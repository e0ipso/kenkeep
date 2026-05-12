---
schema_version: 1
id: practice-curator-read-only-tool
title: "The curator's only allowed tool is Read"
kind: practice
tags: [curator, prompts, tools, claude-code]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/prompts.md
relates_to: []
depends_on: []
confidence: medium
summary: "The curator subprocess may only use Read against existing nodes. All node writes happen in the wrapper after parsing the curator's JSON output."
---

# The curator's only allowed tool is Read

The curator (run as `claude -p` from `src/lib/curate.ts`) is permitted exactly one tool: `Read`, used against existing node files when it needs to compare a candidate to the current content.

All node writes are performed by the wrapper after parsing the curator's JSON output against `CuratorOutputSchema`:

- `add` writes `nodes/<kind>/<id>.md`; the wrapper records an `add_collision` failure if the file already exists.
- `modify` overwrites `nodes/<kind>/<target_node_id>.md`; the wrapper records `modify_missing_target` if the target is absent.
- `contradict` writes nothing; the conflict is appended to `.state/pending-conflicts.json`.
- `drop` is a no-op.

The curator never edits files itself. Do not extend the curator's tool list without a deliberate design change, since the wrapper is also the only place where the human-in-the-loop guarantee is enforced.
