---
id: 3
group: "index-catalog-rewrite"
dependencies: [1, 2]
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Update tests to assert catalog shape; delete obsolete budget-trim coverage

## Objective

Make `tests/lib/index-gen.test.ts` and `tests/index-rebuild.test.ts` assert the new INDEX shape: new section headings, the `## By topic` block, the new bullet format (no em-dash, `#`-prefixed tags), and in-degree-driven sorting. Delete tests that exercised the now-removed budget-trim path (`--budget-tokens`, `MIN_PER_KIND` floor, `hiddenByBudget`, "hidden by token budget" footer).

Your critical mantra for test generation is: **"write a few tests, mostly integration"**. Add only the assertions needed to lock the new shape; do not duplicate coverage of framework behavior or trivial getters.

## Skills Required

- **typescript**, **vitest**: editing existing Vitest specs, writing focused fixture-driven assertions.

## Acceptance Criteria

- [ ] In `tests/lib/index-gen.test.ts` (around lines 72–73), the heading assertions check for `'## Conventions (how we build)'` and `'## Components (what exists)'` (not the old `Practice` / `Map` labels).
- [ ] An assertion confirms `'## By topic'` appears in the generated body.
- [ ] An assertion confirms generated bullets do **not** contain ` — ` (em-dash separator) and **do** contain at least one `#`-prefixed token when the source node has tags.
- [ ] A fixture-driven assertion confirms a node with ≥2 incoming `relates_to` / `depends_on` edges renders **before** a zero-degree sibling within its section.
- [ ] In `tests/index-rebuild.test.ts` (around line 77), the `'additional nodes hidden by token budget'` assertion is removed and replaced with an assertion that every valid node title in the fixture appears in the generated body.
- [ ] Every test that exercised `--budget-tokens`, `MIN_PER_KIND`, `hiddenByBudget`, or trim eviction is deleted (not skipped, not commented out).
- [ ] `npm test` passes with zero failures.
- [ ] No new test file is created unless an existing file is the wrong home for a new assertion; prefer editing existing specs.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `tests/lib/index-gen.test.ts`, `tests/index-rebuild.test.ts`, plus any other test referencing the deleted symbols.
- Use Vitest's existing assertion style (`expect(...).toContain(...)`, `expect(...).toMatch(...)`).
- Build fixture nodes with deterministic IDs/titles so the in-degree ordering test is unambiguous.

## Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms (in-degree sort, tag-bucket sort, bullet rendering shape).
- Critical user workflows (full INDEX render against a multi-node fixture).
- Edge cases relevant to this change (zero-tag node, zero-edge node, ties broken by title).
- Integration points (the rendered INDEX body, end-to-end, not individual sort comparators).

**When NOT to Write Tests:**
- Third-party library functionality (Zod parsing, Commander argument parsing).
- Framework features.
- Simple property access on already-typed structures.
- Configuration files or static data.

**Test Task Creation Rules:**
- Combine related test scenarios into single tests (e.g., one integration test asserting heading + bullet shape + tag block on a fixture).
- Focus on integration over unit coverage. Prefer one assertion against the full rendered body to many assertions against helpers.
- Do not add a dedicated test per renamed heading; one combined `expect(body).toContain(...)` chain is enough.

## Input Dependencies

- Task 1: new `generateIndex` shape and exports.
- Task 2: removed CLI flag and settings field (test imports must compile).

## Output Artifacts

- Updated test files with green `npm test`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

1. Run `npm test` first to see the current failures. The output is the cheapest map of what needs editing.
2. Edit `tests/lib/index-gen.test.ts`:
   - Lines ~72–73: replace `'## Practice (how we build)'` and `'## Map (what exists)'` with `'## Conventions (how we build)'` and `'## Components (what exists)'`.
   - Add `expect(body).toContain('## By topic')`.
   - Add `expect(body).not.toMatch(/ — /)` (em-dash separator).
   - For a node fixture with tags `['foo', 'bar']`, assert the bullet contains `' #foo'` and `' #bar'`.
   - Add a fixture with three nodes: node A with two incoming `relates_to` edges from B and C, and node Z with zero edges, all under the same `kind`. Generate INDEX; assert A's bullet index in the body string is less than Z's. Tiebreaker title test is optional but recommended: two nodes with equal in-degree, assert the alphabetically earlier title appears first.
3. Edit `tests/index-rebuild.test.ts`:
   - Line ~77: delete the `'additional nodes hidden by token budget'` assertion.
   - Replace with: read the fixture's valid node titles, then `for (const title of titles) expect(body).toContain(title)`.
4. `grep -rn '--budget-tokens\|MIN_PER_KIND\|hiddenByBudget\|indexBudgetTokens\|budget_tokens' tests/`. For every hit:
   - If the test exercises eviction behavior or the budget flag, delete the entire `it(...)` or `describe(...)` block.
   - If it is a stray reference inside a still-relevant test, delete just the line and adjust assertions.
5. Run `npm test` until green.
6. Do not introduce new test files. Do not add tests for trivial helpers (e.g., a one-line `renderBullet` unit test is redundant when an integration test already exercises it).
7. Do not assert against a snapshot of the entire INDEX body — that would re-introduce a brittle gold file. Assert on the specific structural invariants listed above.

</details>

<details>
<summary>Out of scope for this task</summary>

- Manual smoke tests of `index rebuild`, curate, bootstrap-incremental, and SessionStart (handled in task 5).
- Updating documentation (handled in task 4).

</details>
