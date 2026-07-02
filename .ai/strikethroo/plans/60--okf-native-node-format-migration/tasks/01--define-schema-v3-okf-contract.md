---
id: 1
group: "schema-contract"
dependencies: []
status: "pending"
created: 2026-07-02
skills:
  - typescript
  - zod
complexity_score: 6
complexity_notes: "Single source of truth for the whole migration; a missed field or wrong Zod literal fails everything downstream loudly, which is the intended safety net."
---
# Define schema_version 3 OKF node contract in Zod

## Objective
Bump the node schema to version 3 and rewrite the node/curator/proposal Zod
contracts so the OKF-native field names (`type`, `title`, `description`, `tags`)
and the `kk_`-namespaced extension keys (`kk_schema_version`, `kk_id`,
`kk_relates_to`, `kk_depends_on`, `kk_derived_from`, `kk_confidence`) become the
single source of truth every other consumer derives from.

## Skills Required
- **typescript** — edit the schema modules and their exported types.
- **zod** — model the v3 frontmatter, including literals, optionals, and the
  `≤140` character `description` constraint.

## Acceptance Criteria
- [ ] `NODE_SCHEMA_VERSION` in `src/lib/schemas.ts` equals `3`.
- [ ] `NodeFrontmatterSchema` accepts `{ type, title, description, tags, kk_schema_version: 3, kk_id, kk_relates_to, kk_depends_on, kk_derived_from, kk_confidence }` and rejects the old unprefixed `kind`/`summary`/`schema_version` shape.
- [ ] Curator, proposal, and proposed-node schemas exposed through `src/lib/schema-registry.ts` use the same v3 field names.
- [ ] `description` is validated as ≤140 characters; `type` accepts only `practice` | `map`.
- [ ] Verification: `npx vitest run src/lib/schemas` (or the schema test file) passes, AND `npx kenkeep schema` prints a contract containing `kk_schema_version` and `type` with no `kind`/`summary` keys. Expected: exit 0, output shows the v3 fields.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/lib/schemas.ts` (`NODE_SCHEMA_VERSION`, `NodeFrontmatterSchema`),
  `src/lib/schema-registry.ts` (curator/proposal/proposed-node schemas).
- Preserve the naming invariant: `kk_id = <type>-<slug>` and filename = `<kk_id>.md`.
- `kk_schema_version` is a Zod literal `3` so stale writers fail validation loudly.
- Do not add an OKF `timestamp` field and do not keep any dual-read/back-compat
  union for v2.

## Input Dependencies
None — this is the root task.

## Output Artifacts
- The v3 `NodeFrontmatterSchema` and registry schemas consumed by every reader,
  writer, migration primitive, lint rule, and prompt in later tasks.

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Open `src/lib/schemas.ts`. Change the `NODE_SCHEMA_VERSION` constant from `2`
   to `3`.
2. Rewrite `NodeFrontmatterSchema`:
   - `type: z.enum(["practice", "map"])` (was `kind`).
   - `title: z.string()`.
   - `description: z.string().max(140)` (was `summary`).
   - `tags: z.array(z.string())` (keep existing optionality).
   - `kk_schema_version: z.literal(3)`.
   - `kk_id: z.string()`, `kk_relates_to: z.array(z.string()).default([])`,
     `kk_depends_on: z.array(z.string()).default([])`,
     `kk_derived_from: z.array(...).default([])`, `kk_confidence: <existing enum/number>`.
   - Match the *shapes* of the old `id`/`relates_to`/`depends_on`/`derived_from`/
     `confidence` validators exactly — only the key names and `schema_version`
     literal change.
3. In `src/lib/schema-registry.ts`, apply the identical rename to the curator,
   proposal, and proposed-node schemas so `kk schema`/`kk validate` expose v3.
4. Fix TypeScript type errors from renamed properties in the two files only;
   downstream consumers are handled by later tasks and are expected to break
   compilation until then (that is the loud-failure safety net).
5. Run the schema unit tests; update fixtures inside those test files to the v3
   shape as needed (test-file edits only, never production toggles).
</details>
