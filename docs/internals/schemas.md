---
title: Schemas
parent: Internals
nav_order: 3
---

# Schemas

Every YAML frontmatter and JSON state file is validated by a Zod schema at read time. Node, index, and graph artifacts carry `schema_version: 2` (the tree-storage clean break); all other shapes carry `schema_version: 1`.

{% include callout.html variant="note" content="[`src/lib/schemas.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/schemas.ts) is the source of truth. When this page disagrees with the code, the code wins." %}

{% include callout.html variant="warning" content="A schema mismatch is a parse failure: the file is SILENTLY dropped." %}

## Node (`nodes/<topic>/<id>.md`)

Leaf nodes live in topical folders under `nodes/` at any depth; the filename is always `<id>.md`. Every folder under `nodes/` also carries a generated `index.md` (an index node, see below), which is never a leaf.

```yaml
---
schema_version: 2
id: practice-prefer-constructor-injection   # <kind>-<slug>
title: "..."
kind: practice | map
tags: [string, ...]
derived_from:
  - 20260510-1014-session-abc.md
relates_to: [string, ...]
depends_on: [string, ...]
confidence: low | medium | high
summary: "≤140 char summary, used in index nodes"
---
```

Validated by `NodeFrontmatterSchema`. Git history is the timeline of record; the frontmatter carries no separate timestamps.

| Field | Meaning |
|---|---|
| `schema_version` | Integer schema marker. A mismatch is a parse failure; the reader rejects the old flat layout / `schema_version: 1` and points to the `kk-migrate` skill (run in an agent session; the in-host clustering drives the deterministic `place` primitive). |
| `id` | Stable identifier `<kind>-<slug>`. Referenced by `relates_to`, `depends_on`, `derived_from`, and `target_node_id` on curator actions. All cross references are by `id`; path is presentation. |
| `title` | Human-readable label rendered in the folder's index node. |
| `kind` | `practice` (how we build) or `map` (what exists). A pure facet: drives only the Conventions / Components rendering split, NOT directory placement. |
| `tags` | Free-form labels for the `## By topic` section in the folder's index node. |
| `derived_from` | Sources (session log filename, repo-relative doc path, or absolute path). `doctor --verbose` lists dangling refs; the consume path silently ignores them. |
| `relates_to` | Loose cross-references, rendered in `GRAPH.md`. Not enforced. |
| `depends_on` | Strict cross-references, rendered in `GRAPH.md`. Not enforced. |
| `confidence` | `low`, `medium`, or `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale. |
| `summary` | ≤140-character one-liner rendered in the folder's index node. |

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
kind: practice | map
tags: [string, ...]
title: <string>
summary: <≤140 chars>
body: <markdown>
confidence: low | medium | high
supports_existing_node: <node-id> | null
contradicts_existing_node: <node-id> | null
```

Validated by `ProposalCandidateSchema`. Top-level: `ProposalOutputSchema = { practice: [...], map: [...] }`.

## Bootstrap candidate

Superset of the proposal candidate with `derived_from`. `supports_existing_node` and `contradicts_existing_node` are always `null` in bootstrap output. Validated by `BootstrapCandidateSchema`.

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

## Index node (`index.md`) and GRAPH.md frontmatter

```yaml
schema_version: 2
nodes_hash: sha256:<hex>
node_count: 47
```

Validated by `IndexFrontmatterSchema` / `GraphFrontmatterSchema`. Every folder under `nodes/` carries a generated `index.md` index node — a deterministic table-of-contents rollup of its child leaves and immediate subfolders, ordered by graph in-degree then title. The top-level catalog `ENTRY.md` is a purpose-built whole-tree launchpad (totals plus the branch list), not a per-folder index node. For a folder index node, `node_count` is the folder's direct leaf count; for `ENTRY.md` it is the whole-tree total. Index nodes are generated artifacts, excluded from `nodes_hash`.

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
  "lock": { "name": "...", "pid": 12345, "acquired_at": "...", "ttl_ms": 1800000 },
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

`lock` is `null` when no lock is held. Validated by `StateFileSchema`. Gitignored.

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
