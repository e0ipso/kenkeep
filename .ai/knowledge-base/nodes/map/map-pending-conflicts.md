---
schema_version: 1
id: map-pending-conflicts
title: ".state/pending-conflicts.json"
kind: map
tags: [state, conflicts, curator]
derived_from:
  - docs/internals/schemas.md
  - docs/how-it-works.md
relates_to: []
confidence: high
summary: "JSON file where the curator records contradictions for the /kb-curate skill to resolve with the user in-session."
---

# `.state/pending-conflicts.json`

When the curator emits a `contradict` action, it does **not** write a conflicting node to disk. Instead, it records the conflict here:

```json
{
  "schema_version": 2,
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

Validated by `PendingConflictsFileSchema`. The `/kb-curate` skill reads the file after the curator subprocess exits, presents each entry to the user (existing node side-by-side with the proposed node), and applies the choice via `ai-knowledge-base conflict resolve <id> --action <replace|reject>`. That subcommand edits `nodes/`, regenerates `INDEX.md`/`GRAPH.md`, and drops the resolved entry. `ai-knowledge-base status` reports the count.
