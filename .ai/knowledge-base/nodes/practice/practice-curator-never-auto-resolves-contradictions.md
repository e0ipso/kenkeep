---
schema_version: 1
id: practice-curator-never-auto-resolves-contradictions
title: "Curator never auto-resolves contradictions"
kind: practice
tags: [curator, conflicts, workflow]
derived_from:
  - PRD.md
  - docs/how-it-works.md
  - docs/internals/prompts.md
relates_to: []
confidence: high
summary: "contradict actions are recorded in pending-conflicts.json and walked by the /kb-curate skill with the user; the wrapper never picks for them."
---

# Curator never auto-resolves contradictions

When the curator emits a `contradict` action, the wrapper writes nothing to `nodes/`. Instead, it appends the conflict to `.ai/knowledge-base/.state/pending-conflicts.json`. The `/kb-curate` skill reads that file after the curator subprocess exits and walks each entry with the contributor in-session: existing node side-by-side with the proposed node, choice of **Replace** or **Reject**, then `ai-knowledge-base conflict resolve <id> --action <...>` applies it.

The curator prompt is instructed to emit `null` for `suggested_resolution`; the wrapper ignores any value it sends.

**Why:** "the system never modifies the KB without human approval" is a PRD goal. Truthful-as-of-last-curation means conflicts surface for a human, not silently overwrite or silently ignore. The skill is the authoritative resolution path.

**How to apply:**

- Never add an auto-supersede or auto-merge code path. New conflict types go through `pending-conflicts.json` and the skill.
- Prompt edits to `curator.md` must keep the binary Replace/Reject resolution menu intact. Anti-pattern listed in the prompt docs: suggesting a `suggested_resolution` value.
