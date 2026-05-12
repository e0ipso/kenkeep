---
schema_version: 1
id: practice-hooks-meet-1s-deadline
title: "Sync hooks must finish in under 1 second"
kind: practice
tags: [hooks, performance, claude-code, contract]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/manual-test-plan.md
relates_to: [map-claude-hooks]
depends_on: []
confidence: high
summary: "kb-capture and kb-session-start are sync hooks with a 1s wall-clock deadline. Overruns exit 0 so session startup is never blocked."
---

# Sync hooks must finish in under 1 second

`kb-capture.mjs` (Stop / SessionEnd / PreCompact) and `kb-session-start.mjs` (SessionStart) are synchronous hooks. Both have a 1-second wall-clock budget.

A missed deadline exits silently / exits 0 so session startup is never blocked; the next trigger retries on its own. Diagnostic: `time node .claude/hooks/kb-capture.mjs < /dev/null` should be under 200ms cold. Over 1s usually means secretlint is loading from a slow filesystem, or the consumer hasn't run `npm install`.

Only `kb-proposal-drain.mjs` runs as `async: true`, freeing it from the deadline at the cost of having its stdout dropped (status surfaces via `ai-knowledge-base status` and the SessionStart consume path).
