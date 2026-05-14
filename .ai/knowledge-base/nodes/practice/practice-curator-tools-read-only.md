---
schema_version: 1
id: practice-curator-tools-read-only
title: "Curator subprocess can only use the Read tool"
kind: practice
tags: [curator, llm, tool-use]
derived_from:
  - docs/internals/prompts.md
relates_to: []
confidence: high
summary: "The curator's only allowed tool is Read against existing nodes; it never edits files or state directly."
---

# Curator subprocess can only use the `Read` tool

The `claude -p` curator subprocess has exactly one tool available: `Read` against existing node files. It emits a JSON array of actions; the wrapper applies them.

- `add` writes `nodes/<kind>/<id>.md`. Collisions become an `add_collision` failure (recorded, not written).
- `modify` overwrites `nodes/<kind>/<target_node_id>.md`. Missing targets become a `modify_missing_target` failure.
- `contradict` writes nothing; the wrapper appends to `pending-conflicts.json` for the `/kb-curate` skill to resolve.
- `drop` is a no-op.

`suggested_resolution` is ignored by the wrapper (always emit `null`).

**Why:** keeping the LLM tool-free for writes means file-system mutations are inspectable in code, not buried in stream-JSON. Failures are deterministic and surface in run output (`failures`, `conflicts`), not as silently misapplied edits.

**How to apply:**

- Never grant the curator additional tools.
- New curator actions go through the wrapper; never invent an action that the LLM applies directly.
- `_logs/curator/<run-id>__<ts>.jsonl` records every `tool_use` (`Read`) and `tool_result`; if it contains anything else, the curator's tool set has been wrongly widened.
