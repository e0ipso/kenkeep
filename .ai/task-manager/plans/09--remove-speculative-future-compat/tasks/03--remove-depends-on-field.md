---
id: 3
group: "dead-fields"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Remove the depends_on Node Frontmatter Field

## Objective
Delete the `depends_on: string[]` field from `NodeFrontmatterSchema` and every production writer, lint check, index/graph renderer, template, and test fixture that touches it. Existing on-disk nodes carrying `depends_on: []` lines remain parseable because the schema relies on Zod's default behavior of ignoring unknown keys (no `.strict()` is applied today).

## Skills Required
- `typescript`: edit schemas, sweep removals across many TypeScript and markdown files in a coordinated way.

## Acceptance Criteria
- [ ] `NodeFrontmatterSchema` in `src/lib/schemas.ts` no longer declares `depends_on`.
- [ ] `src/lib/index-gen.ts`: `computeInDegree` iterates only `n.frontmatter.relates_to`; the `if (fm.depends_on.length > 0)` line in `generateGraph` is gone; the doc comment for `computeInDegree` no longer mentions `depends_on`.
- [ ] `src/lib/lint.ts`: every `[...node.frontmatter.relates_to, ...node.frontmatter.depends_on]` becomes `[...node.frontmatter.relates_to]` (or a direct reference); the outgoing-edge count uses only `relates_to.length`.
- [ ] `src/lib/curate.ts:487`, `src/lib/bootstrap.ts:599`, `src/commands/node-add.ts:76`: the `depends_on: []` line is removed from frontmatter object literals.
- [ ] `src/templates-source/claude/skills/kb-add/SKILL.md:40` and `src/templates-source/claude/skills/kb-bootstrap/SKILL.md:87`: the `depends_on: []` example lines are removed.
- [ ] `src/templates-source/knowledge-base/README.md:23`: the line currently mentioning `relates_to / depends_on` mentions only `relates_to` (rewrite both the bullet and the description text so it still reads cleanly).
- [ ] `tests/fixtures/transcripts/bravo-insider/existing-kb.md`: all four `depends_on: []` lines are deleted.
- [ ] Every test file that constructs a node fixture drops the `depends_on` line/property. Specifically: `tests/doctor.test.ts`, `tests/doctor-dangling.test.ts`, `tests/index-rebuild.test.ts`, `tests/commands/lint.test.ts`, `tests/commands/node-add.test.ts`, `tests/lib/nodes.test.ts`, `tests/lib/curate.test.ts`, `tests/hooks/kb-lint-tick.test.ts`, `tests/lib/session-start.test.ts`, `tests/lib/index-gen.test.ts`, `tests/lib/conflicts.test.ts`, `tests/lib/bootstrap.test.ts`, `tests/lib/lint.test.ts`.
- [ ] The `tests/lib/index-gen.test.ts` case at line 103 that uses `depends_on: ['practice-hub']` to verify in-degree counting is rewritten to use `relates_to: ['practice-hub']` instead (so the in-degree behavior remains covered).
- [ ] `rg -n "depends_on" src/ tests/ src/templates-source/` returns no hits outside of archive markdown.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Zod default behavior already drops unknown keys; verify no `.strict()` is applied to `NodeFrontmatterSchema` (it is not). Old on-disk node files with `depends_on: []` lines must continue to parse cleanly.
- The `NodeFrontmatter` TypeScript type is inferred from the Zod schema; removing the schema entry also removes the property from the type.

## Input Dependencies
None.

## Output Artifacts
- Updated `src/lib/schemas.ts`, `src/lib/index-gen.ts`, `src/lib/lint.ts`, `src/lib/curate.ts`, `src/lib/bootstrap.ts`, `src/commands/node-add.ts`.
- Updated template files: `src/templates-source/claude/skills/kb-add/SKILL.md`, `src/templates-source/claude/skills/kb-bootstrap/SKILL.md`, `src/templates-source/knowledge-base/README.md`.
- Updated fixture: `tests/fixtures/transcripts/bravo-insider/existing-kb.md`.
- Updated test files listed above.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Schema** (`src/lib/schemas.ts:124-135`): delete the `depends_on: z.array(z.string()),` line from `NodeFrontmatterSchema`. The `NodeFrontmatter` type is re-inferred automatically.

2. **`src/lib/index-gen.ts`**:
   - Update the doc comment above `computeInDegree`: change `Count incoming relates_to + depends_on edges per node id.` to `Count incoming relates_to edges per node id.`.
   - Inside `computeInDegree`, change:
     ```ts
     const edges = [...n.frontmatter.relates_to, ...n.frontmatter.depends_on];
     for (const targetId of edges) {
     ```
     to:
     ```ts
     for (const targetId of n.frontmatter.relates_to) {
     ```
   - In `generateGraph`, delete the line `if (fm.depends_on.length > 0) lines.push(\`- **depends_on:** ${fm.depends_on.join(', ')}\`);`.

3. **`src/lib/lint.ts`**: replace each of the two `const refs = [...node.frontmatter.relates_to, ...node.frontmatter.depends_on];` with `const refs = node.frontmatter.relates_to;`. In the orphan check, replace `node.frontmatter.relates_to.length + node.frontmatter.depends_on.length` with `node.frontmatter.relates_to.length`.

4. **Writers**:
   - `src/lib/curate.ts:487`: in `buildNodeFrontmatter`, remove the `depends_on: [],` line from the returned object literal.
   - `src/lib/bootstrap.ts:599`: in the local `frontmatter` literal, remove `depends_on: [],`.
   - `src/commands/node-add.ts:76`: in the local `frontmatter` literal, remove `depends_on: [],`.

5. **Templates**:
   - `src/templates-source/claude/skills/kb-add/SKILL.md` line 40: delete the `depends_on: []` line. The surrounding example YAML block remains otherwise unchanged.
   - `src/templates-source/claude/skills/kb-bootstrap/SKILL.md` line 87: delete the `depends_on: []` line.
   - `src/templates-source/knowledge-base/README.md` line 23: change
     ```
     - `relates_to` / `depends_on`: loose and strict cross-references rendered in `GRAPH.md`.
     ```
     to
     ```
     - `relates_to`: cross-references rendered in `GRAPH.md`.
     ```

6. **Fixture**:
   - `tests/fixtures/transcripts/bravo-insider/existing-kb.md`: delete every occurrence of the `depends_on: []` line (four total).

7. **Tests**: in each of the test files listed in Acceptance Criteria, remove the `depends_on` property/line wherever a node frontmatter object is constructed. Patterns to expect:
   - Object literals: `depends_on: overrides.depends_on ?? [],` or plain `depends_on: [],` — delete these lines.
   - YAML string fragments in fixture builders: `'depends_on: []',` — delete these lines.
   - Special case for `tests/lib/index-gen.test.ts` line 103: it asserts in-degree counting using `depends_on: ['practice-hub']`. Change the property to `relates_to: ['practice-hub']` instead so the same in-degree behavior is exercised through `relates_to`. The accompanying test's interface declaration at line 15 (`depends_on?: string[];`) is removed as part of this edit; line 31 (`depends_on: s.depends_on ?? [],`) is also removed.
   - In `tests/lib/lint.test.ts` and `tests/commands/lint.test.ts`, look for any test scenario that specifically targets the lint behavior with `depends_on`. Those scenarios should be rewritten to use `relates_to` if the intent was to exercise the multi-edge code path; otherwise delete them along with the field.

8. **Sweep verification**:
   - `rg -n "depends_on" src/ tests/ src/templates-source/` must return zero matches.
   - `rg -n "depends_on" .` may still match in `.ai/task-manager/archive/`, the plan file itself, and the CHANGELOG; those are acceptable.
   - `npx tsc --noEmit` exits 0.
   - `npm test` exits 0.

</details>
