---
id: 4
group: "writers"
dependencies: [1]
status: "pending"
created: 2026-07-02
skills:
  - typescript
complexity_score: 6
complexity_notes: "Pure renderers plus every write path; delimiting for idempotent regeneration without touching hand-written prose is the subtle part."
---
# Render Related/Citations body sections on every node write

## Objective
Add pure, deterministic renderers that translate `kk_relates_to` / `kk_depends_on`
into a labeled "Related" body section of bundle-absolute markdown links and
`kk_derived_from` into a numbered `# Citations` section, then invoke them (and
emit v3 frontmatter) on every node-write path (`node-write`/`nodes.ts` write,
`curate-persist`, bootstrap/add) so the generated sections stay in sync with the
frontmatter truth.

## Skills Required
- **typescript** — implement pure renderers and wire the write paths.

## Acceptance Criteria
- [ ] Pure functions render a "Related" section (typed distinction preserved in the link prose/labels) from `kk_relates_to`/`kk_depends_on`, and a numbered `# Citations` section from `kk_derived_from`.
- [ ] Sections are delimited so a re-render replaces them idempotently and never mutates hand-written body prose.
- [ ] All node write paths (`src/lib/nodes.ts` write, `src/lib/curate.ts`/curate-persist, `src/lib/bootstrap.ts`/add) emit v3 frontmatter and regenerate both sections.
- [ ] Renderers are pure: no clock, no randomness; identical frontmatter → identical section text.
- [ ] Verification: a vitest that writes a node, mutates only the edge arrays, rewrites, and asserts (a) the Related/Citations sections updated, (b) surrounding prose is byte-identical, (c) a second identical write is a no-op. Expected: `npx vitest run` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/lib/nodes.ts`, `src/lib/curate.ts` (curate-persist path),
  `src/lib/bootstrap.ts` (add/bootstrap write path); new renderer helpers.
- Links are bundle-absolute paths derived from target `kk_id`s.
- Delimiters must be stable markers (e.g. HTML comment fences) enabling
  idempotent replacement.

## Input Dependencies
- Task 1: v3 field names (`kk_relates_to`, `kk_depends_on`, `kk_derived_from`).

## Output Artifacts
- The renderers reused by the migration step (task 6) and re-render on rebalance.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Create renderer helpers (e.g. `renderRelatedSection(node, resolvePath)` and
   `renderCitationsSection(node)`), pure functions returning markdown wrapped in
   stable delimiter fences (HTML comments like `<!-- kk:related:start -->` …
   `<!-- kk:related:end -->`).
2. "Related" links: for each `kk_relates_to` and `kk_depends_on` id, resolve the
   target's bundle-absolute path and emit a labeled link so the typed
   distinction survives in prose (OKF keeps relationship kind in surrounding
   text). `# Citations`: numbered list from `kk_derived_from`.
3. Implement a splice function that, given existing body text, replaces content
   between the delimiters if present, else appends the section — never touching
   text outside the fences.
4. In `nodes.ts` write, `curate.ts` persist, and `bootstrap.ts` add, after
   producing v3 frontmatter, run the splice for both sections before writing via
   `fs-atomic.ts`.
5. Add the vitest described in the acceptance criteria (edge mutation, prose
   preservation, no-op second write).
</details>
