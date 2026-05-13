---
id: 5
group: "verification"
dependencies: [1, 2, 3, 4]
status: "pending"
created: 2026-05-13
skills:
  - bash
  - typescript
---
# Final verification sweep and CHANGELOG entry

## Objective
Run every static sweep, type check, test, and CLI smoke from the plan's Self Validation section. Add a CHANGELOG entry recording the visible behaviour changes (commander throws on bad numeric input; `node add --preset` flag removed).

## Skills Required
- `bash`: run rg/grep, npm scripts, and ad-hoc CLI smoke commands.
- `typescript`: triage any leftover compile/test issue uncovered by the verification sweep.

## Acceptance Criteria
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` exits 0.
- [ ] `rg -n 'Test seam' src/` returns zero hits.
- [ ] `rg -n 'preset\?:' src/commands/node-add.ts` returns zero hits.
- [ ] `rg -n '\bspawn\?:' src/lib/headless.ts` returns zero hits.
- [ ] `rg -n '\bnow\?:' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts` returns zero hits.
- [ ] `rg -n '\bpid\?:' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts` returns zero hits.
- [ ] `rg -n 'Number\.isNaN' src/cli.ts` returns zero hits.
- [ ] `rg -n 'kbDir|nodesDir|logsDir|sessionsDir|stateFile' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts` shows only `ctx.paths.X` reads or locally-derived `stateFile = join(ctx.paths.stateDir, ...)` lines; no interface field declarations.
- [ ] CLI smoke in a scratch dir (record exit codes and stderr snippets in the verification notes):
  - `ai-knowledge-base init --assistants claude` exits 0.
  - `ai-knowledge-base curate --batch-size 5` exits 0 (or returns no-pending result, depending on session state).
  - `ai-knowledge-base curate --batch-size foo` exits non-zero with a message mentioning `--batch-size` and integer.
  - `ai-knowledge-base curate --timeout abc` exits non-zero with a similar message.
  - `ai-knowledge-base node add --help` does NOT list a `--preset` flag.
- [ ] `CHANGELOG.md` has a new entry under the Unreleased / current development section noting: (a) commander now throws `InvalidArgumentError` on non-integer numeric CLI input (previously silently coerced via `NaN`); (b) `node add --preset` flag removed (undocumented test seam); (c) production context interfaces shrunk (path fields consolidated behind `paths: RepoPaths`; `spawn`, `now`, `pid` test-seam fields removed).
- [ ] No `it.skip` or `describe.skip` introduced by this plan.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The CHANGELOG follows the format already in the file; do not invent a new structure.
- Wording in the CHANGELOG should be user-facing (what a CLI user notices), not implementation detail.

## Input Dependencies
- Tasks 1, 2, 3, 4 — all source-level work must be complete.

## Output Artifacts
- Updated `CHANGELOG.md`.
- Verification notes captured in the session output (each sweep / command / exit code recorded).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Run each sweep in Acceptance Criteria; record exit code and any unexpected matches. Fix root causes before continuing — do not paper over.
2. `npm run lint && npm run typecheck && npm run build && npm test`. If anything fails, return to the relevant prior task and fix.
3. For CLI smoke: build, then run each command. Capture stderr for the failing-input cases to confirm the commander-formatted message naming the flag and the word "integer".
4. Write the CHANGELOG entry. Use the existing section headings (`### Changed`, `### Removed`, etc.). Three bullets, terse, user-facing.
5. Re-run the full test suite one more time after the CHANGELOG edit. Done.

</details>
