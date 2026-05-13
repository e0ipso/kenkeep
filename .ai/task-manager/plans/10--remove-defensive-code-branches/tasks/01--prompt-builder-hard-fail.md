---
id: 1
group: "prompt-builders"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Prompt builder hard-fail on missing placeholder

## Objective
Replace the silent `template + chunk` concatenation fallback in the three prompt builders with a clear `Error` that names the missing placeholder, so a hand-edited prompt template fails loudly instead of shipping a malformed prompt to the LLM.

## Skills Required
- typescript: edit `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/lib/proposal-drain.ts` and their unit tests

## Acceptance Criteria
- [x] `buildPrompt` in `src/lib/bootstrap.ts` throws when `CHUNK_PLACEHOLDER` is absent from the template; the error message names `CHUNK_PLACEHOLDER` verbatim and references the bootstrap prompt name.
- [x] `buildBatchPrompt` in `src/lib/curate.ts` throws when `BATCH_PLACEHOLDER` is absent; the error message names `BATCH_PLACEHOLDER` and the curator prompt name.
- [x] `buildProposalPrompt` in `src/lib/proposal-drain.ts` throws when `TRANSCRIPT_PLACEHOLDER` is absent; the error message names `TRANSCRIPT_PLACEHOLDER` and the proposal-extract prompt name.
- [x] The fallback branches (`${template.trimEnd()}\n\n${chunk}\n` style) are deleted from all three builders.
- [x] One unit test per builder exercises the throw path; the existing happy-path tests still pass.
- [x] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript edits in three files.
- Vitest (or whichever runner this repo uses; check `package.json`) for the new unit tests.
- The placeholder constants (`CHUNK_PLACEHOLDER`, `BATCH_PLACEHOLDER`, `TRANSCRIPT_PLACEHOLDER`) stay; only the fallback branch is removed.

## Input Dependencies
None.

## Output Artifacts
- Edits to `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/lib/proposal-drain.ts`.
- New tests in the corresponding test files (likely `test/bootstrap.test.ts`, `test/curate.test.ts`, `test/proposal-drain.test.ts` — verify actual paths).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open each builder and locate the `if (template.includes(PLACEHOLDER)) { ... } else { return \`${template.trimEnd()}\n\n${chunk}\n\`; }` pattern.
2. Replace the `else` branch with a `throw new Error(...)`. Use this exact shape, parameterised per builder:
   ```ts
   if (!template.includes(CHUNK_PLACEHOLDER)) {
     throw new Error(
       `bootstrap prompt is missing the ${CHUNK_PLACEHOLDER} placeholder; the prompt template must contain it verbatim`,
     );
   }
   return template.replace(CHUNK_PLACEHOLDER, chunk);
   ```
   Substitute placeholder constant and prompt name (`bootstrap`, `curator`, `proposal-extract`).
3. For each builder add a unit test:
   - Provide a template string that omits the placeholder.
   - Assert the call throws with a message containing the placeholder constant name and the prompt name.
4. Run `npm run lint`, `npm run typecheck`, `npm test`. Fix any breakage.

The placeholder constants are exported (or local) in the same files; do not rename them.

</details>
