---
schema_version: 1
id: map-capture-hook
title: "kb-capture.mjs (capture hook)"
kind: map
tags: [hooks, capture, secretlint, redaction]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to:
  - map-session-log
  - practice-capture-runs-secretlint-with-redaction
  - practice-recursion-guard-kb-builder-internal
depends_on: []
confidence: high
summary: "Capture hook: reads transcript, redacts with secretlint, writes _sessions/<...>.md. Sync, ≤1s deadline. Wired per-harness."
---

# `kb-capture.mjs` (capture hook)

Synchronous hook with a hard 1-second deadline. Per-harness event wiring:

| Harness | Capture events |
|---|---|
| Claude Code | `Stop`, `SessionEnd`, `PreCompact` |
| Codex CLI | `Stop` only |
| OpenCode | `session.idle` only |

Pipeline:

1. Read hook input from stdin.
2. Validate `session_id` via `assertValidSessionId` (strict UUID v4 shape).
3. Parse the transcript into role-tagged user/assistant text. OpenCode reads the transcript from on-disk session storage (no `transcript_path` in payload).
4. Run secretlint with the recommended preset; replace findings with `[REDACTED:<ruleId>]`. If secretlint fails to load or times out, capture aborts.
5. Write `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` with frontmatter and the redacted slice. A re-fire for the same `session_id` reuses the existing file.

The only difference between triggers is the `captured_by` field. Never invokes the LLM. Missed deadline exits silently; the next trigger retries.

Failure modes table (from `docs/internals/hooks.md`):

| Condition | Outcome |
|---|---|
| `KB_BUILDER_INTERNAL=1` | Exit. No capture. |
| Empty / malformed stdin | Exit silently. |
| `session_id` not a UUID v4 | Write the error to stderr; no session log. |
| `transcript_path` missing | Exit silently. |
| Transcript empty | Exit silently. |
| Secretlint fails to load or crashes | Log to stderr, no session log written. |
| 1s deadline exceeded | Exit silently; next trigger retries. |
