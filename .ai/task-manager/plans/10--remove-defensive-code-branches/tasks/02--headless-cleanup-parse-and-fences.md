---
id: 2
group: "headless"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Collapse parse-failure message and remove JSON fence stripping

## Objective
Reduce `buildParseFailureMessage` to a single inline `throw` and delete `extractJsonBlock` from `src/lib/headless.ts`. Parsing becomes `JSON.parse(finalResult.trim())`; on failure the thrown error is one line referencing the log path.

## Skills Required
- typescript: edit `src/lib/headless.ts` and its test file

## Acceptance Criteria
- [x] `extractJsonBlock` is deleted from `src/lib/headless.ts` and not imported anywhere in `src/`.
- [x] `buildParseFailureMessage`, `SNIPPET_RADIUS`, the `position N` regex, the snippet-build code, and the multi-line "Next steps" array are all deleted.
- [x] The single call site in `runHeadlessClaude` throws inline: `throw new Error(\`curator output was not valid JSON: ${parseMessage}. See ${logFile ?? 'log'} for the full transcript.\`);`.
- [x] JSON parsing uses `JSON.parse(finalResult.trim())` directly.
- [x] Existing tests for fence stripping and multi-line parse-failure messages are deleted or rewritten to assert the new single-line throw.
- [x] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript edits in `src/lib/headless.ts`.
- Vitest tests for `runHeadlessClaude` (verify path under `test/`).
- Net deletion target for this task: ~40+ lines from `headless.ts`.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/lib/headless.ts`.
- Updated test file(s) for headless.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. In `src/lib/headless.ts`, locate `extractJsonBlock` and its single call site. Inline it as `finalResult.trim()` and delete the function.
2. Locate `buildParseFailureMessage` and `SNIPPET_RADIUS`. Find its call site inside the `catch` of the JSON parse.
3. Replace the call with:
   ```ts
   throw new Error(
     `curator output was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. See ${logFile ?? 'log'} for the full transcript.`,
   );
   ```
   (Match the local variable names used in the file — the example assumes the parse error is captured into `parseError` and the log file path lives in `logFile`.)
4. Delete `buildParseFailureMessage`, `SNIPPET_RADIUS`, and any helper imports they brought in (e.g. unused regex constants).
5. In the test file: find tests asserting "Next steps" content, fence stripping, or 7-line snippet output. Delete those; add (or adjust) one test that:
   - Stubs the runner to return a malformed JSON string.
   - Asserts the thrown error message starts with `curator output was not valid JSON:` and includes the log path.
   - Asserts that input wrapped in ` ```json ... ``` ` fences now throws (no longer succeeds).
6. Run `npm run lint`, `npm run typecheck`, `npm test`.

</details>
