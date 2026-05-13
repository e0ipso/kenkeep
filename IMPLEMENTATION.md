# Implementation: Project Knowledge Base for AI Coding Sessions

This document covers the technical design, key decisions and their rationale, and a phased implementation plan. It assumes the PRD has been read.

## 1. Architecture overview

Two separately versioned, separately distributed pieces:

```
┌────────────────────────────────────────────────┐
│  @e0ipso/ai-knowledge-base (installed per repo)│
│  ─────────────────────────────────────────────  │
│  • CLI: init, curate, status, doctor, ...       │
│  • Hook scripts (compiled JS in templates/)    │
│  • Skill definitions (.claude/skills/...)      │
│  • Proposal extractor & curator prompts        │
└────────────────────────────────────────────────┘
                       │
                       │ writes to / reads from
                       ▼
┌────────────────────────────────────────────────┐
│  .ai/knowledge-base/  (lives in consuming repo)│
│  ─────────────────────────────────────────────  │
│  • Pure markdown                                │
│  • Frontmatter-defined directed graph           │
│  • Catalog INDEX.md (every node)               │
│  • Provenance via derived_from (when committed) │
└────────────────────────────────────────────────┘
                       │
                       │ injected at SessionStart
                       ▼
              ┌──────────────────┐
              │  AI Session      │
              │  (Claude Code v1)│
              └──────────────────┘
```

LLM-driven steps (proposal extraction, curation) execute as subprocess invocations of `claude -p` against the user's existing Claude Code installation, not as in-process SDK calls. See §5.2 and §6 for details.

Contract between the two pieces: directory layout + frontmatter schemas (§4). Either side can be replaced or upgraded independently as long as the contract holds.

## 2. Distribution model

Modeled on `e0ipso/ai-task-manager`:

- Published as an npm package (`@e0ipso/ai-knowledge-base`).
- Initialized per repo via `npx @e0ipso/ai-knowledge-base init --assistants claude`. The `--assistants` flag accepts a list and exists for forward-compatibility, but only `claude` is supported in v1.
- The `init` command copies template files (hooks, skills, prompts) from the package's `templates/` directory into the consuming repo's `.claude/` and `.ai/knowledge-base/`. It also writes `.ai/knowledge-base/.state/installed-version` recording which package version produced the templates, needed by future `init --upgrade` work even though upgrade itself is deferred to v2.
- TypeScript codebase, semantic-release for versioning, MIT license.

CLI surface:

| Command | Purpose |
|---|---|
| `ai-knowledge-base init --assistants <list>` | First-time setup; copies hooks, templates, scaffolds a husky `pre-commit` hook driven by `lint-staged` + `secretlint`, writes `.lintstagedrc.cjs` (which also wires `index rebuild --stage` on `nodes/**/*.md`), and patches the consumer's `package.json` with the required devDeps and `prepare` script. |
| `ai-knowledge-base status` | Show pending session logs, pending curator conflicts, KB stats. |
| `ai-knowledge-base curate` | Run the curator non-interactively (CI-friendly). Writes node files directly under `nodes/`; conflicts go to `.state/pending-conflicts.json` for in-session resolution. |
| `ai-knowledge-base node add` | Interactive: create a node from manual input; writes directly to `nodes/<kind>/<id>.md`. |
| `ai-knowledge-base bootstrap-incremental --from <path>` | Incremental re-bootstrap from markdown docs; processes only files whose content hash changed since last run. Writes nodes directly. |
| `ai-knowledge-base index rebuild [--stage]` | Regenerate `INDEX.md` and `GRAPH.md` from current nodes. `--stage` runs `git add` on the regenerated files (used by the lint-staged pre-commit hook so INDEX/GRAPH land in the same commit as any `nodes/` change; no-ops outside a git repo). |
| `ai-knowledge-base doctor` | Verify hook installation, secret scanner availability, schema validity, INDEX freshness, dangling `derived_from` (with `--verbose`). |

In-session UX (Claude Code skills installed by `init` under `.claude/skills/<name>/SKILL.md`):

| Skill | Purpose |
|---|---|
| `kb-curate` | Trigger the curator from inside a session, then resolve any reported contradictions interactively with the user. |
| `kb-show <topic-or-slug>` | Read a specific node into context. |
| `kb-add` | Manually capture a node from inside a session; writes directly to `nodes/<kind>/<id>.md`. |
| `kb-bootstrap [path]` | Agent-driven first-time bootstrap from existing markdown docs. Writes nodes directly to `nodes/<kind>/` and updates `bootstrap-state.json`. |
| `kb-propose-from-session` | Force a proposal extraction immediately, without waiting for `Stop`. |

## 3. Directory layout

```
<consuming-repo>/
├── .claude/
│   ├── hooks/
│   │   ├── kb-capture.mjs          # Stop, SessionEnd, PreCompact (transcript only)
│   │   ├── kb-proposal-drain.mjs   # SessionStart (async): drain proposal queue
│   │   ├── kb-session-start.mjs    # SessionStart (sync): inject INDEX, threshold nudge
│   │   └── kb-lint-tick.mjs        # SessionEnd (async): increment counter, fire lint on threshold
│   ├── skills/
│   │   ├── kb-add/SKILL.md
│   │   ├── kb-bootstrap/SKILL.md
│   │   └── kb-curate/SKILL.md
│   └── settings.json               # hook registrations
├── .ai/
│   ├── knowledge-base/
│   │   ├── INDEX.md                # catalog (every valid node), regenerated by curate
│   │   ├── GRAPH.md                # full edge listing, regenerated by curate
│   │   ├── README.md               # human-facing explanation
│   │   ├── nodes/
│   │   │   ├── practice/           # how we build things
│   │   │   └── map/                # what exists in the project
│   │   ├── _sessions/              # raw + structured session logs (gitignored by default)
│   │   ├── _logs/                  # stream-json traces of LLM runs (gitignored)
│   │   │   ├── proposal/
│   │   │   │   └── <session-id>__<timestamp>.jsonl
│   │   │   ├── curator/
│   │   │   │   └── <run-id>__<timestamp>.jsonl
│   │   │   └── bootstrap-incremental/
│   │   │       └── <run-id>__<timestamp>.jsonl
│   │   └── .state/                 # tool state (locks, version stamp, bootstrap state)
│   │       ├── installed-version   # template version recording (committed)
│   │       ├── state.json          # last_nudged_at, lock info (gitignored)
│   │       ├── bootstrap-state.json # source-doc content hashes (gitignored)
│   │       ├── pending-conflicts.json # curator-detected conflicts awaiting in-session resolution
│   │       ├── lint-state.json     # lint cadence counter and last-run summary (gitignored)
│   │       └── prompts/            # local prompt overrides (committed)
├── .gitignore                       # contains _sessions/, _logs/, state.json
├── .secretlintrc.json               # secretlint config (recommended preset)
├── .husky/pre-commit                # runs `npx lint-staged`
├── .lintstagedrc.cjs                # secretlint on every staged file + `index rebuild --stage` on nodes/
└── package.json                     # adds husky/lint-staged/secretlint devDeps and `prepare: husky` script
```

All AI-related state grouped under `.ai/`. Three things gitignored by default: `_sessions/`, `_logs/`, and `state.json`.

## 4. Frontmatter schemas

All schemas validated with Zod at read time. Every schema carries `schema_version: 1` from day 1 to enable future migrations.

### 4.1 Node (`.ai/knowledge-base/nodes/<kind>/<slug>.md`)

```yaml
---
schema_version: 1
id: practice-schema-org-custom-event
title: "Use custom event setup for schema.org metadata"
kind: practice                  # practice | map
tags: [seo, metadata, schema-org]
derived_from:                   # session log filenames
  - 2026-05-10-1430-schema-org.md
relates_to: []
depends_on: []
confidence: high                # low | medium | high
summary: "When adding schema.org metadata, use the custom event in modules/custom/x (max 140 chars)"
---

# Body in markdown
...
```

Field rationale:
- `schema_version` marks the frontmatter shape so a Zod mismatch is a clean parse failure.
- `id` is the stable `<kind>-<slug>` reference used by `relates_to`, `depends_on`, `derived_from`, and curator action `target_node_id`.
- `title` is the human-readable label rendered in `INDEX.md`.
- `kind` is `practice` or `map`; tags handle finer distinctions. Two kinds match the two extraction passes.
- `tags` populate the `## By topic` section in `INDEX.md`.
- `derived_from` lists source filenames or doc paths; `doctor --verbose` surfaces dangling refs.
- `relates_to` and `depends_on` feed `GRAPH.md` as loose and strict cross-references.
- `confidence` is `low`, `medium`, or `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale.
- `summary` is the ≤140-character one-liner used by `INDEX.md`.

Git history is the timeline of record. The frontmatter carries no separate creation, update, or validity timestamps; `git log nodes/<kind>/<id>.md` recovers when a node was written or rewritten and by whom.

### 4.2 Session log (`.ai/knowledge-base/_sessions/<timestamp>-<slug>.md`)

```yaml
---
schema_version: 1
session_id: 2026-05-10-1430-schema-org
captured_by: stop                # stop | session_end | pre_compact | manual
captured_at: 2026-05-10T14:30:00Z
transcript_hash: sha256:...      # for dedup
proposal_status: pending         # pending | done | failed | skipped
proposal_completed_at: null
proposal_error: null
proposal_log: null               # path to _logs/proposal/...jsonl when done
secret_scan_status: clean        # clean | redacted | blocked | skipped
topics: []                       # populated by proposal worker
proposals:                       # populated by proposal worker
  practice: []                   # candidates for practice nodes
  map: []                        # candidates for map nodes
---

## Transcript
...

## Proposal
(populated by proposal worker)
```

### 4.3 Pending conflicts (`.ai/knowledge-base/.state/pending-conflicts.json`)

The curator never writes conflicting nodes to disk. When it emits a `contradict` action, it records the conflict here for the kb-curate skill to resolve in-session with the user. Validated by `PendingConflictsFileSchema`.

```json
{
  "schema_version": 1,
  "conflicts": [
    {
      "id": "<run-id>-<n>",
      "detected_at": "<ISO>",
      "run_id": "<curator run-id>",
      "candidate_origin": "<session_id>:<practice|map>:<index>",
      "target_node_id": "practice-foo",
      "rationale": "<why the curator flagged this>",
      "proposed_node": { /* CuratorProposedNode shape */ }
    }
  ]
}
```

Lifecycle:
- The curate command rewrites this file at the end of every run (empty `conflicts` array on success). Past entries from prior runs are not preserved across runs.
- The kb-curate skill reads it after `ai-knowledge-base curate` exits, walks each entry with the user, applies the chosen resolution by editing/creating the relevant `nodes/<kind>/<slug>.md`, and removes the entry from the file.
- `ai-knowledge-base status` reads the count and displays it under "Pending work."

### 4.4 Lint state (`.ai/knowledge-base/.state/lint-state.json`)

Tracks the SessionEnd lint cadence and the most recent run's summary. Validated with Zod.

```json
{
  "schema_version": 1,
  "sessions_since_last_lint": 0,
  "last_lint_at": null,
  "last_errors": 0,
  "last_findings": 0
}
```

Fields:

- `schema_version: 1`.
- `sessions_since_last_lint`: non-negative integer, increments on every SessionEnd, resets to 0 on each lint run.
- `last_lint_at`: ISO 8601 timestamp of the most recent run, or `null` if the lint has never fired.
- `last_errors`: count of error-class lint entries from the most recent run.
- `last_findings`: count of finding-class entries from the most recent run.

Writes are atomic (write to a temp sibling, then rename). Reads are tolerant: a missing or malformed file falls back to defaults (counter at 0, timestamps `null`, counts 0).

## 5. Capture pipeline

Three triggers feed the same path. **All three ship in M1**, not staged across phases; PreCompact in particular cannot be deferred without risking data loss during early phases.

```
Stop / SessionEnd / PreCompact
        │
        ▼ (synchronous, fast, deterministic; ≤1s deadline)
┌──────────────────────────────────┐
│ Transcript capture               │
│ • assertValidSessionId (boundary)│
│ • Secretlint scan + redact       │
│ • Write _sessions/<id>.md        │
│ • proposal_status: pending       │
└──────────────────────────────────┘

Next session:
        │
        ▼
┌─────────────────────────────────────┐
│ kb-proposal-drain.mjs               │
│ (SessionStart, async: true)         │
│ • Sweeps _sessions/*.md for         │
│   frontmatter proposal_status:      │
│   pending                           │
│ • Per pending log: spawns a         │
│   `claude -p` subprocess with       │
│   proposal prompt & stream-json     │
│   --verbose output                  │
│ • Pipes stream into                 │
│   _logs/proposal/...jsonl           │
│ • Parses final result; writes       │
│   done or failed back to            │
│   frontmatter                       │
└─────────────────────────────────────┘
```

### 5.1 Transcript capture: deterministic, fast, blocking-safe

- **Session-id boundary.** The hook validates `session_id` against the UUID v4 shape via `assertValidSessionId` and throws a named error on bad input; downstream code uses the lowercased UUID verbatim.
- **Secret-scan pass.** Programmatic call to `@secretlint/core`'s `lintSource()` using the recommended preset config. Findings (each with `range: [start, end]`) → redact with `[REDACTED:<rule-id>]` placeholders. On exception or timeout (>1 second), abort with `secret_scan_status: blocked`.
- **Write the session log.** Valid frontmatter + `## Transcript`. `proposal_status: pending`. The filename is `YYYYMMDD-HHmm-<sessionId>.md`; a repeated capture for the same session_id reuses the existing file via `findSessionLogBySessionId`, so multi-turn sessions land as one file.
- **Hard deadline:** transcript capture must complete within 1 second on any trigger.

### 5.2 Proposal generation: async hook + headless `claude -p` subprocess

The drain hook is registered as `async: true` in `.claude/settings.json`, so it runs in parallel with the rest of session start without blocking the user. Stdout from async hooks is not injected into the parent session's context: that's fine; status surfaces via `ai-knowledge-base status` and inline on subsequent sessions.

The drain sweeps `_sessions/*.md`, filters to frontmatter where `proposal_status` is `pending`, and for each pending log spawns a fresh Claude Code process:

```
execa('claude', [
  '-p', '<proposal prompt body>',
  '--allowedTools', '',                          // no tools needed for pure extraction
  '--output-format', 'stream-json',
  '--verbose',
], {
  input: '<role-tagged transcript>',             // stdin
  env: { ...process.env, KB_BUILDER_INTERNAL: '1' },
})
```

Behavior:

- Output is **stream-json with verbose**, written line by line to `.ai/knowledge-base/_logs/proposal/<session-id>__<wallclock-timestamp>.jsonl`. Each line is a JSON message (assistant text, tool calls, final result).
- The drain consumes the stream as it arrives, identifies the final `result` message, and validates its content against the proposal Zod schema.
- On success: the session log is updated with `proposal_status: done`, `proposal_log` set to the log filename, `proposals` populated.
- On failure (parse error, schema mismatch, non-zero exit): `proposal_status: failed` is written to the session log along with `proposal_error`. Failures here (timeout, schema mismatch, bad JSON) do not heal on retry, so the drain does not rotate them.
- The `KB_BUILDER_INTERNAL=1` env var is checked by all of our own hooks (`kb-capture`, `kb-proposal-drain`, `kb-session-start`); if set, they exit immediately. This prevents the spawned `claude -p` process from triggering recursive proposal/capture work on its own startup.
- Concurrency on drain: the drain acquires a lock under `.ai/knowledge-base/.state/state.json` (PID + 30-min TTL). If two SessionStart events fire concurrently (two terminals, same repo), the second waits or skips.
- Drain bound: by default the drain processes at most 5 pending logs per invocation; the rest are deferred to subsequent sessions. Configurable in settings.

Authentication: the spawned `claude -p` inherits the user's Claude Code authentication (OAuth or API key). No separate setup. We deliberately do **not** use `--bare`, because `--bare` requires `ANTHROPIC_API_KEY` and would not work for users on Claude.ai subscriptions. The `KB_BUILDER_INTERNAL` env-var guard substitutes for `--bare`'s hook-suppression behavior.

### 5.3 Proposal extraction prompt

The prompt runs in two passes per session log, each emitting structured output. Both passes operate only on **user turns** in the transcript (pass 1 strictly; pass 2 may also draw from agent turns for named-thing introductions). Without role-awareness, agent paraphrasing of user instructions generates spurious capture.

The transcript is supplied to the spawned `claude -p` as role-tagged segments:
```
[USER]: ...
[AGENT]: ...
[USER]: ...
```

**Pass 1: teaching moments → practice nodes**

Goal: identify points in user turns where the human corrected, redirected, or introduced new context the agent could not have inferred.

Trigger phrases (in user turns only): `no, use…`, `don't…`, `we always…`, `the standard way…`, `do it like…`, `because…`, `since we…`, `our convention is…`.

Output schema:
```json
{
  "kind": "practice",
  "tags": ["array", "of", "tags"],
  "title": "short imperative",
  "summary": "≤140 chars",
  "body": "markdown explaining what to do or not do, and why",
  "confidence": "low|medium|high",
  "supports_existing_node": "<id-or-null>",
  "contradicts_existing_node": "<id-or-null>"
}
```

**Pass 2: project-map introductions → map nodes**

Goal: identify new features, vocabulary, or locations introduced or revealed during the session.

Trigger phrases: `let's build…`, `we have a…`, `the X module…`, `it lives in…`, `<term> is our…`, `we call this…`.

Output schema:
```json
{
  "kind": "map",
  "tags": ["array", "of", "tags"],
  "title": "noun phrase naming the thing",
  "summary": "≤140 chars",
  "body": "markdown describing what it is, where it is, what it does",
  "confidence": "low|medium|high",
  "supports_existing_node": "<id-or-null>",
  "contradicts_existing_node": "<id-or-null>"
}
```

**Ownership boundary between passes (avoiding double-capture):**

When a teaching moment introduces a new term (e.g. "use the standard auth module for Bravo Insider"), the two passes split the content:

- Pass 1 owns the imperative knowledge: "use standard auth module for Bravo Insider features."
- Pass 2 owns the named entity: "Bravo Insider, the personalized section on the platform."

The two outputs reference each other via `relates_to` populated post-hoc by the curator.

**Anti-examples (in the prompt; do not capture):**

- Code the agent wrote that just worked.
- Bug fixes for typos, syntax errors, generic mistakes.
- File reads, greps, exploration steps.
- Refactors with no architectural change.
- Anything derivable from general programming knowledge.

The full prompt template lives in `templates/prompts/proposal-extract.md` and is the single most important quality lever in capture.

## 6. Curate pipeline

The curator is a graph-merge problem on top of proposal outputs. It also runs as a `claude -p` subprocess with stream-json verbose logging.

### 6.1 Trigger and lock

Triggered by `/kb-curate` slash command or `npx @e0ipso/ai-knowledge-base curate` CLI. The threshold nudge is a **passive notification, not a trigger**: it tells the user to run curate; nothing runs automatically.

Acquires `.ai/knowledge-base/.state/state.json` lock with PID + 30-minute TTL. Concurrent invocations block on the lock or abort with a clear message.

### 6.2 Inputs

- All session logs with `proposal_status: done` not yet referenced by any existing proposal.
- Existing nodes referenced by proposal outputs via `supports_existing_node` or `contradicts_existing_node`.
- The current `INDEX.md` (for awareness of nodes the proposal outputs didn't link to).

### 6.3 Subprocess invocation

```
execa('claude', [
  '-p', '<curator prompt body>',
  '--allowedTools', 'Read',                      // curator may read referenced nodes
  '--output-format', 'stream-json',
  '--verbose',
], {
  input: '<batched inputs as JSON>',
  env: { ...process.env, KB_BUILDER_INTERNAL: '1' },
})
```

Output written to `.ai/knowledge-base/_logs/curator/<run-id>__<wallclock-timestamp>.jsonl`. The curator run-id is a short ULID generated at the start of `/kb-curate`.

### 6.4 Batching

If pending log count exceeds a token budget (default ~50K tokens of inputs per call, conservatively measured), the curator chunks pending logs into batches of ~10 logs each. Per batch:

1. Load only existing nodes referenced in that batch's proposal outputs.
2. Spawn a `claude -p` subprocess on the batch.
3. Collect proposals into an in-memory accumulator.

Each batch produces its own line-prefix in the same curator log file (or one file per batch; implementation choice, one file per run is simpler). After all batches, run a final dedup pass (LLM-free): two proposals targeting the same content are merged, keeping the higher-confidence rationale and unioning source-session lists.

### 6.5 Curator prompt structure

Per batch, the curator receives:

```
[EXISTING NODES]
  <full content of N referenced nodes>

[INDEX SUMMARY]
  <current INDEX.md content, capped to budget>

[PROPOSAL OUTPUTS]
  Session: <session_id>
    practice candidates: [...]
    map candidates: [...]
  Session: <session_id>
    ...
```

It produces one of four actions per proposal candidate:

```json
{
  "action": "add | modify | contradict | drop",
  "candidate_origin": "<session_id>:<index>",
  "target_node_id": "<id-or-null>",
  "proposed_node": { /* full node frontmatter + body */ },
  "rationale": "why this action",
  "suggested_resolution": null
}
```

Decision rules baked into the prompt:

- **Add:** candidate is genuinely new; no existing node covers it. The wrapper writes the new file at `nodes/<kind>/<id>.md`. If the file already exists, the wrapper records an `add_collision` failure and writes nothing.
- **Modify:** candidate extends or refines an existing node without negating it. The wrapper overwrites `nodes/<kind>/<target_node_id>.md`. If the target doesn't exist on disk, the wrapper records a `modify_missing_target` failure and writes nothing.
- **Contradict:** candidate directly negates an existing valid node. The wrapper records the conflict in `pending-conflicts.json` and writes nothing. Resolution happens in-session via the kb-curate skill.
- **Drop:** candidate is too low-confidence, too vague, or near-rephrasing of existing content. Document the drop reason but produce no change.

Anti-patterns the prompt avoids:

- Modifications that just rephrase existing content. (Drop instead.)
- Additions when a near-duplicate exists. (Convert to modification.)
- Suggesting a `suggested_resolution` value (the wrapper ignores it; resolution is the user's call).
- Crossing the practice/map boundary.

The full curator prompt lives in `templates/prompts/curator.md` and is the most important quality lever in curation (parallel to proposal extraction in capture).

### 6.6 Contradiction handling

The curator never writes conflicting nodes. Each `contradict` action becomes an entry in `.ai/knowledge-base/.state/pending-conflicts.json` (target node id, proposed new content, rationale, run id; see §4.3). The kb-curate skill reads the file after the curator subprocess exits and walks each conflict with the user. The menu is binary:

- **Replace**: delete the existing `nodes/<kind>/<target_node_id>.md` and write the proposed node in its place. The new node lives at the same path with the same id.
- **Reject**: do nothing on disk. The existing node is untouched and the proposed node is discarded.

After applying the choice, the skill removes the entry from `pending-conflicts.json`. Unresolved conflicts persist across sessions and are surfaced by `ai-knowledge-base status`.

### 6.7 Inline INDEX/GRAPH regeneration

After all `add`/`modify` actions have been applied to `nodes/`, the curator regenerates `INDEX.md` and `GRAPH.md` from the current state of `nodes/` (deterministic, no LLM). The reviewer inspects everything with `git diff nodes/`, accepts with `git commit`, and rejects unwanted changes with `git restore <path>`. The pre-commit lint-staged step (`ai-knowledge-base index rebuild --stage`) regenerates and stages a fresh `INDEX.md`/`GRAPH.md` whenever the staged content under `nodes/` differs from what the index records, so the index never drifts from the committed nodes.

### 6.8 Manual-add path

Two entry points produce a node without going through capture. Both write directly to `nodes/<kind>/<id>.md`:

- **`ai-knowledge-base node add`**: Interactive CLI that uses `@inquirer/prompts` to collect the node's `kind`, `title`, `summary`, `body`, `tags`, and optional `relates_to`. Validates against `NodeFrontmatterSchema`. Writes to `nodes/<kind>/<kind>-<slug>.md` with `derived_from: []`, `confidence: high`. Fails loud (exits 1) when the target file already exists; the user must pick a more specific title or edit the existing node directly.

- **`/kb-add`**: Skill whose body instructs the agent to ask the user for the same fields (kind, title, summary, body, tags), assemble the node frontmatter, and write it directly to `nodes/<kind>/`. The skill runs in the user's existing session; no `claude -p` subprocess needed. The skill's `allowed-tools` frontmatter restricts the agent to `Write` only.

The reviewer accepts via `git commit` and rejects via `git restore`. The pre-commit hook keeps INDEX/GRAPH in lockstep. This preserves the human-in-the-loop guarantee uniformly: no node enters the KB without a human commit.

The manual-add path is also the v1 answer to "false-negative detection": when a contributor notices something the extractor missed, they have a low-friction way to capture it without waiting for the next session.

### 6.9 Bootstrap pipelines

Two distinct entry points for seeding the KB from existing markdown docs. They share output format and state file but are otherwise independent tools for different jobs.

#### 6.9.1 First-time bootstrap (`/kb-bootstrap`, agent-driven)

Skill body lives in `templates/claude/skills/kb-bootstrap/SKILL.md`. When invoked in a Claude Code session, the body instructs the agent to:

1. Survey the docs structure (defaults to `docs/`, top-level `*.md`, `README.md`; explicit path overrides via skill argument).
2. Read top-level entry points first; sample representative content from subdirectories.
3. Follow cross-references between docs to understand context.
4. Identify candidate practice and map nodes per the §6 PRD definitions, using doc-appropriate triggers (imperative statements, "must/should/always/never," noun-phrase definitions, section headers naming components).
5. For each candidate: write a node directly to `nodes/<kind>/<kind>-<slug>.md` with:
   - `derived_from: [<source-doc-path>]` (paths relative to repo root, committed to repo, so provenance always resolves)
   - `confidence: medium` (existing docs may be stale, contradictory, or aspirational; force reviewer judgment)
   - **Never overwrite an existing node.** If the target file already exists, skip the candidate and surface the collision in the final report.
6. Update `.ai/knowledge-base/.state/bootstrap-state.json` with content hashes of every doc read.
7. Report a summary: how many nodes produced, which docs were read, which were skipped and why, plus any collisions skipped.

The agent runs in the user's existing session; no `claude -p` subprocess. The user supervises and can intervene mid-run. The skill's `allowed-tools` frontmatter restricts the agent to `Read`, `Glob`, `Grep`, `Write` (for proposals and state file only), and a narrow `Bash` allow-list for `shasum`/`sha256sum`/`mkdir`.

This is intentionally a one-time, judgment-heavy operation. Re-running `/kb-bootstrap` is allowed but produces noise (the agent re-reads docs already reflected in nodes/). For ongoing maintenance, use `bootstrap-incremental` instead.

#### 6.9.2 Incremental bootstrap (`ai-knowledge-base bootstrap-incremental`, CLI)

For when source docs are added or modified after first-time bootstrap. Deterministic, hash-aware, scriptable.

```
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/ \
  [--include '**/*.md'] \
  [--exclude 'docs/legacy/**'] \
  [--dry-run]
```

Behavior:

1. Walk `--from` recursively, respecting `.gitignore` and `--include`/`--exclude` globs.
2. For each markdown file, compute SHA-256 of file contents.
3. Read `.ai/knowledge-base/.state/bootstrap-state.json`. Skip files whose hash matches the recorded hash. Process files that are new or whose hash changed.
4. Chunk the to-process set into batches sized by token budget (~10K tokens per batch; same chunking pattern as the curator).
5. For each batch: spawn a `claude -p` subprocess with the bootstrap-incremental prompt and stream-json verbose output to `.ai/knowledge-base/_logs/bootstrap-incremental/<run-id>__<timestamp>.jsonl`. Include `KB_BUILDER_INTERNAL=1` for recursion safety.
6. Parse output, validate against `NodeFrontmatterSchema`, write each candidate directly to `nodes/<kind>/<kind>-<slug>.md`. Skip (and count) any candidate whose target file already exists; bootstrap never overwrites.
7. Update `bootstrap-state.json` with new hashes and timestamps.
8. `--dry-run` reports what would be processed without invoking the LLM or writing nodes.

The bootstrap-incremental prompt is in `templates/prompts/bootstrap-incremental.md`. It's a tighter variant of the agent-driven body: same output schema, same trigger patterns, but no exploration or cross-referencing, just per-chunk extraction. Cheap, predictable.

**Overlap with existing nodes:** v1 always treats candidates as additions. Conflicts with existing nodes are not merged; they're skipped and reported. The reviewer can hand-merge content into the existing node if desired. v2 may add curator-style modify/contradict logic for incremental re-bootstrap; deferred per §12.

#### 6.9.3 Bootstrap state file schema

`.ai/knowledge-base/.state/bootstrap-state.json` (gitignored, JSON, validated with Zod):

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "2026-05-10T14:30:00Z",
  "last_incremental_at": "2026-05-15T09:12:00Z",
  "docs": {
    "docs/architecture/auth.md": {
      "content_sha256": "abc123...",
      "last_processed_at": "2026-05-10T14:32:00Z",
      "produced_nodes": [
        "practice/practice-auth-flow.md",
        "map/map-auth-module.md"
      ]
    },
    "README.md": {
      "content_sha256": "def456...",
      "last_processed_at": "2026-05-10T14:30:30Z",
      "produced_nodes": []
    }
  }
}
```

`produced_nodes` is informational (useful for `ai-knowledge-base status` and future v2 features); incremental bootstrap doesn't currently use it for anything beyond reporting. Entries are bare `<kind>/<filename>.md` paths relative to `nodes/`.

## 7. Consume pipeline (`SessionStart`)

Two hooks fire on `SessionStart`, with different sync/async modes:

1. **`kb-proposal-drain.mjs`** (`async: true`): drains the proposal queue (§5.2) without blocking session start.
2. **`kb-session-start.mjs`** (sync): handles injection and nudge:
   - Read `INDEX.md`. If missing, generate a stub ("KB is empty").
   - Read `.ai/knowledge-base/.state/state.json` for `last_nudged_at`.
   - Count session logs with `proposal_status: done` not yet referenced by any proposal. If count ≥ threshold AND now − `last_nudged_at` ≥ 1 hour, append nudge line and update `last_nudged_at`.
   - Emit INDEX content + optional nudge as injected context.

Both hooks check `KB_BUILDER_INTERNAL` env var and exit immediately if set, preventing recursion when the proposal drain spawns its own `claude -p`.

### 7.1 Stale INDEX handling

If `INDEX.md`'s `nodes_hash` doesn't match the current hash of `nodes/`, the injection still happens but a warning line is appended: `KB index is stale; run 'ai-knowledge-base index rebuild' to refresh.` The optional pre-commit check (installed by `init`, off by default) refuses commits with stale INDEX.

### 7.2 Missing `derived_from` references

Silent ignore in consume path. `ai-knowledge-base doctor --verbose` lists dangling references. Curator treats unresolved `derived_from` as "evidence not available" and proceeds.

### 7.3 `kb-lint-tick.mjs` (SessionEnd, async)

Maintenance hook registered under SessionEnd with `async: true`. On every SessionEnd, it increments `sessions_since_last_lint` in `.ai/knowledge-base/.state/lint-state.json`. When the counter reaches `lintEveryNSessions` (default 50, configurable in `config.yaml`), the hook invokes `runLint` against `nodes/`, writes the result summary (`last_lint_at`, `last_errors`, `last_findings`) back to the state file, and resets the counter to 0. Recursion-guarded by `KB_BUILDER_INTERNAL=1`: if the env var is set, the hook exits immediately, preventing the spawned `claude -p` subprocess from re-triggering the lint on its own SessionEnd events. The summary surfaces on the next `kb-session-start.mjs` invocation as a one-line nudge; running `ai-knowledge-base lint` clears it.

## 8. INDEX.md design

INDEX.md is a catalog the SessionStart hook injects into every conversation. Every node appears (no eviction). Each bullet is title, path, and `#`-prefixed tags; the full summary lives in the node file, reached on demand. INDEX, node files, and GRAPH.md form three layers: INDEX is the catalog, node files are the detail, GRAPH is the traversal companion.

```markdown
---
schema_version: 1
nodes_hash: sha256:<hash>
node_count: 47
---

# KB Index

_47 nodes • ~9400 estimated tokens_

## Conventions (how we build)
- **<title>** [`nodes/practice/<slug>.md`] #tag-a #tag-b

## Components (what exists)
- **<title>** [`nodes/map/<slug>.md`] #tag-a #tag-b

## By topic
- **#tag-a (4):** <title-1>, <title-2>, <title-3>, <title-4>
```

Algorithm (single-pass render, no partition step):
1. Load all nodes.
2. Compute incoming edge counts (`relates_to` plus `depends_on`) across the full set.
3. Group by `kind`. Within `Conventions` (kind `practice`) and `Components` (kind `map`), sort by in-degree DESC then title ASC.
4. Render each bullet as title, path, and `#`-prefixed tags. No summary.
5. Render `## By topic`: every distinct tag, sorted by bucket size DESC then alpha; titles within a bucket sorted by in-degree DESC then alpha.
6. Write the header line `_N nodes • ~T estimated tokens_`, where `T` is the rough token total across the rendered index body.
7. Stamp `nodes_hash` for stale-detection.

### 8.1 `nodes_hash` definition

Deterministic across filesystems, independent of mtimes:

```
1. Walk all `.md` files under nodes/ recursively.
2. For each file, compute sha256(file_contents).
3. Build a list of strings: "<relative-path-from-nodes-dir>\t<sha256-hex>"
4. Sort the list lexicographically by the string.
5. Join with newlines (\n).
6. nodes_hash = sha256(joined-string), hex-encoded.
```

Excludes any file outside `nodes/`. `GRAPH.md` is the unfiltered, full edge listing: never injected, available for the AI to read when needed.

## 9. Tech stack

- **Runtime:** Node.js 22+. Required for native TS stripping in source files; hooks ship as compiled `.mjs` so consumers need only Node 22+ on PATH.
- **Language:** TypeScript 5.5+, strict mode, ESM-only.
- **Build:** `tsup` (zero-config dual-bundle). `src/` → `dist/` for the CLI/library; `src/templates-source/` → `templates/` for shipping.
- **Validation:** [`zod`](https://zod.dev) for all schemas (frontmatter, prompt outputs, settings, queue file, stream-json messages).
- **Frontmatter:** [`gray-matter`](https://github.com/jonschlinkert/gray-matter).
- **Token counting:** `@anthropic-ai/tokenizer` if available at implementation time, else a documented 4-chars-per-token heuristic. Used by curate/bootstrap chunking; INDEX.md is not token-gated.
- **AI calls:** `claude -p` subprocess via `execa`. No SDK package dependency. The user's existing Claude Code installation is the runtime.
- **Process spawning:** [`execa`](https://github.com/sindresorhus/execa) for cross-platform subprocess work (`claude -p` invocations).
- **Secret scanning:** [`secretlint`](https://github.com/secretlint/secretlint) with `@secretlint/secretlint-rule-preset-recommend`. Called programmatically from the capture hook via `@secretlint/core`'s `lintSource()`. Plain npm packages, no per-platform binaries.
- **CLI:** [`commander`](https://github.com/tj/commander.js).
- **Interactive prompts (`node add`):** [`@inquirer/prompts`](https://github.com/SBoudrias/Inquirer.js).
- **Stream parsing:** [`split2`](https://github.com/mcollina/split2) for line-delimited JSON streams from `claude -p --output-format stream-json`.
- **Testing:** `vitest`.
- **Release:** `semantic-release`.
- **Lint/format:** ESLint flat config + Prettier.

### 9.1 Why compiled JS for hooks (not TS at runtime)

Consumers may not have a TS toolchain. Shipping hooks as `.mjs`:
- Runs on plain Node 22+ with no extra setup.
- No `tsx` / `ts-node` version drift.
- Faster (no on-the-fly stripping).

### 9.2 Why subprocess instead of SDK package

Three reasons:
- The `claude -p` CLI is the most stable surface Anthropic ships; SDK package names and APIs have changed several times. Subprocess invocation insulates us from that drift.
- Inheriting user auth (OAuth subscription or API key) without explicit configuration. The user's `claude` PATH binary is already authenticated.
- Easier sandboxing: `--allowedTools` and the `KB_BUILDER_INTERNAL` env var give us explicit boundaries on what the spawned instance can do and what hooks fire.

## 10. Adapter interface

All assistant-specific logic lives in `src/adapters/<name>.ts`. v1 ships only `adapters/claude.ts`.

```typescript
import type { ZodSchema } from 'zod';

export type HookEvent =
  | 'Stop'
  | 'SessionEnd'
  | 'PreCompact'
  | 'SessionStart'
  | 'UserPromptSubmit';

export interface HookSpec {
  event: HookEvent;
  scriptPath: string;        // relative to hookInstallPath()
  matcher?: string;          // assistant-specific filter
  async?: boolean;
}

export interface SkillSpec {
  name: string;              // "kb-curate"
  description: string;       // what the skill does; used for auto-invocation
  body: string;              // markdown body of SKILL.md
  allowedTools?: string;     // raw value for `allowed-tools` frontmatter
}

export interface HeadlessOpts {
  timeoutMs?: number;        // default 60_000
  allowedTools?: string[];   // empty array = none
  logFile?: string;          // path to write stream-json output
}

export interface RoleTaggedTranscript {
  user: string[];
  agent: string[];
  interleaved: Array<{ role: 'user' | 'agent'; text: string }>;
}

export interface Adapter {
  name: string;                                             // "claude" | "cursor" | ...

  hookInstallPath(): string;                                // ".claude/hooks"
  skillInstallPath(): string;                               // ".claude/skills"

  writeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void>;

  readTranscript(hookInput: unknown): Promise<RoleTaggedTranscript>;

  // Spawns a headless instance, streams output to logFile if given,
  // parses the final result, validates it against schema. Throws on
  // persistent failure.
  runHeadless<T>(
    promptBody: string,
    stdin: string,
    schema: ZodSchema<T>,
    opts?: HeadlessOpts
  ): Promise<T>;

  // Renders the body of `.claude/skills/<name>/SKILL.md` for Claude Code.
  // For other assistants, this can adapt to whatever in-session UX format
  // they support (custom prompts, command palettes, etc.).
  renderSkill(spec: SkillSpec): string;
}
```

`adapters/claude.ts` implements `runHeadless` as `execa('claude', ['-p', promptBody, '--allowedTools', allowedTools.join(','), '--output-format', 'stream-json', '--verbose'], { input: stdin, env: { ...process.env, KB_BUILDER_INTERNAL: '1' } })`, piping stdout through `split2` to both `logFile` and a parser that finds the final result message.

## 11. Key decisions and rationale

### 11.1 Markdown-as-graph, not a database

**Decision.** Plain markdown with frontmatter-defined edges, no SQLite/Neo4j/vector store.

**Why.** Consumer path requires zero infrastructure. Review workflow is git-native.

### 11.2 Two node kinds with tags, not five categories

**Decision.** `practice` and `map`. Tags handle finer distinctions.

**Why.** Earlier five-category scheme caused boundary ambiguity. Two clean kinds matching the two extraction passes eliminate miscategorization.

### 11.3 Async hook + `claude -p` subprocess for proposal generation

**Decision.** The drain hook is `async: true`, doesn't block session start. Inside it, each queue entry spawns a `claude -p` subprocess with `--output-format stream-json --verbose`, with output captured to `_logs/proposal/`. Recursive triggering is prevented by `KB_BUILDER_INTERNAL=1` env var.

**Why.** Solves session unblocking, SDK-package-name churn, and cross-platform process semantics in one move. `async: true` is Anthropic's blessed mechanism (released Jan 2026); `claude -p` is the most stable Claude Code surface.

**Trade-off.** Stdout from async hooks is not injected into the parent session. Status surfaces via `ai-knowledge-base status` and inline on subsequent sessions. ~1-3s startup per subprocess invocation is irrelevant at typical queue depths.

### 11.4 Verbose stream-json logging

**Decision.** Both proposal and curator runs produce stream-json verbose output, written to `.ai/knowledge-base/_logs/{proposal,curator}/<id>__<timestamp>.jsonl`. Logs are gitignored.

**Why.** When the model does something unexpected, the user needs to see exactly what it saw and produced. Stream-json captures every step (assistant text, tool calls, results). Per-run files with id+timestamp prevent collisions on re-runs.

**Trade-off.** Logs grow without bound. v1.5 ships `ai-knowledge-base logs prune --older-than <duration>`.

### 11.5 Replacement deletes the old node

**Decision.** When the user resolves a curator contradiction with Replace, the existing `nodes/<kind>/<id>.md` file is deleted and the proposed node is written in its place. Reject leaves disk untouched. There is no third option.

**Why.** Git history is the timeline of record. A binary menu keeps the conflict-resolution UX trivial and keeps node files free of bookkeeping that duplicates `git log`.

### 11.6 Provenance via `derived_from`

**Decision.** Every node carries session log filenames that produced or modified it.

**Why.** Reviewers can trace nodes back to their source conversation. Curator has evidence on hand.

**Trade-off.** Default gitignore on `_sessions/` means provenance only resolves for the original contributor unless the team commits sessions. Missing references degrade silently.

### 11.7 Token-budgeted INDEX

**Decision.** Injection capped at ~2000 tokens, one-line summaries only.

**Why.** Forces tight summaries. Forces progressive disclosure.

### 11.8 SHA-256 dedup window

**Decision.** Capture hooks dedupe on a 5-minute SHA-256 window.

**Why.** Stop, SessionEnd, and PreCompact can fire on overlapping content.

### 11.9 Two-stage capture

**Decision.** Transcript capture is deterministic and self-sufficient; proposal generation is LLM-driven, deferred and retryable.

**Why.** If the LLM fails, raw redacted transcripts still exist. Proposal generation can be re-run and improved without losing data.

### 11.10 Human-in-the-loop curation via git

**Decision.** Skills, the curator, manual-add, and bootstrap all write directly to `nodes/`. The review gate is git: `git diff` to inspect, `git restore` to reject, `git commit` to accept. The pre-commit hook regenerates and stages `INDEX.md`/`GRAPH.md` so the index can never land out of sync with the committed nodes.

**Why.** A single review surface (git) and a single frontmatter shape (`NodeFrontmatterSchema`) keep the contributor's mental model small: the workflow is the same as for code, the diff tooling is the same, and the index can't drift from what's committed. The human-in-the-loop guarantee (no node enters the KB without a human `git commit`) is enforced by the absence of any code path that commits on the user's behalf. Contradictions, which can't translate to a direct write because two competing claims would mean two competing files, are surfaced to the user in-session via `.state/pending-conflicts.json` and resolved by the kb-curate skill.

### 11.11 Secret scanning belt-and-suspenders, from M0

**Decision.** Secretlint (with `@secretlint/secretlint-rule-preset-recommend`) runs both inside the capture hook (programmatically via `@secretlint/core`) and as a husky `pre-commit` hook through `lint-staged`. Both shipped from M0.

**Why.** Defense in depth. Capture covers automation-written files; the pre-commit hook covers user-pasted content. Both pass through the same scanner so the rule set stays consistent.

### 11.12 Schema version from day 1

**Decision.** Every frontmatter carries `schema_version: 1`.

**Why.** Cheap now, painful to retrofit. The migrator itself is v2.

### 11.13 Multi-assistant: future, isolated today

**Decision.** Adapter interface (§10); only `adapters/claude.ts` ships in v1.

**Why.** Avoids the cost of designing for plurality without paying the cost of supporting it.

### 11.14 Inline INDEX/GRAPH regen during curate

**Decision.** Curate produces proposals AND regenerates INDEX/GRAPH atomically.

**Why.** Sidesteps git-hook propagation, Husky dependency, and CI auto-commit complications.

### 11.15 Hourly nudge throttle

**Decision.** Once threshold is exceeded, nudge on next `SessionStart` and at most once per hour after that. Tracked via `last_nudged_at` in `.ai/knowledge-base/.state/state.json`.

**Why.** Hourly handles bursty session starts without becoming wallpaper.

### 11.16 Role-aware extraction

**Decision.** Pass 1 (practice) operates only on user turns. Pass 2 (map) draws from both. Adapter's `readTranscript` returns role-tagged content.

**Why.** Without role-awareness, agent paraphrasing of user instructions generates spurious capture.

### 11.17 Pass-ownership boundary in proposal generation

**Decision.** Imperative content (do/don't/why) belongs to pass 1; nominative content (named entities) belongs to pass 2. They reference each other via curator-populated `relates_to` edges.

**Why.** Prevents the two passes both capturing the same content.

### 11.18 Curator batches

**Decision.** Curator processes pending logs in batches sized by token budget (~10 logs each). Final dedup pass merges proposals across batches.

**Why.** Without batching, a stale-curation backlog blows the input budget on a single call.

### 11.19 Moderate schema-versioning policy

**Decision.** `schema_version` bumps when fields are renamed, removed, or change semantics. Adding new optional fields does **not** bump the version.

**Why.** Strict (any change bumps) creates noise and over-frequent migrations. Loose (only breaking changes) means nodes written under different "v1" schemas may have meaningfully different shapes, complicating tools. Moderate is the practical middle: tools written for v1 can ignore unknown additive fields safely, but renames/removals/semantic-shifts get an explicit migration boundary.

**Concretely:**
- `schema_version: 1 → 2` on: removing `confidence`; renaming `derived_from` to `sources`; changing `kind` from string to enum-with-different-values; making a previously-optional field required.
- No bump on: adding optional `category_v2`; adding `last_reviewed_at`; relaxing a regex constraint.

The policy is documented in the project's CONTRIBUTING.md so future schema authors apply it consistently.

### 11.20 Manual-add path uniformity

**Decision.** Both `ai-knowledge-base node add` (CLI) and `/kb-add` (slash command) write directly to `nodes/<kind>/<id>.md`. Acceptance is `git commit`; rejection is `git restore <path>`.

**Why.** Two reasons. First, the human-in-the-loop guarantee is uniform: every node enters the KB through a `git commit`, regardless of source (manual, curator, bootstrap). Second, this gives v1 a low-friction answer to "false-negative detection": contributors who notice missing knowledge can capture it directly without waiting for a session that happens to teach the same thing. The acceptance metric (≥80% of curator outputs accepted) only catches false positives; manual-add is the workaround for false negatives.

### 11.21 Two-tool bootstrap design

**Decision.** Bootstrap from existing docs ships as two separate tools: `/kb-bootstrap` (agent-driven, in-session, for first-time use) and `ai-knowledge-base bootstrap-incremental` (CLI, deterministic, for re-runs).

**Why.** The two jobs have opposite characteristics. First-time bootstrap on a real project's messy docs needs judgment: following cross-references, recognizing boilerplate, understanding project conventions. That's an in-session agent task with the user supervising. Trying to do this with a fixed CLI prompt produces a flood of mediocre proposals that takes longer to review than running the agent once. Incremental bootstrap on a few changed files needs the opposite: cheap, deterministic, scriptable, no supervision. A 20-minute agent exploration for three new files is wrong; a chunked `claude -p` extraction is right.

**Trade-off accepted.** Two tools to maintain instead of one. Two prompts to keep aligned (the slash command body and the bootstrap-incremental prompt). Documented separately in the docs site under a single Bootstrap section. This is the cost of matching the tool to the job rather than forcing one approach onto both.

**Shared infrastructure.** Both tools write to the same proposal directory, use the same proposal frontmatter schema, and update the same `bootstrap-state.json`. The state file means the slash command's run can hand off cleanly to future incremental runs without re-processing the same docs.

## 12. Implementation phases

Each phase shippable on its own.

**M0 (Project skeleton + secret scanning + docs foundation).** npm package, TS+ESM build, `init` command that copies stub `.ai/knowledge-base/` and `.claude/`, scaffolds the husky + lint-staged + secretlint commit-time scan, writes `.ai/knowledge-base/.state/installed-version`. `ai-knowledge-base doctor` checks secretlint resolves in node_modules, Node version, and `claude` CLI availability. Documentation foundation ships here too: minimal top-level `README.md`, `CONTRIBUTING.md` skeleton, in-KB `README.md` template that `init` copies, and the Jekyll/Just-the-Docs site skeleton (Home + Getting Started shell, deployed to GitHub Pages). No KB functionality yet, but the security guarantee and documentation scaffolding are in place from day 1.

**M1 (Transcript capture for all three triggers).** `Stop`, `SessionEnd`, and `PreCompact` hooks ship together. Session-id boundary check, secretlint redaction, write session logs (one file per `session_id`, overwritten on re-fire). Stress-test PreCompact on long sessions during this phase.

**M2 (Proposal drain).** `kb-proposal-drain.mjs` async SessionStart hook. Adapter's `runHeadless` implementation invoking `claude -p --output-format stream-json --verbose`. Stream-json log writing under `_logs/proposal/`. Two-pass extraction prompt with role-aware rules. Tests with a mocked subprocess against fixture transcripts.

**M3 (Curate pipeline + manual-add).** `/kb-curate` slash command, curator prompt with batching and contradiction handling, direct writes to `nodes/`, conflict side-channel at `.state/pending-conflicts.json`. Lock file with PID + TTL. `_logs/curator/` writing. Inline INDEX regen happens here, plus the `index rebuild --stage` flag and the `.lintstagedrc.cjs` entry that runs it on every commit so INDEX/GRAPH stay in lockstep with `nodes/`. Review is git: `git diff nodes/` to inspect, `git commit` to accept, `git restore` to reject. Manual-add path (`ai-knowledge-base node add` and `/kb-add`) ships in this phase since it shares the node-write infrastructure.

**M3.5 (Bootstrap from existing docs).** `/kb-bootstrap` skill (agent-driven, in-session) for first-time bootstrap. `ai-knowledge-base bootstrap-incremental` CLI for re-runs. `bootstrap-state.json` schema and Zod validator. `_logs/bootstrap-incremental/` writing. Bootstrap-specific prompts under `templates/prompts/bootstrap-incremental.md` and `templates/claude/skills/kb-bootstrap/SKILL.md`. Both write directly to `nodes/` and never overwrite existing files (collisions are skipped and reported). Ships after M3 because it depends on the node-write infrastructure and the chunking pattern (curator). Optional path for users; empty-KB start still works without invoking either bootstrap tool.

**M4 (SessionStart consumption).** `INDEX.md` generator (called inline by curate), `kb-session-start.mjs` hook, threshold nudge with hourly throttle, stale-INDEX detection, dangling-`derived_from` doctor warnings.

**M5 (Polish + complete docs site).** `index rebuild` CLI, doctor checks expanded, CI recipe, and the docs site brought to completion: all reference pages filled in, troubleshooting guide written, architecture page for would-be adapter authors. (No multi-assistant adapter, no `init --upgrade`, no `logs prune`; those are explicitly v2/v1.5.) See §15 for the per-phase doc-work distribution.

## 13. Testing strategy

- **Unit tests** (`vitest`): frontmatter parsers, schema validators, INDEX generator (golden files), `nodes_hash` computation, secretlint redaction & finding-to-range conversion, lock TTL, stale-INDEX detection, role-tagged transcript splitting, stream-json line parser, session-id boundary check.
- **Integration smoke tests with mocked subprocess:** proposal extractor against fixture transcripts (covering teaching moments, project-map introductions, role-aware filtering, ownership boundary cases); curator against fixture session-log + node sets (covering add/modify/contradict/drop, add-collision and missing-target failures, conflict side-channel population, batching, dedup).
- **Real-`claude` end-to-end suite:** a separate test suite (run on demand, not in CI by default) exercising one full capture → drain → curate → consume cycle against the actual `claude -p` CLI with a controlled fixture transcript. Catches drift in CLI behavior or prompt regressions that mocks miss.
- **Manual testing checklist** in `docs/manual-test-plan.md`: PreCompact timing, hook installation on Windows, secretlint redaction on each platform, real session capture quality, log file rotation behavior.

## 14. Open implementation questions

1. **Settings file.** `.ai/knowledge-base/config.yaml` (committed) for token budget, threshold, drain bound, bootstrap-incremental token budget. (Secretlint config lives in the repo-root `.secretlintrc.json`, not here.) User-level overrides at `~/.config/ai-knowledge-base/config.yaml`. Project settings win.

2. **Proposal timeout.** Per-entry subprocess timeout (default 60s). On timeout, mark `failed` and continue.

3. **Tokenizer fallback.** If `@anthropic-ai/tokenizer` is unavailable, fall back to 4-chars-per-token heuristic. Documented in `ai-knowledge-base doctor`.

4. **Log retention.** `_logs/` grows unbounded across all subdirectories (`proposal/`, `curator/`, `bootstrap-incremental/`). v1.5: `ai-knowledge-base logs prune --older-than <duration>`.

5. **Bootstrap-incremental overlap detection.** v1 always emits `addition` proposals; reviewer rejects duplicates. v2 may add curator-style modify/contradict logic. Decision deferred until real usage shows whether this matters.

## 15. Documentation deliverables

Documentation has three layers, mirroring the pattern set by `e0ipso/ai-task-manager`:

### 15.1 Top-level GitHub/npm `README.md` (minimal)

Intentionally short, under ~80 lines. Contents:
- npm version + license badges
- One-paragraph pitch
- Quick-start snippet (`npx <pkg> init --assistants claude`)
- Link to the docs site
- Link to `CONTRIBUTING.md` for contributors

The README is **not** the documentation. It's the front door. All real content lives on the docs site.

### 15.2 In-KB `README.md` template

Copied by `init` into `.ai/knowledge-base/README.md`. Explains to a teammate browsing the KB:
- What this directory is.
- How knowledge gets here (capture → curate → consume, briefly).
- How to read a node (kind, provenance, relations).
- How to propose a new node manually (`ai-knowledge-base node add` or `/kb-add`).
- Link to the project docs site for deeper info.

Aimed at the **consumer** persona: someone who pulls the repo and wonders what `.ai/knowledge-base/` is.

### 15.3 Docs site

Stack: **Just the Docs** (Jekyll theme), served via **GitHub Pages** from `/docs` on `main`. Matches the ai-task-manager pattern. No Node build for the site itself; GitHub Pages renders Jekyll natively.

Local preview requires `bundler` + `jekyll` (Ruby toolchain). Documented in `CONTRIBUTING.md`. CI deploys on push to `main`.

Site structure:

```
Home                              Minimal landing (pitch, quick start, links)
Getting Started
  ├── Installation & first init   Setup walkthrough
  └── First capture → curate      End-to-end first-run experience
Core Concepts
  ├── How it works                Capture / curate / consume pipeline
  └── Knowledge model             practice/map, provenance, relations
Bootstrap
  ├── First-time bootstrap        /kb-bootstrap agent-driven walkthrough
  └── Incremental bootstrap       ai-knowledge-base bootstrap-incremental CLI usage
Customization
  ├── Editing the prompts         proposal, curator, and bootstrap prompt customization
  └── Settings reference          config.yaml and user-level overrides
Reference
  ├── CLI commands                Every ai-knowledge-base subcommand
  ├── Skills                      /kb-curate, /kb-show, /kb-add, /kb-bootstrap, /kb-propose-from-session
  ├── Frontmatter schemas         Node, session log, proposal (full Zod schemas)
  ├── Hook events                 Stop / SessionEnd / PreCompact / SessionStart
  └── Failure modes               One page per failure type with recovery steps
Troubleshooting
  ├── Reading _logs/              How to interpret stream-json traces
  └── Common issues               FAQ-style, grows over time
Architecture                      For contributors and future adapter authors
```

### 15.4 `CONTRIBUTING.md`

Lives at the repo root. Aimed at maintainers of @e0ipso/ai-knowledge-base itself, not consumers. Contents:
- How to set up the dev environment (Node 22+, `pnpm install`, etc.)
- How to run tests (`vitest`, integration suite)
- **Schema-version bump policy** (the moderate policy from §11.19, with examples)
- Prompt versioning policy: each `templates/prompts/*.md` has a top-of-file version comment; bumping the prompt version is independent of the package version, but a prompt change must be noted in the changelog
- Release process (semantic-release handles tagging, npm publish, and changelog generation; no manual steps)
- How to preview the docs site locally (`bundle exec jekyll serve`)

### 15.5 Per-phase documentation distribution

Documentation grows with the code, not all at the end. Per-phase doc work:

| Phase | Documentation work |
|---|---|
| M0 | Top-level README; CONTRIBUTING.md; in-KB README template; docs site skeleton (Home + empty Getting Started shell); GitHub Pages deployment configured |
| M1 | Reference > Hook events; Reference > CLI command coverage for `init`, `doctor`, `status`; Getting Started > Installation page completed |
| M2 | Customization > Editing the proposal prompt; Reference > Settings (token budget, drain bound, threshold); Troubleshooting > Reading `_logs/proposal/` |
| M3 | Reference > Skills; Reference > CLI for `curate`, `node add`, `index rebuild --stage`; Review-via-git workflow page; Customization > Editing the curator prompt; Troubleshooting > Reading `_logs/curator/` and resolving `pending-conflicts.json`; Getting Started > First capture → curate (end-to-end walkthrough) |
| M3.5 | Bootstrap > First-time bootstrap (`/kb-bootstrap` agent-driven walkthrough); Bootstrap > Incremental bootstrap (CLI usage, glob filters, dry-run, collision reporting); Customization > Editing the bootstrap-incremental prompt; Reference > `bootstrap-state.json` schema; Reference > CLI for `bootstrap-incremental` |
| M4 | Core Concepts > How it works; Core Concepts > Knowledge model; Reference > Frontmatter schemas; INDEX/GRAPH explanation |
| M5 | Troubleshooting > Common issues (seeded with whatever the team has hit during M1 through M4 testing); Architecture page; final pass on every page for accuracy |

Each phase's PR includes its own doc updates. No PR ships code without the corresponding docs section being updated or stubbed with a "coming in M<n>" notice.

### 15.6 Documentation principles

- **README is a billboard, not a manual.** Anything more than the pitch + quick-start belongs on the docs site.
- **Every CLI command, skill, config key, and frontmatter field has a reference page entry.** No exceptions; the doctor command can verify completeness.
- **Examples beat prose.** Each customization page has a working before/after example.
- **Show stream-json traces in troubleshooting docs.** Real fragments from real runs, redacted, with annotations.
- **Architecture page is honest about trade-offs.** Documents what was rejected and why, not just what was chosen; future adapter authors need this context.
