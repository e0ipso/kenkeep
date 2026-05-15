---
id: 11
group: "codex-adapter"
dependencies: [8, 9]
status: "completed"
created: 2026-05-15
skills:
  - typescript
---

# Codex hook scripts: kb-capture, kb-session-start, kb-proposal-drain, kb-lint-tick

## Objective

Write the four Codex hook scripts under `src/harnesses/codex/hooks/`. They mirror the Claude versions structurally but use Codex-native stdin/stdout shapes and the rollout-JSONL transcript parser. The build pipeline (Task 6) compiles them into `templates/codex/hooks/*.mjs`.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/codex/hooks/kb-capture.ts`: reads stdin JSON, validates `session_id` is a UUID, globs `${CODEX_HOME ?? ~/.codex}/sessions/YYYY/MM/DD/rollout-*-<session_id>.jsonl` for today's UTC date then yesterday's, parses with `parseCodexTranscript` (Task 9), runs the shared secret scan, writes a session log under `_sessions/` with `captured_by: stop`, `transcript_hash`, `secret_scan_status`
- [ ] Fallback glob: if `rollout-*-<session_id>.jsonl` returns zero results, glob `rollout-*.jsonl` and filter by reading the first line's `session_meta.payload.id`
- [ ] `src/harnesses/codex/hooks/kb-session-start.ts`: reads INDEX.md (token-budgeted via the existing helper), emits stdout JSON in Codex's documented additionalContext shape: `{ "additionalContext": "<INDEX.md content>" }`
- [ ] `src/harnesses/codex/hooks/kb-proposal-drain.ts`: identical conceptual flow to the Claude version (run a curator pass on pending session logs); reuses the shared `proposalDrain()` helper but resolves the adapter via `--harness codex` (or env var KB_HARNESS, if introduced) so it invokes the Codex headless runner
- [ ] `src/harnesses/codex/hooks/kb-lint-tick.ts`: runs the lint cycle on Stop instead of SessionEnd; uses the shared `lint-state.ts` cadence helper to avoid running every turn
- [ ] All four scripts honor `KB_BUILDER_INTERNAL=1` (early-exit if set, to prevent recursion when the curator subprocess fires its own hooks)
- [ ] All four scripts exit 0 on all non-fatal errors (capture must never block a Codex Stop event)
- [ ] Vitest unit test for the capture script that creates a temp `$CODEX_HOME/sessions/` tree, feeds the script a synthetic stdin payload, and asserts a session log is written with the expected frontmatter

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `glob` or `globby` for filesystem lookup
- Shared modules: `src/lib/secret-scan.ts`, `src/lib/session-log.ts`, `src/lib/proposal-drain.ts`, `src/lib/lint-state.ts`, `src/lib/index-gen.ts`
- Cwd inside the hook is the project root (set by Codex; same convention as Claude)

## Input Dependencies

- Task 8 (hooks-config writer — needed so the scripts have the right entry-point paths to live at)
- Task 9 (transcript parser — used by kb-capture)

## Output Artifacts

- Four hook scripts under `src/harnesses/codex/hooks/`
- One Vitest unit test for kb-capture

## Implementation Notes

<details>
<summary>Guidance</summary>

- Codex hook stdin payload schema (per official docs): JSON with at least `session_id` (UUID), `event` (the lifecycle event name), `cwd`. Validate with Zod at the top of every script.
- `kb-capture` glob recipe:
  ```ts
  const homeRoot = process.env.CODEX_HOME ?? join(os.homedir(), '.codex');
  const today = new Date(); // use UTC components
  const ymdPath = `${today.getUTCFullYear()}/${String(today.getUTCMonth()+1).padStart(2,'0')}/${String(today.getUTCDate()).padStart(2,'0')}`;
  let matches = await globby(`${homeRoot}/sessions/${ymdPath}/rollout-*-${session_id}.jsonl`);
  if (!matches.length) {
    // fall back to yesterday
    const y = new Date(today.getTime() - 86400000);
    const yPath = `${y.getUTCFullYear()}/${String(y.getUTCMonth()+1).padStart(2,'0')}/${String(y.getUTCDate()).padStart(2,'0')}`;
    matches = await globby(`${homeRoot}/sessions/${yPath}/rollout-*-${session_id}.jsonl`);
  }
  if (!matches.length) {
    // final fallback: scan today's directory and filter by session_meta.payload.id
    ...
  }
  ```
- `kb-session-start` Codex stdout shape: `process.stdout.write(JSON.stringify({ additionalContext: indexMd }))`. No streaming.
- `kb-proposal-drain` is the `async: true` hook (per Codex docs, async hooks run without blocking the agent). It needs to invoke the same proposal-drain pipeline as Claude; pass `harness: 'codex'` to whatever entry point the shared module exposes.
- `kb-lint-tick` on Stop must use `lint-state.ts` cadence (e.g. one-in-N) since Stop fires every turn; SessionEnd fired only once per session for Claude.
- All scripts: `if (process.env.KB_BUILDER_INTERNAL === '1') process.exit(0);` at the very top.
- Per `feedback_no_backwards_compat`: do not implement legacy/alternate rollout file path conventions. Stick to the documented `YYYY/MM/DD/rollout-*-<session_id>.jsonl` plus the documented fallback heuristic.
- Per `feedback_hide_cosmetic_shell_errors`: any "session log not found" / "rollout not yet flushed" scenario should log a warn and exit 0, not raise to stderr in a way the user sees.

</details>
