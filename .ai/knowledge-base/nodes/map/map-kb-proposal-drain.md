---
schema_version: 1
id: map-kb-proposal-drain
title: 'kb-proposal-drain: async worker that runs the extraction step'
kind: map
tags:
  - worker
  - proposal
  - kb-pipeline
derived_from:
  - 20260512-1438-e5b4618a5295.md
  - 20260512-1527-aa21a0a11614.md
relates_to:
  - map-claude-hooks
depends_on: []
confidence: high
summary: >-
  SessionStart async hook that sweeps pending session logs and spawns a Claude
  SDK subprocess to extract structured proposals from each.
---
`kb-proposal-drain` (built from `src/lib/proposal-drain.ts`) sweeps `_sessions/*.md` for frontmatter where `proposal_status` is `pending`. For each pending log, it spawns a Claude Code SDK subprocess running the extraction prompt against the session log's transcript slice, parses the JSON result with `ProposalOutputSchema` (`proposal-drain.ts:175`), and writes `proposals.practice` and `proposals.map` arrays into the session log's frontmatter. It then replaces the body placeholder with a completion marker (`proposal-drain.ts:294`).

On failure (parse error, schema mismatch, non-zero exit), the drain writes `proposal_status: failed` with `proposal_error` and moves on; these failure modes do not heal on retry.

Each subprocess invocation produces one `_logs/proposal/<session-id>__<timestamp>Z.jsonl` stream-json audit log.
