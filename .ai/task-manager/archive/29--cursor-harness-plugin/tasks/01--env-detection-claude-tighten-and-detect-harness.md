---
id: 1
group: "env-detection"
dependencies: []
status: "completed"
created: "2026-05-21"
skills:
  - typescript
---
# Tighten Claude env detection and add Cursor to detect-harness sources

## Objective

Fix the env-detection collision that misroutes Cursor sessions to the Claude adapter: require `CLAUDECODE === '1'` for Claude (drop `CLAUDE_PROJECT_DIR`-alone fallback), add the Cursor detector entry before Claude in all shared SKILL.md `ENV_DETECTORS` heredocs, and keep `npm run lint:detect-harness` green.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `detectClaudeFromEnv` in `src/harnesses/claude/index.ts` returns true only when `env.CLAUDECODE === '1'`; the `CLAUDE_PROJECT_DIR` non-empty fallback is removed
- [ ] All three shared skill templates (`src/templates-source/skills/kb-add/SKILL.md`, `kb-bootstrap/SKILL.md`, `kb-curate/SKILL.md`) update `ENV_DETECTORS`: insert `{ env: 'CURSOR_VERSION', value: '*nonempty*', harness: 'cursor' }` **before** the Claude entry; remove `{ env: 'CLAUDE_PROJECT_DIR', value: '*nonempty*', harness: 'claude' }`
- [ ] `REGISTERED` / id allowlist literals in those SKILL.md files include `'cursor'` (sorted with existing ids)
- [ ] `tests/harnesses/detect.test.ts` (or equivalent) covers: `CURSOR_VERSION` + `CLAUDE_PROJECT_DIR` without `CLAUDECODE` does **not** resolve to `claude`; `CLAUDECODE=1` still resolves to `claude`; only `CLAUDE_PROJECT_DIR` does **not** resolve to `claude`
- [ ] `npm run lint:detect-harness` passes; removing `cursor` from a heredoc causes lint failure (revert after spot-check)
- [ ] `npm run build` and `npm test` pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/claude/index.ts`
- `src/templates-source/skills/kb-{add,bootstrap,curate}/SKILL.md`
- `scripts/lint-detect-harness.mjs` (verify only; no change unless lint script needs a fourth id)
- `src/harnesses/detect.ts` tests if env walk order is asserted there

## Input Dependencies

None (plan prerequisite before Cursor adapter lands).

## Output Artifacts

- Tightened Claude `detectFromEnv`
- SKILL.md heredocs listing `cursor` detector before `claude`
- Passing detect-harness lint and collision tests

## Implementation Notes

<details>
<summary>Guidance</summary>

- This is an intentional clean break: no shim for `CLAUDE_PROJECT_DIR`-only detection. Document in a later docs task that hook subprocesses without `CLAUDECODE=1` must pass `--harness claude` explicitly.
- Cursor `detectFromEnv` implementation lives in Task 2 (`src/harnesses/cursor/index.ts`); this task only wires the **heredoc** side so `/tmp/kb-detect-harness.mjs` can resolve `cursor` once the adapter registers.
- Registry env-walk order: when Task 2 registers `cursorAdapter`, ensure it is iterated **before** `claudeAdapter` in `detectHarnessFromEnv` if order is explicit; otherwise rely on detector specificity (`CURSOR_VERSION` + `CLAUDECODE !== '1'`).
- Per constitution: no backwards-compat comments or migrators.
- Update the JSDoc on `detectClaudeFromEnv` to remove the `CLAUDE_PROJECT_DIR` rationale.

</details>
