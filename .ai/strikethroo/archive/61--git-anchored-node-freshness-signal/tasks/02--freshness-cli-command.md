---
id: 2
group: "surfaces"
dependencies: [1]
status: "completed"
created: 2026-07-07
skills:
  - commander-cli
  - vitest
---
# `kenkeep freshness` CLI command

## Objective
Register a top-level, read-only `freshness` subcommand that runs the freshness core and prints a deterministic, human-readable report of how many nodes may describe code that changed since curation. It is advisory and always exits zero; it never writes to `nodes/` and never calls the LLM.

## Skills Required
Commander subcommand wiring in `src/cli.ts` plus a `runFreshness` command module, and Vitest for the output rendering.

## Acceptance Criteria
- [ ] `src/commands/freshness.ts` exports `runFreshness` and is registered as `program.command('freshness')` in `src/cli.ts`, mirroring the existing `lint`/`doctor` registration (including a `-v, --verbose` option).
- [ ] Default output prints a headline: either "N node(s) may describe code that changed since curation" plus the per-branch rollup (branch → flagged count), or a single all-fresh line when `flaggedCount === 0`.
- [ ] `--verbose` additionally lists each flagged node id and, for each, the referenced path(s) that changed.
- [ ] The command exits `0` in all normal cases (advisory, never a failure), and prints a clean "no signal" line and exits `0` when the core returns an empty report (non-git tree / git error / empty KB).
- [ ] Output is deterministic (stable ordering, no timestamps), consistent with the project determinism contract.
- [ ] `node dist/cli.js freshness --help` shows the subcommand after `npm run build`.
- [ ] `npm test -- <the freshness command suite>` exits 0 and asserts the headline, the per-branch rollup, the verbose listing, and the empty-report "no signal" rendering.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse `computeFreshness`/`FreshnessReport` from Task 1; do not re-implement any git logic in the command.
- Resolve paths with `findRepoRoot()` + `repoPaths(root)` and pass `root` + `paths.nodesDir` into the core, as `status`/`doctor` do.
- Use the shared `log` helper for output. Keep the command a thin renderer over the report.
- Follow the CLI conventions already in `src/cli.ts` (`.action(async () => process.exit(await runFreshness(...)))`, `--verbose` boolean default false, a clear `.description(...)`).

## Input Dependencies
Task 1 (`computeFreshness`, `FreshnessReport`).

## Output Artifacts
`src/commands/freshness.ts`, the `freshness` registration in `src/cli.ts`, and the command's Vitest suite. Consumed by users, skills, and the Task 5 documentation.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Copy the shape of an existing simple command (`status.ts` for path resolution + `log.plain` rendering; `lint`'s registration in `cli.ts` for the `--verbose` wiring). Register the subcommand next to `lint`/`doctor`.
3. Keep rendering pure and deterministic: sort branches and node ids stably; do not print dates or elapsed time.
4. The command must not exit non-zero on "nodes flagged" — flagged nodes are informational, not an error. Only reserve non-zero for a genuine internal failure if the core ever surfaces one (it shouldn't, since it fails open).
5. Test philosophy — write a few tests, mostly integration. Drive `runFreshness` (or a rendering helper) against a stubbed/real `FreshnessReport` and assert the printed lines. Do not re-test the core's git logic here.
</details>
