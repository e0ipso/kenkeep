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
summary: "Per-session redacted transcript slices live at .ai/knowledge-base/_sessions/YYYYMMDD-HHmm-<sessionId>.md. Gitignored by default; commit only if reviewers need provenance."
---

# `_sessions/`: captured session logs

Per-session redacted transcript slices live at `.ai/knowledge-base/_sessions/YYYYMMDD-HHmm-<sessionId>.md`, where `<sessionId>` is the Claude Code session UUID. Each file carries frontmatter validated by `SessionLogFrontmatterSchema`: `session_id`, `captured_by` (stop/session_end/pre_compact/manual), `captured_at`, `transcript_hash`, `proposal_status` (pending/done/failed), `secret_scan_status`, `proposals.{practice,map}`, and curator-set fields once processed.

The proposal drain reads this directory directly: it sweeps `*.md`, filters frontmatter to `proposal_status: pending`, and writes outcomes back into the same frontmatter. There is no separate queue file.

`_sessions/` is **gitignored by default**. `derived_from` references on nodes resolve for the original contributor; if reviewers other than the original contributor need provenance, remove `_sessions/` from `.gitignore` and commit the logs (cost: more repo bloat, full audit trail).
