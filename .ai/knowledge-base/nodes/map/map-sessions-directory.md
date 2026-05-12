---
schema_version: 1
id: map-sessions-directory
title: "_sessions/: captured session logs (gitignored by default)"
kind: map
tags: [storage, capture, sessions, gitignore]
derived_from:
  - docs/internals/architecture.md
  - docs/internals/schemas.md
  - PRD.md
relates_to: [map-claude-hooks, map-nodes-directory]
depends_on: []
confidence: high
summary: "Per-session redacted transcript slices live at .ai/knowledge-base/_sessions/<YYYYMMDD-HHmm-id>.md. Gitignored by default; commit only if reviewers need provenance."
---

# `_sessions/`: captured session logs

Per-session redacted transcript slices live at `.ai/knowledge-base/_sessions/<YYYYMMDD-HHmm-id>.md`. Each file carries frontmatter validated by `SessionLogFrontmatterSchema`: `session_id`, `captured_by` (stop/session_end/pre_compact/manual), `captured_at`, `transcript_hash`, `proposal_status` (pending/done/failed/skipped), `secret_scan_status`, `topics`, `proposals.{practice,map}`, and curator-set fields once processed.

Supporting state:

- `_sessions/.queue.json`: transcript-to-proposal handoff.
- `_sessions/.dedup-cache.json`: 5-minute SHA-256 window to drop overlapping Stop/SessionEnd/PreCompact triggers.

`_sessions/` is **gitignored by default**. `derived_from` references on nodes resolve for the original contributor; if reviewers other than the original contributor need provenance, remove `_sessions/` from `.gitignore` and commit the logs (cost: more repo bloat, full audit trail).
