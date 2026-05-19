---
schema_version: 1
id: map-proposal-candidate-schema
title: "Proposal candidate schema"
kind: map
tags: [schema, proposal, candidate]
derived_from:
  - docs/internals/schemas.md
relates_to:
  - map-proposal-drain-hook
  - map-curator-action
depends_on: []
confidence: high
summary: "Shape emitted by proposal-extract per practice/map candidate. supports_existing_node / contradicts_existing_node are the curator's join keys."
---

# Proposal candidate schema

Emitted by the proposal-extract prompt. Validated by `ProposalCandidateSchema` in `src/lib/schemas.ts`.

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

Top-level shape (`ProposalOutputSchema`):

```json
{ "practice": [<ProposalCandidate>, ...], "map": [<ProposalCandidate>, ...] }
```

The two `*_existing_node` fields are how the curator joins candidates against the current `nodes/` tree without seeing every node body. Only nodes referenced by these fields are passed back to the curator in `existing_nodes`; if a candidate appears to overlap a node **not** in `existing_nodes`, the curator is instructed to `drop` it with a rationale naming the suspected overlap.

The bootstrap variant (`BootstrapCandidateSchema`) is a superset that adds `derived_from`. In bootstrap output, both `*_existing_node` fields are always `null`.
