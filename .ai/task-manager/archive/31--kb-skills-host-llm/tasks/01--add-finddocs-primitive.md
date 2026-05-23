---
id: 1
group: "cli-primitives"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - typescript
  - bash
---
# Add `finddocs` CLI primitive

## Objective
Add a new top-level `ai-kb finddocs --from <scope>` command that performs the deterministic doc-discovery pass (with `.gitignore`, `.kbignore`, and `STATIC_SKIPS` semantics) used today by `bootstrap-incremental --dry-run`, and emits each candidate file with an optional SHA-256 hash so skills can decide what to (re)process.

## Skills Required
- `typescript` — implement the new `commander` subcommand and reuse existing discovery library code.
- `bash` — exercise the CLI from tests / fixtures.

## Acceptance Criteria
- [ ] New file `src/commands/finddocs.ts` registered against the CLI root in `src/cli.ts` (or wherever `commander` is wired today).
- [ ] `ai-kb finddocs --from <scope>` prints one `+ <relpath>` line per surviving candidate, matching the line shape used today by `bootstrap-incremental --dry-run`.
- [ ] A `--with-hashes` (or equivalent) flag adds a `\t<sha256>` suffix per line so callers can compare against `state.json`.
- [ ] `.kbignore` is explicitly mentioned in the command's `--help` output (closes the discoverability gap noted in the plan).
- [ ] Pure Node — no harness spawned, no `KB_BUILDER_INTERNAL` reads, no `claude -p`.
- [ ] Unit/integration test against a fixture directory asserting (a) ignore semantics match the legacy code path and (b) hash output is stable across runs.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse `discoverMarkdownFiles` (currently in `src/lib/bootstrap.ts`) — if it is still embedded in the runner, lift it into its own module under `src/lib/` (e.g. `src/lib/finddocs.ts`) so the primitive and any future caller share one implementation.
- Hashing: stream the file through `crypto.createHash('sha256')`; do not load entire docs into memory if avoidable.
- Follow the existing CLI conventions (commander subcommand factory, exit codes, structured stderr messages).

## Input Dependencies
None.

## Output Artifacts
- `ai-kb finddocs` CLI command used by Task 4 (skill rewrite) — the `kb-bootstrap` skill drives discovery by parsing this output.
- A reusable `discoverMarkdownFiles`-style export that Task 6 (runner deletion) can rely on once `BootstrapRunner` is removed.

## Implementation Notes
<details>
<summary>Details</summary>

- Today's source for this logic: `src/lib/bootstrap.ts` lines around 228–241 (per the plan). Inspect that block, extract the candidate-enumeration body, and call it from both the new primitive and (for now) the still-present `BootstrapRunner` so behavior is identical until Task 6 deletes the runner.
- Output format must be machine-parseable by the skill. Recommend exactly: `+ <relpath>` for filename-only mode, `+ <relpath>\t<sha256>` when `--with-hashes` is passed. No JSON wrapper — keep it shell-friendly so the skill can `Bash`-pipe and `Read` per line.
- Scope resolution (`--from`) should mirror what `bootstrap-incremental --from` does today (relative-to-cwd path resolution, validation that the directory exists).
- Exit codes: `0` on success even when zero candidates were found; nonzero only on hard errors (bad `--from`, IO failure).
- Add a test under `test/` (mirror the layout of existing CLI integration tests) using a fixture tree with a known `.kbignore`. Assert exact stdout. For hash determinism, run twice and `assertEqual`.
- Do **not** add `proper-lockfile`, sub-agent invocation, or any state mutation in this command. It is read-only.
- Update `docs/cli-reference.md` minimally with the new command signature — full documentation rewrite lives in Task 7.

</details>
