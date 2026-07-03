---
id: 9
group: "validation"
dependencies: [5, 6, 7, 8]
status: "pending"
created: 2026-07-02
skills:
  - migration
  - vitest
complexity_score: 7
complexity_notes: "The proving run against the real KB plus the lossless-diff, determinism, and reader-rejection assertions that back the plan's primary success criteria."
---
# Migrate this repo's KB to v3 and validate end to end

## Objective
Run the new 2→3 migration step against this repository's own `.ai/kenkeep/`
knowledge base (the primary validation fixture), then prove the migration is
lossless and deterministic and that all kenkeep functionality operates against
the v3 bundle, with the full test suite green.

## Skills Required
- **migration** — execute the supervised migrate step and review the result.
- **vitest** — author the lossless-diff / determinism integration assertions.

## Acceptance Criteria
- [ ] `npx kenkeep --harness claude migrate status` on a pre-migration copy of `.ai/kenkeep/nodes/` reports exactly one pending step (2→3); executing it yields a v3 tree.
- [ ] A per-leaf frontmatter diff asserts zero information loss: `type==old kind`, `description==old summary`, each `kk_*==` its unprefixed predecessor, edge arrays byte-identical, body prose unchanged outside delimited sections.
- [ ] Every v2 folder `summary` is preserved in the sidecar under the same POSIX folder path; running index rebuild twice leaves sidecar + indexes byte-identical on the second run.
- [ ] A conformance sweep over the migrated tree reports zero violations (non-empty `type` on every non-reserved leaf; root `nodes/index.md` declares only `okf_version: 0.1`; all other indexes frontmatter-free).
- [ ] `npx kenkeep lint --verbose` and `npx kenkeep doctor --verbose` report zero errors; a v2 fixture is rejected by both `init` and a node-read command naming the migrate command; session-start injection renders correctly from the v3 bundle with resolvable branch links; `pack export`→`pack import` round-trips into a scratch v3 workspace and a v2-era pack is rejected by the manifest gate.
- [ ] The whole test suite is green: `npx vitest run` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Uses the migrate step (task 6), readers (task 5), lint/doctor (task 7), and
  prompts (task 8). The dogfood run happens on a clean working tree; accept by
  commit, reject by `git restore`.
- Validation scripts parse frontmatter with the repo's existing gray-matter
  path; no new runtime dependencies.

## Input Dependencies
- Tasks 5, 6, 7, 8 (functional v3 stack).

## Output Artifacts
- The migrated `.ai/kenkeep/` v3 bundle and the integration tests backing
  success criteria 1–4.

## Implementation Notes
Test philosophy — "write a few tests, mostly integration": meaningful tests
verify custom business logic, critical paths, and edge cases specific to this
application. Test *your* code, not the framework. WRITE tests for: custom
business logic and algorithms; critical workflows and data transformations; edge
cases and error conditions for core functionality; integration points between
components; complex validation/calculations. Do NOT write tests for: third-party
library functionality; framework features; simple CRUD without custom logic;
trivial getters/setters or static config; obvious functionality that would break
immediately if incorrect. Combine related scenarios into a single task; favor
integration and critical-path coverage over per-method unit tests; avoid one
test task per CRUD operation; question whether simple functions need a dedicated
test. Here that means: one lossless-migration integration test, one determinism
(double-rebuild) test, one conformance-sweep test, and one reader-rejection test
— not per-field unit tests.

<details>
<summary>Executable guidance</summary>

1. On a clean working tree, copy `.ai/kenkeep/nodes/` from a pre-migration
   commit into a temp workspace. Run `npx kenkeep --harness claude migrate status`
   there and assert exactly one pending 2→3 step with the expected primitives.
2. Execute the migration primitives. Programmatically load old and new
   frontmatter per leaf and assert the field-equality mapping (zero information
   loss) and that body prose outside the delimited sections is unchanged.
3. Diff old folder-index frontmatter summaries against the new sidecar; assert
   preservation by POSIX folder path. Run index rebuild twice; assert
   byte-identical on the second run.
4. Write a conformance-sweep script asserting non-empty `type` on every
   non-reserved leaf, root-only `okf_version`, and frontmatter-free ordinary
   indexes; assert zero violations.
5. Run `lint --verbose`, `doctor --verbose`, the v2-rejection captures for `init`
   and node-read, a synthetic session-start payload, and the pack
   export/import round-trip plus v2-pack rejection.
6. Apply the migration to the actual repo KB, review on disk, and commit to
   accept. Ensure `npx vitest run` is fully green.
</details>
