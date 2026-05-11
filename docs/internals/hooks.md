---
title: Hooks
parent: Internals
nav_order: 2
---

# Hooks

`init` registers three hook scripts in `.claude/settings.json`.

| Script | Event(s) | Mode |
|---|---|---|
| `kb-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kb-stage2-drain.mjs` | `SessionStart` | async |
| `kb-session-start.mjs` | `SessionStart` | sync, ≤1s |

The two `SessionStart` entries are independent; a failure in one doesn't block the other.

## Recursion guard

All three hooks exit immediately if `KB_BUILDER_INTERNAL=1` is set. The extractor, curator, and `bootstrap-incremental` set this on every `claude -p` child so spawned sessions don't trigger our hooks recursively. If you wrap the `claude` CLI, propagate `KB_BUILDER_INTERNAL=1` only into intentionally-internal subprocesses.

## `kb-capture.mjs` (capture)

1. Read hook input from stdin.
2. Parse the transcript (`user`/`assistant` text, role-tagged).
3. SHA-256 dedup against `_sessions/.dedup-cache.json` (5-min window).
4. Run secretlint (with the recommended preset); replace findings with `[REDACTED:<ruleId>]`. If secretlint fails to load or times out, capture aborts.
5. Write `_sessions/<YYYYMMDD-HHmm-id>.md` with frontmatter and the redacted slice. Append the path to `_sessions/.queue.json` atomically.

The only difference between the three triggers is the `captured_by` field (`stop`, `session_end`, `pre_compact`).

Never invokes the LLM. 1s deadline. A missed deadline exits silently; the next trigger retries.

### Capture failure modes

| Condition | Outcome |
|---|---|
| `KB_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| Dedup hit (recent) | Skip as duplicate. |
| Secretlint fails to load or crashes | Log to stderr, no session log written. |
| 1s deadline exceeded | Exit silently; next trigger retries. |

## `kb-stage2-drain.mjs` (extraction)

Per `SessionStart`:

1. Recursion guard.
2. Acquire the `stage2-drain` lock (PID + 30-min TTL). Stale locks reclaimed.
3. Load the prompt (local override first, bundled fallback).
4. Process up to `drainBound` entries (default 5). Rest deferred.
5. Per entry: spawn `claude -p --output-format stream-json --verbose`, stream to `_logs/stage-2/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `Stage2OutputSchema`.
6. On success: update frontmatter with `stage_2_status: done`, populated `proposals.{practice,map}`, deduped `topics`.
7. On failure: rotate to back of queue with `attempts++`. After `maxAttempts` (default 3), mark `stage_2_status: skipped`.

## `kb-session-start.mjs` (consume)

1. Recursion guard.
2. Load `INDEX.md`. If missing, emit "_The knowledge base is empty._".
3. Compare frontmatter `nodes_hash` against the live hash of `nodes/`. On drift, append `> KB index is stale — run \`ai-knowledge-base index rebuild\``.
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
      { "hooks": [{ "type": "command", "command": "KB_BUILDER_HOOK=Stop node .claude/hooks/kb-capture.mjs" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-stage2-drain.mjs", "async": true }] },
      { "hooks": [{ "type": "command", "command": "KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-session-start.mjs" }] }
    ]
  }
}
```

User-defined hooks in the same file are preserved on re-init.
