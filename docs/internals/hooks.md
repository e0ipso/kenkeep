---
title: Hooks
parent: Internals
nav_order: 2
---

# Hooks

"Hooks" here means scripts the host harness invokes on lifecycle events like `SessionStart` and `Stop`. kenkeep consumes them; it does not expose a hook API of its own for third-party extension.

`init` registers four shared hook scripts per harness, plus a fifth **prompt-time** hook on the harnesses with a verified native prompt-submit context channel (Claude and Codex). The Claude Code wiring (`.claude/settings.json`) is the canonical reference:

| Script | Event(s) | Mode |
|---|---|---|
| `kk-capture.cjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kk-proposal-drain.cjs` | `SessionStart` | async |
| `kk-session-start.cjs` | `SessionStart` | sync, ≤1s |
| `kk-lint-tick.cjs` | `SessionEnd` | async — runs lint every `lintEveryNSessions` sessions (default 50) |
| `kk-prompt-context.cjs` | `UserPromptSubmit` | sync, ≤1s — **Claude and Codex only** |

The two `SessionStart` entries are independent: a failure in one does not block the other.

Every harness wires the scripts through its native mechanism, but the compiled script files install under the shared `.ai/kenkeep/hooks/<harness>/` tree: Codex via `.codex/hooks.json`; Cursor via `.cursor/hooks.json`; OpenCode via a plugin registered in `.opencode/opencode.json` that dispatches scripts under `.ai/kenkeep/hooks/opencode/`; Copilot via `.github/hooks/kk.json` walk-up commands (repo-level; Copilot loads it before user-level `~/.copilot/hooks/`). Event names vary (Codex/Cursor fire `Stop`/`PreCompact`; OpenCode uses `session.idle`/`session.created`; Copilot uses `sessionEnd`/`agentStop`/`sessionStart`) but the hook roles are consistent across harnesses. The prompt-time hook is the one exception: it ships only where the host exposes a native prompt-submit context channel (see [Prompt-time injection](#kk-prompt-contextcjs-prompt-time-injection)).

## Hook synchrony and the async launcher

Hooks fall into two classes, and the class decides whether a hook may run in the background:

| Hook | Class | Why |
|---|---|---|
| `kk-capture` | synchronous context-producer | Must finish writing the session slice before the host moves on; the capture is the only record of the turn. |
| `kk-session-start` | synchronous context-producer | Returns `additionalContext` the host injects into the session; the value is useless if produced after startup. |
| `kk-prompt-context` | synchronous context-producer | Returns `additionalContext` the host injects alongside the user prompt; an async hook's stdout is discarded, so it must stay synchronous. |
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
2. Validate `session_id`. Most harnesses use `assertValidSessionId` (strict UUID v4 shape). Codex accepts UUID-shaped ids, including UUIDv7-like ids, because current Codex sessions are not guaranteed to be UUID v4. On bad input, throw with a named error; the catch handler writes it to stderr.
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
| `session_id` invalid for the adapter (UUID v4 for most harnesses, UUID-shaped for Codex) | Write the error to stderr; no session log. |
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
5. Count the curation queue: session logs with `proposal_status: pending` awaiting extraction plus `proposal_status: done` logs without `curator_processed_at` awaiting curator review. If the count is at or above `curationThreshold` (default 20) and the last nudge was over an hour ago, append a one-line nudge and write `last_nudged_at`. The nudge escalates to a loud `🚨 kenkeep curation is overdue` heading when the queue is large or stale: queue count >= `2 * curationThreshold`, or queue count >= `curationThreshold` with the oldest uncurated log at least `staleDays` (default 7) old.
6. For actionable nudges only — stale index, curation backlog, and lint findings — attempt a native OS notification when `notifications.enabled` is true (the default) and the platform has a local backend. macOS uses `osascript`; Linux uses `notify-send`. If several signals fire on the same SessionStart, they are batched into one urgency-aware desktop notification. The attempt is fire-and-forget, shell-free, and best effort: missing commands, denied permissions, headless sessions, SSH, WSL, missing DBus, and notification-daemon failures are silent skips. No network backend such as `ntfy` is used.
7. Emit through the host's native channel, with no event-name translation: Claude and Codex return `hookSpecificOutput.additionalContext`; Cursor relays `additional_context` (dropped where the host doesn't consume it); OpenCode writes `.opencode/AGENTS.md`; Copilot writes the `.github/copilot-instructions.md` sentinel block. The Claude and Codex shape is:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

The staleness line, curation nudge, and lint summary are preserved across all assistant/context channels; native OS notifications are additive and never replace them. 1s hard deadline; overrun exits 0 so session startup is not blocked.

## `kk-prompt-context.cjs` (prompt-time injection)

`SessionStart` injection orients the agent before any task is known, so it can only inject the root `ENTRY.md` catalog — it cannot select task-relevant leaves. The **prompt-time** hook closes that gap: it fires *after* the user's prompt is known and injects a small, bounded set of the leaf nodes most relevant to that prompt.

Per `UserPromptSubmit`:

1. Recursion guard (`KENKEEP_BUILDER_INTERNAL=1` → exit).
2. Read the native `prompt` field. Empty or missing → exit 0 with no context.
3. Resolve the repo root from the payload `cwd`; if the project is not initialized, exit 0.
4. Call the shared deterministic retrieval core (`src/lib/prompt-retrieval.ts`): read the current on-disk leaf nodes via `readAllNodes`, score each against the prompt (lexical matches in `title`/`tags`/`summary` weighted above body, with a small graph-neighbor boost resolved through `nodes/.redirects.json`), and render a bounded **summaries-plus-links** block.
5. Emit through the host's native channel — Claude and Codex `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}`. When nothing is relevant, emit nothing.

The payload carries each match's title, id, repo-relative markdown link (`.ai/kenkeep/nodes/<relPath>`), summary, and tags — **never full leaf bodies** — plus a one-line instruction to open the linked node before relying on details and to verify named files/functions/flags against the live tree. Output is bounded by an internal node-count cap and a rendered-character budget (no `config.yaml` setting in the MVP).

**Deterministic, local, and private.** Retrieval makes no LLM call and uses no embeddings, external service, database, persistent store, or long-lived cache. The same prompt and node tree always produce the same ranking. The prompt text is never logged or persisted.

**Synchronous and fail-open.** The hook blocks prompt processing, so it runs with a 1s hard deadline and is **not** routed through the async launcher (an async hook's stdout is discarded). A missing prompt, missing/empty/malformed knowledge base, timeout, or any error yields no injected context — the user's prompt is never blocked or altered.

### Supported harnesses

| Harness | Prompt-time injection | Channel |
|---|---|---|
| Claude Code | ✅ | native `UserPromptSubmit` → `hookSpecificOutput.additionalContext` |
| Codex CLI | ✅ | native `UserPromptSubmit` → `hookSpecificOutput.additionalContext` |
| Cursor | ❌ | no verified native prompt-submit context channel in this repo |
| OpenCode | ❌ | plugin events list no documented prompt-submit model-context channel |
| GitHub Copilot CLI | ❌ | `userPromptSubmitted` output is documented as not processed |

Unsupported harnesses register no prompt-time hook and keep their existing `SessionStart` injection unchanged. Support is represented by the adapter declaring a native prompt-submit `HookSpec` (no global event-name translation); to add a harness, verify a current native prompt-context channel with docs and a smoke test, then wire its `kk-prompt-context` hook.

## Registration shape

After `init`, `.claude/settings.json` carries one block per event (scripts are compiled `.cjs` bundles):

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-capture.cjs\"" }] }
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-capture.cjs\"" }] },
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-lint-tick.cjs\"", "async": true }] }
    ],
    "PreCompact": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-capture.cjs\"" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-proposal-drain.cjs\"", "async": true }] },
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-session-start.cjs\"" }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.ai/kenkeep/hooks/claude/kk-prompt-context.cjs\"" }] }
    ]
  }
}
```

{% include callout.html variant="note" content="User-defined hooks in the same file are preserved on re-init." %}
