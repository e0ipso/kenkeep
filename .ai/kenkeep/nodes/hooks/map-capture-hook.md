---
schema_version: 2
id: map-capture-hook
title: kk-capture.mjs (capture hook)
kind: map
tags:
  - hooks
  - capture
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to:
  - map-session-log
  - practice-recursion-guard-kenkeep-builder-internal
depends_on: []
confidence: high
summary: >-
  Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline
  (OpenCode 8s). Wired per-harness.
---

# `kk-capture.mjs` (capture hook)

Synchronous hook with a hard 1-second deadline for the text-based harnesses; OpenCode raised its deadline to 8 seconds to accommodate `opencode export` latency (1.4–3.0s measured), which is safe because the OpenCode plugin spawns the capture child fire-and-forget. Per-harness event wiring:

| Harness | Capture events |
|---|---|
| Claude Code | `Stop`, `SessionEnd`, `PreCompact` |
| Codex CLI | `Stop` only |
| OpenCode | `session.idle` only |

Pipeline:

1. Read hook input from stdin.
2. Validate `session_id` via `assertValidSessionId` (strict UUID v4 shape).
3. Parse the transcript into role-tagged user/assistant text. OpenCode sources the transcript from `opencode export <sessionID>` (no `transcript_path` in payload).
4. Write `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` with frontmatter and the transcript slice. A re-fire for the same `session_id` reuses the existing file.

The only difference between triggers is the `captured_by` field. Never invokes the LLM. Missed deadline exits silently; the next trigger retries.

`captured_by` derivation: there is no shared, Claude-keyed event map in `src/lib/capture.ts`. Each adapter's `kk-capture` owns an exported `*_EVENT_TO_TRIGGER` map that translates its own native lifecycle event name into the canonical `CaptureTrigger` (`stop` | `session_end` | `pre_compact` | `manual`), then passes it on `HookInput.trigger`; `captureSession` writes that value as `captured_by`, defaulting to `stop` when no trigger is supplied. Per-adapter maps: Claude `Stop`→`stop`, `SessionEnd`→`session_end`, `PreCompact`→`pre_compact`; Cursor `stop`→`stop`, `sessionEnd`→`session_end`, `preCompact`→`pre_compact`; Codex `Stop`→`stop`; OpenCode `session.idle`→`stop`; Copilot `agentStop`→`stop`, `sessionEnd`→`session_end`.

Usage tracking: after the session log is written, each adapter surfaces the file paths the agent opened via read tool calls in its raw transcript (`src/harnesses/read-extract.ts`); reads resolving under `nodes/` are appended to the gitignored `.state/usage.jsonl` as one JSON line per read occurrence (`{ document, type, session_id, used_at }`), reconciled monotonically per `session_id` — counts are never decreased, so a post-compaction transcript cannot lower them. Best-effort and non-fatal: a usage error is written to stderr and never blocks capture. The four text-based harnesses run a text extractor on the transcript; OpenCode precomputes read paths from the `opencode export` JSON (`tool`/`read` parts → `state.input.filePath`).

Failure modes table (from `docs/internals/hooks.md`):

| Condition | Outcome |
|---|---|
| `KENKEEP_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `session_id` not a UUID v4 | Write the error to stderr; no session log. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| Hard deadline exceeded (1s text harnesses; 8s OpenCode) | Exit silently; next trigger retries. |

Secret scanning is an end-user concern (pre-commit hooks, CI). This library does not scan or redact captured transcripts.
