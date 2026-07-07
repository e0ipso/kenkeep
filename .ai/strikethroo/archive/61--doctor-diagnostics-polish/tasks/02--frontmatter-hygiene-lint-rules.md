---
id: 2
group: "frontmatter-hygiene"
dependencies: []
status: "completed"
created: 2026-07-07
skills:
  - typescript
---
# Two Frontmatter-Hygiene Lint Rules (tag stray-whitespace, empty folder summary)

## Objective
Add two new non-blocking lint rules to `runLint` in `src/lib/lint.ts`, each
producing `LintEntry { rule, file, message, action }` findings that name the
offending file and the one-line fix:
1. **Tag stray-whitespace** — tag values with leading/trailing/embedded stray
   whitespace.
2. **Empty folder summary** — folder `index.md` nodes whose `summary`
   (`IndexFrontmatterSchema.summary`) is present-but-empty or whitespace-only.
   Leaf `description` is explicitly NOT scanned.

## Skills Required
- **typescript**: Node ≥22 ESM with `.js` import extensions; edit
  `src/lib/lint.ts`, add to the `LintRule` union and push findings, reusing the
  existing node-enumeration path and `normalizeTag`.

## Acceptance Criteria
- [ ] `LintRule` union gains two new rule ids (e.g. `tag-whitespace` and
      `empty-summary`); both emit into the `findings` (non-blocking) array, never
      `errors`.
- [ ] Tag stray-whitespace finding fires when a tag's raw value differs from its
      whitespace-normalized form; message names the node file and the corrected
      tag as the one-line fix.
- [ ] Empty-summary finding fires only on folder `index.md` nodes whose `summary`
      is present-but-empty/whitespace-only; message names the `index.md` file and
      the one-line fix. Leaf `description` is not scanned.
- [ ] Node/index enumeration degrades gracefully when node loading fails (mirror
      doctor's `canEnumerate` guard); a single malformed node does not throw out
      of the rule.
- [ ] A clean knowledge base produces zero new findings (no false positives).
- [ ] **Verification:** `npm run build && npm run typecheck && npm run lint` exit
      0. In a scratch KB, introduce (a) a node tag with leading/trailing
      whitespace and (b) a folder `index.md` with an empty `summary`, then run
      `node dist/cli.js lint --verbose`: two findings appear, each naming the
      exact file and a one-line fix, and the command exit code is unchanged
      (non-blocking, exits 0 when only findings exist).

## Technical Requirements
- File: `src/lib/lint.ts` (`runLint`); extend the `LintRule` union
  (`lint.ts:8-16`) and the `printCounts` rule listing in
  `src/commands/lint.ts` so the new findings show in the summary counts.
- Reuse: `readAllNodes` (already called in `runLint`) for leaf tags;
  `normalizeTag` (`lint.ts:309`) as the normalization reference so the two tag
  rules stay consistent; `INDEX_FILENAME` for folder-index detection.
- Schema: `IndexFrontmatterSchema.summary` is `z.string().optional()`
  (`src/lib/schemas.ts:244`); leaf `tags` are `z.array(z.string())` (NOT
  trimmed by the schema, so raw whitespace survives into `readAllNodes`).
- Findings are `LintEntry { rule, file, message, action }`; keep them sorted via
  the existing `compareEntries`/`findings.sort` path.

## Input Dependencies
None. Independent of task 1 (different file: `src/lib/lint.ts`).

## Output Artifacts
- Two new `findings` rules from `runLint`, consumed by task 3 (doctor surfaces
  them) and task 4 (tests), and described by task 5 (docs).

## Implementation Notes
**Test philosophy carried from the plan (apply if you touch tests here, though
tests are owned by task 4):** *Write a few tests, mostly integration. Meaningful
tests verify custom business logic, critical paths, and edge cases specific to
this application — test your code, not the framework. Combine related scenarios
into a single task; favor integration/critical-path coverage over per-method
unit tests; question whether simple functions need a dedicated test.*

<details>
<summary>Step-by-step implementation</summary>

1. Add two members to the `LintRule` union (e.g. `'tag-whitespace'`,
   `'empty-summary'`).
2. **Tag stray-whitespace:** iterate `nodes` (already loaded via `readAllNodes`
   in `runLint`). For each `tag` in `node.frontmatter.tags`, compute a
   whitespace-normalized form — trim ends and collapse internal whitespace runs,
   e.g. `tag.replace(/\s+/g, ' ').trim()`. If it differs from the raw `tag`,
   push a `findings` entry: `file: node.path`, message naming the raw tag,
   `action` giving the corrected tag as the one-line fix. Use `normalizeTag` as
   the consistency reference for how the sibling `tag-near-duplicate` rule treats
   tags, but note `normalizeTag` strips ALL non-alphanumerics — do not use it to
   *detect* whitespace; use it only to stay conceptually consistent.
3. **Empty folder summary:** enumerate folder `index.md` files. These carry
   `IndexFrontmatterSchema` frontmatter with an optional `summary`. Parse each
   folder `index.md` via `gray-matter` (as `checkIndexConformance` already does),
   read `summary`, and if it is present but `String(summary).trim() === ''`, push
   a `findings` entry naming the `index.md` file with the one-line fix (author a
   non-empty summary, or point at the command/skill that repairs it). Target the
   literal `summary` field only; do not scan leaf `description`. Reconcile with
   the existing `okf-conformance` handling of `index.md` — only flag folders
   whose index legitimately carries an `IndexFrontmatterSchema` summary field.
4. **Graceful degradation:** if the shared node-loading path throws
   (`InvalidNodeFrontmatterError`/`OldLayoutError`), the rule must skip rather
   than re-throw — mirror doctor's `canEnumerate` guard so one broken node does
   not abort lint. Since `runLint` already calls `readAllNodes` unguarded, only
   your new folder-index scanning needs its own try/skip if it reads files
   independently.
5. Both rules push to `findings` (non-blocking), never `errors`; keep the
   `findings.sort(compareEntries)` invariant.
6. Update `printCounts` in `src/commands/lint.ts` to list the two new rules in
   the `findings` bucket so counts render.
7. Build, typecheck, lint; verify against a scratch KB per the acceptance
   criteria.
</details>
