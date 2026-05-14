---
schema_version: 1
id: map-session-log
title: "Session log (_sessions/*.md)"
kind: map
tags: [sessions, capture, schema]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/schemas.md
relates_to: []
confidence: high
summary: "Per-session redacted transcript checkpoint with proposal state, validated by SessionLogFrontmatterSchema."
---

# Session log (`_sessions/*.md`)

Each Claude Code session produces at most one log under `.ai/knowledge-base/_sessions/`. Filename is `YYYYMMDD-HHmm-<sessionId>.md`; a re-fire for the same `session_id` (multi-turn sessions, PreCompact after Stop) reuses the existing file via `findSessionLogBySessionId`, so the count stays at one per session.

Frontmatter (validated by `SessionLogFrontmatterSchema`):

```yaml
schema_version: 2
session_id: <claude-code-session-id>
captured_by: stop | session_end | pre_compact | manual
captured_at: <ISO>
transcript_hash: sha256:<hex>
proposal_status: pending | done | failed | skipped
proposal_completed_at: <ISO> | null
proposal_error: <string> | null
proposal_log: _logs/proposal/<id>__<ts>.jsonl | null
secret_scan_status: clean | redacted | blocked | skipped
topics: [...]
proposals:
  practice: [<ProposalCandidate>, ...]
  map: [<ProposalCandidate>, ...]
curator_processed_at: <ISO>
curator_run_id: <UUID>
```

The body is the redacted transcript slice. Logs are gitignored by default; provenance via `derived_from` only works for the original contributor unless the team commits `_sessions/` (more bloat, full audit trail; documented trade-off).
