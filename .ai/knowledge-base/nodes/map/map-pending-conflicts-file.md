---
schema_version: 1
id: map-pending-conflicts-file
title: ".state/pending-conflicts.json: curator-detected contradictions"
kind: map
tags: [state, curator, contradictions, kb-curate]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/schemas.md
  - docs/how-it-works.md
relates_to: [map-claude-hooks, map-kb-claude-skills, practice-curator-read-only-tool]
depends_on: []
confidence: high
summary: "The curator records contradict actions here instead of writing conflicting nodes. The /kb-curate skill reads this file after the curator exits and walks each entry with the user."
---

# `.state/pending-conflicts.json`: curator-detected contradictions

When the curator decides a candidate contradicts an existing node, it does **not** write a competing node to `nodes/`. Instead, it appends an entry to `.ai/knowledge-base/.state/pending-conflicts.json` (validated by `PendingConflictsFileSchema`):

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

The `/kb-curate` skill reads this file after the curator subprocess exits, walks each entry with the user (existing node side-by-side with the new claim), asks for a resolution (supersede / keep both / reject), applies it by editing the relevant `nodes/<kind>/<id>.md`, and removes the resolved entry from the array. `ai-knowledge-base status` reports the count.
