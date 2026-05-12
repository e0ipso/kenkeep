---
id: 6
group: "tests"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-05-13
skills:
  - vitest
  - typescript
---
# Update tests and fixtures to the slim schema and binary conflict model

## Objective

Update every test and fixture that builds node frontmatter, asserts INDEX/GRAPH content, or exercises the supersession-resolution path so it matches the new schema and the binary replace/reject conflict model. Delete tests that specifically exercise the "supersede" conflict resolution or the `Recently superseded` rendering and replace them with one or two targeted assertions that those features are absent. Update fixtures so transcripts and expected outputs read in the current design's terms.

## Skills Required

- vitest: edit and run a vitest-based suite, including snapshot-style assertions.
- typescript: keep test types aligned with the slim schemas.

## Acceptance Criteria

- [ ] No test file under `tests/` constructs a node frontmatter object containing `valid_from`, `valid_until`, `updated`, `supersedes`, or `superseded_by`.
- [ ] No test asserts the presence of `Recently superseded`, `status:`, `supersedes:`, or `superseded_by:` lines in INDEX/GRAPH output.
- [ ] At least one regression-style assertion exists confirming `Recently superseded` does not appear in `generateIndex` output and `status:` / `supersedes:` / `superseded_by:` do not appear in `generateGraph` output. Co-locate these in `tests/lib/index-gen.test.ts`.
- [ ] Tests previously exercising the supersession conflict resolution are removed; replaced (where useful) by an assertion that the curator's `contradict` path produces a `pending-conflicts.json` whose `proposed_node` validates against the slim `CuratorProposedNodeSchema`.
- [ ] Fixture `tests/fixtures/transcripts/bravo-insider/existing-kb.md` no longer carries the five removed frontmatter fields.
- [ ] Fixture `tests/fixtures/transcripts/bravo-insider/expected.md` describes a replace/reject resolution rather than a supersession resolution.
- [ ] Fixture `tests/fixtures/bootstrap-docs/expected.md` no longer uses "superseded by" cross-reference language.
- [ ] `npm test` is green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files (non-exhaustive, confirmed via grep):
  - `tests/lib/nodes.test.ts`
  - `tests/lib/curate.test.ts`
  - `tests/lib/index-gen.test.ts`
  - `tests/lib/session-start.test.ts`
  - `tests/lib/conflicts.test.ts`
  - `tests/lib/bootstrap.test.ts`
  - `tests/index-rebuild.test.ts`
  - `tests/doctor.test.ts`
  - `tests/doctor-dangling.test.ts`
  - `tests/commands/node-add.test.ts`
  - `tests/fixtures/transcripts/bravo-insider/existing-kb.md`
  - `tests/fixtures/transcripts/bravo-insider/expected.md`
  - `tests/fixtures/bootstrap-docs/expected.md`
- Test framework: vitest.

## Input Dependencies

- Task 1 (slim schemas) — required for any test that imports the types.
- Task 2 (curate.ts + node-add.ts) — required for behavioral tests against the curator and `node add`.
- Task 3 (index-gen.ts) — required for INDEX/GRAPH assertions.

## Output Artifacts

- All listed test files and fixtures updated.
- New negative-assertion tests in `tests/lib/index-gen.test.ts` confirming absence of removed features.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance — Meaningful Test Strategy</summary>

**Meaningful test strategy mantra: "write a few tests, mostly integration".** Do not add tests that verify the framework or the schema library itself. Tests in this task either (a) keep an existing behavioral assertion working under the slim schema, or (b) lock in the removal of a previously documented feature.

1. **Grep first**, fix second:
   ```
   grep -rn "valid_from\|valid_until\|supersedes\|superseded_by\|updated:" tests
   grep -rn "Recently superseded\|RECENT_SUPERSEDED_LIMIT" tests
   grep -rn "supersede" tests
   ```
   These three sweeps surface every site to address.

2. **Inline frontmatter literals.** Where a test constructs a node object with the five fields, delete those keys. Where the test used `valid_until: null` (a "current" node) and then asserted `isValid()` behavior, delete the assertion entirely — the partitioning concept is gone.

3. **Test-helper factories.** If `tests/lib/nodes.test.ts` or a shared `tests/helpers/` factory builds a node fixture with the five fields, update the factory in place. All callers benefit automatically.

4. **Curator tests** (`tests/lib/curate.test.ts`):
   - Existing tests for `modify` and `add` should keep working with their assertions on title/body/id; remove any assertion that checks `updated`, `valid_from`, `valid_until`, `supersedes`, or `superseded_by`.
   - Remove any test case that exercises a "supersede" resolution.
   - Add a focused integration test: feed a fixture session containing one `contradict` candidate, run `persistAction`, read back `pending-conflicts.json`, and assert that `PendingConflictsFileSchema.parse(content)` succeeds and that `content.conflicts[0].proposed_node` has none of the removed fields.

5. **Index-gen tests** (`tests/lib/index-gen.test.ts`):
   - Remove the test that fed a mix of valid + superseded nodes and asserted the partition output.
   - Add (or keep) a test that feeds N nodes and asserts the header line reads `_${N} nodes • ~T estimated tokens_` for some T.
   - Add a regression test: feed three nodes through `generateIndex` and assert the output does not contain `Recently superseded`.
   - Add a regression test for `generateGraph`: feed two nodes and assert the output does not contain the substrings `**status:**`, `**supersedes:**`, `**superseded_by:**`.

6. **Doctor tests** (`tests/doctor.test.ts`, `tests/doctor-dangling.test.ts`):
   - Update fixture nodes to lack the five fields.
   - If doctor had checks for "dangling supersedes" or "valid_until after valid_from", remove those checks from the source and the tests in lockstep. (If those checks live in `src/lib/doctor.ts` and weren't covered by an earlier task, remove them here as part of completing this task; flag the deletion in the commit message.)

7. **`tests/commands/node-add.test.ts`:**
   - Adjust expected frontmatter output to the slim shape.
   - Remove any case verifying a `now`-based timestamp is stamped.

8. **`tests/lib/session-start.test.ts`, `tests/lib/conflicts.test.ts`, `tests/lib/bootstrap.test.ts`, `tests/index-rebuild.test.ts`:**
   - Grep each for the field names and update test data accordingly.
   - `tests/index-rebuild.test.ts` likely asserts INDEX header content; update the expected string.

9. **Fixtures:**
   - `tests/fixtures/transcripts/bravo-insider/existing-kb.md`: remove the five frontmatter fields from every node block embedded in the fixture.
   - `tests/fixtures/transcripts/bravo-insider/expected.md`: rewrite the resolution narrative. Where the expected text described a supersession outcome ("old node retains `valid_until`, new node carries `supersedes`"), describe the replace outcome ("old node file deleted; new node written at the same path; the new node's id may match the deleted one"). No retrospective framing.
   - `tests/fixtures/bootstrap-docs/expected.md`: drop "superseded by" cross-references. If the fixture document references a temporal lineage, rephrase as a current-state cross-reference using `relates_to` semantics.

10. **Style sweep** on fixtures that contain narrative prose (the two `expected.md` files): grep for ` - `, `—`, `–` and replace with commas, colons, or parentheses.

11. **Run the suite:**
    ```
    npm test
    npm run typecheck
    ```
    Both must be green before this task is complete. If a test fails due to a source-side issue that should have been caught by tasks 2 or 3, fix the source (`curate.ts`, `index-gen.ts`) here; the boundary between tasks is approximate.

12. **Do not** introduce a new test file solely to assert that schemas reject the removed fields — that would be testing zod itself.

</details>
