---
title: Hooks
parent: Internals
nav_order: 2
---

# Hooks

"Hooks" here means scripts the host harness invokes on lifecycle events like `SessionStart` and `Stop`. kenkeep consumes them; it does not expose a hook API of its own for third-party extension.

`init` registers four hook scripts per harness. The Claude Code wiring (`.claude/settings.json`) is the canonical reference:

| Script | Event(s) | Mode |
|---|---|---|
| `kk-capture.cjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kk-proposal-drain.cjs` | `SessionStart` | async |
| `kk-session-start.cjs` | `SessionStart` | sync, ≤1s |
| `kk-lint-tick.cjs` | `SessionEnd` | async — runs lint every `lintEveryNSessions` sessions (default 50) |

The two `SessionStart` entries are independent: a failure in one does not block the other.

Every harness wires the same four scripts through its native mechanism: Codex via `.codex/hooks.json`; Cursor via `.cursor/hooks.json`; OpenCode via a plugin registered in `.opencode/opencode.json` that dispatches scripts under `.opencode/kk-hooks/`; Copilot via `.github/hooks/kk.json` walk-up commands (repo-level; Copilot loads it before user-level `~/.copilot/hooks/`). Event names vary (Codex/Cursor fire `Stop`/`PreCompact`; OpenCode uses `session.idle`/`session.created`; Copilot uses `sessionEnd`/`agentStop`/`sessionStart`) but the four scripts are identical across all five harnesses.

## Hook synchrony and the async launcher

Hooks fall into two classes, and the class decides whether a hook may run in the background:

| Hook | Class | Why |
|---|---|---|
| `kk-capture` | synchronous context-producer | Must finish writing the session slice before the host moves on; the capture is the only record of the turn. |
| `kk-session-start` | synchronous context-producer | Returns `additionalContext` the host injects into the session; the value is useless if produced after startup. |
| `kk-proposal-drain` | asynchronous advisory worker | Spawns headless LLM runs per pending log; long-running and produces nothing the session consumes. |
| `kk-lint-tick` | asynchronous advisory worker | Runs the tree lint every Nth fire; advisory, surfaced on a later `SessionStart`. |

**Context-producing hooks must stay synchronous and must never be routed through the launcher** — they exist to hand data back to the host. Only the advisory workers run in the background.

How "the background" is achieved depends on what the host supports:

| Harness | Async mechanism |
|---|---|
| Claude | native `async: true` in `.claude/settings.json` |
| OpenCode | plugin async dispatch (the `.opencode/plugins/kk.mjs` shim) |
| Codex | async launcher (`src/lib/async-launcher.ts`) |
| Cursor | async launcher |
| Copilot | async launcher |

Codex, Cursor, and Copilot have no native async hook support — their config writers even drop the spec's `async` flag (Codex writes a 30s `timeout` instead). On those three, non-blocking behavior is guaranteed by the **runtime launcher, not a host flag**. A hook opts in with `runHookEntry({ asyncLauncher: true })`; the launcher then re-spawns the current hook script as a detached, `unref`'d child in its own process group and the parent exits, freeing the host's hook slot. The first invocation does a hard-bounded stdin capture (≤250ms) to carry the payload to the child, then launches and exits *before* any host-dependent or unbounded operation — so a host that holds stdin open without EOF, or enforces a hook timeout, can no longer block or kill the hook before it detaches. (This closed a real defect: the Codex `SessionStart` drain previously awaited an unbounded stdin read before detaching and was killed at Codex's 30s timeout.)

**Launcher guarantees:**

- Frees the host's hook slot immediately (the parent returns before running the work).
- Survives a host hook-timeout kill: the worker is in its own process group, beyond the reach of a kill aimed at the parent.
- One named entry point (`asyncLauncher: true`) for every long-running advisory hook.

**Launcher non-guarantees:**

- No user-visible output — the worker's stdout/stderr go nowhere the session shows.
- No retry — a failed worker is not re-run (drain failures are intentionally not rotated).
- No ordering or delivery guarantee beyond what the drain's state lock provides.

**Worker diagnostics.** A detached worker is invisible to the host, so it leaves two trails under `.ai/kenkeep/_logs/`:

- `hook-errors-YYYY-MM-DD.log` — one NDJSON line per swallowed hook failure (`{ ts, hook, phase, error }`), written best-effort so a failed diagnostic never surfaces.
- `proposal/<sessionId>__<ts>.jsonl` — the drain's per-log stream-JSON trace from the headless run.

**Stale-lock interaction.** The drain holds a `proper-lockfile` lock on `state.json` with a 60s stale threshold and an mtime heartbeat while held. If the host kills a detached worker mid-run, the lock it leaves behind is reclaimed by the next drain on acquire (within ~60s) rather than blocking for the old long window — so a killed launcher child degrades to "the next session's drain picks it up," never a wedged queue.

## Recursion guard

All four hooks exit immediately if `KENKEEP_BUILDER_INTERNAL=1` is set. Two surfaces set this var on the harness child they exec:

- The `proposal-drain` hook, when it spawns its headless extractor.
- The CLI launchers (`bootstrap`, `curate`, `node add`), which exec `<harness> -p "/kk-<name>"`.

Without the guard, the spawned session would fire its own `SessionStart` hooks and recurse.

{% include callout.html variant="warning" content="If you wrap a harness CLI, propagate `KENKEEP_BUILDER_INTERNAL=1` only into intentionally-internal subprocesses. Leaking it elsewhere silently disables capture and injection." %}

## `kk-capture.mjs` (capture)

1. Read hook input from stdin.
2. Validate `session_id` via `assertValidSessionId` (strict UUID v4 shape). On bad input, throw with a named error; the catch handler writes it to stderr.
3. Parse the transcript (`user`/`assistant` text, role-tagged).
4. Write `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` with frontmatter and the transcript slice. A re-fire for the same `session_id` (multi-turn sessions, `PreCompact` after `Stop`) reuses the existing file via `findSessionLogBySessionId`, so the count stays at one log per session.

The only difference between the three triggers is the `captured_by` field (`stop`, `session_end`, `pre_compact`).

Never invokes the LLM. 1s deadline: a miss exits silently and the next trigger retries.

{% capture capture_warning %}
kenkeep does **not** scan or redact the transcript. Secrets present in the session are written verbatim to `_sessions/`. Secret hygiene is the consumer's responsibility (see [Installation → commit-time hardening](../installation.md#optional-commit-time-hardening)).
{% endcapture %}
{% include callout.html variant="warning" content=capture_warning %}

### Capture failure modes

| Condition | Outcome |
|---|---|
| `KENKEEP_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `session_id` not a UUID v4 | Write the error to stderr; no session log. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| 1s deadline exceeded | Exit silently; next trigger retries. |

## `kk-proposal-drain.mjs` (extraction)

Per `SessionStart`:

1. Recursion guard.
2. Acquire the `proposal-drain` lock on `state.json` via `proper-lockfile` (a mkdir-atomic `state.json.lock` directory whose mtime is refreshed on a heartbeat while held; 60s stale threshold). A drain killed mid-run by the host's outer timeout leaves a stale lock that the next drain auto-reclaims on acquire.
3. Load the prompt (local override first, bundled fallback).
4. Sweep `_sessions/*.md` for frontmatter with `proposal_status: pending`.
5. Per pending log: spawn the active harness's headless driver in streaming-JSON mode, stream to `_logs/proposal/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `ProposalOutputSchema`.
6. On success: set `proposal_status: done`, populated `proposals.{practice,map}`, deduped `topics`.
7. On failure: set `proposal_status: failed` with `proposal_error`.

{% include callout.html variant="note" content="Drain failures (timeout, schema mismatch, bad JSON) do not heal on retry, so the drain does not rotate them." %}

## `kk-session-start.mjs` (consume)

1. Recursion guard.
2. Load **only** the entry catalog (`ENTRY.md`, the top-level branch catalog). If missing, emit `_The knowledge base is empty._`. The injected body is bounded and does not grow with node count; deep leaves surface only as branch rollup counts.
3. Append the descent navigation directive (pick relevant branches by intent and tags, read their index nodes, descend as needed, open only confirmed-relevant leaves, follow cross edges). It comes from the single `KK_NAVIGATION_DIRECTIVE` constant that the `kenkeep:kk-index` block in `AGENTS.md` reuses verbatim, so the two surfaces never drift.
4. Compare the root index node's `nodes_hash` (the global hash over the whole leaf set) against the live hash of `nodes/`. On drift, append `> kenkeep index is stale, run \`npx kenkeep index rebuild\``.
5. Count pending logs. If the count is at or above `curationThreshold` (default 20) and the last nudge was over an hour ago, append a one-line nudge and write `last_nudged_at`. The nudge escalates to a loud `🚨 kenkeep curation queue is overdue` heading when the queue is large or stale: `pending >= 10`, or `pending >= curationThreshold` with the oldest log at least `staleDays` (default 7) old.
6. Emit through the host's native channel, with no event-name translation: Claude and Codex return `additionalContext`; Cursor relays `additional_context` (dropped where the host doesn't consume it); OpenCode writes `.opencode/AGENTS.md`; Copilot writes the `.github/copilot-instructions.md` sentinel block. The Claude shape is:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

The staleness line, curation nudge, and lint summary are preserved across all channels. 1s hard deadline; overrun exits 0 so session startup is not blocked.

## Registration shape

After `init`, `.claude/settings.json` carries one block per event (scripts are compiled `.cjs` bundles):

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-capture.cjs" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-capture.cjs" }] },
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-lint-tick.cjs", "async": true }] }
    ],
    "PreCompact": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-capture.cjs" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-proposal-drain.cjs", "async": true }] },
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-session-start.cjs" }] }
    ]
  }
}
```

{% include callout.html variant="note" content="User-defined hooks in the same file are preserved on re-init." %}
