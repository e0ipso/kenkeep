---
title: Editing the curator prompt
parent: Customization
nav_order: 2
---

# Editing the curator prompt

The curator decides what happens to every stage-2 candidate that lands in the queue: add, modify, contradict, or drop. After the stage-2 extractor, this is the second most important quality lever in the pipeline.

## Where the prompt lives

| Location | Used by | When edited |
|---|---|---|
| `src/templates-source/prompts/curator.md` | The package itself | Edit here if you maintain `@e0ipso/ai-knowledge-base` |
| `.ai/knowledge-base/.state/prompts/curator.md` | The curator subprocess at runtime | Edit here in a consumer repo to override the prompt locally |

`ai-knowledge-base init` copies the shipped template into `.ai/knowledge-base/.state/prompts/`. The `ai-knowledge-base curate` command prefers the local copy if it exists.

## Version comment

The first comment block in `curator.md` is the prompt version (`Version: N`). Bump it whenever you change behavior; the curator log records the prompt content under the run id so historic decisions remain auditable.

## What the prompt receives

At runtime, the `[BATCH PLACEHOLDER]` token is replaced by a JSON payload of the form:

```json
{
  "index_summary": "<current INDEX.md contents>",
  "existing_nodes": [
    { "id": "...", "title": "...", "kind": "practice", "tags": ["..."], "summary": "...", "body": "..." }
  ],
  "batch": [
    {
      "session_id": "...",
      "captured_at": "...",
      "derived_from": "session-<id>.md",
      "practice_candidates": [{ /* Stage2Candidate */ }],
      "map_candidates": [{ /* Stage2Candidate */ }]
    }
  ]
}
```

`existing_nodes` only contains the nodes referenced by `supports_existing_node` or `contradicts_existing_node` in the batch. The full INDEX is provided as a fallback so the curator can spot near-duplicates the stage-2 extractor didn't link.

## What the prompt must produce

A single JSON array (the curator's final result message). Each element is one `CuratorAction`:

```json
{
  "action": "add | modify | contradict | drop",
  "candidate_origin": "<session_id>:<practice|map>:<index>",
  "target_node_id": "<id-or-null>",
  "proposed_node": { /* full node frontmatter + body, or null for drop */ },
  "rationale": "1–3 sentence justification",
  "suggested_resolution": null
}
```

The curator MUST always emit `suggested_resolution: null`, even on contradictions — the reviewer chooses, not the model.

## What to verify after a change

1. Re-run `npm test` — the curate library tests assert add/modify/contradict routing into the correct `_proposed/<bucket>/` folder and that contradictions never auto-resolve.
2. Re-run against `tests/fixtures/transcripts/bravo-insider/expected.md`'s curator follow-up checks. The four key cases — analytics-dispatcher contradict, cache-tags add-with-relates-to, schema.org add, DI drop-or-modify — exercise the prompt's hardest decisions.
3. Inspect `.ai/knowledge-base/_logs/curator/<run-id>__<timestamp>.jsonl` from a real run: confirm the model emits a single JSON array as the final result, with no preamble.

## Anti-patterns the prompt avoids

- Modifications that just rephrase existing content (drop instead).
- Additions when a near-duplicate exists (convert to modification).
- Auto-resolving contradictions (suggested_resolution must stay null).
- Crossing the practice/map boundary.

When the curator's output looks wrong, the prompt is almost always the right place to fix it before reaching for code changes.
