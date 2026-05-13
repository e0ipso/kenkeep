---
id: 2
group: "test-seams"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Split `node-add` into prompt + `writeNewNode`, drop `preset?`

## Objective
Remove the `preset?` test-seam field from `NodeAddOptions` and split the prompt step from the file-writing step. Export `writeNewNode(answers, deps)` so tests exercise the write path directly with the same input shape `promptForNode` returns, restoring validation parity.

## Skills Required
- `typescript`: refactor `src/commands/node-add.ts` and the corresponding test file.
- `vitest`: rewrite the two preset-driven tests to call `writeNewNode` directly.

## Acceptance Criteria
- [ ] `NodeAddOptions.preset` (and the `Preset` shape it referenced) is deleted from `src/commands/node-add.ts`.
- [ ] If `NodeAddOptions` has no remaining fields after `preset?` is removed, the interface itself is deleted (and `runNodeAdd`'s signature updated).
- [ ] A new exported function `writeNewNode(answers: NodeAnswers, deps: { paths: RepoPaths }): Promise<NodeWriteResult>` lives in `src/commands/node-add.ts`. `NodeAnswers` matches the return shape of `promptForNode`. The function performs everything the current preset/write branch does today (frontmatter assembly, body composition, atomic write, return value).
- [ ] `runNodeAdd()` becomes a thin wrapper: init-version marker check, resolve `RepoPaths` via `findRepoRoot()` + `repoPaths(root)`, call `promptForNode()`, then `writeNewNode(answers, { paths })`. No `preset` branch.
- [ ] `tests/commands/node-add.test.ts` rewrites the two `preset:`-driven tests to call `writeNewNode({ kind: 'practice', title: 'Foo', ... }, { paths: testRepoPaths })` directly; the assertions about generated frontmatter (kind, title, summary, tags, body, relates_to, confidence) remain equivalent.
- [ ] No test imports or sets `preset:`.
- [ ] `rg -n 'preset\?:' src/commands/node-add.ts` returns zero hits.
- [ ] No `// Test seam:` comment remains in `src/commands/node-add.ts`.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `RepoPaths` is the existing record returned by `repoPaths(root)`; import it from wherever it currently lives.
- The `parseList` helper stays inside `node-add.ts`; it is still used by `writeNewNode` to split tag/relates-to strings if the answers pass through that helper.
- `writeNewNode` is exported directly from `src/commands/node-add.ts`. Do not add a barrel re-export.
- Validation parity: the prompt's `validate:` callbacks remain only on the prompt side. Tests calling `writeNewNode` directly are responsible for supplying already-valid `NodeAnswers`; the function may still perform internal invariants (e.g., reject empty title) if those exist today, but no new branching is required.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/commands/node-add.ts` (interface shrinks or disappears; new exported `writeNewNode`; slimmer `runNodeAdd`).
- Rewritten `tests/commands/node-add.test.ts` covering the two preset cases via `writeNewNode`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open `src/commands/node-add.ts`. Note the line range that runs from "after `opts.preset` branch returns" through to the end of the function — this is the body that becomes `writeNewNode`.
2. Define `NodeAnswers` (or re-use whatever type `promptForNode` already returns) as the input type for `writeNewNode`. If `promptForNode` returns an inline literal type, lift it to a named exported interface so tests can construct values.
3. Extract the write-side code into:
   ```ts
   export async function writeNewNode(
     answers: NodeAnswers,
     deps: { paths: RepoPaths },
   ): Promise<NodeWriteResult> { /* moved body */ }
   ```
   Replace any prior reads of `opts.preset.*` with `answers.*`. Replace `repoPaths(...)` lookups with `deps.paths`.
4. Rewrite `runNodeAdd` to:
   ```ts
   export async function runNodeAdd(): Promise<number> {
     // existing init-version marker check
     const root = await findRepoRoot();
     const paths = repoPaths(root);
     const answers = await promptForNode(/* existing deps */);
     await writeNewNode(answers, { paths });
     return 0;
   }
   ```
   Adjust return type / exit code to match the existing contract.
5. Delete `NodeAddOptions.preset`. If `NodeAddOptions` becomes empty, delete the interface and update `runNodeAdd`'s signature to take no options. Update the CLI wiring in `src/cli.ts` if necessary (the `node add` command currently has no flags besides `--preset`; remove it).
6. In `tests/commands/node-add.test.ts`:
   - Replace each `await runNodeAdd({ preset: {...} })` with:
     ```ts
     const paths = repoPaths(tmpRoot);
     await writeNewNode({ kind: 'practice', title: 'Foo', summary: 'Bar', tags: ['x','y'], body: '...', relates_to: [...], confidence: 0.8 }, { paths });
     ```
   - Keep the existing filesystem assertions; they should pass unchanged because `writeNewNode` produces the same on-disk output for the same answers.
7. Run `rg -n 'preset' src/ tests/` to confirm only deliberate (CLI help / docs) references remain.
8. Run `npm run lint && npm run typecheck && npm test`.

</details>
