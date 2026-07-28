---
id: 1
group: "prompt-eval"
dependencies: []
status: "completed"
created: 2026-07-19
skills:
  - nodejs
  - vitest
complexity_score: 5
complexity_notes: "Single component, but the determinism contract (byte-stable sorted report, exit 0 always) and six specified unit-test modes require care."
execution_profile: "standard-implementation"
---
# Implement deterministic scorer with unit tests

## Objective

Create the dev-only scoring script `scripts/prompt-eval/score.mjs` that turns a
directory of expected-labels sidecars plus a directory of extraction-result
JSONs into a stable, advisory report, and cover its matching and reporting
logic with a vitest unit suite exercising all six specified modes.

## Skills Required

- `nodejs` — ESM scripting with no added dependencies (only what the repo
  already has, e.g. `js-yaml`).
- `vitest` — unit suite in `tests/` following the repo's existing idioms.

## Acceptance Criteria

- [ ] `scripts/prompt-eval/score.mjs` exists and runs as
      `node scripts/prompt-eval/score.mjs <fixtures-dir> <results-dir>`.
- [ ] The report includes: per-fixture PASS/FAIL with reasons (missed expected
      point, phantom over budget, non-empty where empty expected, result file
      missing, result schema-invalid); per-category passed/total; aggregate
      expected-point recall, phantom count, and gate accuracy.
- [ ] Matching is lowercase substring conjunction over `must_match_all`, with
      optional `must_not_match` exclusion, per the sidecar schema in plan 64.
- [ ] Exit code is 0 always — verify: `node scripts/prompt-eval/score.mjs <dir-with-sidecars> <empty-dir>; echo $?` prints `0` and every fixture reports FAIL with reason "result file missing", ordered by fixture id.
- [ ] Output is byte-stable — verify: run the scorer twice with identical
      inputs, redirect both outputs to files, and `diff` them; the diff is
      empty. No timestamps, absolute paths, or locale-dependent ordering in
      the report.
- [ ] Unit tests cover exactly these six modes against tiny inline fixtures:
      matched point, missed point, phantom over budget, expected-empty
      violated, missing result file, schema-invalid result — verify: the new
      vitest suite passes via the repo's test invocation (`npm test` or
      `npx vitest run <suite>`).
- [ ] `npm pack --dry-run` output contains nothing under
      `scripts/prompt-eval/` (the existing `files` allowlist already excludes
      `scripts/`; this confirms it).
- [ ] Zero runtime surface added: no CLI subcommand, no hook, no nudge, no
      notification, no harness exec by kenkeep code, no CI LLM step, no gate
      on the score. Nothing under `src/` changes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Node ESM (`.mjs`) beside the repo's existing dev-only scripts in
  `scripts/`; no new dependencies.
- Sidecar schema consumed: `fixture_id`, `category`, `expect_empty`,
  `expected_points[]` (`id`, `type` practice|map, `must_match_all` lowercase
  substrings, optional `must_not_match`), `max_unexpected_proposals`, `notes`.
- Result files: one JSON per fixture in `<results-dir>`, named by fixture id,
  shaped like the registered `proposal-output` schema
  (strict `{ practice: [], map: [] }` — see `src/lib/schema-registry.ts`).
  The scorer treats a result that does not parse or does not match that shape
  as "result schema-invalid"; it must not import from `src/` or `dist/`.
- Report sorted by fixture id; per-category accounting mirrors the idiom of
  `tests/lib/prompt-retrieval-golden.test.ts`.

## Input Dependencies

None. The sidecar schema and report contract are fully specified in plan 64
and issue #113; the corpus itself is not needed for unit tests (they use tiny
inline fixtures).

## Output Artifacts

- `scripts/prompt-eval/score.mjs` — consumed by task 4 (documented procedure)
  and by the manual eval runs.
- Scorer unit-test suite in `tests/` — runs in normal CI.

## Implementation Notes

<details>
<summary>Detailed guidance</summary>

- Read plan 64 (`plan-64--manual-prompt-eval-corpus.md`), especially the
  "Deterministic Scorer" section, and GitHub issue #113 for the verbatim
  reporting requirements.
- Mirror the strict-validation idioms of
  `tests/lib/prompt-retrieval-golden.test.ts`: validation failures should
  throw with file-and-case labels; keep per-category pass accounting.
- Determinism checklist: sort fixture ids with a plain lexicographic
  comparator (no `localeCompare` without a fixed locale), never emit
  timestamps or absolute paths, iterate categories in sorted order.
- The scorer is advisory: malformed sidecars in the fixtures dir should
  produce a clear per-fixture failure line, not a crash, and the process
  still exits 0.
- Test philosophy (binding): write a few tests, mostly integration.
  Meaningful tests verify custom business logic, critical paths, and edge
  cases specific to this application — test *your* code, not the framework.
  Write tests for custom logic, critical workflows, edge cases, and
  integration points; do not test third-party libraries, framework features,
  trivial getters, or static configuration. Combine related scenarios into a
  single task/suite; favor integration and critical-path coverage over
  per-method unit tests. Here that means: one suite, six specified scenarios,
  no more.

</details>
