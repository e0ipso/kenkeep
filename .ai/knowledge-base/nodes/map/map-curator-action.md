---
schema_version: 1
id: map-curator-action
title: "Curator action (add / modify / contradict / drop)"
kind: map
tags: [schema, curator, action]
derived_from:
  - docs/internals/schemas.md
  - docs/internals/prompts.md
relates_to:
  - map-curate-command
  - map-conflict-files
depends_on: []
confidence: high
summary: "Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/."
---

# Curator action

The curator emits a single JSON array. Each element is one action (validated by `CuratorOutputSchema` in `src/lib/schemas.ts`):

```yaml
action: add | modify | contradict | drop
candidate_origin: "<session_id>:<practice|map>:<index>"
target_node_id: <node-id> | null
proposed_node: <CuratorProposedNode> | null   # null only for drop
rationale: <free-text>
suggested_resolution: supersede | keep_both | reject | null
```

Wrapper application (`src/lib/curate.ts`):

- `add` — writes `nodes/<kind>/<id>.md`. Existing file → records an `add_collision` failure, writes nothing.
- `modify` — overwrites `nodes/<kind>/<target_node_id>.md`. Missing target → records a `modify_missing_target` failure.
- `contradict` — writes one conflict file under `.ai/knowledge-base/conflicts/`. Never touches `nodes/`.
- `drop` — no-op.

`suggested_resolution` is **always ignored by the wrapper** (the curator prompt instructs it to emit `null`). Conflict resolution is done by the `/kb-curate` skill walking each conflict file with the user.

Failures (`add_collision`, `modify_missing_target`) are returned in `runCurate`'s `failures: FailureReport[]` array and reported in CLI output. They are not persisted; rerun after fixing the underlying issue.
