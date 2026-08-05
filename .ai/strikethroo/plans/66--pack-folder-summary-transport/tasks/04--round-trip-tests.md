---
id: 4
group: "pack-transport"
dependencies: [1, 2, 3]
status: "pending"
created: 2026-08-05
skills:
  - vitest
  - typescript
complexity_score: 6
complexity_notes: "Spans three test files and requires a two-sandbox export/import round trip with a stubbed acquirer."
execution_profile: "standard-implementation"
---
# Test the folder summary round trip and its failure modes

## Objective

Prove that folder summaries survive a `pack export` → `pack import` round trip, that renaming and legacy packs behave correctly, and that malformed and hostile registries are rejected — covering the plan's Primary Success Criteria with automated tests.

## Skills Required

- **vitest** — the project's test runner; fixture construction in temp directories and dependency injection for stubbing pack acquisition.
- **typescript** — writing tests that import directly from `src/`.

## Acceptance Criteria

- [ ] **Round trip** (`tests/commands/pack-import.test.ts`): a KB seeded with nested folders and a populated registry exports, then imports into a second sandbox; `readFolderSummaries(consumerNodesDir)` contains `<dest>` and `<dest>/<subfolder>` keys carrying the authored text, and `nodes/<dest>/index.md` renders the authored routing sentence rather than the `deterministicIntent` fallback.
- [ ] **Rename**: the same round trip with `--as <name>` re-keys every entry under the renamed branch.
- [ ] **Legacy pack**: a pack with no `knowledge.FOLDER_SUMMARIES.md` imports successfully, returns exit code `0`, and produces no error.
- [ ] **`manifest.summary` precedence**: the existing assertion at `tests/commands/pack-import.test.ts:255-270` passes unchanged, and a pack shipping a root (`''`) registry entry does not override `manifest.summary` for the destination key.
- [ ] **Malformed registry** (`tests/lib/pack.test.ts`): a registry failing `FolderSummaryRegistrySchema` makes `validatePack` return `ok: false` with a matching `errors` entry.
- [ ] **Traversal key** (`tests/lib/pack.test.ts`): a registry containing `../../../evil` makes `validatePack` return `ok: false` with an error naming that key.
- [ ] **Missing entry is a warning** (`tests/lib/pack.test.ts`): a pack whose `knowledge/` has a folder with no registry entry returns `ok: true` with a `warnings` entry naming the folder.
- [ ] **Export emits the file** (`tests/commands/pack-export.test.ts`): a positive assertion that `knowledge.FOLDER_SUMMARIES.md` exists at the pack root, alongside the existing negative assertions at `tests/commands/pack-export.test.ts:161-164`; and an assertion that no `FOLDER_SUMMARIES.md` exists under `knowledge/`.
- [ ] The `seedKnowledgeBase` helper (`tests/commands/pack-export.test.ts:56-70`) is extended to write a registry, since it currently writes none.
- [ ] The existing export idempotence test using `snapshotTree` (`tests/commands/pack-export.test.ts:226-241`) still passes, proving the new file serializes deterministically.
- [ ] Runnable verification: from `/workspace`, `npx vitest run tests/commands/pack-export.test.ts tests/commands/pack-import.test.ts tests/lib/pack.test.ts tests/lib/folder-summaries.test.ts tests/lib/index-gen.test.ts` exits `0` with zero failures.
- [ ] Runnable verification: from `/workspace`, `npm test` exits `0`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Runner is vitest (`vitest.config.ts`, `include: ['tests/**/*.test.ts']`, `testTimeout: 20000`).
- Pack fixtures are constructed in code — there are no on-disk pack fixtures in `tests/fixtures`, and this task must not add any. Follow the existing `writePack` convention at `tests/commands/pack-import.test.ts:65-72`.
- Stub pack acquisition through the injectable `opts.acquireSource` (`tests/commands/pack-import.test.ts:186-189`). No test may touch the network.

## Input Dependencies

- Task 1 — export must emit the registry.
- Task 2 — `validatePack` must implement the error/warning behavior these tests assert.
- Task 3 — import must merge and re-key.

## Output Artifacts

- Regression coverage for the round trip, renaming, legacy packs, and the two rejection paths.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Test philosophy — apply this while writing these tests.**

*Definition.* Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test *your* code, not the framework or library.

*When TO write tests:* custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic or calculations.

*When NOT to write tests:* third-party library functionality; framework features; simple CRUD operations without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

*Test task creation rules:* combine related test scenarios into a single task rather than splitting per scenario; favor integration and critical-path coverage over per-method unit tests; avoid one test case per CRUD operation; question whether simple functions need dedicated coverage.

Concretely here: do **not** write tests for `gray-matter`, `zod`, or `js-yaml` behavior, and do not add per-function unit tests for `writeFolderSummaries` — its byte-stability contract is already covered at `tests/lib/folder-summaries.test.ts:24-55`. The valuable coverage is the end-to-end round trip and the two rejection paths.

**Running focused tests.** `npm test` runs a full `pretest` build first, which is slow. For iteration use `npx vitest run tests/commands/pack-import.test.ts` — these tests import from `src/`, so no build is needed. The one exception is the `runCli` path in `tests/helpers.ts`, which shells out to `dist/cli.js` and does require a build. Prefer calling `runPackExportCommand` / `runPackImportCommand` directly over `runCli`. Run `npm test` once at the end for the full-suite acceptance criterion.

**Round-trip test construction.**

1. Seed an export sandbox: reuse or mirror `seedKnowledgeBase` (`tests/commands/pack-export.test.ts:56-70`), adding at least two nested folders, and write a registry via `writeFolderSummaries(nodesDir, map)` (or `setFolderSummary` per key, since this is fixture setup, not production code) with distinctive authored text — include a `read when …` clause so the assertion can distinguish authored text from the `deterministicIntent` fallback.
2. Run `runPackExportCommand({ name, version, summary, out })` pointed at a temp output directory.
3. Assert the pack root contains `knowledge.FOLDER_SUMMARIES.md` and that its parsed `summaries` carry the seeded text.
4. Seed a second, independent consumer sandbox (initialized kenkeep repo).
5. Run `runPackImportCommand(source, { acquireSource })` where `acquireSource` returns `{ packRoot: <the export dir>, resolvedSource: <label> }` — see the existing stub at `tests/commands/pack-import.test.ts:186-189`.
6. Assert `readFolderSummaries(consumerNodesDir)` has `<dest>` and `<dest>/<sub>` keys with the authored text.
7. Read `nodes/<dest>/index.md` and assert it contains the authored routing sentence. Assert it does **not** contain the Title-cased fallback phrasing. This assertion is what catches a merge mis-ordered after `runIndexRebuild()`.
8. Capture stdout/stderr as the existing tests do and assert no "folder(s) have no summary" warning appears.

**Rename test.** Same as above with `{ as: 'renamed' }`; assert keys are `renamed` and `renamed/<sub>` and that no key uses the manifest name.

**Legacy pack test.** Build a pack fixture with `writePack` and simply do not write a registry file. Assert the import resolves to exit code `0` and that no error was logged. A warning is expected and acceptable — assert on the exit code and the absence of errors, not on warning text.

**`validatePack` cases.** Add to `tests/lib/pack.test.ts` alongside its existing nine cases (`:84-190`), following their construction style:

- Malformed: write a registry file whose frontmatter fails the schema — for example `schema_version: 2`, or `summaries` as an array instead of a record. Assert `ok === false` and an `errors` entry mentioning the registry.
- Traversal: write a valid-schema registry whose `summaries` includes the key `../../../evil`. Assert `ok === false` and an `errors` entry containing `../../../evil`.
- Missing entry: build a pack whose `knowledge/` contains a folder absent from the registry. Assert `ok === true` and a `warnings` entry naming that folder.

**Export test.** Add the positive assertion for `knowledge.FOLDER_SUMMARIES.md` next to the existing negative assertions that `ENTRY.md`, `GRAPH.md`, `.state`, and `config.yaml` are not exported (`tests/commands/pack-export.test.ts:161-164`). Also assert no `FOLDER_SUMMARIES.md` exists anywhere under `knowledge/` — shipping it there would make `collectLeafNodes` treat it as a leaf node and break every import.

**Do not** modify production source in this task. If a test reveals a defect in tasks 1-3, report it rather than patching around it — a test adjusted to accommodate a bug is worse than a failing test.

</details>
