---
id: 7
group: "conformance"
dependencies: [1, 2]
status: "pending"
created: 2026-07-02
skills:
  - typescript
complexity_score: 5
complexity_notes: "New conformance rules plus re-expressing existing lint rules and doctor reads against v3 field names and the sidecar."
---
# Add OKF conformance lint rules and update doctor

## Objective
Make OKF conformance a checked invariant: lint asserts every non-reserved `.md`
under `nodes/` has parseable frontmatter with a non-empty `type`, that the
bundle-root `nodes/index.md` declares only `okf_version`, and that every other
`nodes/**/index.md` has no frontmatter; re-express the existing lint rules
(naming agreement, dangling edges) against the v3 field names; and update doctor
so dangling-source reporting reads `kk_derived_from` and freshness checks read
the kenkeep sidecar rather than reserved index frontmatter.

## Skills Required
- **typescript** — edit lint rules and doctor checks.

## Acceptance Criteria
- [ ] Lint flags any non-reserved leaf lacking parseable frontmatter or a non-empty `type`.
- [ ] Lint flags a bundle-root `nodes/index.md` whose frontmatter is not exactly `okf_version`, and any other `nodes/**/index.md` that has frontmatter.
- [ ] Naming-agreement and dangling-edge lint rules use v3 names (`kk_id`, `kk_relates_to`, `kk_depends_on`).
- [ ] Doctor's verbose dangling-source report reads `kk_derived_from`; its freshness checks read the sidecar (task 2), not reserved index frontmatter.
- [ ] Verification: `npx kenkeep lint --verbose` and `npx kenkeep doctor --verbose` against a valid v3 fixture report zero errors; introducing a leaf with an empty `type` or frontmatter on an ordinary index makes lint report exactly that violation and exit non-zero.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/lib/lint.ts`, `src/lib/lint-state.ts` (if rule registry lives
  there), and the doctor command implementation.
- Conformance rules scoped to exactly what OKF v0.1 requires — no gold-plating.

## Input Dependencies
- Task 1: v3 field names. Task 2: sidecar for freshness.

## Output Artifacts
- Conformance gate exercised in the dogfood validation (task 9).

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. In `src/lib/lint.ts`, add rules: (a) for each non-reserved `.md` under
   `nodes/`, parse frontmatter and assert non-empty `type`; (b) for bundle-root
   `nodes/index.md`, assert frontmatter keys == `{ okf_version }`; (c) for every
   other `nodes/**/index.md`, assert no frontmatter.
2. Update the existing naming-agreement rule (filename == `<kk_id>.md`,
   `kk_id == <type>-<slug>`) and dangling-edge rule (`kk_relates_to`/
   `kk_depends_on` targets exist) to the v3 keys.
3. In doctor, change dangling-source reporting to read `kk_derived_from` and
   freshness to consult `readFolderSummaries` / the generated-artifact hashes in
   `ENTRY.md`/`GRAPH.md` rather than reserved index frontmatter.
4. Add vitests: a clean v3 fixture yields zero lint/doctor errors; targeted
   violations (empty `type`, stray index frontmatter, dangling edge) each produce
   exactly one reported error.
</details>
