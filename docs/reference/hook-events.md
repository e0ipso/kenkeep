---
title: Hook events
parent: Reference
nav_order: 3
---

# Hook events

`init` registers three hook scripts.

| Script | Event(s) | Mode |
|---|---|---|
| `kb-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kb-stage2-drain.mjs` | `SessionStart` | async |
| `kb-session-start.mjs` | `SessionStart` | sync, ≤1s |

The two `SessionStart` entries are independent. Failure in one doesn't block the other.

## Recursion guard

All three exit immediately if `KB_BUILDER_INTERNAL=1` is set. The stage-2 drain, curator, and `bootstrap-incremental` set this on every `claude -p` child so spawned sessions don't trigger our own hooks recursively.

If you wrap the `claude` CLI, propagate `KB_BUILDER_INTERNAL=1` only into intentionally-internal subprocesses.

## Stage-1 (capture)

1. Read hook input from stdin.
2. Parse the transcript (`user`/`assistant` text, role-tagged).
3. SHA-256 dedup against `_sessions/.dedup-cache.json` (5-min window). `Stop`/`SessionEnd`/`PreCompact` often fire in close succession on the same content.
4. Run gitleaks; replace findings with `[REDACTED:<RuleID>]`. If gitleaks isn't on PATH or crashes, capture aborts without writing.
5. Write `_sessions/<YYYYMMDD-HHmm-id>.md` with frontmatter and the redacted slice. Append the path to `_sessions/.queue.json` atomically.

The only difference between the three triggers is the `captured_by` field (`stop`, `session_end`, `pre_compact`).

Stage 1 never invokes the LLM and has a 1s deadline. A missed deadline exits silently; the next trigger retries.

## Stage-2 (drain)

Per `SessionStart`:

1. Recursion guard.
2. Acquire the `stage2-drain` lock (PID + 30-min TTL). Stale locks are reclaimed.
3. Load the prompt (per-repo override first, bundled fallback).
4. Process up to `drainBound` entries (default 5). Rest deferred.
5. Per entry: spawn `claude -p --output-format stream-json --verbose`, stream to `_logs/stage-2/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `Stage2OutputSchema`.
6. On success: update the log's frontmatter with `stage_2_status: done`, populated `proposals.{practice,map}`, deduped `topics`.
7. On failure (parse error, schema mismatch, timeout, non-zero exit): rotate to back of queue with `attempts++`. After 3 attempts, mark `stage_2_status: skipped`.

## Consume

1. Recursion guard.
2. Load `INDEX.md`. If missing, emit "_The knowledge base is empty._".
3. Compare frontmatter `nodes_hash` against the live hash of `nodes/`. On drift, append `> KB index is stale — run \`ai-knowledge-base index rebuild\``.
4. Count pending logs. If above `curationThreshold` AND last nudge was over an hour ago, append a nudge and write `last_nudged_at`.
5. Emit:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

1s hard deadline. Overrun exits 0 so startup isn't blocked.

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

## Capture failure table

| Condition | Outcome |
|---|---|
| `KB_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| Dedup hit (recent) | Skip as duplicate. |
| Gitleaks missing or crashes | Log to stderr, no session log written. |
| 1s deadline exceeded | Exit silently; next trigger retries. |
