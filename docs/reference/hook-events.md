---
title: Hook events
parent: Reference
nav_order: 3
---

# Hook events

`init` registers three hook scripts:

- `.claude/hooks/kb-capture.mjs` — runs on `Stop`, `SessionEnd`, and `PreCompact`. Implements **stage-1 capture**: dedup, secret-scan with redaction, write a session log, append to `.queue.json`.
- `.claude/hooks/kb-stage2-drain.mjs` — runs on `SessionStart` with `async: true`. Drains the stage-2 queue by spawning `claude -p` for each pending session log; updates the log's frontmatter with the structured extraction output.
- `.claude/hooks/kb-session-start.mjs` — runs on `SessionStart` synchronously. **Consume** step: injects `INDEX.md` as `additionalContext` for the session, appends a stale-INDEX warning when `nodes_hash` has drifted, and emits a one-line nudge when the curate backlog crosses the threshold (hourly throttle).

## Registered events

| Event | Why we capture | Behavior |
|---|---|---|
| `Stop` | Captures after every assistant turn ends. The transcript hash changes turn-by-turn, so this produces one log per substantive checkpoint within a session. | Synchronous, ≤1 s deadline. Dedup window prevents overlap with the other two events. |
| `SessionEnd` | Captures when the user explicitly closes or clears the session. The strongest signal that the session is done. | Same pipeline as `Stop`. |
| `PreCompact` | Fires immediately before Claude Code compacts context. Without this, content about to be discarded would be lost. | Same pipeline as `Stop`. The 1-second deadline still applies; if you have a very long transcript and capture would exceed it, the hook exits silently rather than blocking compaction. |
| `SessionStart` (drain, async) | Runs the **stage-2 drain** (M2). For each entry in `.queue.json`, spawns `claude -p --output-format stream-json --verbose` against the redacted transcript slice and writes the structured extraction back into the session log's frontmatter. | `async: true` — stdout does not flow into the parent session. Stops after `drainBound` entries (default 5), the rest are deferred to the next session. |
| `SessionStart` (consume, sync) | Runs the **consume** step (M4). Loads `INDEX.md`, emits it as `hookSpecificOutput.additionalContext` so the assistant sees the current KB summary at the start of every session. Appends a stale-INDEX warning when `nodes_hash` drift is detected. Appends a curate nudge when the pending-session backlog ≥ 5 (default) AND it has been ≥ 1 hour since the last nudge (`last_nudged_at` lives in `state.json`). | Synchronous, ≤1 s deadline. stdout is JSON; non-fatal errors go to stderr. |

The three stage-1 events route through the same `kb-capture.mjs` script, so the only difference in the resulting session log is the `captured_by` frontmatter field (`stop`, `session_end`, or `pre_compact`). `SessionStart` runs two scripts: `kb-stage2-drain.mjs` (async drain) and `kb-session-start.mjs` (sync consume injection). They are independent — failure in one does not block the other.

## Recursion guard

All three hooks check `KB_BUILDER_INTERNAL=1` in their environment and exit immediately if set. The stage-2 drain (M2), the curator (M3), and `bootstrap-incremental` (M3.5) all spawn `claude -p` subprocesses with this env var so that the child Claude Code instance doesn't fire its own capture, drain, or consume hooks and trigger recursive work.

If you wrap the `claude` CLI in a script that spawns sessions for any reason, set `KB_BUILDER_INTERNAL=1` in those subprocesses.

## What stage 1 does

1. **Read hook input.** Claude Code passes a JSON payload on stdin (session id, transcript path, cwd, event name).
2. **Parse the transcript.** The transcript file at `transcript_path` is a JSONL of conversation messages. We pull only `user` and `assistant` text content and render it as a role-tagged slice (`[USER]: …` / `[AGENT]: …`).
3. **SHA-256 dedup.** The hash of the slice is checked against `_sessions/.dedup-cache.json`. If a matching hash exists and is less than 5 minutes old, capture exits silently — Stop/SessionEnd/PreCompact often fire in close succession over the same content.
4. **Gitleaks scan + redact.** The slice is written to a temp file and passed to `gitleaks detect --no-git`. Findings are replaced with `[REDACTED:<RuleID>]` placeholders. If gitleaks isn't installed, hangs, or crashes, capture **aborts without writing a session log** — the security guarantee outweighs availability.
5. **Write the session log.** `_sessions/<YYYYMMDD-HHmm-id>.md` with frontmatter (`schema_version: 1`, `stage_2_status: pending`, `gitleaks_status`, etc.) followed by the redacted slice under a `## Stage 1: redacted transcript slice` section. A `## Stage 2: structured summary` section is left empty for the M2 worker.
6. **Append to the queue.** `_sessions/.queue.json` gets an entry pointing at the new log. Written atomically (temp file + rename).

## What stage 1 does NOT do

- Run the LLM. Stage 2 (M2) reads the queue asynchronously on the next `SessionStart` and spawns `claude -p` to produce structured proposals.
- Block on long operations. The hook has a hard 1-second deadline. If anything (gitleaks, disk I/O) goes long, the hook exits silently and the content for that trigger is lost. Subsequent triggers (the next Stop, SessionEnd, PreCompact) will re-attempt.

## Stage 2 (drain on SessionStart)

The drain hook is async, so the user does not wait on it. Per invocation:

1. **Recursion guard.** Exits immediately if `KB_BUILDER_INTERNAL=1` is set (the env var the drain itself sets on the children it spawns).
2. **Lock.** Acquires the stage-2 lock in `.ai/knowledge-base/.state/state.json` (PID + 30-minute TTL). If another drain is already running, this invocation exits without doing anything. Stale locks are reclaimed after TTL.
3. **Load the prompt.** Prefers the per-repo override at `.ai/knowledge-base/.state/prompts/stage-2-extract.md` (written by `init`); falls back to the version bundled with the package.
4. **Iterate the queue.** Up to `drainBound` (default 5) entries per invocation. The rest are deferred to subsequent sessions.
5. **Per entry:** loads the session log, extracts the redacted transcript slice, substitutes it into the prompt, spawns `claude -p --allowedTools '' --output-format stream-json --verbose`, and writes the full stream into `.ai/knowledge-base/_logs/stage-2/<session-id>__<timestamp>.jsonl`.
6. **Parse the final result message.** Validated against the stage-2 Zod schema. On success: the session log's frontmatter is updated with `stage_2_status: done`, the log path, the populated `proposals.{practice,map}` arrays, and a deduped `topics` list.
7. **Failure handling.** Parse error, schema mismatch, non-zero exit, or timeout (`stage2Timeout`, default 60 s) all count as one failed attempt. The entry rotates to the back of the queue with `attempts` incremented. After 3 attempts, the session log is marked `stage_2_status: skipped` and the entry is removed.

## Failure modes

| Condition | Outcome |
|---|---|
| `KB_BUILDER_INTERNAL=1` | Hook exits immediately. No capture. |
| Empty / malformed stdin | Hook exits silently. No capture. |
| `transcript_path` missing or absent | Hook exits silently. No capture. |
| Transcript has no user or assistant text | Hook exits silently. No capture. |
| Hash matches a recent entry in `_sessions/.dedup-cache.json` | Skipped as duplicate. No capture. |
| Gitleaks not on PATH or crashes | A `[ai-knowledge-base] gitleaks blocked stage-1 capture: …` line goes to stderr. **No session log is written.** Install gitleaks and the next trigger will succeed. |
| 1-second deadline exceeded | Hook exits silently. The content is lost for this trigger; the next Stop/SessionEnd/PreCompact retries. |

## Inspecting the registration

After `init`, `.claude/settings.json` contains a block per event:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "KB_BUILDER_HOOK=Stop node .claude/hooks/kb-capture.mjs"
          }
        ]
      }
    ]
  }
}
```

The same pattern repeats for `SessionEnd` and `PreCompact`. `SessionStart` carries two entries — the drain (async, so it does not block startup) and the consume injection (sync, since its output must reach the assistant before the first turn):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-stage2-drain.mjs",
            "async": true
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-session-start.mjs"
          }
        ]
      }
    ]
  }
}
```

Existing user-defined hooks in the same file are preserved on re-init.

## Consume hook (`SessionStart`, sync)

The consume hook is the M4 read path. Per invocation:

1. **Recursion guard.** Exits immediately if `KB_BUILDER_INTERNAL=1` is set.
2. **Resolve `INDEX.md`.** If missing, emits an "_The knowledge base is empty._" stub so the assistant still sees a coherent context. If present, parses the frontmatter and strips it before injection.
3. **Stale detection.** Compares the frontmatter `nodes_hash` against `computeNodesHash(nodes/)`. On mismatch, appends `> KB index is stale — run \`ai-knowledge-base index rebuild\` to refresh.`
4. **Nudge throttle.** Counts session logs with `stage_2_status: done` and no `curator_processed_at`. If the count ≥ threshold (default 5) AND `now - state.last_nudged_at ≥ 1 hour`, appends `> You have N pending session log(s). Run \`/kb-curate\` (or \`ai-knowledge-base curate\`) when ready.` and writes the new `last_nudged_at` back to `state.json`.
5. **Emit.** Writes a single JSON line to stdout matching Claude Code's SessionStart contract:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<INDEX body + optional warnings>"}}
   ```

The hook has a 1-second hard deadline (same as stage-1 capture). If it overruns, the timer exits process 0 so session startup is never blocked.
