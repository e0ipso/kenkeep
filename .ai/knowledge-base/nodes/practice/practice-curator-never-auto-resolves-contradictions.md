---
schema_version: 1
id: practice-curator-never-auto-resolves-contradictions
title: "Curator never auto-resolves contradictions"
kind: practice
tags: [curator, conflicts, human-in-the-loop]
derived_from:
  - docs/how-it-works.md
  - docs/daily-use.md
  - docs/internals/prompts.md
  - docs/internals/schemas.md
relates_to:
  - map-conflict-files
  - map-curator-action
  - map-curate-command
depends_on: []
confidence: high
summary: "Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kb-curate."
---

# Curator never auto-resolves contradictions

When the curator detects a candidate that contradicts an existing node, it emits a `contradict` action. The wrapper writes nothing to `nodes/`; instead it writes one markdown file per conflict under `.ai/knowledge-base/conflicts/<run-id>-<n>.md` with `status: pending`. The `/kb-curate` skill walks each pending file with the user in-session and applies the chosen resolution (Accept / Reject / Keep as record).

**Why:** contradictions are the only case where a curator decision could destroy committed, human-reviewed content. Putting a human in the loop here — and only here — is the single load-bearing review point in an otherwise mostly-automatic pipeline. The curator prompt is explicitly told to emit `suggested_resolution: null`; the wrapper ignores the field unconditionally.

**How to apply:**

- Never write logic that resolves a `contradict` action without a human prompt.
- `suggested_resolution` is always ignored — do not read it as input to any automated decision.
- When extending the curator or its prompt, preserve this property. Adding an "auto-supersede on high confidence" code path is the exact thing this design forbids.
