---
type: map
title: Curator action (add / modify / contradict / drop)
description: >-
  Curator emits an array of {action, candidate_origin, target_node_id,
  proposed_node, rationale}. Wrapper applies each directly to nodes/.
tags:
  - schema
  - curator
  - action
kk_schema_version: 3
kk_id: map-curator-action
kk_derived_from:
  - docs/internals/schemas.md
  - docs/internals/prompts.md
kk_relates_to:
  - map-curate-command
  - map-conflict-files
kk_depends_on: []
kk_confidence: high
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

- `add` — writes `nodes/<folder>/<id>.md`. Existing file → records an `add_collision` failure, writes nothing.
- `modify` — overwrites `nodes/<folder>/<target_node_id>.md`. Missing target → records a `modify_missing_target` failure.
- `contradict` — writes one conflict file under `.ai/kenkeep/conflicts/`. Never touches `nodes/`.
- `drop` — no-op.

`suggested_resolution` is **always ignored by the wrapper** (the curator prompt instructs it to emit `null`). Conflict resolution is done by the `/kk-curate` skill walking each conflict file with the user.

Failures (`add_collision`, `modify_missing_target`) are returned in `runCurate`'s `failures: FailureReport[]` array and reported in CLI output. They are not persisted; rerun after fixing the underlying issue.

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-conflict-files](/curation/map-conflict-files.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/schemas.md](docs/internals/schemas.md)
[2] [docs/internals/prompts.md](docs/internals/prompts.md)
<!-- kk:citations:end -->
