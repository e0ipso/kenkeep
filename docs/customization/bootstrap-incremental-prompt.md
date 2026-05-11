---
title: Editing the bootstrap-incremental prompt
parent: Customization
nav_order: 3
---

# Editing the bootstrap-incremental prompt

The `bootstrap-incremental` CLI invokes `claude -p` once per batch of source-doc content. The prompt template controls what the model treats as a candidate practice or map node, and what it discards as boilerplate. Tune it per project to match your docs' tone and conventions.

For the agent-driven, in-session bootstrap (`/kb:bootstrap`), edit `.claude/commands/kb-bootstrap.md` instead — that file is a slash command body, not a `claude -p` prompt.

## Where the prompt lives

Two copies of the template:

| Location | Used by | When edited |
|---|---|---|
| `templates/prompts/bootstrap-incremental.md` (inside the npm package) | Fallback if no per-repo override exists. | Edit upstream and bump the package version. |
| `.ai/.kb-builder/prompts/bootstrap-incremental.md` (inside your repo, copied by `init`) | The CLI prefers this copy. | Edit locally to tune per-project extraction. |

When `bootstrap-incremental` spawns `claude -p`, it loads the override copy if present and falls back to the bundled template otherwise. The override is plain markdown — commit it like any other project asset.

## Anatomy of the prompt

The template has six sections:

1. **Inputs** — describes the chunk format the runner injects (`=== FILE: <path> ===` … `=== END FILE ===`).
2. **Output** — pins the JSON shape (`{ practice: […], map: […] }`) and the candidate fields the schema validator accepts.
3. **What to extract** — the trigger patterns for practice vs map (imperative verbs, definition patterns, named entities).
4. **What to skip** — boilerplate categories: auto-generated reference, licenses, generic framework knowledge, aspirational TODOs.
5. **Confidence calibration** — when to default to `medium`, when to escalate to `high`, when to back off to `low`.
6. **Rules** — explicit "never invent facts," "quote rationale verbatim," "emit only the JSON object."

The chunk is appended at the bottom in place of the `[CHUNK PLACEHOLDER — substituted at runtime]` marker. If you remove the placeholder, the runner appends the chunk verbatim with a blank line separator.

## Versioning

The prompt file carries a top-of-file HTML comment:

```
<!--
  Version: 1
  Used by: ai-knowledge-base bootstrap-incremental (via `claude -p`)
  ...
-->
```

Bump `Version: N` whenever you change the prompt's behavior (not just typos). Doing so makes it easy to attribute regressions to specific edits when reading the JSONL logs under `_logs/bootstrap-incremental/`.

## Calibration loop

A reasonable workflow when tuning:

1. Pick a small representative subset of your docs (3–5 files spanning architecture, modules, and overview).
2. Run `bootstrap-incremental --from <subset> --dry-run` to confirm chunking looks right.
3. Run without `--dry-run`. Review the proposals with `ai-knowledge-base proposals review`.
4. Note the false positives (proposals you'd reject) and false negatives (knowledge in the docs that didn't surface). Adjust the prompt's "trigger patterns" and "what to skip" sections.
5. Delete `.ai/.kb-builder/bootstrap-state.json` (so the next run re-processes those files) and re-run.
6. Repeat until the ratio of accepted proposals to total proposals is in the 60–80% range. Pushing higher tends to also drop true positives.

## Common edits

- **Add project vocabulary triggers.** If your docs use a specific phrasing like "Bravo invariant: …" to mark practice content, add that trigger pattern explicitly to the "what to extract" section.
- **Tighten boilerplate filters.** If the model keeps proposing the CI badges or contributor-list content, name those categories explicitly in "what to skip."
- **Adjust confidence defaults.** A docs tree that's known to be stale should default `low`; a tightly maintained docs site can default `high`.

## See also

- [Editing the stage-2 prompt](stage-2-prompt.md) — the in-session capture extractor.
- [Editing the curator prompt](curator-prompt.md) — how stage-2 candidates become proposals.
- [Bootstrap > Incremental bootstrap](../bootstrap/incremental-bootstrap.md) — the CLI consumer.
