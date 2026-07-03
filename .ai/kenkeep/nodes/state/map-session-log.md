---
type: map
title: Session log (_sessions/*.md)
description: >-
  Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id;
  frontmatter tracks capture, proposal, and curator phases.
tags:
  - session
  - capture
  - state
  - schema
kk_schema_version: 3
kk_id: map-session-log
kk_derived_from:
  - docs/internals/hooks.md
  - docs/internals/schemas.md
  - docs/internals/architecture.md
  - '4c12545c-3224-4602-8b5a-14c752d26975:map:3'
kk_relates_to:
  - map-capture-hook
  - map-proposal-drain-hook
  - map-session-log-stage-live
kk_depends_on: []
kk_confidence: high
---
# Session log (`_sessions/*.md`)

Filename: `YYYYMMDD-HHmm-<sessionId>.md`. Re-firing the capture hook for the same `session_id` overwrites in place via `findSessionLogBySessionId`, so the session-log count stays at one per session even across multi-turn sessions, PreCompact-after-Stop, etc.

Frontmatter (validated by `SessionLogFrontmatterSchema`):

```yaml
schema_version: 1
session_id: <claude-code-session-id>
captured_by: stop | session_end | pre_compact | manual
captured_at: <ISO>
transcript_hash: sha256:<hex>
proposal_status: pending | done | failed | skipped
proposal_completed_at: <ISO> | null
proposal_error: <string> | null
proposal_log: _logs/proposal/<id>__<ts>.jsonl | null
topics: [string, ...]
proposals:
  practice: [<ProposalCandidate>, ...]
  map: [<ProposalCandidate>, ...]
curator_processed_at: <ISO>
curator_run_id: <UUID>
```

`captured_by` records which lifecycle trigger produced the log, as one of the canonical `CaptureTrigger` values (`stop` | `session_end` | `pre_compact` | `manual`). It is derived per-adapter, not from a shared Claude-keyed event map: each harness's `kk-capture` maps its own native event name to the canonical trigger and passes it on `HookInput.trigger`, which `captureSession` writes here (defaulting to `stop`). Examples: Copilot `sessionEnd`->`session_end` and `agentStop`->`stop`; Cursor `preCompact`->`pre_compact`; Codex `Stop`->`stop`; OpenCode `session.idle`->`stop`; Claude's values are unchanged (`Stop`->`stop`, `SessionEnd`->`session_end`, `PreCompact`->`pre_compact`).

Lifecycle:

1. `kk-capture.mjs` writes the file with `proposal_status: pending` and the transcript slice.
2. `kk-proposal-drain.mjs` (next `SessionStart`, async) processes pending entries, populates `proposals.{practice,map}` and `topics`, and sets `proposal_status: done` (or `failed` with `proposal_error`).
3. `curate` reads `done` logs, applies actions to `nodes/`, sets `curator_processed_at` and `curator_run_id`.

`/kk-session-extract` uses the same session-log boundary for live extraction. Its `session-log stage-live` primitive writes a `manual` log that is already `proposal_status: done`, then `curate-dedup --session-id` stamps only that staged session.

When capture later rewrites a log for the same `session_id`, it preserves `curator_processed_at`, `curator_run_id`, and terminal proposal state for logs that have already been curated. That keeps immediate live extraction from being undone by a later lifecycle capture of the same session.

<!-- kk:related:start -->
# Related

- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
- Related: [map-session-log-stage-live](/state/map-session-log-stage-live.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/hooks.md](docs/internals/hooks.md)
[2] [docs/internals/schemas.md](docs/internals/schemas.md)
[3] [docs/internals/architecture.md](docs/internals/architecture.md)
[4] [4c12545c-3224-4602-8b5a-14c752d26975:map:3](4c12545c-3224-4602-8b5a-14c752d26975:map:3)
<!-- kk:citations:end -->
