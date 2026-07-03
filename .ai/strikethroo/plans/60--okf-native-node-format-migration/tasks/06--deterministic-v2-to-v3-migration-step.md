---
id: 6
group: "migration"
dependencies: [1, 2, 3, 4]
status: "pending"
created: 2026-07-02
skills:
  - typescript
complexity_score: 7
complexity_notes: "The core no-LLM rewrite: field renames, namespacing, section rendering, summary migration, index rebuild, collision detection, dual-key version detection, plus the registry/SKILL.md binding rule."
---
# Add the deterministic v2→v3 migration step

## Objective
Add a `MIGRATION_STEPS` entry from 2 to 3 whose primitives mechanically and
losslessly rewrite a v2 tree to v3 with no LLM: rename `kind`→`type` and
`summary`→`description`, `kk_`-prefix the kenkeep-only keys, set
`kk_schema_version: 3`, render the Related and Citations sections, migrate folder
summaries out of index frontmatter into the sidecar, rebuild indexes as OKF
reserved files, and report `# Citations`/`Related` heading collisions for
supervised resolution. Teach `detectSchemaVersion` to read both the legacy
`schema_version` and the namespaced `kk_schema_version`, and add the matching
per-step procedure + version bump to the kk-migrate SKILL.md.

## Skills Required
- **typescript** — implement the migration primitives and version detection.

## Acceptance Criteria
- [ ] `MIGRATION_STEPS` in `src/lib/migrate.ts` gains a `from: 2, to: 3` entry whose primitives perform every rewrite listed in the objective.
- [ ] The step's primitives refuse to run unless the detected on-disk version is exactly 2.
- [ ] `detectSchemaVersion` resolves v1 and v2 trees via the legacy `schema_version` key and v3 trees via `kk_schema_version`.
- [ ] Existing `Related`/`# Citations` headings in node prose are inventoried and reported as collisions instead of being silently merged.
- [ ] The kk-migrate SKILL.md gains the 2→3 procedure section with its `<!-- Version -->` bump (update the source under `templates/skills/kk-migrate/SKILL.md` and any generated copies).
- [ ] Verification: `npx kenkeep --harness claude migrate status` against a v2 fixture reports exactly one pending step (2→3) with the expected primitives; running it produces a v3 tree whose per-leaf frontmatter diff shows `type==old kind`, `description==old summary`, each `kk_*==` its unprefixed predecessor, and body prose unchanged outside delimited sections. Expected: exit 0, zero information loss.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/lib/migrate.ts` (`MIGRATION_STEPS`, `detectSchemaVersion`),
  migration primitive modules; `templates/skills/kk-migrate/SKILL.md` (source of
  truth) and mirrored `.agents`/`.opencode`/`.cursor` copies if generated.
- Reuse the renderers (task 4), sidecar (task 2), and index rebuild (task 3).
- No clustering, no LLM — purely mechanical.

## Input Dependencies
- Task 1: v3 schema. Task 2: sidecar. Task 3: index rebuild. Task 4: section
  renderers.

## Output Artifacts
- The migration step run against this repo's KB in task 9.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. In `src/lib/migrate.ts`, extend `detectSchemaVersion` to check
   `kk_schema_version` first (v3+), falling back to the legacy `schema_version`
   key (v1/v2). A tree with neither is version-less.
2. Add a `MIGRATION_STEPS` entry `{ from: 2, to: 3, primitives: [...] }`. The
   primitive(s), for every leaf: (a) rename `kind`→`type`, `summary`→`description`;
   (b) move `id`/`relates_to`/`depends_on`/`derived_from`/`confidence` to
   `kk_`-prefixed keys; (c) set `kk_schema_version: 3`; (d) call the task-4
   renderers to splice Related + Citations; (e) inventory pre-existing `Related`/
   `# Citations` headings and collect collisions.
3. Migrate folder summaries: read old `nodes/**/index.md` frontmatter summaries,
   write them to the sidecar via task 2, then rebuild all indexes via task 3
   (root gets `okf_version: "0.1"`, others frontmatter-free).
4. Guard: the primitive throws if `detectSchemaVersion(root) !== 2`.
5. On collisions, do not merge — surface them in the step result for supervised
   resolution.
6. Update `templates/skills/kk-migrate/SKILL.md`: add the "2→3" procedure section
   describing invoke-primitives-then-review, and bump its `<!-- Version -->`
   comment per the registry's binding rule. Regenerate/mirror the harness copies
   if the build produces them.
7. Add integration tests covering v1, v2, v3, and mixed-tree detection plus a
   full 2→3 run with a per-leaf frontmatter diff assertion.
</details>
