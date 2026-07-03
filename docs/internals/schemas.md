---
title: Schemas
parent: Internals
nav_order: 3
---

# Schemas

Every YAML frontmatter and JSON state file is validated by a Zod schema at read time. As of `schema_version` 3, the `nodes/` tree is a conformant [Open Knowledge Format (OKF v0.1)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle: leaves use OKF's native `type` / `title` / `description` / `tags` keys, and every kenkeep-only field rides under the `kk_` extension namespace (`kk_schema_version`, `kk_id`, `kk_relates_to`, `kk_depends_on`, `kk_derived_from`, `kk_confidence`). A leaf carries `kk_schema_version: 3`; the kenkeep-owned `ENTRY.md` and `GRAPH.md` artifacts carry `schema_version: 3`; all other shapes carry `schema_version: 1`.

{% include callout.html variant="note" content="[`src/lib/schemas.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/schemas.ts) is the source of truth. When this page disagrees with the code, the code wins." %}

{% include callout.html variant="warning" content="A schema mismatch is a parse failure: the file is SILENTLY dropped." %}

## Node (`nodes/<topic>/<id>.md`)

Leaf nodes live in topical folders under `nodes/` at any depth; the filename is always `<kk_id>.md`. Every folder under `nodes/` also carries a generated `index.md` (an OKF reserved index file, see below), which is never a leaf.

```yaml
---
type: practice | map                      # OKF native
title: "..."                              # OKF native
description: "one-line summary"          # OKF native
tags: [string, ...]                       # OKF native
kk_schema_version: 3
kk_id: practice-prefer-constructor-injection   # <type>-<slug>
kk_derived_from:
  - 20260510-1014-session-abc.md
kk_relates_to: [string, ...]
kk_depends_on: [string, ...]
kk_confidence: low | medium | high
---
```

Validated by `NodeFrontmatterSchema`. A leaf is an OKF concept document: the four unprefixed keys are OKF's own vocabulary, and the `kk_`-prefixed keys are kenkeep extensions (OKF explicitly permits producer extension keys). Git history is the timeline of record; the frontmatter carries no separate timestamps. Two body sections are regenerated deterministically from the edge/provenance arrays on every write — a labeled `Related` links section (from `kk_relates_to` / `kk_depends_on`) and a numbered `# Citations` section (from `kk_derived_from`) — so plain OKF consumers can traverse the graph and see provenance; both are fenced (`<!-- kk:related:start -->` … `<!-- kk:citations:end -->`) for idempotent regeneration and never touch hand-written prose.

| Field | OKF? | Meaning |
|---|---|---|
| `type` | native | `practice` (how we build) or `map` (what exists). A pure facet: drives only the Conventions / Components rendering split, NOT directory placement. |
| `title` | native | Human-readable label rendered in the folder's index node. |
| `description` | native | One-liner rendered in the folder's index node and used as the preview. |
| `tags` | native | Free-form labels for the `## By topic` section in the folder's index node. |
| `kk_schema_version` | ext | Literal `3`. A mismatch is a parse failure; the reader rejects `schema_version: 2` / the old flat layout / `schema_version: 1` and points to the `kk-migrate` skill (run in an agent session). |
| `kk_id` | ext | Stable identifier `<type>-<slug>`. Referenced by `kk_relates_to`, `kk_depends_on`, `kk_derived_from`, and `target_node_id` on curator actions. All cross references are by id; path is presentation. OKF's own concept identity (the file path) is unstable under rebalance moves, which is why `kk_id` persists. |
| `kk_derived_from` | ext | Provenance sources (session log filename, repo-relative doc path, or absolute path). Rendered into the `# Citations` body section. `doctor --verbose` lists dangling refs; the consume path silently ignores them. |
| `kk_relates_to` | ext | Loose cross-references, rendered in `GRAPH.md` and the `Related` body section. Dangling-checked by lint. |
| `kk_depends_on` | ext | Strict cross-references, rendered in `GRAPH.md` and the `Related` body section. Defaulted to `[]` so older nodes still parse. |
| `kk_confidence` | ext | `low`, `medium`, or `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale. |

### Two kinds

- **Practice**: _how we build._ Imperative guidance.
- **Map**: _what exists._ Named entities (modules, services, vocabulary).

The proposal prompt splits combined statements: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes one practice (use the dispatcher) and one map (what the dispatcher is).

### Conflict resolution

On a `contradict` action, `/kk-curate` walks each pending file under `.ai/kenkeep/conflicts/` with the user. The menu is three-way and git-driven:

| Choice | On-disk effect | Side effects |
|---|---|---|
| Accept | Skill rewrites the existing leaf `<target_node_id>.md` (located by `id` in its topical folder under `nodes/`) from the proposed body. | Contributor `git restore`s the conflict file to discard it. |
| Reject | None. The existing node file is untouched. | Contributor `git restore`s the conflict file to discard it. |
| Keep as record | None to the node tree. | Contributor `git commit`s the conflict file; it stays in `.ai/kenkeep/conflicts/` as durable history for future curate runs to read. |

## Conflict files (`conflicts/<run-id>-<n>.md`)

The curator records `contradict` actions as one markdown file per conflict, instead of writing conflicting nodes to disk. The shape is set inline by the curate wrapper (`src/lib/curate.ts`); there is no Zod schema (it is human-reviewed, not parsed for state).

```markdown
---
id: <run-id>-<n>
status: pending
detected_at: <ISO>
run_id: <curator run-id>
candidate_origin: <session_id>:<practice|map>:<index>
target_node_id: practice-foo
proposed_kind: practice | map
proposed_title: "..."
---

## Rationale

<curator's free-text rationale>

## Proposed node

<the proposed node body as the curator would have written it to nodes/>
```

After the curator subprocess exits, `/kk-curate` reads every file with `status: pending`, walks each with the user, and advances it via `git restore` (Reject and Accept-after-applying) or `git commit` (Keep as record). `kenkeep status` reports the pending count.

## Curator failure reports

`runCurate` returns a `failures: FailureReport[]` array alongside `conflicts`, covering two cases the curator must not paper over:

- `reason: "add_collision"`: an `add` action targets a node that already exists on disk.
- `reason: "modify_missing_target"`: a `modify` action's `target_node_id` doesn't resolve to an existing file.

Failures are reported in CLI output and not persisted; rerun the curator after fixing the underlying issue.

## Session log (`_sessions/<YYYYMMDD-HHmm-id>.md`)

```yaml
schema_version: 1
session_id: <claude-code-session-id>
captured_by: stop | session_end | pre_compact | manual
captured_at: 2026-05-11T10:00:00Z
transcript_hash: sha256:<hex>
proposal_status: pending | done | failed | skipped
proposal_completed_at: <ISO> | null
proposal_error: <string> | null
proposal_log: _logs/proposal/<id>__<ts>.jsonl | null
topics: [string, ...]
proposals:
  practice: [<ProposalCandidate>, ...]
  map: [<ProposalCandidate>, ...]
curator_processed_at: 2026-05-11T11:00:00Z   # set after curate
curator_run_id: <UUID>
```

Validated by `SessionLogFrontmatterSchema`.

## Proposal candidate

```yaml
type: practice | map
tags: [string, ...]
title: <string>
description: <one-line summary>
body: <markdown>
kk_confidence: low | medium | high
```

Validated by `ProposalCandidateSchema`. Top-level: `ProposalOutputSchema = { practice: [...], map: [...] }`. The curator resolves supersede/contradict relationships during dedup, so candidates no longer carry `supports_existing_node` / `contradicts_existing_node` hints.

## Bootstrap candidate

Same shape as the proposal candidate (`type`, `tags`, `title`, `description`, `body`, `kk_confidence`), validated by `BootstrapCandidateSchema` (`.strict()`).

## Curator action

```yaml
action: add | modify | contradict | drop
candidate_origin: "<session_id>:<practice|map>:<index>"
target_node_id: <node-id> | null
proposed_node: <CuratorProposedNode> | null   # null only for drop
rationale: <free-text>
suggested_resolution: supersede | keep_both | reject | null
```

Validated by `CuratorOutputSchema` (array of actions).

## Reserved index files, ENTRY.md / GRAPH.md, and the folder-summary sidecar

Under strict OKF conformance the `nodes/**/index.md` reserved files carry no kenkeep diagnostics:

- **Ordinary folder `index.md`** — no frontmatter at all; a body-only progressive-disclosure table of contents (child leaves and immediate subfolders, ordered by graph in-degree then title).
- **Bundle-root `nodes/index.md`** — frontmatter is exactly `okf_version: "0.1"` and nothing else, then the body.

Kenkeep's generated-artifact diagnostics move to files that live *outside* the OKF bundle, at `.ai/kenkeep/ENTRY.md` and `.ai/kenkeep/GRAPH.md`:

```yaml
# ENTRY.md and GRAPH.md frontmatter
schema_version: 3
nodes_hash: sha256:<hex>
node_count: 75
```

Validated by `IndexFrontmatterSchema` / `GraphFrontmatterSchema`. `ENTRY.md` is the whole-tree launchpad injected at session start (totals plus the branch list); `GRAPH.md` renders the edge graph. `node_count` is the whole-tree total; index bodies are generated artifacts, excluded from `nodes_hash`.

Folder summaries (branch descriptions) also leave the reserved files for a committed sidecar, `.ai/kenkeep/FOLDER_SUMMARIES.md`, keyed by POSIX folder path:

```yaml
schema_version: 1
summaries:
  cli: the init/upgrade commands and AGENTS.md pointer injection; …
  hooks: the capture, session-start, drain, and lint-tick hooks; …
```

Validated by `FolderSummaryRegistrySchema`. `generateIndex` reads a folder's summary from this sidecar to render the parent's descent pointer; `harvestFolderSummaries` / `stampFolderSummary` read and write it, so a summary survives the otherwise-total rebuild. The lint OKF-conformance rule enforces that ordinary reserved indexes stay frontmatter-free and that only the bundle root declares `okf_version`.

### `nodes_hash` algorithm

Deterministic, mtime-independent. Defined in `computeNodesHash` (`src/lib/nodes.ts`):

1. Walk all leaf `.md` files under `nodes/`, EXCLUDING every generated `index.md`.
2. For each leaf, compute `sha256(contents)`.
3. Build strings: `<relative-path>\t<sha256-hex>`.
4. Sort lexicographically.
5. Join with `\n`.
6. `nodes_hash = sha256(joined)`.

Generated `index.md` files are excluded so the hash isn't self-referential: a rebuild rewrites every `index.md`, and if those fed the hash, every rebuild would change it and break drift detection.

## State files

### `.state/state.json`

```json
{
  "schema_version": 1,
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

Validated by `StateFileSchema`. Gitignored. The file carries only `last_nudged_at`; the proposal-drain lock is a separate `proper-lockfile` directory (`state.json.lock`, 60s stale threshold), not a field in this JSON.

### `.state/bootstrap-state.json`

Records the SHA-256 of every doc the bootstrap pipelines have processed. Hash hits are skipped on re-runs.

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
        "practice-auth-flow",
        "map-auth-module"
      ]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `last_full_bootstrap_at` | Last `/kk-bootstrap` run. Never set by the CLI. |
| `last_incremental_at` | Last `bootstrap` run (via the launcher or the kk-bootstrap skill) that processed ≥1 doc. Field name retained from the pre-rename era for backward compatibility. |
| `docs[].content_sha256` | SHA-256 of file contents at processing time. |
| `docs[].last_processed_at` | Timestamp of last processing. Not updated on hash hits. |
| `docs[].produced_nodes` | Node ids written from this doc. Informational. |

Lifecycle:

- **First run**: file is created with `docs: {}`.
- **Hash hit**: doc is skipped; `last_processed_at` is not updated.
- **Hash miss**: doc is read by the kk-bootstrap skill. On success, it calls `node write --source-doc <relpath> --source-hash <sha256>`, which folds the entry into this file as part of the same atomic write. On failure, no entry is added so a re-run retries.
- **Preview discovery without writing**: run `finddocs [--from <scope>] [--with-hashes]`. Read-only, never touches `bootstrap-state.json`.
- **Force re-bootstrap**: delete the file.

A malformed file is treated as missing. Validated by `BootstrapStateSchema`. Gitignored.
