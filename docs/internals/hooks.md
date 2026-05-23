---
title: Hooks
parent: Internals
nav_order: 2
---

# Hooks

"Hooks" here means [Claude Code's hook mechanism](https://docs.claude.com/en/docs/claude-code/hooks): scripts the assistant invokes on events like `SessionStart` and `Stop`. `ai-knowledge-base` consumes them; it does not expose a hook API of its own for third-party extension.

`init` registers three hook scripts in `.claude/settings.json`.

| Script | Event(s) | Mode |
|---|---|---|
| `kb-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kb-proposal-drain.mjs` | `SessionStart` | async |
| `kb-session-start.mjs` | `SessionStart` | sync, ≤1s |

The two `SessionStart` entries are independent; a failure in one doesn't block the other.

## Recursion guard

All three hooks exit immediately if `KB_BUILDER_INTERNAL=1` is set. Two surfaces propagate this var onto the harness child they exec: the `proposal-drain` hook (when it spawns its `claude -p` extractor) and the CLI launchers (`bootstrap`, `curate`, `node add`, which exec `<harness> -p "/kb-<name>"`). Without the guard, the spawned session would fire its own SessionStart hooks and recurse. If you wrap the `claude` CLI, propagate `KB_BUILDER_INTERNAL=1` only into intentionally-internal subprocesses.

## `kb-capture.mjs` (capture)

1. Read hook input from stdin.
2. Validate `session_id` via `assertValidSessionId` (strict UUID v4 shape). On bad input, throw with a named error message; the catch handler writes it to stderr.
3. Parse the transcript (`user`/`assistant` text, role-tagged).
4. Run secretlint (with the recommended preset); replace findings with `[REDACTED:<ruleId>]`. If secretlint fails to load or times out, capture aborts.
5. Write `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` with frontmatter and the redacted slice. A re-fire for the same `session_id` (multi-turn sessions, PreCompact after Stop) reuses the existing file via `findSessionLogBySessionId`, so the session-log count stays at one per session.

The only difference between the three triggers is the `captured_by` field (`stop`, `session_end`, `pre_compact`).

Never invokes the LLM. 1s deadline. A missed deadline exits silently; the next trigger retries.

### Capture failure modes

| Condition | Outcome |
|---|---|
| `KB_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `session_id` not a UUID v4 | Write the error to stderr; no session log. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| Secretlint fails to load or crashes | Log to stderr, no session log written. |
| 1s deadline exceeded | Exit silently; next trigger retries. |

## `kb-proposal-drain.mjs` (extraction)

Per `SessionStart`:

1. Recursion guard.
2. Acquire the `proposal-drain` lock (PID + 30-min TTL). Stale locks reclaimed.
3. Load the prompt (local override first, bundled fallback).
4. Sweep `_sessions/*.md` for frontmatter with `proposal_status: pending` and process each entry.
5. Per pending log: spawn `claude -p --output-format stream-json --verbose`, stream to `_logs/proposal/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `ProposalOutputSchema`.
6. On success: update frontmatter with `proposal_status: done`, populated `proposals.{practice,map}`, deduped `topics`.
7. On failure: write `proposal_status: failed` with `proposal_error`. The failure modes here (timeout, schema mismatch, bad JSON) do not heal on retry, so the drain does not rotate them.

## `kb-session-start.mjs` (consume)

1. Recursion guard.
2. Load `INDEX.md`. If missing, emit "_The knowledge base is empty._".
3. Compare frontmatter `nodes_hash` against the live hash of `nodes/`. On drift, append `> KB index is stale, run \`npx @e0ipso/ai-knowledge-base index rebuild\``.
4. Count pending logs. If above `curationThreshold` AND last nudge was over an hour ago, append a nudge and write `last_nudged_at`.
5. Emit:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

1s hard deadline. Overrun exits 0 so session startup isn't blocked.

## Registration shape

After `init`, `.claude/settings.json` carries one block per event:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kb-capture.mjs" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kb-proposal-drain.mjs", "async": true }] },
      { "hooks": [{ "type": "command", "command": "node .claude/hooks/kb-session-start.mjs" }] }
    ]
  }
}
```

User-defined hooks in the same file are preserved on re-init.
