---
title: Editing the stage-2 prompt
parent: Customization
nav_order: 1
---

# Editing the stage-2 extraction prompt

The stage-2 prompt is the single most important quality lever in capture. It controls what the extractor treats as worth remembering and what it drops as noise. You should re-read it before tweaking it and re-run the fixture transcripts after every change.

## Where the prompt lives

Two copies of the prompt template exist:

| Location | Used by | When edited |
|---|---|---|
| `templates/prompts/stage-2-extract.md` (inside the npm package) | First-time fallback if no per-repo override exists. | Edit upstream and bump the package version. |
| `.ai/.kb-builder/prompts/stage-2-extract.md` (inside your repo, copied by `init`) | The stage-2 drain hook prefers this copy. | Edit locally to tune the extractor for your project's vocabulary. |

When the drain hook spawns `claude -p`, it loads the override copy if present and falls back to the bundled template otherwise. The override is plain markdown — commit it like any other project asset.

## Anatomy of the prompt

The prompt has six sections:

1. **Frontmatter comment** — `Version: N`. Bump this whenever you change behavior; the version is independent of the npm package version but should be noted in your project's changelog so reviewers know to re-calibrate fixtures.
2. **"What you are looking for"** — defines practice and map nodes, lists trigger phrases ("no, use…", "we always…", "we have a…", named-entity introductions).
3. **"What you are NOT looking for"** — the anti-examples that suppress noise: typos, file reads, agent paraphrases, generic programming knowledge.
4. **Ownership boundary** — splits combined statements into a practice piece (imperative) and a map piece (named entity). Both passes never both capture the same content.
5. **Inline example** — a small worked transcript with the expected JSON output. The most concrete signal to the model about what good output looks like.
6. **Output schema** — the exact JSON shape the drain expects. `{ "practice": [...], "map": [...] }`, each candidate carrying `kind`, `tags`, `title`, `summary`, `body`, `confidence`, `supports_existing_node`, `contradicts_existing_node`.

## Substitution

The drain replaces the placeholder line `[TRANSCRIPT PLACEHOLDER — substituted at runtime]` with the redacted transcript slice from the session log. If you remove the placeholder, the drain appends the transcript at the end of the prompt instead — both shapes work, but keeping the placeholder lets you control exactly where in the prompt the transcript lands.

## Calibrating with fixtures

Two synthetic transcripts under `tests/fixtures/transcripts/` form the calibration targets:

- **`routine-zero/`** — a session with no teaching moments. Correct output: empty `practice` and `map` arrays. If your prompt change causes this fixture to produce capture, the prompt is now over-capturing.
- **`bravo-insider/`** — a session with four practice candidates (constructor DI, analytics dispatcher, per-user cache tags, schema.org emitter) and three map candidates (Bravo Insider, dispatcher, schema_emitter). The `expected.md` file in that directory is the canonical target.

Run the fixtures end-to-end with the real `claude` CLI before shipping a prompt change. The mocked unit tests pin the schema and drain behaviour, but only the real `claude -p` invocation reveals whether the prompt still produces good output.

## Schema-aware editing

Output shape must continue to match `Stage2OutputSchema` (see `src/lib/schemas.ts`). Adding new fields to candidates is safe — the schema currently rejects unknown fields, so you'd also need to extend the Zod schema. Bump `schema_version` from 1 → 2 only if you remove a field, rename a field, or change a field's semantics; new optional fields do not bump the version (see [CONTRIBUTING.md](https://github.com/e0ipso/ai-knowledge-base/blob/main/CONTRIBUTING.md#schema-version-bump-policy)).

## Reverting

The drain hook always prefers the override copy. To revert to the bundled prompt without re-running `init`, delete `.ai/.kb-builder/prompts/stage-2-extract.md`. The next drain will load the package's bundled version.
