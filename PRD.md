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

Knowledge is captured automatically. Knowledge is curated deliberately, with a human in the loop for every change. Consuming the knowledge base requires Node 22+ plus one of the supported AI harnesses: Claude Code, OpenAI Codex CLI, Cursor, OpenCode, or GitHub Copilot CLI. Each harness ships as its own adapter (`src/harnesses/claude/`, `src/harnesses/codex/`, `src/harnesses/cursor/`, `src/harnesses/opencode/`, `src/harnesses/copilot/`); selecting which one a repo uses happens at install time via `--harnesses <id[,id,...]>` and at runtime via the `--harness <id>` global CLI flag. The Claude adapter wires capture on `Stop`, `SessionEnd`, and `PreCompact`; the Codex adapter captures on `Stop` and `PreCompact` (Codex emits no `SessionEnd`, and its hooks require a one-time user trust step inside a Codex session before they run); the Cursor adapter captures on `stop`, `sessionEnd`, and `preCompact`; the OpenCode adapter captures on `session.idle` via a TS plugin shim under `.opencode/plugins/kk.mjs` that `init` registers in `.opencode/opencode.json` (OpenCode loads only declared plugins); the Copilot adapter captures on `sessionEnd` and `agentStop` via a repo-level per-event JSON hook config at `.github/hooks/kk.json` (Copilot loads repo-level hooks before user-level; each command resolves the session repo's own scripts from the session cwd; its skills install to `.github/skills/` and its static pointer block to `.github/copilot-instructions.md`, so `.github/` is the directory to commit and nothing is written under `.copilot/` in the repo), reading the per-session `events.jsonl` transcript under `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/`. All five harnesses share the same node format, curator, and review surface, so a knowledge base curated under one harness loads correctly under any other.

The builder is deliberately split into two layers: **LLM skills** (`kk-curate`, `kk-session-extract`, `kk-bootstrap`, `kk-add`, `kk-migrate`) make the judgment calls - what is worth capturing, how to cluster nodes topically, whether a finding contradicts an existing node - and a layer of **deterministic, LLM-free CLI primitives** (`drafts collect`, `curate-dedup`, `curate-persist`, `conflict prepare`, `conflict resolve`, `node write`, `session-log stage-live`, `session-log update-proposals`, `place`, `rebalance`, `index rebuild`, `finddocs`, `memory mark`) owns every write to disk, and `memory list` reports the harness memory files without writing. `memory list` is not LLM-free: on Claude Code it finds the files with one headless `claude -p` call. The model never writes a file directly; it produces structured plans that the primitives validate and apply. This keeps every mutation auditable, reproducible, and reviewable as a git diff.

A primitive that reports a result prints exactly one JSON document on stdout and sends every diagnostic, including the output of any command it drives, to stderr, so a skill can parse stdout whole. The two no-op paths of `migrate status` and `place inventory` print a plain `nothing to do` line instead.

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
- **Vocabulary:** Project-specific terms ("Rivermark Discover = personalized section on the platform"), internal module names, custom entity names.
- **Locations:** Where major systems live in the file tree.

The system explicitly does **not** capture:

- Code the agent wrote that just worked the first time without human correction.
- Bug fixes for typos, syntax errors, or generic mistakes.
- File reads, greps, or exploration the agent did to understand existing code.
- Refactors that didn't change architecture or convention.
- Anything the agent could derive from general programming knowledge or by reading the codebase.
- Routine completions where no teaching moment occurred.

The signal for capture is: **did the human have to teach the agent something the agent couldn't have known from the codebase alone, or did the human introduce something new to the project that didn't exist before?** Everything else is noise.

`practice` and `map` are a **frontmatter facet** (`type`), not a storage location. Both live side by side in the topical folder tree described in §7; `type` controls how a node is rendered in an index ("Conventions" vs "Components"), not which directory it lands in.

## 7. Knowledge base structure

The knowledge base is a set of plain markdown files under `.ai/kenkeep/`. Leaves, `ENTRY.md` and `GRAPH.md` carry schema version **3**. The `nodes/` tree is a conformant [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle: leaves are OKF concept documents, and every kenkeep-only field is namespaced under `kk_`. Other persisted shapes version on their own. Conflict files carry `schema_version: 2`. Session logs, `config.yaml` and the JSON state files carry 1.

The node reader refuses an older schema and points the user at migration (see §9.10). There are no compatibility shims or legacy read paths. `init` does not refuse. On a repository whose nodes are at an older schema it finishes the install, leaves `nodes/` untouched, prints an error naming the on-disk version, and exits 0. Every command that reads `nodes/` then fails until the knowledge base is migrated.

**Nodes live in a nested topical folder tree.** Leaves are stored under `nodes/<branch>/.../<id>.md`, where the file name is the node id and `kk_id = <type>-<slug>` (e.g. `practice-cache-tags-entity-x`). Folder placement is **topical**, chosen for where a node belongs conceptually. It is *presentation*. The node id is *identity*: cross-references resolve by id and render the node's current path, so a node can be relocated (by migration or rebalance) without breaking any reference to it. Every value that becomes a file location (a node id, a folder key, a run id) goes through one validator that rejects `..`, absolute paths, non-canonical ids and symlinked directories, so a write cannot leave its target directory.

**Every folder carries a generated `index.md`.** Each is a deterministic table of contents for that one folder: a breadcrumb, descent pointers to its subfolders, and its own direct leaves split by `type` ("Conventions" for practice, "Components" for map). Ordinary folder indexes have no frontmatter. Only the bundle-root `nodes/index.md` declares `okf_version: "0.1"`. A folder's one-line summary lives in `FOLDER_SUMMARIES.md`, a committed sidecar beside `nodes/`. It is the single self-preserved, human-or-LLM-authored field in the generated output (see §9.10 and §9.3 for the two sanctioned authoring moments).

`index rebuild` reads the tree once and reconciles the whole owned output set (every folder index, `ENTRY.md`, `GRAPH.md`, `FOLDER_SUMMARIES.md`) against the actual leaves. It removes an index left in a branch with no leaves, prunes that branch's summary, and under `--stage` stages the full set, deletions included.

**Two root artifacts orient the whole tree:**

- **`ENTRY.md`** - the root launchpad. A catalog of the top-level branches (each with its one-line summary) plus any root-level leaves. This is the file the `SessionStart` hook injects into a new session. It is deliberately *not* the per-folder `index.md` template; it is the whole-tree branch index designed to be small.
- **`GRAPH.md`** - the full cross-tree edge overlay, listing every node's `kk_relates_to`, `kk_depends_on`, and `kk_derived_from` edges by id.

Both root artifacts (and every `index.md`) are regenerated deterministically from the leaf set. A content-addressed `nodes_hash` (sha256 over each leaf's path + file content, excluding generated index files) is stamped into `ENTRY.md` and `GRAPH.md` and drives staleness detection: when the live hash diverges from the recorded one, `doctor` flags it and `index rebuild` regenerates.

**Rendered links are leaf-relative.** Every Related, Depends on and Citations link inside a leaf is relative to that leaf's own file, so it resolves on GitHub and in any markdown reader. A repo-relative `kk_derived_from` path resolves through the leaf's `../` depth, a URL is linked as written, and a session origin (`<session>:<kind>:<index>`) renders as plain text. Rebalance, `node sweep` and `pack import` refresh the link sections of the leaves they move or graft. `lint` reports any other drift as `stale-rendered-link` (a warning), and `npx kenkeep node refresh-links` repairs it. `index rebuild` never rewrites a leaf.

**Node frontmatter** carries OKF's `type` (`practice` | `map`), `title`, `description` and `tags`, plus `kk_schema_version: 3`, `kk_id`, `kk_derived_from` (session-log or doc provenance), `kk_relates_to` (loose association, by id), `kk_depends_on` (genuine dependency, by id) and `kk_confidence`. Both edge fields are rendered in `GRAPH.md` and dangling-checked by `npx kenkeep lint`.

**Retired ids stay resolvable.** When a node's id is retired (only a split-leaf rebalance does this), a JSON ledger at `nodes/.redirects.json` maps the old id to its successor id(s), resolved transitively, so older references and provenance keep working after a reorganization. Split children keep the source's `kk_derived_from` and may carry their own edges. Edges that no child claims are reported, and no new child may cite the retired id. Existing legacy retired-id provenance is preserved without a rewrite: `doctor` accepts it when the redirect chain reaches at least one live successor, and still warns when no source resolves.

## 8. User stories

### As a contributor

> "I want to finish a debugging session and have the gotcha I just learned end up in the knowledge base without me having to write it down."

Capture happens via session-end hooks. After several sessions, a notification at the start of a new session says "you have N pending session logs ready for curation."

> "I want to control when knowledge actually lands in the knowledge base, so I'm not getting noisy commits after every coffee-break session."

The `kk-curate` skill runs the curator on demand. The skill drafts actions per batch of sessions, and the deterministic `drafts collect`, `curate-dedup` and `curate-persist` primitives validate them and write the topical tree (`nodes/<branch>/.../<id>.md`: new files for additions, in-place rewrites for modifications). Nothing lands in the live knowledge base until the contributor reviews the diff with `git` and commits.

> "I want to know when my new finding contradicts something the knowledge base already says, so I can decide which is right."

The curator flags contradictions as a separate category. It does not write conflicting nodes to the tree. For each `contradict` action, with or without a proposed node, `curate-dedup` writes one markdown file under `.ai/kenkeep/conflicts/<run-id>-<n>.md`. The file holds the full proposal in its frontmatter and renders the rationale and the proposed body below it for review in git. The `kk-curate` skill walks every open conflict with the contributor in-session, existing node side-by-side with the proposed one, and applies each decision with `conflict resolve`. It does this whether or not any session was pending. The contributor picks Accept, Reject, Keep as record, or Skip. See §9.5 for the lifecycle.

> "When the curator does something weird, I want to be able to look at exactly what it saw and what it produced."

Every LLM-driven step writes a verbose log file under `_logs/` (gitignored). For each proposal extraction and each curator run, the full stream-json trace is preserved.

> "I just realized something about the project, even though I'm not in a session. I want to add it to the knowledge base now."

Two paths into manual capture: `npx kenkeep node add` from the terminal (which launches the `kk-add` skill in the active harness), or the `kk-add` skill directly from inside a session (the skill guides the agent through type, title, description, body, tags, and edges, then writes the node via the deterministic `node write` primitive). Either path writes directly to the topical tree. Acceptance is `git commit`; rejection is `git restore <path>`. Same human-in-the-loop guarantee as session-derived captures, just with git as the review surface instead of a separate staging directory.

> "My project already has a bunch of READMEs, ADRs, and module docs. I don't want to start with an empty knowledge base - I want the knowledge base seeded from what's already documented."

The `kk-bootstrap` skill runs an agent-driven first-time bootstrap inside a normal session. The agent surveys the project's docs directory, reads representative content, follows cross-references between docs, and writes nodes directly to the topical tree with `kk_derived_from` pointing to the actual doc paths. Bootstrap is conservative: it never overwrites an existing node - collisions are skipped and reported. The contributor reviews each new node with `git diff nodes/` and accepts what they want. Bootstrap is a supervised one-off, not an autopilot.

> "I added some new docs after the initial bootstrap. I want them folded into the knowledge base without re-processing everything."

Re-running `kk-bootstrap` (`npx kenkeep bootstrap --from <scope>`) is incremental by construction. It reads a state file (`.ai/kenkeep/.state/bootstrap-state.json`) recording the SHA-256 of each finished source doc, skips unchanged docs (the `finddocs` primitive enumerates candidates and hashes them), and runs chunked extraction only on new or modified ones. A document counts as finished only when `bootstrap complete-doc` says so, after every node for it is written, including a document that yields zero nodes. `node write --source-doc` records each node under an `in_progress` entry for its document, so a run interrupted halfway through a document resumes it: rewriting a draft already written in that attempt creates no `-2` duplicate while that node is still in the tree (a deleted one is written again), and a document that changed mid-run is refused at completion. Cheap, deterministic, scriptable. Re-runnable safely. (The older `bootstrap-incremental` command name still works as a deprecated alias that delegates to `bootstrap`.)

Both bootstrap and `curate` also consume the active harness's auto-memory files (Claude Code's persisted memories; other adapters return `[]` until their hosts ship the feature). `memory list` prints the memory files that are new or changed since the ledger recorded them. On Claude Code it asks a headless `claude -p` child where the files are, so listing makes one model call; a failed call lists nothing and the files come back next run. `memory mark` records one as processed, in the per-user ledger at `.ai/kenkeep/.state/memory-ledger.json` (gitignored), and only after the nodes derived from that file are on disk. `mark` refuses when the file changed since it was listed, so a failed run leaves the file listed for the next one.

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

Every node carries a `kk_derived_from` list pointing to session origins (or, for bootstrapped nodes, source doc paths). **Caveat:** session logs are gitignored by default - provenance only works for the original contributor unless the team commits `_sessions/`. If reviewers other than the original contributor need to verify provenance, the team opts in by replacing `/_sessions/` with `!/_sessions/` in `.ai/kenkeep/.gitignore`. `init --upgrade` keeps that line and does not re-add the ignore rule. Documented as an explicit setup decision with the trade-off (more repo bloat, full audit trail).

## 9. Key workflows

### 9.1 First-time setup

1. A contributor runs `npx <pkg> init --harnesses <id[,id,...]>` (e.g. `claude`, or `codex,cursor,opencode,copilot`). `--harnesses` is required.
2. The installer creates `.ai/kenkeep/` with starter structure (including `_logs/` and `_sessions/` both gitignored), registers hooks for each selected harness, installs the `kk-add`, `kk-bootstrap`, `kk-curate`, `kk-migrate`, and `kk-session-extract` skills, writes `.ai/kenkeep/.state/installed-version`, seeds an empty `.ai/kenkeep/config.yaml` for project-level tunables, copies local prompt overrides into `.ai/kenkeep/.config/prompts/`, and adds a managed `.ai/kenkeep/.gitignore` block. It does **not** install husky, lint-staged, secretlint, commitlint, or any other commit-time tooling in the consuming repo. Teams that want a commit-time secret scanner or a commit-message linter wire those up themselves (see [Installation](docs/installation.md)). `init` has no global preflight. Each adapter validates its own host registration when it installs, and the `AGENTS.md` pointer block is checked when `init` reaches it. A malformed file stops the run with that file's own diagnostic. Whatever was written before that point stays on disk (the `.ai/kenkeep/` skeleton and any adapter installed earlier in the run), and `installed-version` is not written. Fixing the file and running the same `init` again completes the install.
3. The contributor commits. knowledge base is live but empty.

**Fresh clone.** The hook scripts are gitignored, so a teammate's clone has the committed host configs but none of the scripts they reference. The teammate runs `npx kenkeep init --harnesses <id>` once. On an initialized repository this restores, for every harness recorded in `.ai/kenkeep/.state/installed-version`, the missing hook scripts; skills, plugins and prompts are committed and arrive with the clone. It never rewrites a file that exists, so `config.yaml`, prompt overrides and host configs stay byte-identical and `git status` stays clean. Naming a harness that is not recorded installs it and adds it to the inventory.

**Upgrade.** `init --upgrade` refreshes templates and skills for every recorded harness plus any named on the command line, and preserves `config.yaml` and local prompt overrides. It never drops a recorded harness. A harness leaves the inventory only when a human deletes its host registration and edits `installed-version`. As its last step, `init --upgrade` sweeps loose leaves at the `nodes/` root (see §9.13). It keeps a session-retention opt-in (§8) and never reverses it.

**Doctor.** `doctor --harness <id>` fails when `<id>` is unknown or not recorded. Unscoped `doctor` includes a `harness inventory` check: an unrecorded harness that has a host registration or a shipped plugin is an error when its scripts are missing and a warning otherwise.

### 9.2 Daily session capture (automatic)

1. The contributor runs an AI session as normal.
2. When the session ends - or when context compaction is about to fire - a hook captures a slice of the transcript into `.ai/kenkeep/_sessions/`, marked pending for proposal extraction. (Capture writes the slice as-is to the gitignored staging area; there is no automated redaction - see Goal 6. The one exception is explicit user marking: text wrapped in `<kk-private>…</kk-private>` during the session is stripped before the slice is written.)
3. Proposal extraction turns each pending session log into structured `practice`/`map` candidates. For the Codex, Cursor, OpenCode, and Copilot adapters this runs in the background on the next session start (the `kk-proposal-drain` hook spawns the harness's headless binary, without blocking the session). OpenCode uses its plugin's async dispatch; Codex, Cursor, and Copilot have no native async hook support and instead route through the canonical async launcher (`src/lib/async-launcher.ts`), which detaches the worker into its own process group before any host-dependent operation so a host stdin-hold or hook timeout cannot block or kill it — the same launcher the long-running `kk-lint-tick` hook uses on those three adapters (see [Hooks internals](docs/internals/hooks.md)). For the Claude adapter the drain hook is intentionally a no-op: proposals are extracted inline at the start of a `kk-curate` run instead. Either way the run's stream-json trace lands in `_logs/proposal/`.
4. Every log records its transcript version, `transcript_hash` plus `transcript_chars`. A re-fire whose hash matches leaves the log untouched, so a finished extraction and its proposals survive a duplicate `Stop`. A changed hash returns the log to `pending` with empty proposals. The curator stamp records the version it consumed. When the session keeps growing and the consumed version is still a prefix of the new transcript, normally only the new turns are extracted and curated. A capture that lands while a curate run is stamping the log keeps the whole transcript extractable, so the next run may extract the consumed turns again and the curator reconciles them against existing nodes (see [Hooks internals](docs/internals/hooks.md#transcript-versions)). A drain or an inline extraction whose log changed underneath it refuses to write back (`session-log update-proposals --expected-hash`), and the newer version stays pending. A stamp written before version binding is never re-admitted.
5. Each adapter reports the real outcome. "Saved" means a log was written. A skip names its reason (no transcript, no content), and a pipeline failure reports a capture error. OpenCode has no `transcript_path`, so its hook exports the session with `opencode export` into a private temporary directory and removes that directory on every exit path.

### 9.3 Curation (deliberate)

1. After enough session logs accumulate (default `curationThreshold` = 20; configurable per project), a nudge appears at session start: "You have N pending session logs. Invoke the `kk-curate` skill when ready." The throttle is one nudge per hour. It covers the attention block, the desktop notification and the response directive. The queue status line stays in the injected context at every start. `last_nudged_at` is recorded only when the nudge fires. A curated session whose transcript has grown since counts toward the backlog again.
2. The contributor invokes the `kk-curate` skill. The skill reads pending logs and current knowledge base nodes (extracting proposals inline first when running under Claude) and drafts curator actions per batch of sessions. The contract is a discriminated union generated from Zod (`schema curator-output`): `add` carries a proposed node, `modify` a target and a proposed node, `contradict` a target and a rationale (a proposed node is optional), and `drop` an origin and a rationale.
   - Each batch draft lists the sessions it consumed (id, filename, `transcript_hash`) next to its actions.
   - `drafts collect` merges the valid drafts into one document, `{ runId, batches, consumed, actions }`. A draft is `valid` or `invalid`, and a batch that wrote no draft consumes nothing. Only valid drafts contribute actions and consumed sessions, and the sessions of the others stay pending. It exits 1 only when no draft survived.
   - `curate-dedup` takes that document and validates it before any write. It rejects unknown origins and duplicate, missing or non-pending consumed sessions, and a session whose transcript changed since the batch was issued. It then deduplicates, writes conflict files and stamps exactly the consumed set. Dedup never suppresses a contradiction. A surviving `modify` whose target has a contradiction is held as a second conflict for human review instead of being applied.
   - `curate-persist` writes the surviving `add` and `modify` actions, each placed in the best-fitting existing folder. Before each add it skips a leaf that already carries the action's origin with the same fields and body, and a modify that would change nothing is reported as `already-applied`, so a rerun of the same file writes only what has not landed. A failed action does not block the others.
3. The skill walks every open conflict with the contributor (§9.5). It does this even when no session was pending.
4. The skill regenerates `ENTRY.md`/`GRAPH.md`/`index.md` via `index rebuild`, then runs **rebalance (the final phase of curation)**. `rebalance trigger` is a deterministic, hysteresis-gated check over per-folder metrics that decides whether to split an over-full folder, split an over-large multi-concept leaf, merge an under-full branch, or promote a homeless root leaf into its own branch. A node that is the target of an open conflict is never a split-leaf or create-branch candidate. If the trigger fires, the skill clusters the affected nodes (the only LLM judgment in this phase), then `rebalance move` applies the plan as content-stable git renames (a split-leaf mints new ids and records redirects), and the index is rebuilt. A folder created or split here gets a one-line summary authored at this moment.
5. The reviewer inspects all changes with `git diff nodes/`, accepts with `git commit`, and rejects unwanted changes with `git restore <path>`. INDEX/GRAPH are already aligned by the curator at end-of-run; `npx kenkeep index rebuild` realigns them if a reviewer hand-edits a node afterwards.

### 9.4 Consuming the knowledge base

1. A teammate clones the repo and starts an AI session.
2. A `SessionStart` hook injects the current `ENTRY.md`. Delivery differs per harness: Claude and Cursor inject it as session context directly; OpenCode writes it to `.opencode/AGENTS.md`, which `init` registers in the config `instructions` array so the host loads it natively; Copilot receives it as the top-level `additionalContext` of its `sessionStart` hook output, so no per-session text lands in a tracked file. `.github/copilot-instructions.md` holds only a static pointer block written at install and upgrade. Independent of hooks, `init` and `index rebuild` maintain a pointer block in the repo's `AGENTS.md` so agents-file surfaces (and humans browsing the repo) always have an entry into the knowledge base.
3. The AI descends into branch `index.md` files and reads individual nodes on demand via standard file-reading tools.
4. The teammate does not need the builder tool installed.

### 9.5 Handling contradictions

1. During curation, the curator detects that a new session log conflicts with an existing node.
2. For each `contradict` action, `curate-dedup` writes one file under `.ai/kenkeep/conflicts/<run-id>-<n>.md`. Its frontmatter is the lossless record: `schema_version: 2`, `id`, `status`, `detected_at`, `run_id`, `candidate_origin`, `target_node_id`, `rationale`, `proposal` (the full proposed node, or null when the curator gave none), `default_decision` and `decided_at`. The body renders `## Rationale` and `## Proposed node` for reading in git and is never parsed back. Nothing is written to the tree.
3. `conflict prepare` lists the open conflicts (`pending` and `skipped`) in a stable order and writes into each conflict file the `default_decision` it will display. It never touches the target node or the conflict's status. The default is `accept` when fewer than 5 lines differ and the proposal's confidence is high, `reject` when more than half of the lines differ, `skip` otherwise. A missing target on disk, or a conflict with no proposal, always defaults to `skip`.
4. The skill shows each conflict next to its target. The contributor answers Accept, Reject, Keep as record or Skip, and an empty reply is the displayed default. The skill applies the answer with `conflict resolve <conflict> [--decision]`, which prints one JSON document.
   - Accept rewrites the existing target in place through the same modify path `curate-persist` uses. The id and path stay the same, no second node appears, and the proposal's title, description, tags and edges replace the old ones while provenance is merged. Accept on a conflict with no proposal, or whose target is gone, exits 1 with an error and leaves the status `pending`.
   - Reject, Keep and Skip set the status to `rejected`, `kept` or `skipped` and do not touch the target. Skip leaves the conflict open, so `prepare` lists it on the next run.
   - Decided files stay on disk as records and carry `decided_at`. The primitive never deletes a conflict file. The contributor commits a `kept` file as durable history, and the curator reads it for context on later runs.
5. A conflict file from before schema 2 does not carry the full proposal. `conflict prepare` and `conflict resolve` reject an open one with hand-review guidance: edit the target from the file's `## Proposed node` section, run `index rebuild`, then delete the file or set `status: kept`. A legacy file already marked decided is ignored.
6. The reviewer commits the resulting change. Old node state is preserved in git history.

### 9.6 First-time bootstrap from existing docs (optional, one-off)

1. The contributor invokes the `kk-bootstrap` skill inside a normal session, optionally passing a path scope (defaults to common doc locations like `docs/`, `README.md`, top-level `*.md` files).
2. The agent surveys the directory structure, reads representative content, follows cross-references, identifies candidate practice and map nodes, and writes them directly to the topical tree. Each node carries `kk_derived_from: [<doc-path>]`, written by `node write --source-doc` after it checks that the path is a regular file inside the repo and the hash is a sha256. Bootstrap is conservative: existing nodes are never overwritten; collisions are skipped and reported.
3. After the nodes for a document are on disk, the agent runs `bootstrap complete-doc <path> --hash <sha256>`. That is the only step that records the document in `bootstrap-state.json`, and it works for a document that yielded no nodes. A run stopped before that step leaves the document in `in_progress`, and the next run resumes it.
4. The contributor reviews the new nodes with `git diff nodes/` and commits the ones they want; `git restore` discards the rest.

The contributor can supervise and intervene mid-session if the agent goes off track. This is a one-time, judgment-heavy operation - running it once is the expected case.

### 9.7 Incremental bootstrap (later updates)

1. The team adds new docs (a new ADR, a fresh module README) or significantly revises existing ones.
2. The contributor re-invokes `kk-bootstrap` (`npx kenkeep bootstrap --from docs/`).
3. The skill reads `bootstrap-state.json`, hashes every candidate file under `--from` (via the `finddocs --with-hashes` primitive), skips files whose hash is unchanged, and runs chunked extraction on the rest.
4. New nodes are written directly to the topical tree. Existing-node collisions are skipped (and counted in the run summary). Each document is finalized with `bootstrap complete-doc`, and an `in_progress` document is resumed instead of re-listed from scratch.
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
- `proposalModel` / `curatorModel` / `bootstrapModel` - optional per-harness model + effort overrides. `proposalModel` applies to the drain hook's headless extraction. `curatorModel` (`curate` and `node add`) and `bootstrapModel` (`bootstrap`) apply to the launchers, which pass the host's native flags: `--model` everywhere, plus `--effort` on Claude, `-c model_reasoning_effort=<level>` on Codex and an optional `--agent` on OpenCode. A setting whose `harness` names another adapter than the active one launches with the host default and warns on stderr. A skill run inside a session uses that session's model.
- `cliDefaultHarness` - the harness used when a bare `npx kenkeep <cmd>` runs outside any assistant session (skills and hooks auto-detect their host and ignore this; only the plain-shell fallback consults it). Omitted by default, so repos fall back to the first registered harness (`claude`).

The schema is strict: unknown keys or malformed YAML cause a hard error naming the offending file. (Note: the curation lock's 30-minute stale timeout - see §10 - is a fixed constant, not a `config.yaml` tunable.)

`_logs/` grows unbounded by design (full stream-json traces are the audit trail). `npx kenkeep logs prune` walks `_logs/` recursively and deletes `*.jsonl` files older than `settings.logsRetentionDays` (default 30).

### 9.10 Schema migration

The knowledge base carries a schema version (nodes, `ENTRY.md` and `GRAPH.md` are at **3**). When the on-disk version lags, the node reader and `doctor` refuse to operate on stale artifacts and point the user at the `kk-migrate` skill, and `init` prints the same error without touching `nodes/` (§7). Migration is a real, supported capability - **not** a CLI one-liner and not autonomous; it requires an interactive agent session because one step needs LLM judgment.

The split mirrors the rest of the builder:

- `npx kenkeep migrate status` is a deterministic, LLM-free **dispatcher**. It detects the on-disk version and emits the ordered chain of pending migration steps as a single JSON line. It never executes a step. Legacy status comes only from leaf frontmatter (`schema_version: 1` or `2`). Folder names carry no signal, so `map/` and `practice/` are ordinary topical folders.
- The `kk-migrate` skill drives each step in-host. For the v1→v2 step (flat two-bucket layout → nested topical tree), it runs `place inventory` (which emits the flat leaves as JSON), performs the topical clustering itself (the one LLM judgment), then `place apply` (a deterministic primitive that relocates leaves id- and byte-stable and stamps the new folders' summaries), then `index rebuild`. `place apply` refuses an id placed twice and two leaves that share an id, before it moves anything.
- The v2→v3 step is `migrate okf-v3`, deterministic and LLM-free. It converts v2 leaves to OKF frontmatter with `kk_` fields, writes the `FOLDER_SUMMARIES.md` sidecar and rebuilds the indexes. All validation happens before the first write. A tree it only partly converted is finished by running it again.

Migration is a **clean break**: there are no compatibility shims, no dual-read paths, and no in-place "best effort" reads of an old shape. The schema version both fails loudly on an incompatible read *and* drives the migrator that bridges the gap. Node ids and file bytes are preserved across the move, so provenance and cross-references survive. An I/O failure partway through reports every path written, rewritten, removed or created, with the recovery commands (§9.13).

### 9.11 Periodic content-health lint

A `kk-lint-tick` hook rides each harness's session-boundary event. Most fires only increment a counter; every `lintEveryNSessions`-th fire (default 50) actually runs `npx kenkeep lint` over the tree - checking for dangling `kk_relates_to`/`kk_depends_on`/`kk_derived_from` edges, slug/id mismatches, duplicate tags, orphan nodes, stale generated link sections (`stale-rendered-link`, a warning), an `index.md` outside the owned set (`stale-folder-index`, an error), and a missing, dangling or malformed `AGENTS.md` pointer block - and records the result. The next `SessionStart` surfaces a stale-lint summary as a nudge. `npx kenkeep lint` can also be run on demand.

### 9.12 Usage instrumentation

At capture time the builder appends to a gitignored ledger at `.ai/kenkeep/.state/usage.jsonl`, recording which knowledge base documents were read during the captured session (a leaf's node id, or a branch `index.md`'s path). The signal is two-fold: dedicated file-read tool calls, plus markdown file paths an agent visibly named in shell/search commands (`cat`, `sed`, `head`, `rg`, `grep`, …). Codex in particular reads through shell. The usage layer remains the safety filter: only `.md` files under `.ai/kenkeep/nodes/` become records, and the persisted shape is unchanged (`{ document, type, session_id, used_at }`). Command coverage means explicit file-path candidates in tool input only; directory-only searches, glob expansion, shell stdout, and arbitrary prose are not attributed to individual documents. The ledger is append-only: each capture appends only the positive delta for its session and never rewrites earlier lines. This is **write-only instrumentation today** - no decision logic consumes it yet. It is reserved as a future signal for pruning, rebalance, or curation prioritization, and is captured now so the data exists when those features are built.

### 9.13 Retry and recovery

Every primitive that can fail halfway either changes nothing or tells the user how to get back to a known state.

- **`curate-persist`** skips what already landed in the tree (§9.3). Rerun with the same input.
- **`rebalance move`** resolves every operation, minted id and sibling path against a simulated tree before the first write. A plan with an invalid third operation, a duplicate split id or a destination conflict exits 1 with the tree byte-identical. An I/O failure after earlier writes prints one JSON document, `{error, moves}`, listing the moves that landed; no index is rebuilt.
- **`place apply` and `migrate okf-v3`** preflight the complete output, and write every destination before removing any source; `migrate okf-v3` resumes on rerun.
- **`pack import`** refuses to start unless `.ai/kenkeep/` and `AGENTS.md` are clean in git, validates before it writes, and on failure prints the `git restore` and `git clean` commands that undo it.
- **`node sweep`** (and the sweep at the end of `init --upgrade`) files a loose leaf from its own edges and tags. A leaf nothing fits is deleted only when nothing references it and git can restore it, and the output names the `git restore` command. Every other such leaf stays at the root. Nothing is staged or committed.
- **`bootstrap`** resumes an unfinished document (§9.6). **`memory mark`** leaves a file listed when its run failed (§8).
- **Capture and extraction** are version-checked (§9.2), so a concurrent writer cannot overwrite a newer log.

### 9.14 Knowledge packs

`pack export` writes the current `nodes/` tree, with its redirect ledger and folder summaries, to a publishable directory. It runs the lint gate first. The output must be a missing or empty directory, or one that already holds a pack. Export replaces only the pack's own entries (`kenkeep-pack.yaml`, `README.md`, `knowledge/` and its folder-summary file) and leaves everything else in the directory alone, so a pack repository keeps its `.git`, license and CI files across re-exports. It refuses a symlinked `--out`, any other non-empty directory, and an output inside `.ai/kenkeep`.

`pack import` lands a pack as one isolated branch under `nodes/<name>/`. It is deterministic and validates before it writes:

- Import refuses a kenkeep tree with uncommitted or untracked changes in `.ai/kenkeep/` or `AGENTS.md`, so git can undo a failed run.
- A symlink anywhere in the pack's `knowledge/` tree is rejected, and the scan never follows a link or reads through one.
- Imported leaves are copied byte for byte. A pack's `index.md` files are never imported, because the rebuild regenerates every index.
- A pack id equal to a live or retired id in the consumer's tree is an error for a human to decide. Nothing is skipped or bound to unrelated consumer content.
- Every `kk_relates_to` and `kk_depends_on` edge must resolve inside the pack plus the consumer tree, through the merged redirect ledgers. A pack may extend a base pack the consumer already imported.
- The pack's `knowledge/.redirects.json` is validated strictly and merged into the consumer's root ledger. A redirect that maps a retired id differently from the consumer's is an error. The summary reports `Redirects merged: N`.
- Imported and affected consumer leaves get their generated link sections refreshed, then the indexes are rebuilt.

### 9.15 Hook bounds and headless calls

Hook deadlines are **cooperative**. Node cannot interrupt synchronous work, so a timer fires only while the hook awaits something. Each hook receives a budget and checks it between bounded units of work (per directory, per leaf, per child timeout). The timer is cleared when the hook finishes, so a completed hook never logs a deadline after the fact. One unbounded unit, a single leaf parse or a `spawnSync` without its own timeout, can still overrun. Capture, session-start and prompt-context run with a 1 s budget. OpenCode capture runs with 8 s, and its `opencode export` probe and export timeouts are cut from the remaining budget.

Measured on a slow-filesystem fixture (12 leaves, each read stalled 200 ms, 1 s deadline), the prompt-time hook finished in 1,348 to 1,371 ms and injected nothing. The documented bound is the budget, plus one stalled unit (200 ms), plus about 600 ms of process start and teardown, 1.8 s here. The injected block is also bounded: its length, trailing newline included, never exceeds the rendered-character budget, and the first entry's summary is truncated to fit.

SessionStart always injects the entry catalog, the curation queue and the lint state. The staleness hash over `nodes/` and the freshness walk check the budget per leaf; a walk that runs out reports no signal, so a partial hash never yields a stale warning. Nothing is logged.

The headless calls (the proposal drain and `npm run prompt-eval`) share one runner. Up to 64 KiB the prompt travels as an argument. Above that it goes through the host's stdin channel with no positional prompt, because Linux caps a single argument at 128 KiB. It sets `KENKEEP_BUILDER_INTERNAL=1` on every child. Transcripts are substituted into the prompt template literally, so `$&` or `$'` sequences in a transcript arrive unchanged.

Verification state: the stdin rule is documented for Claude Code and Codex. For Cursor it comes from the installed agent's bundled source, not its public docs. For Copilot CLI and OpenCode it comes from their public docs and source, and neither binary was installed where this was checked. The Copilot `additionalContext` channel (§9.4) was verified from GitHub's hook reference and changelog, not from a live Copilot CLI session. Until someone runs both against the real binaries, treat those paths as documented but unproven.

## 10. Failure modes the user sees

| Failure | What the user sees |
|---|---|
| Transcript capture fails (empty/unreadable transcript, disk full) | Session log not written. Brief warning at next session start. Session content is lost; user can paste relevant parts manually. |
| Proposal extraction fails (CLI error, rate limit) | Session log retained as `proposal_status: failed`. Visible in `npx kenkeep status`. Not retried automatically, because failures do not heal by themselves: set `proposal_status` back to `pending` to retry. Full log under `_logs/proposal/` for diagnosis. |
| `SessionStart` hook fails | Session starts without knowledge base context. Single-line warning in transcript. The session works, just without injection. |
| `ENTRY.md`/`GRAPH.md` stale (someone hand-edited a node) | `npx kenkeep doctor` flags it (the recorded `nodes_hash` no longer matches the leaf set). Run `npx kenkeep index rebuild` to refresh. |
| Knowledge base is at an older `schema_version` | The reader and `doctor` refuse and point at the `kk-migrate` skill. `init` finishes, leaves `nodes/` alone and prints the same error. Run the skill to migrate (see §9.10). |
| A `curate-persist` action fails (missing target, unwritable folder) | The summary lists the failure and the command exits non-zero. Successful writes stay. Fix the cause and rerun the same command. |
| A rebalance, placement, migration or pack import is interrupted | `rebalance move` prints the moves that landed; `migrate okf-v3` resumes on rerun; `pack import` prints the git commands that undo it (see §9.13). |
| A hook overruns its budget | The hook injects nothing or skips its work and exits 0. The prompt-context hook logs a `budget` line to `_logs/hook-errors-*.log` (see §9.15); SessionStart logs nothing. |
| Two contributors invoke `kk-curate` simultaneously | Both runs proceed (single-author, no cross-process lock). A concurrent writer may silently drop one session-stamp update; no data corruption, but some sessions may reprocess on the next run. |
| `kk_derived_from` references a missing session log | Silent ignore in consume path. `npx kenkeep doctor --verbose` warns. Curator treats as "evidence not available" and proceeds. |

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

- For very large KBs, should the index injection be filtered by current task, or is the branch-bounded `ENTRY.md` sufficient? (Resolved: task relevance is delivered by a separate **prompt-time injection** surface rather than by filtering the session-start `ENTRY.md`. The `UserPromptSubmit` hook on harnesses with a native prompt-context channel — Claude Code and Codex today — ranks the current leaf nodes against the user's prompt and injects a bounded summaries-plus-links block; branch-bounded `ENTRY.md` orientation stays unchanged at session start. See [docs/internals/hooks.md](docs/internals/hooks.md).)
- Should incremental bootstrap detect overlap with existing accepted nodes (curator-style modify/contradict logic) instead of always producing additions? (Deferred; v1 produces additions only and relies on the reviewer to catch duplicates.)
- Should `usage.jsonl` graduate from instrumentation to an input for pruning/rebalance/curation prioritization, and on what policy? (Deferred until there is enough real usage data to design against.)
