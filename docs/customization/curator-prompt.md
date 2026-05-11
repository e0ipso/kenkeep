---
title: Curator prompt
parent: Customization
nav_order: 2
---

# Editing the curator prompt

Decides what happens to every stage-2 candidate: add, modify, contradict, or drop. Second-biggest quality lever after the stage-2 prompt.

## Where it lives

| Path | Used by |
|---|---|
| `src/templates-source/prompts/curator.md` | Package source. |
| `.ai/knowledge-base/.state/prompts/curator.md` | Preferred at runtime. |

Bump the `Version: N` comment on behavior changes; the curator log records the prompt content so historic decisions stay auditable.

## Input

At runtime, `[BATCH PLACEHOLDER]` is replaced with:

```json
{
  "index_summary": "<current INDEX.md>",
  "existing_nodes": [
    { "id": "...", "title": "...", "kind": "practice", "tags": ["..."], "summary": "...", "body": "..." }
  ],
  "batch": [
    {
      "session_id": "...",
      "captured_at": "...",
      "derived_from": "session-<id>.md",
      "practice_candidates": [...],
      "map_candidates": [...]
    }
  ]
}
```

`existing_nodes` carries only nodes referenced by `supports_existing_node` / `contradicts_existing_node` in the batch; the full INDEX is provided so the curator can spot duplicates stage-2 missed.

## Output

A single JSON array. Each element:

```json
{
  "action": "add | modify | contradict | drop",
  "candidate_origin": "<session_id>:<practice|map>:<index>",
  "target_node_id": "<id-or-null>",
  "proposed_node": { /* full node, or null for drop */ },
  "rationale": "...",
  "suggested_resolution": null
}
```

`suggested_resolution` must always be `null`. The reviewer chooses.

## Verifying

1. `npm test` (curate tests assert routing into the right `_proposed/<bucket>/`).
2. Re-run against `bravo-insider/expected.md`'s four key cases: analytics-dispatcher contradict, cache-tags add-with-relates-to, schema.org add, DI drop-or-modify.
3. Inspect `_logs/curator/<run-id>__<ts>.jsonl` for the final array (no preamble).

## Anti-patterns to avoid

- Modifications that rephrase existing content (drop instead).
- Additions when a near-duplicate exists (modify instead).
- Auto-resolving contradictions.
- Crossing the practice/map boundary.
