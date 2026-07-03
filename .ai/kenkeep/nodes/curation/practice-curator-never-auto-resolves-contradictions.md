---
type: practice
title: Curator never auto-resolves contradictions
description: >-
  Curator emits contradict; the wrapper writes a conflict file and writes
  nothing to nodes/. Resolution is always user-driven via /kk-curate.
tags:
  - curator
  - conflicts
  - human-in-the-loop
kk_schema_version: 3
kk_id: practice-curator-never-auto-resolves-contradictions
kk_derived_from:
  - docs/how-it-works.md
  - docs/daily-use.md
  - docs/internals/prompts.md
  - docs/internals/schemas.md
kk_relates_to:
  - map-conflict-files
  - map-curator-action
  - map-curate-command
kk_depends_on: []
kk_confidence: high
---

# Curator never auto-resolves contradictions

When the curator detects a candidate that contradicts an existing node, it emits a `contradict` action. The wrapper writes nothing to `nodes/`; instead it writes one markdown file per conflict under `.ai/kenkeep/conflicts/<run-id>-<n>.md` with `status: pending`. The `/kk-curate` skill walks each pending file with the user in-session and applies the chosen resolution (Accept / Reject / Keep as record).

**Why:** contradictions are the only case where a curator decision could destroy committed, human-reviewed content. Putting a human in the loop here — and only here — is the single load-bearing review point in an otherwise mostly-automatic pipeline. The curator prompt is explicitly told to emit `suggested_resolution: null`; the wrapper ignores the field unconditionally.

**How to apply:**

- Never write logic that resolves a `contradict` action without a human prompt.
- `suggested_resolution` is always ignored — do not read it as input to any automated decision.
- When extending the curator or its prompt, preserve this property. Adding an "auto-supersede on high confidence" code path is the exact thing this design forbids.

<!-- kk:related:start -->
# Related

- Related: [map-conflict-files](/curation/map-conflict-files.md)
- Related: [map-curator-action](/curation/map-curator-action.md)
- Related: [map-curate-command](/curation/map-curate-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/how-it-works.md](docs/how-it-works.md)
[2] [docs/daily-use.md](docs/daily-use.md)
[3] [docs/internals/prompts.md](docs/internals/prompts.md)
[4] [docs/internals/schemas.md](docs/internals/schemas.md)
<!-- kk:citations:end -->
