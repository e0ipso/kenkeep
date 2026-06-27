---
id: 1
group: "schema-primitives"
dependencies: []
status: "pending"
created: 2026-06-27
skills:
  - typescript-cli
  - vitest
complexity_score: 6
complexity_notes: "New Zod->JSON-Schema generator, a named-schema registry, two CLI commands, and a dependency addition; cohesive but spans generation + validation."
---
# Add `kk schema` / `kk validate` primitives backed by a Zod→JSON-Schema generator

## Objective
Make the existing Zod contracts in `src/lib/schemas.ts` visible and
self-checkable to skill authors and the LLM. Add (1) a small generator that
projects named Zod schemas to JSON Schema, (2) a shared named-schema registry
mapping stable names (`proposal-output`, `curator-output`, `node`, and any
others the skills reference) to their Zod schema, (3) a `kk schema <name>` CLI
command that prints the JSON Schema for a name, and (4) a `kk validate <name>
[file|-]` command that validates a JSON artifact against the named Zod schema
and prints line-referenced, actionable errors. Zod stays the single source of
truth — the JSON Schema is always derived, never hand-authored. These commands
are purely additive: no existing command, flag, or schema changes.

## Skills Required
TypeScript CLI command implementation (commander registration in `src/cli.ts`,
zod parsing, filesystem/stdin handling) and Vitest test design.

## Acceptance Criteria
- [ ] A single well-established generator library (e.g. `zod-to-json-schema`) is added to `dependencies` in `package.json` and used to derive JSON Schema from the Zod definitions; no JSON Schema is hand-authored.
- [ ] A shared registry (e.g. `src/lib/schema-registry.ts`) maps stable names to Zod schemas and is the ONLY place names→schema is resolved. At minimum it includes `proposal-output` (`ProposalOutputSchema`), `curator-output` (`CuratorOutputSchema`), and `node` (`NodeFrontmatterSchema`). Names match what the skills will reference.
- [ ] `node dist/cli.js schema --help` and `node dist/cli.js validate --help` both show the new commands. (Registration may be `program.command('schema')` / `program.command('validate')` consistent with existing top-level commands.)
- [ ] `node dist/cli.js schema curator-output` prints valid JSON Schema to stdout and exits 0; an unknown name exits non-zero listing the available names.
- [ ] `node dist/cli.js validate node <file>` and `... validate node -` (stdin) validate the artifact: valid input exits 0 with a success summary; invalid input exits non-zero and prints actionable errors that reference the offending JSON path/line so an author can locate each problem.
- [ ] Tests in `tests/` cover: schema emission for at least one name (shape sanity, not a golden dump of the whole library output), a valid artifact passing `validate`, and an invalid artifact failing with a non-zero exit and a located error. Test the registry/validation glue, not `zod-to-json-schema` itself.
- [ ] `npm run build`, `npm run typecheck`, and the new tests pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- New: `src/commands/schema.ts`, `src/commands/validate.ts`, `src/lib/schema-registry.ts`; a generator helper (inline in the registry or a sibling lib file).
- Registration in `src/cli.ts` mirroring the existing top-level command pattern (see `curate-persist`, `curate-dedup`).
- Reuse existing JSON-reading/stdin helpers where present (`src/lib/stdin.ts`, `src/lib/json-extract.ts`).
- Dependency added to `dependencies` (runtime), not `devDependencies` — the CLI ships it.

## Input Dependencies
None.

## Output Artifacts
The `kk schema` and `kk validate` commands, the named-schema registry, and the
generator helper. Consumed by Task 3 (`drafts collect` reuses the registry) and
Task 6 (skills reference `kk schema <name>` and the `kk validate` loop).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Inspect `src/lib/schemas.ts` for the exact exported schema names. The ones the skills narrate today are `ProposalOutputSchema`, `CuratorOutputSchema`/`CuratorActionSchema`/`CuratorProposedNodeSchema`, and `NodeFrontmatterSchema`. Choose short kebab names: `proposal-output`, `curator-output`, `node`. Add `proposal-candidate` / `curator-action` only if a skill actually needs the sub-shape; do not over-populate the registry (YAGNI).
3. Add `zod-to-json-schema` (already common in the TS/Zod ecosystem) to `dependencies`. Run `npm install` so the lockfile updates. If the agent proxy blocks the install, surface the failure rather than vendoring by hand.
4. `src/lib/schema-registry.ts`: export `const SCHEMA_NAMES` and a `resolveNamedSchema(name): ZodTypeAny | undefined`, plus `toJsonSchema(name)`. Keep this the single source so Task 3 imports it.
5. `schema.ts`: resolve the name, run the generator, `JSON.stringify(..., null, 2)` to stdout. Unknown name → stderr lists `SCHEMA_NAMES`, exit non-zero.
6. `validate.ts`: read JSON from the file arg or stdin (`-`), `JSON.parse`, then `schema.safeParse`. On failure, format `result.error.issues` into one line per issue including the dotted `path` (e.g. `node.tags[2]: expected string`). Exit 0 on success with a one-line OK summary; non-zero on parse or validation failure.
7. Test philosophy — "write a few tests, mostly integration": exercise the commands end-to-end (build, then `node dist/cli.js ...`) or call the command functions directly with a temp file. Do NOT snapshot the entire generated JSON Schema (brittle against the library version) — assert key properties exist. Cover one valid + one invalid artifact and the unknown-name path. Combine scenarios into one or two test files.
8. Run `npm run build`, `npm run typecheck`, and `npx vitest run` for the new files before declaring done. Report exactly which files changed.
</details>
