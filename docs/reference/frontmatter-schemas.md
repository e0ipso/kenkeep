---
title: Frontmatter schemas
parent: Reference
nav_order: 6
---

# Frontmatter schemas

Every YAML frontmatter and JSON state file is validated by a Zod schema at read time. The schemas live in [`src/lib/schemas.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/schemas.ts) and are the source of truth. When this page disagrees, the schema wins.

All shapes carry `schema_version: 1`. A schema mismatch is a parse failure; the file is silently dropped (the runtime fails closed).

## Node (`nodes/{practice,map}/<slug>.md`)

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

## Proposal (`_proposed/{additions,modifications,contradictions}/<slug>.md`)

Same as a node, plus:

```yaml
proposal:
  kind: addition | modification | contradiction
  source_sessions: [session-id, ...]
  target_node: practice-foo | null
  rationale: "..."
  suggested_resolution: supersede | keep_both | reject | null
  curator_log: _logs/curator/<run-id>__<ts>.jsonl | null
```

Invariants enforced at write time:

- Contradictions always carry `suggested_resolution: null`.
- `proposal.kind` matches the containing directory.

Validated by `ProposalFrontmatterSchema`.

## Session log (`_sessions/<YYYYMMDD-HHmm-id>.md`)

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
gitleaks_status: clean | redacted | blocked | skipped
topics: [string, ...]
proposals:
  practice: [<Stage2Candidate>, ...]
  map: [<Stage2Candidate>, ...]
curator_processed_at: 2026-05-11T11:00:00Z   # optional, set after curate
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

Superset of stage-2: adds `derived_from`. `supports_existing_node` and `contradicts_existing_node` are always `null` in bootstrap output.

Validated by `BootstrapCandidateSchema`. Top-level: `BootstrapOutputSchema`.

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

## `nodes_hash` algorithm

Deterministic, mtime-independent:

1. Walk all `.md` files under `nodes/`.
2. For each, compute `sha256(contents)`.
3. Build strings: `<relative-path>\t<sha256-hex>`.
4. Sort lexicographically.
5. Join with `\n`.
6. `nodes_hash = sha256(joined)`.

In `computeNodesHash` (`src/lib/nodes.ts`).

## `state.json`

```json
{
  "schema_version": 1,
  "lock": { "name": "...", "pid": 12345, "acquired_at": "...", "ttl_ms": 1800000 },
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

`lock` is `null` when no lock is held. Validated by `StateFileSchema`. Gitignored.

## `bootstrap-state.json`

See [`bootstrap-state.json` schema](bootstrap-state.md). Validated by `BootstrapStateSchema`.
