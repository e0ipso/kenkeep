---
id: 3
group: "prompt-eval"
dependencies: [2]
status: "completed"
created: 2026-07-19
skills:
  - vitest
  - yaml
complexity_score: 4
execution_profile: "standard-implementation"
---
# Add corpus structural-invariant test

## Objective

Add a vitest suite that walks `tests/fixtures/prompt-eval/` in normal CI (no
LLM, no eval results) and fails loudly if the committed corpus's structure
drifts: pairing, frontmatter validity, UUID uniqueness, sidecar schema, and
exact category counts.

## Skills Required

- `vitest` — suite in `tests/` mirroring the idioms of
  `tests/lib/prompt-retrieval-golden.test.ts`.
- `yaml` — strict parsing of session frontmatter and sidecars.

## Acceptance Criteria

- [ ] The suite verifies: every session parses with valid frontmatter
      (`schema_version: 1`, `harness`, ISO `captured_at`); every
      `session_id` is a valid UUID v4 and unique across the corpus; exact
      session↔sidecar pairing with `fixture_id` matching the shared
      basename (no unpaired files in either direction); every sidecar
      conforms to the issue #113 schema; category counts match the issue's
      table exactly (11 admit by subcategory, 9 reject by subcategory,
      2 mixed-salvage, 2 trap-phantom).
- [ ] Every session contains 8–20 role segments and at least one consecutive
      pair of `[AGENT]:` segments, guarding the captured-session shape instead
      of uniform alternating dialogue.
- [ ] The suite fails loudly if the corpus no longer contains `/kk-add`,
      `/kk-bootstrap`, `/kk-curate`, and `/kk-session-extract` command traffic,
      if any invocation loses its `<command-name>` envelope, or if a bare
      `[USER]: /kk-*` invocation is introduced.
- [ ] Validation failures throw with file-and-case labels, and the suite
      reports per-category pass counts, mirroring
      `tests/lib/prompt-retrieval-golden.test.ts`.
- [ ] Verify green: the repo's test invocation (`npm test` or
      `npx vitest run <suite>`) passes with the task-2 corpus in place.
- [ ] Verify it guards: temporarily rename one sidecar (or corrupt one
      `session_id`), confirm the suite fails with a message naming the
      offending file, then restore the fixture.
- [ ] The suite reads only `tests/fixtures/prompt-eval/` — it never runs an
      LLM, never reads `tmp/` eval results, and adds no runtime surface (no
      CLI subcommand, hook, nudge, notification, or harness exec).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Vitest plus the repo's existing YAML parsing (`js-yaml`); no new
  dependencies.
- Hard-code the issue's category table in the test as the expected
  distribution so count drift fails loudly (a "loud guard test" per the
  #115 idiom).
- Do not extract shared helpers with `prompt-retrieval-golden.test.ts` and
  do not modify #115's code — mirror idioms by convention only.

## Input Dependencies

- Task 2: the committed corpus under `tests/fixtures/prompt-eval/` (the test
  asserts against the real fixture set, including exact category counts).

## Output Artifacts

- Structural-invariant vitest suite in `tests/` — runs in normal CI and
  freezes the corpus contract for future refactors.

## Implementation Notes

<details>
<summary>Detailed guidance</summary>

- Read `tests/lib/prompt-retrieval-golden.test.ts` first and copy its
  structure: strict inline validation that throws with file-and-case
  labels, per-category accounting, guard tests that fail loudly when an
  authored-against assumption drifts.
- UUID v4 check: format regex including the version-4 and variant nibbles;
  collect all ids and assert set size equals 24.
- Pairing check both directions: every `sessions/<base>.md` has
  `expected/<base>.yaml` and vice versa; each sidecar's `fixture_id`
  equals `<base>`.
- Test philosophy (binding): write a few tests, mostly integration.
  Meaningful tests verify custom business logic, critical paths, and edge
  cases specific to this application — test *your* code, not the framework.
  Do not test third-party libraries, framework features, or trivial
  configuration; combine related scenarios into a single suite rather than
  one test per file or per field. Here that means one suite asserting the
  named invariants over the whole corpus — no per-fixture test tasks and no
  additional suites.

</details>
