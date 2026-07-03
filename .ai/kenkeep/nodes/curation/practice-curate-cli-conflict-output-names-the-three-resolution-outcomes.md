---
type: practice
title: Curate CLI conflict output names the three resolution outcomes
description: >-
  When the curate CLI writes conflict files, its stdout names the
  accept/reject/keep-as-record outcomes and points at /kk-curate.
tags:
  - kenkeep
  - kk-curate
  - conflicts
  - cli
  - ux
kk_schema_version: 3
kk_id: practice-curate-cli-conflict-output-names-the-three-resolution-outcomes
kk_derived_from: []
kk_relates_to:
  - map-curate-command
  - map-conflict-files
  - practice-curator-never-auto-resolves-contradictions
kk_depends_on: []
kk_confidence: high
---
When `curate` produces conflict files under `.ai/kenkeep/conflicts/`, the CLI's stdout message names all three resolution outcomes (accept: edit target node + `git restore` conflict; reject: `git restore` conflict; keep as record: `git commit` conflict) and points users at the `/kk-curate` skill for interactive resolution. It also notes that unresolved conflict files re-surface on the next curate run.

The CLI cannot detect whether it was invoked by the `/kk-curate` skill or directly, so the conflict-output message must be useful in both cases. A bare "N conflict(s) written, review with git diff" line is a dead end for users who run the CLI directly without the skill -- they get conflict files on disk but no idea that the existing nodes were deliberately not overwritten and that a decision is required.

Applies to: any future changes to the curate command's terminal output around conflicts.

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-conflict-files](/curation/map-conflict-files.md)
- Related: [practice-curator-never-auto-resolves-contradictions](/curation/practice-curator-never-auto-resolves-contradictions.md)
<!-- kk:related:end -->
