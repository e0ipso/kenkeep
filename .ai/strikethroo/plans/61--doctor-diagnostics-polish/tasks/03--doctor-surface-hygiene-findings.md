---
id: 3
group: "frontmatter-hygiene"
dependencies: [1, 2]
status: "pending"
created: 2026-07-07
skills:
  - typescript
---
# Surface Lint Hygiene Findings in doctor

## Objective
Make `doctor` surface the two new frontmatter-hygiene lint findings (tag
stray-whitespace, empty folder summary) in its existing actionable-pointer
style — each rendered as a warn-level line naming the file and the one-line fix
— so the issue's "in doctor" intent is honored while hygiene logic stays
single-sourced in `runLint`. The pre-existing dangling-`kk_derived_from` check
remains the sole reporter of non-resolving references (reused, never duplicated).

## Skills Required
- **typescript**: Node ≥22 ESM with `.js` import extensions; edit
  `src/commands/doctor.ts` to invoke `runLint` findings and render the hygiene
  entries, respecting the `canEnumerate` guard.

## Acceptance Criteria
- [ ] `doctor` invokes the shared `runLint` finding producer and renders the two
      hygiene findings (`tag-whitespace`, `empty-summary`) as warn-level lines,
      each naming the file and the one-line fix.
- [ ] Hygiene surfacing respects the existing `canEnumerate` guard: when node
      enumeration fails, doctor skips the hygiene findings with the existing
      migrate/fix pointer instead of crashing.
- [ ] The pre-existing `collectDanglingDerivedFrom` + `resolvesOnDisk` check
      remains the only reporter of dangling `kk_derived_from`; no duplicate
      dangling reporter is added and no dangling line is emitted twice.
- [ ] Surfaced findings are warn-level and do not change exit code beyond the
      existing warnings-still-exit-0 path.
- [ ] **Verification:** `npm run build && npm run typecheck && npm run lint` exit
      0. In a scratch KB with a whitespace tag and an empty folder `summary`,
      `node dist/cli.js doctor -v` surfaces the same two hygiene findings shown by
      `lint`, each naming the file and one-line fix; a deliberately dangling
      `kk_derived_from` reference is reported exactly once (no duplicate line).

## Technical Requirements
- File: `src/commands/doctor.ts` (`runDoctor`).
- Reuse: `runLint` from `src/lib/lint.ts` (returns `{ errors, findings }`);
  filter `findings` to the two new hygiene rule ids and render via
  `log.warn`/`log.plain` in doctor's actionable-pointer style
  (`rule file: message | action` shape used by `lint`'s `formatEntry`).
- Guard: the existing `frontmatterCheck.canEnumerate` flag (`doctor.ts:53-55`)
  already gates node-dependent checks; gate the hygiene surfacing behind it too.
- Do NOT touch `collectDanglingDerivedFrom`/`resolvesOnDisk` — reuse as-is; at
  most group the existing dangling output under a hygiene presentation heading.

## Input Dependencies
- Task 1 (per-harness view) — edits the same `runDoctor` rendering area, so this
  task must land after it to avoid conflicting edits.
- Task 2 (lint rules) — provides the `tag-whitespace` and `empty-summary`
  findings this task surfaces.

## Output Artifacts
- doctor output that surfaces hygiene findings, consumed by task 4 (tests) and
  described by task 5 (docs).

## Implementation Notes
Keep hygiene logic single-sourced: doctor must *read* `runLint`'s findings, not
re-implement the checks. Only surface the two new hygiene rules (and, at most,
present the existing dangling check under the same heading) — do not surface the
full lint finding set (e.g. `orphan`, `tag-near-duplicate`) unless the plan
requires it; it does not.

<details>
<summary>Step-by-step implementation</summary>

1. In `runDoctor`, after building `paths`, call
   `runLint({ nodesDir: paths.nodesDir, root, kkDir: paths.kkDir })` (mirror
   `src/commands/lint.ts`). Do this only when `frontmatterCheck.canEnumerate` is
   true; otherwise skip and rely on the existing "fix those first" warning.
2. Filter `result.findings` to the two new rule ids from task 2.
3. Render each as a warn-level line in doctor's actionable style, e.g.
   `log.warn(`${f.rule} ${f.file}: ${f.message} | ${f.action}`)`, and count them
   toward `warnings` (never `failures`) so exit code stays 0 for warnings-only.
4. Do not add a second dangling reporter: the existing `danglingResult` block
   (`doctor.ts:55-63`, printed via the `checks` list) stays the sole source.
   If you group findings under a hygiene heading, ensure the dangling line is
   still emitted exactly once — add/adjust a test-observable heading only, not a
   second computation.
5. Build, typecheck, lint; verify per acceptance criteria including the
   "reported exactly once" dangling assertion.
</details>
