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

Knowledge is captured automatically. Knowledge is curated deliberately, with a human in the loop for every change. Consuming the knowledge base requires Node 22+ plus one of the supported AI harnesses: Claude Code, OpenAI Codex CLI, Cursor, OpenCode, or GitHub Copilot CLI. Each harness ships as its own adapter (`src/harnesses/claude/`, `src/harnesses/codex/`, `src/harnesses/cursor/`, `src/harnesses/opencode/`, `src/harnesses/copilot/`); selecting which one a repo uses happens at install time via `--harnesses <id[,id,...]>` and at runtime via the `--harness <id>` global CLI flag. The Claude adapter wires capture on `Stop`, `SessionEnd`, and `PreCompact`; the Codex adapter captures on `Stop` and `PreCompact` (Codex emits no `SessionEnd`, and its hooks require a one-time user trust step inside a Codex session before they run); the Cursor adapter captures on `stop`, `sessionEnd`, and `preCompact`; the OpenCode adapter captures on `session.idle` via a TS plugin shim under `.opencode/plugins/kk.mjs` that `init` registers in `.opencode/opencode.json` (OpenCode loads only declared plugins); the Copilot adapter captures on `sessionEnd` and `agentStop` via a repo-level per-event JSON hook config at `.github/hooks/kk.json` (Copilot loads repo-level hooks before user-level; each command resolves the session repo's own scripts from the session cwd), reading the per-session `events.jsonl` transcript under `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/`. All five harnesses share the same node format, curator, and review surface, so a knowledge base curated under one harness loads correctly under any other.

The builder is deliberately split into two layers: **LLM skills** (`kk-curate`, `kk-bootstrap`, `kk-add`, `kk-migrate`) make the judgment calls - what is worth capturing, how to cluster nodes topically, whether a finding contradicts an existing node - and a layer of **deterministic, LLM-free CLI primitives** (`curate-dedup`, `node write`, `session-log update-proposals`, `place`, `rebalance`, `index rebuild`, `finddocs`) owns every write to disk. The model never writes a file directly; it produces structured plans that the primitives validate and apply. This keeps every mutation auditable, reproducible, and reviewable as a git diff.

## 3. Users

**The contributor** runs AI coding sessions on the repo. Benefits from automatic capture and occasionally curates proposed changes. Can be solo or one of several teammates.

**The consumer** is any teammate who clones the repo and starts an AI session. Gets accumulated knowledge of every prior session, automatically loaded into context. May never run curation themselves.

**The reviewer** approves proposed knowledge base changes. In small teams, usually the same person as the contributor. In larger teams, may be a designated knowledge owner, or knowledge base changes may flow through normal PR review.

## 4. Goals

1. **Persistent project memory.** Knowledge from one session survives into the next, and into sessions run by other teammates.
2. **Truthful as of last curation.** When new sessions contradict old knowledge, the system surfaces the conflict for a human; it doesn't silently overwrite or silently ignore. Drift between captured sessions and the curated knowledge base is bounded by curation cadence, which the contributor controls.
3. **Low setup cost for consumers.** No installation beyond a supported harness and Node 22+. No API keys. No DB. No services.
4. **Low friction for contributors.** Capture is automatic. Curation is one skill invocation, run when convenient.
5. **Reviewable like code.** All knowledge base changes go through git. A reviewer can read a diff, accept some, reject others; the audit trail is the commit history.
6. **Safe by review, not by scanner.** v1 ships **no** automated secret scanner or redaction step. The safeguard against secrets, API keys, or customer data reaching a committed knowledge base file is the same human-in-the-loop git review that gates every other change: capture writes only to a gitignored `_sessions/` staging area, and a human reads every node diff before committing. Teams that want defense in depth wire their own commit-time secret scanner (see [Installation](docs/installation.md)).
7. **Debuggable.** Every LLM-driven step (proposal extraction, curation, bootstrap, migration clustering) writes a verbose stream-json log so contributors can audit what the model saw and what it produced.

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

`practice` and `map` are a **frontmatter facet** (`kind`), not a storage location. Both kinds live side by side in the topical folder tree described in §7; `kind` controls how a node is rendered in an index ("Conventions" vs "Components"), not which directory it lands in.

## 7. Knowledge base structure

The knowledge base is a set of plain markdown files under `.ai/kenkeep/`. Its on-disk shape is governed by a `schema_version` (currently **2**). The reader refuses to load artifacts from an older schema and points the user at migration (see §9.10); there are no compatibility shims or legacy read paths.

**Nodes live in a nested topical folder tree.** Leaves are stored under `nodes/<branch>/.../​<id>.md`, where the file name is the node `id` and `id = <kind>-<slug>` (e.g. `practice-cache-tags-entity-x.md`). Folder placement is **topical**, chosen for where a node belongs conceptually - it is *presentation*. The node `id` is *identity*: cross-references resolve by id and render the node's current path, so a node can be relocated (by migration or rebalance) without breaking any reference to it.

**Every folder carries a generated `index.md`.** Each `index.md` is a deterministic table of contents for that one folder: a breadcrumb, descent pointers to its subfolders, and its own direct leaves split by `kind` ("Conventions" for practice, "Components" for map). An `index.md` may carry an optional one-line `summary` - the single self-preserved, human-or-LLM-authored field on an otherwise fully-regenerated file (see §9.10 and §9.3 for the two sanctioned authoring moments).

**Two root artifacts orient the whole tree:**

- **`ENTRY.md`** - the root launchpad. A catalog of the top-level branches (each with its one-line summary) plus any root-level leaves. This is the file the `SessionStart` hook injects into a new session. It is deliberately *not* the per-folder `index.md` template; it is the whole-tree branch index designed to be small.
- **`GRAPH.md`** - the full cross-tree edge overlay, listing every node's `relates_to`, `depends_on`, and `derived_from` edges by id.

Both root artifacts (and every `index.md`) are regenerated deterministically from the leaf set. A content-addressed `nodes_hash` (sha256 over each leaf's path + file content, excluding generated index files) is stamped into the indexes and drives staleness detection: when the live hash diverges from the recorded one, `doctor` flags it and `index rebuild` regenerates.

**Node frontmatter** (`schema_version: 2`) carries: `id`, `title`, `kind` (`practice` | `map`), `tags`, `derived_from` (session-log or doc provenance), `relates_to` (loose association, by id), `depends_on` (genuine dependency, by id), `confidence`, and `summary`. Both `relates_to` and `depends_on` are rendered in `GRAPH.md` and dangling-checked by `npx kenkeep lint`.

**Retired ids stay resolvable.** When a node's id is retired (only a split-leaf rebalance does this), a JSON ledger at `nodes/.redirects.json` maps the old id to its successor id(s), resolved transitively, so older references and provenance keep working after a reorganization.

## 8. User stories

### As a contributor

> "I want to finish a debugging session and have the gotcha I just learned end up in the knowledge base without me having to write it down."

Capture happens via session-end hooks. After several sessions, a notification at the start of a new session says "you have N pending session logs ready for curation."

> "I want to control when knowledge actually lands in the knowledge base, so I'm not getting noisy commits after every coffee-break session."

The `kk-curate` skill runs the curator on demand. The curator writes nodes directly into the topical tree (`nodes/<branch>/.../​<id>.md`: new files for additions, in-place rewrites for modifications) via the deterministic `curate-dedup` primitive. Nothing lands in the live knowledge base until the contributor reviews the diff with `git` and commits.

> "I want to know when my new finding contradicts something the knowledge base already says, so I can decide which is right."

The curator flags contradictions as a separate category. It does not write conflicting nodes to the tree; instead, for each `contradict` action that carries a proposed node, it writes one markdown file under `.ai/kenkeep/conflicts/<run-id>-<n>.md` (frontmatter: `id`, `status: pending`, `detected_at`, `run_id`, `candidate_origin`, `target_node_id` (nullable), `proposed_kind`, `proposed_title`, `proposed_confidence`; body: `## Rationale` and `## Proposed node`). The kk-curate skill reads every pending file after the curator subprocess exits and walks each conflict with the contributor in-session: existing node side-by-side with the proposed one. The contributor picks Accept (the skill rewrites the existing node from the proposed body, then the contributor `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file, existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history, existing node stands). Conflict-file lifecycle is git-driven; the skill never deletes a conflict file itself.

> "When the curator does something weird, I want to be able to look at exactly what it saw and what it produced."

Every LLM-driven step writes a verbose log file under `_logs/` (gitignored). For each proposal extraction and each curator run, the full stream-json trace is preserved.

> "I just realized something about the project, even though I'm not in a session. I want to add it to the knowledge base now."

Two paths into manual capture: `npx kenkeep node add` from the terminal (which launches the `kk-add` skill in the active harness), or the `kk-add` skill directly from inside a session (the skill guides the agent through kind, title, summary, body, tags, and edges, then writes the node via the deterministic `node write` primitive). Either path writes directly to the topical tree. Acceptance is `git commit`; rejection is `git restore <path>`. Same human-in-the-loop guarantee as session-derived captures, just with git as the review surface instead of a separate staging directory.

> "My project already has a bunch of READMEs, ADRs, and module docs. I don't want to start with an empty knowledge base - I want the knowledge base seeded from what's already documented."

The `kk-bootstrap` skill runs an agent-driven first-time bootstrap inside a normal session. The agent surveys the project's docs directory, reads representative content, follows cross-references between docs, and writes nodes directly to the topical tree with `derived_from` pointing to the actual doc paths. Bootstrap is conservative: it never overwrites an existing node - collisions are skipped and reported. The contributor reviews each new node with `git diff nodes/` and accepts what they want. Bootstrap is a supervised one-off, not an autopilot.

> "I added some new docs after the initial bootstrap. I want them folded into the knowledge base without re-processing everything."

Re-running `kk-bootstrap` (`npx kenkeep bootstrap --from <scope>`) is incremental by construction. It reads a state file (`.ai/kenkeep/.state/bootstrap-state.json`) recording the SHA-256 of each previously-processed source doc, skips unchanged docs (the `finddocs` primitive enumerates candidates and hashes them), and runs chunked extraction only on new or modified ones. Cheap, deterministic, scriptable. Re-runnable safely. (The older `bootstrap-incremental` command name still works as a deprecated alias that delegates to `bootstrap`.)

Both bootstrap and `curate` also consume the active harness's auto-memory files (Claude Code's persisted memories; other adapters return `[]` until their hosts ship the feature). A per-user ledger at `.ai/kenkeep/.state/memory-ledger.json` (gitignored) keeps the second pass cheap by skipping unchanged files.

### As a consumer

> "I clone the repo and start an AI session. I want the AI to already know what my teammates have learned."

A `SessionStart` hook injects the current `ENTRY.md` (the root branch catalog) into the session.

> "I want the AI to load the right knowledge for the task I'm doing, not all of it at once."

Progressive disclosure. The injection is the root catalog only - the branch list with summaries, not every node - typically a few hundred to a couple thousand tokens. The AI descends into branch `index.md` files and reads individual nodes only when relevant.

> "I should be able to read the knowledge base as a human, not just have it consumed by the AI."

Plain markdown. Browse in any editor or on the GitHub web UI.

### As a reviewer

> "I want to see proposed knowledge base changes the same way I see code changes."

Proposed knowledge base changes *are* code changes. Skills and the curator's deterministic primitives write directly to `nodes/<branch>/.../​<id>.md`; the reviewer inspects with `git diff nodes/`, accepts with `git commit`, and rejects with `git restore <path>`. The curator regenerates `ENTRY.md`/`GRAPH.md`/per-folder `index.md` at the end of every run, and `npx kenkeep index rebuild` does the same on demand. Teams that want commit-time regeneration wire it into their own pre-commit hook (this repo's `.lintstagedrc.cjs` is the dogfood example). knowledge base commits can land as a dedicated PR with a `[kk]` prefix (recommended for shared repos with formal review) or bundled with the code change that motivated them (recommended for solo contributors). The system does not enforce either workflow.

> "I want to know which session a piece of knowledge came from."

Every node carries a `derived_from` list pointing to session log filenames (or, for bootstrapped nodes, source doc paths). **Caveat:** session logs are gitignored by default - provenance only works for the original contributor unless the team commits `_sessions/`. If reviewers other than the original contributor need to verify provenance, the team removes `_sessions/` from `.gitignore`. Documented as an explicit setup decision with the trade-off (more repo bloat, full audit trail).

## 9. Key workflows

### 9.1 First-time setup

1. A contributor runs `npx <pkg> init --harnesses <id[,id,...]>` (e.g. `claude`, or `codex,cursor,opencode,copilot`). `--harnesses` is required.
2. The installer creates `.ai/kenkeep/` with starter structure (including `_logs/` and `_sessions/` both gitignored), registers hooks for each selected harness, installs the `kk-add`, `kk-bootstrap`, `kk-curate`, and `kk-migrate` skills, writes `.ai/kenkeep/.state/installed-version`, seeds an empty `.ai/kenkeep/config.yaml` for project-level tunables, copies local prompt overrides into `.ai/kenkeep/.config/prompts/`, and adds a managed `.ai/kenkeep/.gitignore` block. It does **not** install husky, lint-staged, secretlint, commitlint, or any other commit-time tooling in the consuming repo. Teams that want a commit-time secret scanner or a commit-message linter wire those up themselves (see [Installation](docs/installation.md)). Re-running with `init --upgrade` refreshes templates and skills while preserving `config.yaml` and local prompt overrides.
3. The contributor commits. knowledge base is live but empty.

### 9.2 Daily session capture (automatic)

1. The contributor runs an AI session as normal.
2. When the session ends - or when context compaction is about to fire - a hook captures a slice of the transcript into `.ai/kenkeep/_sessions/`, marked pending for proposal extraction. (Capture writes the slice as-is to the gitignored staging area; there is no automated redaction - see Goal 6. The one exception is explicit user marking: text wrapped in `<kk-private>…</kk-private>` during the session is stripped before the slice is written.)
3. Proposal extraction turns each pending session log into structured `practice`/`map` candidates. For the Codex, Cursor, OpenCode, and Copilot adapters this runs in the background on the next session start (the `kk-proposal-drain` hook spawns the harness's headless binary, without blocking the session). OpenCode uses its plugin's async dispatch; Codex, Cursor, and Copilot have no native async hook support and instead route through the canonical async launcher (`src/lib/async-launcher.ts`), which detaches the worker into its own process group before any host-dependent operation so a host stdin-hold or hook timeout cannot block or kill it — the same launcher the long-running `kk-lint-tick` hook uses on those three adapters (see [Hooks internals](docs/internals/hooks.md)). For the Claude adapter the drain hook is intentionally a no-op: proposals are extracted inline at the start of a `kk-curate` run instead. Either way the run's stream-json trace lands in `_logs/proposal/`.
4. Capture is silent on success.

### 9.3 Curation (deliberate)

1. After enough session logs accumulate (default `curationThreshold` = 20; configurable per project), a nudge appears at session start: "You have N pending session logs. Invoke the `kk-curate` skill when ready." Throttled to at most once per hour.
2. The contributor invokes the `kk-curate` skill. The skill reads pending logs and current knowledge base nodes (extracting proposals inline first when running under Claude), drafts curator actions (`add` / `modify` / `contradict` / `drop`), and hands them to the deterministic `curate-dedup` primitive, which applies them: new files for `add` actions, in-place rewrites for `modify` actions, and one conflict file per `contradict` action (with a proposed node) under `.ai/kenkeep/conflicts/`. The skill then regenerates `ENTRY.md`/`GRAPH.md`/`index.md` via `index rebuild` and writes its stream-json trace to `_logs/curator/`.
3. **Rebalance (final phase of curation).** The skill runs `rebalance trigger` - a deterministic, hysteresis-gated check over per-folder metrics that decides whether to split an over-full folder, split an over-large multi-concept leaf, merge an under-full branch, or promote a homeless root leaf into its own branch. If it fires, the skill clusters the affected nodes (the only LLM judgment in this phase), then `rebalance move` applies the plan as content-stable git renames (a split-leaf mints new ids and records redirects), and the index is rebuilt. A folder created or split here gets a one-line `summary` authored at this moment.
4. The kk-curate skill reads every pending file under `.ai/kenkeep/conflicts/` and walks each conflict with the contributor in-session. The contributor picks Accept (the skill rewrites the target node from the proposed body, the contributor then `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file, existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history).
5. The reviewer inspects all changes with `git diff nodes/`, accepts with `git commit`, and rejects unwanted changes with `git restore <path>`. INDEX/GRAPH are already aligned by the curator at end-of-run; `npx kenkeep index rebuild` realigns them if a reviewer hand-edits a node afterwards.

### 9.4 Consuming the knowledge base

1. A teammate clones the repo and starts an AI session.
2. A `SessionStart` hook injects the current `ENTRY.md`. Delivery differs per harness: Claude and Cursor inject it as session context directly; OpenCode writes it to `.opencode/AGENTS.md`, which `init` registers in the config `instructions` array so the host loads it natively; Copilot writes it into a managed sentinel block in `.github/copilot-instructions.md`. Independent of hooks, `init` and `index rebuild` maintain a pointer block in the repo's `AGENTS.md` so agents-file surfaces (and humans browsing the repo) always have an entry into the knowledge base.
3. The AI descends into branch `index.md` files and reads individual nodes on demand via standard file-reading tools.
4. The teammate does not need the builder tool installed.

### 9.5 Handling contradictions

1. During curation, the curator detects that a new session log conflicts with an existing node.
2. For each such `contradict` action carrying a proposed node, the `curate-dedup` primitive writes one markdown file under `.ai/kenkeep/conflicts/<run-id>-<n>.md` (frontmatter: `id`, `status: pending`, `detected_at`, `run_id`, `candidate_origin`, `target_node_id` (nullable), `proposed_kind`, `proposed_title`, `proposed_confidence`; body: `## Rationale` plus `## Proposed node`). It does **not** write the conflicting node to the tree.
3. The kk-curate skill reads every pending file after the curator subprocess exits and presents each conflict in-session (existing node side-by-side with the proposed one). The contributor picks Accept (the skill rewrites the existing node from the proposed body; the contributor then `git restore`s the conflict file), Reject (the contributor `git restore`s the conflict file; the existing node stands), or Keep as record (the contributor `git commit`s the conflict file as durable history; the existing node stands).
4. The reviewer commits the resulting change. Old node state is preserved in git history; conflict files committed as Keep as record remain under `.ai/kenkeep/conflicts/` as permanent annotations the curator can read for context on future runs.

### 9.6 First-time bootstrap from existing docs (optional, one-off)

1. The contributor invokes the `kk-bootstrap` skill inside a normal session, optionally passing a path scope (defaults to common doc locations like `docs/`, `README.md`, top-level `*.md` files).
2. The agent surveys the directory structure, reads representative content, follows cross-references, identifies candidate practice and map nodes, and writes them directly to the topical tree. Each node carries `derived_from: [<doc-path>]`. Bootstrap is conservative: existing nodes are never overwritten; collisions are skipped and reported.
3. The agent updates `bootstrap-state.json` with content hashes of every doc it read.
4. The contributor reviews the new nodes with `git diff nodes/` and commits the ones they want; `git restore` discards the rest.

The contributor can supervise and intervene mid-session if the agent goes off track. This is a one-time, judgment-heavy operation - running it once is the expected case.

### 9.7 Incremental bootstrap (later updates)

1. The team adds new docs (a new ADR, a fresh module README) or significantly revises existing ones.
2. The contributor re-invokes `kk-bootstrap` (`npx kenkeep bootstrap --from docs/`).
3. The skill reads `bootstrap-state.json`, hashes every candidate file under `--from` (via the `finddocs --with-hashes` primitive), skips files whose hash is unchanged, and runs chunked extraction on the rest.
4. New nodes are written directly to the topical tree. Existing-node collisions are skipped (and counted in the run summary). The state file is updated.
5. The contributor reviews with `git diff nodes/` and commits.

Incremental bootstrap is deterministic, fast, and safe to re-run. It does not attempt to detect overlap with existing accepted nodes via curator-style modify/contradict logic - if an extracted candidate would collide with an existing node, the new candidate is dropped and reported, not merged.

### 9.8 Debugging an LLM run

1. The proposal worker produced something odd, or the curator missed a contradiction the contributor expected to see.
2. The contributor opens the relevant log in `.ai/kenkeep/_logs/proposal/<session-id>-<timestamp>.jsonl` or `_logs/curator/<run-id>-<timestamp>.jsonl`.
3. Each line is a stream-json message: prompt, assistant text, tool calls, final result. The contributor inspects what the model saw and produced.
4. If a prompt change is needed, the contributor reports the issue or edits the local prompt override under `.ai/kenkeep/.config/prompts/` (or `templates/prompts/...` in the package).

### 9.9 Tunables and log retention

Operational defaults can be overridden per project via a committed `.ai/kenkeep/config.yaml`:

- `curationThreshold` (default **20**) - pending logs before the curation nudge fires.
- `logsRetentionDays` (default **30**) - age cutoff for `logs prune`.
- `lintEveryNSessions` (default **50**) - how often the periodic content-health lint runs (see §9.11).
- `proposalModel` / `curatorModel` / `bootstrapModel` - optional per-harness model + effort overrides for each LLM step.
- `cliDefaultHarness` - the harness used when a bare `npx kenkeep <cmd>` runs outside any assistant session (skills and hooks auto-detect their host and ignore this; only the plain-shell fallback consults it). Omitted by default, so repos fall back to the first registered harness (`claude`).

The schema is strict: unknown keys or malformed YAML cause a hard error naming the offending file. (Note: the curation lock's 30-minute stale timeout - see §10 - is a fixed constant, not a `config.yaml` tunable.)

`_logs/` grows unbounded by design (full stream-json traces are the audit trail). `npx kenkeep logs prune` walks `_logs/` recursively and deletes `*.jsonl` files older than `settings.logsRetentionDays` (default 30).

### 9.10 Schema migration

The knowledge base carries a `schema_version`. When the on-disk version lags the package's current version (now **2**), the node reader, `doctor`, and `init` refuse to operate on stale artifacts and point the user at the `kk-migrate` skill. Migration is a real, supported capability - **not** a CLI one-liner and not autonomous; it requires an interactive agent session because one step needs LLM judgment.

The split mirrors the rest of the builder:

- `npx kenkeep migrate status` is a deterministic, LLM-free **dispatcher**. It detects the on-disk version and emits the ordered chain of pending migration steps as a single JSON line. It never executes a step.
- The `kk-migrate` skill drives each step in-host. For the v1→v2 step (flat two-bucket `nodes/practice/` + `nodes/map/` layout → nested topical tree), it runs `place inventory` (which emits the flat leaves as JSON), performs the topical clustering itself (the one LLM judgment), then `place apply` (a deterministic primitive that relocates leaves id- and byte-stable and stamps the new folders' summaries), then `index rebuild`.

Migration is a **clean break**: there are no compatibility shims, no dual-read paths, and no in-place "best effort" reads of an old shape. `schema_version` both fails loudly on an incompatible read *and* drives the migrator that bridges the gap. Node ids and file bytes are preserved across the move, so provenance and cross-references survive.

### 9.11 Periodic content-health lint

A `kk-lint-tick` hook rides each harness's session-boundary event. Most fires only increment a counter; every `lintEveryNSessions`-th fire (default 50) actually runs `npx kenkeep lint` over the tree - checking for dangling `relates_to`/`depends_on`/`derived_from` edges, slug/id mismatches, duplicate tags, orphan nodes, and a missing or dangling `AGENTS.md` pointer block - and records the result. The next `SessionStart` surfaces a stale-lint summary as a nudge. `npx kenkeep lint` can also be run on demand.

### 9.12 Usage instrumentation

At capture time the builder appends to a gitignored ledger at `.ai/kenkeep/.state/usage.jsonl`, recording which knowledge base documents were read during the captured session (a leaf's node id, or a branch `index.md`'s path). This is **write-only instrumentation today** - no decision logic consumes it yet. It is reserved as a future signal for pruning, rebalance, or curation prioritization, and is captured now so the data exists when those features are built.

## 10. Failure modes the user sees

| Failure | What the user sees |
|---|---|
| Transcript capture fails (empty/unreadable transcript, disk full) | Session log not written. Brief warning at next session start. Session content is lost; user can paste relevant parts manually. |
| Proposal extraction fails (CLI error, rate limit) | Session log retained as `proposal_status: failed`. Visible in `npx kenkeep status`. Curator retries on next run. Full log under `_logs/proposal/` for diagnosis. |
| `SessionStart` hook fails | Session starts without knowledge base context. Single-line warning in transcript. The session works, just without injection. |
| `ENTRY.md`/`GRAPH.md` stale (someone hand-edited a node) | `npx kenkeep doctor` flags it (the recorded `nodes_hash` no longer matches the leaf set). Run `npx kenkeep index rebuild` to refresh. |
| Knowledge base is at an older `schema_version` | The reader, `doctor`, or `init` refuses and points at the `kk-migrate` skill. Run it to migrate (see §9.10). |
| Two contributors invoke `kk-curate` simultaneously | Second invocation aborts with "curation already in progress." Cleared by a fixed 30-minute stale-lock timeout. |
| `derived_from` references a missing session log | Silent ignore in consume path. `npx kenkeep doctor --verbose` warns. Curator treats as "evidence not available" and proceeds. |

## 11. Success criteria

The system is working if, after three months of use on a real project:

- **Capture quality:** ≥80% of curator-proposed additions are accepted on first review. (Lower means the proposal prompt is over-capturing.)
- **Curation cadence:** P50 curation session takes under 10 minutes for 10 pending logs.
- **Drift bounded:** No more than one week between curation runs in active development.
- **Zero secret incidents:** No secret has appeared in a committed knowledge base file. (The guard is human review of every diff before commit - see Goal 6 - not an automated scanner.)
- **Recall improves:** Contributors stop re-explaining the same project context to new sessions.
- **Knowledge evolves correctly:** When project decisions change, the knowledge base reflects the new state without losing the historical record.

## 12. Out of scope for v1

- Cross-repo knowledge sharing.
- Web UI for browsing or editing the knowledge base.
- Integration with project management tools (Jira, Linear).
- Active learning loops where the AI proactively asks "should I save this?" mid-session.
- Anything that requires running infrastructure.
- Automated secret scanning / redaction of captured transcripts (the human git-review gate is the v1 safeguard - see Goal 6).
- Consuming `usage.jsonl` for any automated decision (pruning, rebalance signals, curation prioritization) - the data is captured but not yet acted on (see §9.12).

## 13. Open questions deferred to implementation or v2

- For very large KBs, should the index injection be filtered by current task, or is the branch-bounded `ENTRY.md` sufficient? (Defer; decide based on real usage.)
- Should incremental bootstrap detect overlap with existing accepted nodes (curator-style modify/contradict logic) instead of always producing additions? (Deferred; v1 produces additions only and relies on the reviewer to catch duplicates.)
- Should `usage.jsonl` graduate from instrumentation to an input for pruning/rebalance/curation prioritization, and on what policy? (Deferred until there is enough real usage data to design against.)
