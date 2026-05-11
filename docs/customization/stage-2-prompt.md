---
title: Stage-2 prompt
parent: Customization
nav_order: 1
---

# Editing the stage-2 prompt

The biggest quality lever in capture. Controls what the extractor treats as worth remembering.

## Where it lives

| Path | Used by |
|---|---|
| `templates/prompts/stage-2-extract.md` (npm package) | Bundled fallback. |
| `.ai/knowledge-base/.state/prompts/stage-2-extract.md` (your repo) | Preferred by the drain hook. |

Edit the repo copy locally. Delete it to revert to the bundled version.

## Sections

1. **Version comment** (`Version: N`): bump on behavior changes.
2. **What to extract**: practice/map definitions, trigger phrases.
3. **What to skip**: typos, file reads, agent paraphrases, generic programming knowledge.
4. **Ownership boundary**: how to split combined statements between practice and map.
5. **Inline example**: a worked transcript with expected JSON output.
6. **Output schema**: `{ practice: [...], map: [...] }` per `Stage2OutputSchema`.

The drain replaces `[TRANSCRIPT PLACEHOLDER — substituted at runtime]` with the redacted slice. If the placeholder is removed, the transcript is appended at the end.

## Calibration

Two fixtures under `tests/fixtures/transcripts/`:

- `routine-zero/`: a session with no teaching moments. Correct output is empty.
- `bravo-insider/`: a session with 4 practice and 3 map candidates. `expected.md` is the target.

Run the fixtures with the real `claude` CLI before shipping changes. Mocked tests pin the schema; only real `claude -p` reveals prompt quality.

## Schema

Output shape must match `Stage2OutputSchema` in `src/lib/schemas.ts`. Adding new fields means extending the Zod schema. Bump `schema_version` on rename, removal, or semantic change; new optional fields don't bump.
