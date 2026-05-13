---
id: 3
group: "cli-option-parsing"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Make CLI numeric option parsers throw `InvalidArgumentError`; collapse handler rebuild blocks

## Objective
Add an `intArg(name)` helper that throws `commander.InvalidArgumentError` on non-integer input, replace every `v => parseInt(v, 10)` parser in `src/cli.ts` with it, and delete the five conditional-spread blocks inside `.action()` handlers so commander-parsed options are forwarded directly to the underlying lib functions.

## Skills Required
- `typescript`: edit `src/cli.ts` and adjust lib option types if a naming mismatch (e.g., `--timeout` vs `timeoutMs`) needs a one-line boundary translation.

## Acceptance Criteria
- [ ] An `intArg(name: string): (value: string) => number` helper is defined (inline in `src/cli.ts` or in `src/lib/cli-args.ts` if it grows). On `Number.isNaN(parseInt(value, 10))` it throws `new InvalidArgumentError(\`${name} must be an integer (got "${value}")\`)`. `InvalidArgumentError` is imported from `commander`.
- [ ] Every `v => parseInt(v, 10)` parser in `src/cli.ts` is replaced with `intArg('--flag-name')`.
- [ ] All five conditional-spread blocks (`init`, `curate`, `bootstrap-incremental`, `index rebuild`, `logs prune`) inside `.action()` are removed. Each handler body collapses to roughly:
   ```ts
   .action(async (opts: <LibOpts>) => {
     const code = await <runFn>(opts);
     process.exit(code);
   });
   ```
   With a single boundary translation line if the CLI flag name differs from the lib field name (e.g., `timeout` → `timeoutMs`).
- [ ] `rg -n 'Number\.isNaN' src/cli.ts` returns zero hits.
- [ ] CLI smoke: `node dist/cli.js curate --batch-size foo` (or the equivalent live entrypoint) exits non-zero with a commander-formatted message naming `--batch-size` and "integer". `node dist/cli.js curate --batch-size 5` proceeds.
- [ ] CLI smoke: `node dist/cli.js curate --timeout abc` exits non-zero with a similar message. (Bootstrap-incremental `--token-budget xyz` if the flag still exists after plan 11.)
- [ ] Any existing tests that asserted silent-NaN behaviour are updated to assert the throw path; at least one test per command covers the throwing parser.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `commander.InvalidArgumentError` — commander prints a formatted error and exits non-zero automatically when this is thrown from a custom parser.
- The lib functions (`runInit`, `runCurate`, `runBootstrapIncremental`, `runIndexRebuild`, `runLogsPrune`) already accept option bags with `number | undefined` and `boolean | undefined` shapes. Confirm by reading each function signature; if any signature shape diverges from what commander emits, fix the boundary translation, not the lib type, with a single-line `const opts = { ...rawOpts, timeoutMs: rawOpts.timeout }` if absolutely needed.
- `exactOptionalPropertyTypes: true` is the constraint that drove the original spread blocks; the collapsed shapes must still satisfy it. Confirm with `npx tsc --noEmit`.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/cli.ts` (or new `src/lib/cli-args.ts` if the helper moves there).
- Possibly minor edits to lib type definitions if a CLI/lib name divergence is unavoidable.
- Updated tests covering the new throwing behaviour.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Add the helper (inline near the top of `src/cli.ts`):
   ```ts
   import { InvalidArgumentError } from 'commander';
   function intArg(name: string): (value: string) => number {
     return (value) => {
       const n = parseInt(value, 10);
       if (Number.isNaN(n)) {
         throw new InvalidArgumentError(`${name} must be an integer (got "${value}")`);
       }
       return n;
     };
   }
   ```
2. Locate every `v => parseInt(v, 10)` parser passed to `.option(...)`. Replace with `intArg('--batch-size')`, `intArg('--token-budget')`, `intArg('--timeout')`, `intArg('--stage')`, etc. Use the exact flag string from the same `.option(...)` call.
3. For each affected `.action(async (opts) => { ... })` block:
   - Delete the conditional-spread rebuild (the `cmdOpts = {}` + `if (typeof opts.X === 'number' && !Number.isNaN(opts.X)) cmdOpts.X = opts.X` lines).
   - Type the handler parameter as the lib function's option type (or as the inferred commander shape — pick whichever produces fewer casts).
   - Forward `opts` directly. If a name differs (e.g., `--timeout` → `timeoutMs`), do the single rename inline.
4. Run `npx tsc --noEmit`. If `exactOptionalPropertyTypes` complains, the right fix is usually to align the lib option type with commander's `T | undefined` shape — not to bring back the spread block.
5. For each previously-asserting test that exercised silent-NaN behaviour, replace the assertion with `expect(() => parser('foo')).toThrow(InvalidArgumentError)` or run the CLI in a subprocess and assert exit code + stderr.
6. Build the CLI (`npm run build`) and run the smoke commands listed in Acceptance Criteria.
7. Re-run `rg -n 'Number\.isNaN' src/cli.ts` and `rg -n '\.action\(async \(opts' src/cli.ts` to confirm only direct forwards remain.

</details>
