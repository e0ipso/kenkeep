---
title: Schemas
parent: Internals
nav_order: 3
---

# Schemas

Every YAML frontmatter and JSON state file is validated by a Zod schema at read time. The schemas in [`src/lib/schemas.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/schemas.ts) are the source of truth — when this page disagrees with the code, the code wins.

All shapes carry `schema_version: 1`. A schema mismatch is a parse failure; the file is silently dropped.

## Node — `nodes/{practice,map}/<slug>.md`

```yaml
---
schema_version: 1
id: practice-prefer-constructor-injection   # <kind>-<slug>
title: "..."
kind: practice | map
tags: [string, ...]
valid_from: 2026-05-10T14:30:00Z
valid_until: null                            # ISO-8601 or null
updated: 2026-05-10T14:30:00Z
supersedes: null
superseded_by: null
derived_from:
  - 20260510-1014-session-abc.md
relates_to: [string, ...]
depends_on: [string, ...]
confidence: low | medium | high
summary: "≤140 char summary, used in INDEX.md"
---
```

Validated by `NodeFrontmatterSchema`.

### Two kinds

- **Practice** — _how we build._ Imperative guidance.
- **Map** — _what exists._ Named entities (modules, services, vocabulary).

The stage-2 prompt splits combined statements: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes one practice (use the dispatcher) and one map (what the dispatcher is).

### Validity, provenance, relations

- `valid_from` / `valid_until` are ISO-8601. A node is current when `valid_until` is `null`. Accepting a `supersede` contradiction sets `valid_until` and `superseded_by` on the target. Informational; nothing enforces it.
- `derived_from` lists sources (session log filename, repo-relative doc path, or absolute path). `doctor --verbose` lists dangling refs; the consume path silently ignores them.
- `relates_to` (loose) and `depends_on` (strict) feed `GRAPH.md`. Not enforced.
- `confidence` is `low` / `medium` / `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale.

## Pending conflicts — `.state/pending-conflicts.json`

The curator records `contradict` actions here instead of writing conflicting nodes to disk. Validated by `PendingConflictsFileSchema`.

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
      "rationale": "...",
      "proposed_node": { "id": "...", "title": "...", "kind": "...", ... }
    }
  ]
}
```

The `/kb-curate` skill reads this file after the curator subprocess exits, walks each entry with the user, applies the chosen resolution by editing the relevant `nodes/<kind>/<id>.md`, and removes the resolved entry from the array. `ai-knowledge-base status` reports the count.

## Curator failure reports

`runCurate` returns a `failures: FailureReport[]` array alongside `conflicts`. Failures cover two cases the curator must not paper over:

- `reason: "add_collision"` — an `add` action targets a node that already exists on disk.
- `reason: "modify_missing_target"` — a `modify` action's `target_node_id` doesn't resolve to an existing file.

Failures are reported in CLI output and not persisted; rerun the curator after fixing the underlying issue.

## Session log — `_sessions/<YYYYMMDD-HHmm-id>.md`

```yaml
schema_version: 1
session_id: <claude-code-session-id>
captured_by: stop | session_end | pre_compact | manual
captured_at: 2026-05-11T10:00:00Z
transcript_hash: sha256:<hex>
stage_2_status: pending | done | failed | skipped
stage_2_completed_at: <ISO> | null
stage_2_error: <string> | null
stage_2_log: _logs/stage-2/<id>__<ts>.jsonl | null
secret_scan_status: clean | redacted | blocked | skipped
topics: [string, ...]
proposals:
  practice: [<Stage2Candidate>, ...]
  map: [<Stage2Candidate>, ...]
curator_processed_at: 2026-05-11T11:00:00Z   # set after curate
curator_run_id: <ULID>
```

Validated by `SessionLogFrontmatterSchema`.

## Stage-2 candidate

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

Validated by `Stage2CandidateSchema`. Top-level: `Stage2OutputSchema = { practice: [...], map: [...] }`.

## Bootstrap candidate

Superset of stage-2 with `derived_from`. `supports_existing_node` and `contradicts_existing_node` are always `null` in bootstrap output. Validated by `BootstrapCandidateSchema`.

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

## INDEX.md / GRAPH.md frontmatter

```yaml
schema_version: 1
generated_at: 2026-05-10T14:30:00Z
nodes_hash: sha256:<hex>
node_count: 47
budget_tokens: 2000     # INDEX only
```

Validated by `IndexFrontmatterSchema` / `GraphFrontmatterSchema`.

### `nodes_hash` algorithm

Deterministic, mtime-independent:

1. Walk all `.md` files under `nodes/`.
2. For each, compute `sha256(contents)`.
3. Build strings: `<relative-path>\t<sha256-hex>`.
4. Sort lexicographically.
5. Join with `\n`.
6. `nodes_hash = sha256(joined)`.

Defined in `computeNodesHash` (`src/lib/nodes.ts`).

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
        "practice/practice-auth-flow.md",
        "map/map-auth-module.md"
      ]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `last_full_bootstrap_at` | Last `/kb-bootstrap` run. Never set by the CLI. |
| `last_incremental_at` | Last `bootstrap-incremental` non-dry-run that processed ≥1 doc. |
| `docs[].content_sha256` | SHA-256 of file contents at processing time. |
| `docs[].last_processed_at` | Timestamp of last processing. Not updated on hash hits. |
| `docs[].produced_nodes` | `<kind>/<filename>.md` paths (relative to `nodes/`) written from this doc. Informational. |

Lifecycle:

- **First run** — file is created with `docs: {}`.
- **Hash hit** — doc is skipped; `last_processed_at` is not updated.
- **Hash miss** — doc is queued. On success, the entry is overwritten. On failure, the entry is left untouched so a re-run retries.
- **`--dry-run`** — file is read, never written.
- **Force re-bootstrap** — delete the file.

A malformed file is treated as missing. Validated by `BootstrapStateSchema`. Gitignored.
