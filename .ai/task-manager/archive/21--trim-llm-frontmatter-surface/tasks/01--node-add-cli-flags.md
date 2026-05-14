---
id: 1
group: "node-add-cli"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - node-cli
---
# Add non-interactive flag surface to `node add`

## Objective
Give the `ai-knowledge-base node add` command a deterministic, non-interactive entry point so callers (kb-add skill, scripts, tests) can write nodes without prompting. The flag-driven path must call the same `writeNewNode` function plan 13 introduced.

## Skills Required
- `typescript`: extend the `runNodeAdd` action handler and its Zod-validated answer shape.
- `node-cli`: define commander option flags, custom parsers, `--body @-` stdin idiom, `--yes` confirmation skip.

## Acceptance Criteria
- [ ] `ai-knowledge-base node add` accepts: `--kind <practice|map>`, `--title <string>`, `--summary <string>`, `--tags <comma-separated>`, `--body <text-or-@->`, `--relates-to <comma-separated>`, `--confidence <low|medium|high>`, `--yes`.
- [ ] When `--body @-` is passed, the action reads stdin until EOF and uses that content as the body.
- [ ] When all required answers (`kind`, `title`, `summary`, `body`) arrive via flags and `--yes` is set, `runNodeAdd` skips every prompt and calls `writeNewNode(answers, deps)` directly.
- [ ] When required flags are missing without `--yes`, the action prompts only for the missing fields (existing interactive flow is intact when no flags are passed at all).
- [ ] When required flags are missing AND `--yes` is set, the action exits non-zero with a clear error message naming the missing field.
- [ ] `--body @-` combined with `--yes` errors if stdin is a TTY (no piped input).
- [ ] Validation rules from the existing `validate:` callbacks apply equally to flag-driven input (title required, summary required, kind in enum, confidence in enum, comma-list shape).
- [ ] New tests in `tests/commands/node-add.test.ts` cover: full flag set with stdin body, partial flags with prompt fallback for missing fields, `--yes` with missing required flag errors, non-null confidence and tags parsing.
- [ ] `pnpm exec tsc --noEmit` passes; `pnpm test` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Commander: define options with custom parsers where appropriate (`--tags` and `--relates-to` produce `string[]`; `--kind`/`--confidence` validated against literal sets via `InvalidArgumentError`).
- Stdin: detect `--body === '@-'` and call `await readStdin()` (use `process.stdin` async iterator or `node:stream/consumers` `text(process.stdin)`); detect TTY with `process.stdin.isTTY` for the error case.
- `runNodeAdd` action signature: receive parsed options object alongside existing deps; branch into flag-driven or prompted path; converge on the same `Answers` shape passed to `writeNewNode`.
- Reuse existing answer validators rather than duplicating regexes.

## Input Dependencies
- Plan 13 `writeNewNode(answers, deps)` factoring must be in place. If it is not, this task is blocked.

## Output Artifacts
- `ai-knowledge-base node add` accepts the flag set; `runNodeAdd` branches on presence; tests cover the flag-driven path.
- Public CLI surface that task 2 (kb-add skill rewrite) depends on.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Locate the commander definition for `node add` (likely `src/cli.ts` or `src/commands/node-add.ts`). Add the seven option flags plus `--yes`. Use `.option('--tags <list>', 'comma-separated tags', parseCommaList)` style for list flags; reject empty entries.
2. For `--kind` and `--confidence`, use a parser that throws `new InvalidArgumentError(...)` on out-of-enum values. Mirror the enum constants already used by the interactive prompts.
3. For `--body`, accept the raw string. The action handler is responsible for detecting the `@-` sentinel and reading stdin. Do not preprocess in the option parser.
4. In `runNodeAdd`, accept an `options` parameter (typed `NodeAddOptions`). Build a partial `Answers` object from the flags. If `body === '@-'`:
   - If `process.stdin.isTTY` and `--yes`, throw an error: "stdin is a TTY; --body @- requires piped input when --yes is set".
   - Otherwise await `readStdin()` (helper to read all of stdin to string) and substitute into the answer.
5. Validate the partial answers against the same rules the interactive prompts use. Collect missing required fields.
6. Branch:
   - All required present + `--yes`: call `writeNewNode(answers, deps)` directly (no confirmation).
   - All required present, no `--yes`: show summary and confirm prompt (existing behavior), then `writeNewNode`.
   - Some required missing, no `--yes`: enter prompt loop only for missing fields, then `writeNewNode`.
   - Some required missing + `--yes`: error and exit non-zero.
7. Update `node add --help` to document each flag and the `--body @-` stdin convention.
8. Tests:
   - Test the action handler directly with a synthesized options object and a mocked `writeNewNode`.
   - For stdin tests, inject the body string rather than poking at `process.stdin` if `readStdin` is a parameterized dependency.
   - Test enum rejection for `--kind` and `--confidence`.
   - Test comma-list parsing (trim whitespace, drop empty entries).
9. Verify no regression in the all-prompts interactive flow with a test that passes no flags.

</details>

### Meaningful Test Strategy Guidelines

Critical mantra: "write a few tests, mostly integration."

**Write tests for:**
- The flag-driven `runNodeAdd` integration: from parsed options to `writeNewNode` call, including stdin body.
- The partial-flag prompt fallback path.
- The `--yes` + missing required error path.
- Custom parsers (`parseCommaList`, enum guards).

**Do NOT write tests for:**
- Commander option-parsing mechanics themselves.
- `writeNewNode` internals (covered by plan 13 tests).
- Trivial getters on the options object.
