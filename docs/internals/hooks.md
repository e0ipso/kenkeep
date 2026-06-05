---
title: Hooks
parent: Internals
nav_order: 2
---

# Hooks

"Hooks" here means [Claude Code's hook mechanism](https://docs.claude.com/en/docs/claude-code/hooks): scripts the assistant invokes on events like `SessionStart` and `Stop`. kenkeep consumes them; it does not expose a hook API of its own for third-party extension.

`init` registers three hook scripts in `.claude/settings.json`:

| Script | Event(s) | Mode |
|---|---|---|
| `kk-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kk-proposal-drain.mjs` | `SessionStart` | async |
| `kk-session-start.mjs` | `SessionStart` | sync, ≤1s |

The two `SessionStart` entries are independent: a failure in one does not block the other.

## Recursion guard

All three hooks exit immediately if `KENKEEP_BUILDER_INTERNAL=1` is set. Two surfaces set this var on the harness child they exec:

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
2. Acquire the `proposal-drain` lock (PID + 30-min TTL). Stale locks are reclaimed.
3. Load the prompt (local override first, bundled fallback).
4. Sweep `_sessions/*.md` for frontmatter with `proposal_status: pending`.
5. Per pending log: spawn the active harness's headless driver in streaming-JSON mode, stream to `_logs/proposal/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `ProposalOutputSchema`.
6. On success: set `proposal_status: done`, populated `proposals.{practice,map}`, deduped `topics`.
7. On failure: set `proposal_status: failed` with `proposal_error`.

{% include callout.html variant="note" content="Drain failures (timeout, schema mismatch, bad JSON) do not heal on retry, so the drain does not rotate them." %}

## `kk-session-start.mjs` (consume)

1. Recursion guard.
2. Load `INDEX.md`. If missing, emit `_The knowledge base is empty._`.
3. Compare frontmatter `nodes_hash` against the live hash of `nodes/`. On drift, append `> kk index is stale, run \`npx kenkeep index rebuild\``.
4. Count pending logs. If above `curationThreshold` AND the last nudge was over an hour ago, append a nudge and write `last_nudged_at`.
5. Emit:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

1s hard deadline. Overrun exits 0 so session startup is not blocked.

## Registration shape

After `init`, `.claude/settings.json` carries one block per event:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-capture.mjs" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-proposal-drain.mjs", "async": true }] },
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kk-session-start.mjs" }] }
    ]
  }
}
```

{% include callout.html variant="note" content="User-defined hooks in the same file are preserved on re-init." %}
