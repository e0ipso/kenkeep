---
type: map
title: Conflict files (conflicts/<run-id>-<n>.md)
description: >-
  Curator-detected contradictions: one markdown file per conflict under
  conflicts/; resolved by /kk-curate skill via git restore/commit.
tags:
  - conflicts
  - curator
  - schema
kk_schema_version: 3
kk_id: map-conflict-files
kk_derived_from:
  - docs/internals/schemas.md
  - docs/how-it-works.md
  - docs/troubleshooting.md
kk_relates_to:
  - practice-curator-never-auto-resolves-contradictions
  - map-curator-action
kk_depends_on: []
kk_confidence: high
---

# Conflict files (`conflicts/<run-id>-<n>.md`)

When the curator detects that a candidate contradicts an existing node, it writes one markdown file per conflict under `.ai/kenkeep/conflicts/`, instead of writing a conflicting node to disk. The file shape is set inline by the curate wrapper (`src/lib/curate.ts`); there is no Zod schema for it (humans review and resolve it).

Shape:

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

Resolution (three-way, git-driven, walked by the `/kk-curate` skill):

| Choice | On-disk effect | Side effects |
|---|---|---|
| **Accept** | Skill rewrites `nodes/<folder>/<target_node_id>.md` from the proposed body. | `git restore` the conflict file. |
| **Reject** | None. Existing node untouched. | `git restore` the conflict file. |
| **Keep as record** | None to the node tree. | `git commit` the conflict file; it stays as durable history future curate runs can read. |

`kenkeep status` reports the pending count.

> Documentation drift: some pages (e.g. `docs/how-it-works.md`, `docs/troubleshooting.md`) refer to a JSON-array file `.ai/kenkeep/.state/pending-conflicts.json` instead of the per-conflict markdown files described in `docs/internals/schemas.md` and `docs/internals/prompts.md`. The on-disk format the curator actually uses is the per-file markdown shape documented here; the JSON path appears to be stale.

<!-- kk:related:start -->
# Related

- Related: [practice-curator-never-auto-resolves-contradictions](/curation/practice-curator-never-auto-resolves-contradictions.md)
- Related: [map-curator-action](/curation/map-curator-action.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/schemas.md](docs/internals/schemas.md)
[2] [docs/how-it-works.md](docs/how-it-works.md)
[3] [docs/troubleshooting.md](docs/troubleshooting.md)
<!-- kk:citations:end -->
