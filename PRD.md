# PRD - Project Knowledge Base for AI Coding Sessions

## 1. Problem

Working with an AI coding assistant on a real software project produces a steady stream of valuable knowledge: project conventions, prohibitions ("don't use the default cache tags here"), gotchas about a third-party API, names and locations of internal modules, things the human had to teach the agent before it would do something correctly, and rationale for why a current approach exists. Today, almost all of that knowledge evaporates when the session ends.

The mainstream answers - a hand-curated `CLAUDE.md`, sticky-note files, "remember this" prompts - break down in three ways:

- **They don't scale.** A single memory file becomes either too sparse to help or too noisy to load every session.
- **They don't evolve.** When a decision is reversed or a convention updated, the old text quietly misleads future sessions.
- **They're solo artifacts.** Knowledge captured by one developer doesn't reach the rest of the team, even on the same repo.

We need a system where AI sessions actively contribute to a shared, project-specific knowledge base that grows, gets corrected, and gets re-loaded on demand - without the developer having to remember to do anything ceremonial.

## 2. Solution overview

Two cooperating pieces:

- **A builder tool** (installed once per repo, used by anyone running AI sessions) that watches sessions, extracts candidate knowledge, and proposes changes to the knowledge base for human review.
- **A knowledge base** (lives inside the repo as plain markdown files) that any teammate gets when they clone the repo, and that the AI can navigate progressively during their own sessions.

Knowledge is captured automatically. Knowledge is curated deliberately, with a human in the loop for every change. Consuming the knowledge base requires Node 22+ plus one of the supported AI harnesses: Claude Code, OpenAI Codex CLI, Cursor, OpenCode, or GitHub Copilot CLI. Each harness ships as its own adapter (`src/harnesses/claude/`, `src/harnesses/codex/`, `src/harnesses/cursor/`, `src/harnesses/opencode/`, `src/harnesses/copilot/`); selecting which one a repo uses happens at install time via `--harnesses <id[,id,...]>` and at runtime via the `--harness <id>` global CLI flag. The Claude adapter wires capture on `Stop`, `SessionEnd`, and `PreCompact`; the Codex adapter captures on `Stop` only (Codex does not emit `SessionEnd` or `PreCompact`); the Cursor adapter captures on `stop`, `sessionEnd`, and `preCompact`; the OpenCode adapter captures on `session.idle` via a TS plugin shim under `.opencode/plugins/kk.mjs` that subscribes to the OpenCode runtime event bus; the Copilot adapter captures on `sessionEnd` and `agentStop` via a per-event JSON hook config at `~/.copilot/hooks/kk.json`, reading the per-session `events.jsonl` transcript under `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/`. All five harnesses share the same node format, curator, and review surface, so a knowledge base curated under one harness loads correctly under any other.

## 3. Users

**The contributor** runs AI coding sessions on the repo. Benefits from automatic capture and occasionally curates proposed changes. Can be solo or one of several teammates.

**The consumer** is any teammate who clones the repo and starts an AI session. Gets accumulated knowledge of every prior session, automatically loaded into context. May never run curation themselves.

**The reviewer** approves proposed knowledge base changes. In small teams, usually the same person as the contributor. In larger teams, may be a designated knowledge owner, or knowledge base changes may flow through normal PR review.

## 4. Goals

1. **Persistent project memory.** Knowledge from one session survives into the next, and into sessions run by other teammates.
2. **Truthful as of last curation.** When new sessions contradict old knowledge, the system surfaces the conflict for a human; it doesn't silently overwrite or silently ignore. Drift between captured sessions and the curated knowledge base is bounded by curation cadence, which the contributor controls.
3. **Low setup cost for consumers.** No installation beyond Claude Code and Node 22+. No API keys. No DB. No services.
4. **Low friction for contributors.** Capture is automatic. Curation is one skill invocation, run when convenient.
5. **Reviewable like code.** All knowledge base changes go through git. A reviewer can read a diff, accept some, reject others; the audit trail is the commit history.
6. **Safe by default.** No secrets, API keys, customer data, or other sensitive content ever lands in the knowledge base.
7. **Debuggable.** Every LLM-driven step (proposal extraction, curation) writes a verbose stream-json log so contributors can audit what the model saw and what it produced.

## 5. Non-goals

- **Not a cross-project memory system.** Each repo has its own knowledge base.
- **Not a real-time team sync.** Propagation is via git pull.
- **Not a vector database or semantic search engine.** Plain markdown navigated with normal file-reading tools.
- **Not a replacement for documentation.** ADRs, READMEs, and inline comments still belong where they belong. The knowledge base captures the AI-session-derived layer.
- **Not autonomous.** The system never modifies the knowledge base without human approval.

## 6. What counts as knowledge

This scope is critical to signal-to-noise. The system captures two broad kinds:

**"How we build things" (practice nodes):**
- **Conventions:** "When adding schema.org metadata, use the custom event setup in `modules/custom/<name>`."
- **Prohibitions:** "Don't use the default cache tags for entity X - they break invalidation."
- **Gotchas:** Finicky third-party integration details, race conditions, brittle config.
- **Decision rationale:** Why a current approach exists, especially when non-obvious. "We use approach X because Y didn't handle the multilingual case."
- **Tooling and workflow:** "Tests run with `vendor/bin/phpunit ...`."

**"What exists in the project" (map nodes):**
- **Features and architecture:** New systems being built, what they do, where their seams are.
- **Vocabulary:** Project-specific terms ("Bravo Insider = personalized section on the platform"), internal module names, custom entity names.
- **Locations:** Where major systems live in the file tree.

The system explicitly does **not** capture:

- Code the agent wrote that just worked the first time without human correction.
- Bug fixes for typos, syntax errors, or generic mistakes.
- File reads, greps, or exploration the agent did to understand existing code.
- Refactors that didn't change architecture or convention.
- Anything the agent could derive from general programming knowledge or by reading the codebase.
- Routine completions where no teaching moment occurred.

The signal for capture is: **did the human have to teach the agent something the agent couldn't have known from the codebase alone, or did the human introduce something new to the project that didn't exist before?** Everything else is noise.

## 7. User stories

### As a contributor

> "I want to finish a debugging session and have the gotcha I just learned end up in the knowledge base without me having to write it down."

Capture happens via session-end hooks. After several sessions, a notification at the start of a new session says "you have N pending session logs ready for curation."

> "I want to control when knowledge actually lands in the knowledge base, so I'm not getting noisy commits after every coffee-break session."

The `kk-curate` Claude Code skill runs the curator on demand. The curator writes nodes directly into `nodes/<kind>/<slug>.md` (new files for additions, in-place rewrites for modifications). Nothing lands in the live knowledge base until the contributor reviews the diff with `git` and commits.

> "I want to know when my new finding contradicts something the knowledge base already says, so I can decide which is right."

The curator flags contradictions as a separate category. It does not write conflicting nodes to disk; instead, it writes one markdown file per conflict under `.ai/kenkeep/conflicts/<run-id>-<n>.md` (frontmatter carries `status: pending`, `target_node_id`, `proposed_kind`, `proposed_title`, `candidate_origin`, `run_id`, `detected_at`; body has `## Rationale` and `## Proposed node` sections). The kk-curate skill reads every pending file after the curator subprocess exits and walks each conflict with the contributor in-session: existing node side-by-side with the proposed one. The contributor picks Accept (the skill rewrites the existing node from the proposed body, then the contributor `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file, existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history, existing node stands). Conflict-file lifecycle is git-driven; the skill never deletes a conflict file itself.

> "I never want a session containing a database password to leak into a committed file."

A deterministic secret scanner (secretlint with the recommended preset) runs on every session log before it is written; findings are replaced inline with `[REDACTED:<rule>]` and the session log is aborted if the scanner crashes. The package does not install a commit-time secret scanner in the consuming repo; teams that want defense in depth run secretlint in CI (a sample workflow ships in the README) or wire their own pre-commit hook, see [Installation](docs/installation.md).

> "When the curator does something weird, I want to be able to look at exactly what it saw and what it produced."

Every LLM-driven step writes a verbose log file under `_logs/` (gitignored). For each proposal extraction and each curator run, the full stream-json trace is preserved.

> "I just realized something about the project, even though I'm not in a session. I want to add it to the knowledge base now."

Two paths into manual capture: `npx kenkeep node add` from the terminal (interactive prompts collect kind, title, summary, body, tags), or the `kk-add` Claude Code skill from inside a session (the skill guides the agent through the same fields and writes a node). Either path writes directly to `nodes/<kind>/<slug>.md`. Acceptance is `git commit`; rejection is `git restore <path>`. Same human-in-the-loop guarantee as session-derived captures, just with git as the review surface instead of a separate staging directory.

> "My project already has a bunch of READMEs, ADRs, and module docs. I don't want to start with an empty knowledge base - I want the knowledge base seeded from what's already documented."

The `kk-bootstrap` Claude Code skill runs an agent-driven first-time bootstrap inside a normal session. The agent surveys the project's docs directory, reads representative content, follows cross-references between docs, and writes nodes directly to `nodes/<kind>/<slug>.md` with `derived_from` pointing to the actual doc paths. Bootstrap is conservative: it never overwrites an existing node - collisions are skipped and reported. The contributor reviews each new node with `git diff nodes/` and accepts what they want. Bootstrap is a supervised one-off, not an autopilot.

> "I added some new docs after the initial bootstrap. I want them folded into the knowledge base without re-processing everything."

`npx kenkeep bootstrap-incremental --from <path>` is a CLI tool for re-bootstrap. It reads a state file recording the SHA-256 of each previously-processed source doc, skips unchanged docs, and runs chunked extraction only on new or modified ones. Cheap, deterministic, scriptable. Re-runnable safely.

Both `bootstrap-incremental` and `curate` also consume the active harness's auto-memory files (Claude Code's persisted memories; other adapters return `[]` until their hosts ship the feature). Memory files reach the LLM only after passing through the same secretlint redaction gate as session capture, and a per-user ledger at `.ai/kenkeep/.state/memory-ledger.json` (gitignored) keeps the second pass cheap by skipping unchanged files.

### As a consumer

> "I clone the repo and start an AI session. I want the AI to already know what my teammates have learned."

A `SessionStart` hook injects a token-budgeted index of the knowledge base into the session.

> "I want the AI to load the right knowledge for the task I'm doing, not all of it at once."

Progressive disclosure. The injection is the index only - typically a few hundred to two thousand tokens. The AI reads individual nodes only when relevant.

> "I should be able to read the knowledge base as a human, not just have it consumed by the AI."

Plain markdown. Browse in any editor or on the GitHub web UI.

### As a reviewer

> "I want to see proposed knowledge base changes the same way I see code changes."

Proposed knowledge base changes *are* code changes. Skills and the curator write directly to `nodes/<kind>/<slug>.md`; the reviewer inspects with `git diff nodes/`, accepts with `git commit`, and rejects with `git restore <path>`. The curator regenerates `ENTRY.md`/`GRAPH.md` at the end of every run, and `npx kenkeep index rebuild` does the same on demand. Teams that want commit-time regeneration wire it into their own pre-commit hook (this repo's `.lintstagedrc.cjs` is the dogfood example). knowledge base commits can land as a dedicated PR with a `[kk]` prefix (recommended for shared repos with formal review) or bundled with the code change that motivated them (recommended for solo contributors). The system does not enforce either workflow.

> "I want to know which session a piece of knowledge came from."

Every node carries a `derived_from` list pointing to session log filenames. **Caveat:** session logs are gitignored by default - provenance only works for the original contributor unless the team commits `_sessions/`. If reviewers other than the original contributor need to verify provenance, the team removes `_sessions/` from `.gitignore`. Documented as an explicit setup decision with the trade-off (more repo bloat, full audit trail).

## 8. Key workflows

### 8.1 First-time setup

1. A contributor runs `npx <pkg> init --assistants claude`.
2. The installer creates `.ai/kenkeep/` with starter structure (including `_logs/` and `_sessions/` both gitignored), registers hooks under `.claude/`, installs the `kk-add`, `kk-bootstrap`, and `kk-curate` Claude Code skills, writes `.ai/kenkeep/.state/installed-version`, seeds an empty `.ai/kenkeep/config.yaml` for project-level tunables, copies local prompt overrides into `.ai/kenkeep/.config/prompts/`, and adds a managed `.gitignore` block. It does **not** install husky, lint-staged, secretlint, commitlint, or any other commit-time tooling in the consuming repo. Teams that want a commit-time secret scanner or a commit-message linter wire those up themselves (see [Installation](docs/installation.md)). Re-running with `init --upgrade` refreshes templates and skills while preserving `config.yaml` and local prompt overrides.
3. The contributor commits. knowledge base is live but empty.

### 8.2 Daily session capture (automatic)

1. The contributor runs an AI session as normal.
2. When the session ends - or when context compaction is about to fire - a hook captures a redacted slice of the transcript into `.ai/kenkeep/_sessions/`, marked pending for proposal extraction.
3. Proposal extraction runs in the background on the next session start, without blocking it. Results land in the session log; the run's stream-json trace lands in `_logs/proposal/`.
4. Capture is silent on success.

### 8.3 Curation (deliberate)

1. After enough session logs accumulate (default `curationThreshold` = 5; configurable per project), a nudge appears at session start: "You have 7 pending session logs. Invoke the `kk-curate` skill when ready." Throttled to at most once per hour.
2. The contributor invokes the `kk-curate` skill. The curator reads pending logs and current knowledge base nodes, then applies its decisions directly to `nodes/`: new files for `add` actions, in-place rewrites for `modify` actions. `contradict` actions are written as one markdown file per conflict under `.ai/kenkeep/conflicts/<run-id>-<n>.md` instead of writing the conflicting node to `nodes/`. The curator regenerates `ENTRY.md`/`GRAPH.md` inline and writes its stream-json trace to `_logs/curator/`.
3. The kk-curate skill reads every pending file under `.ai/kenkeep/conflicts/` and walks each conflict with the contributor in-session. The contributor picks Accept (the skill rewrites the target node from the proposed body, the contributor then `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file, existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history).
4. The reviewer inspects all changes with `git diff nodes/`, accepts with `git commit`, and rejects unwanted changes with `git restore <path>`. INDEX/GRAPH are already aligned by the curator at end-of-run; `npx kenkeep index rebuild` realigns them if a reviewer hand-edits a node afterwards.

### 8.4 Consuming the knowledge base

1. A teammate clones the repo and starts an AI session.
2. A `SessionStart` hook injects the current `ENTRY.md`.
3. The AI reads individual nodes on demand via standard file-reading tools.
4. The teammate does not need the builder tool installed.

### 8.5 Handling contradictions

1. During curation, the curator detects that a new session log conflicts with an existing node.
2. The curator writes one markdown file per conflict under `.ai/kenkeep/conflicts/<run-id>-<n>.md` (frontmatter: `status: pending`, `target_node_id`, `proposed_kind`, `proposed_title`, `candidate_origin`, `run_id`, `detected_at`; body: `## Rationale` plus `## Proposed node`). It does **not** write the conflicting node to `nodes/`.
3. The kk-curate skill reads every pending file after the curator subprocess exits and presents each conflict in-session (existing node side-by-side with the proposed one). The contributor picks Accept (the skill rewrites the existing node from the proposed body; the contributor then `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file; the existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history; the existing node stands).
4. The reviewer commits the resulting change. Old node state is preserved in git history; conflict files committed as Keep as record remain under `.ai/kenkeep/conflicts/` as permanent annotations the curator can read for context on future runs.

### 8.6 First-time bootstrap from existing docs (optional, one-off)

1. The contributor invokes the `kk-bootstrap` skill inside a normal Claude Code session, optionally passing a path argument (defaults to common doc locations like `docs/`, `README.md`, top-level `*.md` files).
2. The agent surveys the directory structure, reads representative content, follows cross-references, identifies candidate practice and map nodes, and writes them directly to `nodes/<kind>/<slug>.md`. Each node carries `derived_from: [<doc-path>]`. Bootstrap is conservative: existing nodes are never overwritten; collisions are skipped and reported.
3. The agent updates `bootstrap-state.json` with content hashes of every doc it read.
4. The contributor reviews the new nodes with `git diff nodes/` and commits the ones they want; `git restore` discards the rest.

The contributor can supervise and intervene mid-session if the agent goes off track. This is a one-time, judgment-heavy operation - running it once is the expected case.

### 8.7 Incremental bootstrap (later updates)

1. The team adds new docs (a new ADR, a fresh module README) or significantly revises existing ones.
2. The contributor runs `npx kenkeep bootstrap-incremental --from docs/`.
3. The CLI reads `bootstrap-state.json`, hashes every file under `--from`, skips files whose hash is unchanged, and runs chunked extraction on the rest.
4. New nodes are written directly to `nodes/<kind>/<slug>.md`. Existing-node collisions are skipped (and counted in the run summary). The state file is updated.
5. The contributor reviews with `git diff nodes/` and commits.

Incremental bootstrap is deterministic, fast, and safe to re-run. It does not attempt to detect overlap with existing accepted nodes via curator-style modify/contradict logic - if an extracted candidate would collide with an existing node, the new candidate is dropped and reported, not merged.

### 8.8 Debugging an LLM run

1. The proposal worker produced something odd, or the curator missed a contradiction the contributor expected to see.
2. The contributor opens the relevant log in `.ai/kenkeep/_logs/proposal/<session-id>-<timestamp>.jsonl` or `_logs/curator/<run-id>-<timestamp>.jsonl`.
3. Each line is a stream-json message: prompt, assistant text, tool calls, final result. The contributor inspects what the model saw and produced.
4. If a prompt change is needed, the contributor reports the issue or edits `templates/prompts/...` in the package.

### 8.9 Tunables and log retention

Operational defaults (curation threshold, log retention window, lint cadence, plus optional `proposalModel` / `curatorModel` / `bootstrapModel` overrides) can be overridden per project via a committed `.ai/kenkeep/config.yaml`. The schema is strict: unknown keys or malformed YAML cause a hard error naming the offending file.

`_logs/` grows unbounded by design (full stream-json traces are the audit trail). `npx kenkeep logs prune` walks `_logs/` recursively and deletes `*.jsonl` files older than `settings.logsRetentionDays` (default 30).

## 9. Failure modes the user sees

| Failure | What the user sees |
|---|---|
| Transcript capture fails (secretlint crashes, disk full) | Session log not written. Brief warning at next session start. Session content is lost; user can paste relevant parts manually. |
| Proposal extraction fails (CLI error, rate limit) | Session log retained as `proposal_status: failed`. Visible in `npx kenkeep status`. Curator retries on next run. Full log under `_logs/proposal/` for diagnosis. |
| `SessionStart` hook fails | Session starts without knowledge base context. Single-line warning in transcript. The session works, just without injection. |
| `ENTRY.md` stale (someone hand-edited a node) | `npx kenkeep doctor` flags it. Run `npx kenkeep index rebuild` to refresh. |
| Two contributors invoke `kk-curate` simultaneously | Second invocation aborts with "curation already in progress, started 4 minutes ago." Cleared by lock TTL (default 30 minutes, configurable). |
| `derived_from` references a missing session log | Silent ignore in consume path. `npx kenkeep doctor --verbose` warns. Curator treats as "evidence not available" and proceeds. |

## 10. Success criteria

The system is working if, after three months of use on a real project:

- **Capture quality:** ≥80% of curator-proposed additions are accepted on first review. (Lower means the proposal prompt is over-capturing.)
- **Curation cadence:** P50 curation session takes under 10 minutes for 10 pending logs.
- **Drift bounded:** No more than one week between curation runs in active development.
- **Zero secret incidents:** No secret has ever appeared in a committed knowledge base file.
- **Recall improves:** Contributors stop re-explaining the same project context to new sessions.
- **Knowledge evolves correctly:** When project decisions change, the knowledge base reflects the new state without losing the historical record.

## 11. Out of scope for v1

- Cross-repo knowledge sharing.
- Web UI for browsing or editing the knowledge base.
- Integration with project management tools (Jira, Linear).
- Active learning loops where the AI proactively asks "should I save this?" mid-session.
- Anything that requires running infrastructure.

## 12. Open questions deferred to implementation or v2

- For very large KBs, should the index injection be filtered by current task, or is the token budget alone sufficient? (Defer; decide based on real usage.)
- Schema migration tooling. **Out of scope, permanently.** `schema_version` exists to *fail loudly* on incompatible reads, not to feed a migrator. Breaking changes use a clean break - readers reject older shapes with a clear error directing users to re-init. No migrators, no compatibility shims, no legacy code paths ship in any version.
- Whether incremental bootstrap should detect overlap with existing accepted nodes (curator-style modify/contradict logic) instead of always producing additions. (Deferred; v1 produces additions only and relies on the reviewer to catch duplicates.)
