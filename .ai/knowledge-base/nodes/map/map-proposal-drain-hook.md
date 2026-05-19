---
schema_version: 1
id: map-proposal-drain-hook
title: "kb-proposal-drain.mjs (extraction hook)"
kind: map
tags: [hooks, extraction, llm, async]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to:
  - map-session-log
  - map-proposal-candidate-schema
  - practice-recursion-guard-kb-builder-internal
depends_on: []
confidence: high
summary: "Async SessionStart hook; sweeps pending _sessions/, spawns claude -p per log, populates proposals.{practice,map} and topics."
---

# `kb-proposal-drain.mjs` (extraction hook)

Asynchronous hook fired on `SessionStart`. Pipeline:

1. Recursion guard: exit if `KB_BUILDER_INTERNAL=1`.
2. Acquire the `proposal-drain` lock in `state.json` (PID + 30-min TTL). Stale locks are reclaimed.
3. Load the prompt: local override at `.ai/knowledge-base/.config/prompts/proposal-extract.md` first, bundled fallback otherwise.
4. Sweep `_sessions/*.md` for frontmatter with `proposal_status: pending` and process each one.
5. Per log: spawn `claude -p --output-format stream-json --verbose`, stream to `_logs/proposal/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `ProposalOutputSchema`.
6. On success: update the session-log frontmatter with `proposal_status: done`, populated `proposals.{practice,map}`, and a deduped `topics` array.
7. On failure: write `proposal_status: failed` with `proposal_error`. The drain does **not** retry — schema-mismatch, timeout, and bad-JSON failures do not heal on retry.

To force re-extraction of a `failed` entry, set its `proposal_status` back to `pending` and clear `proposal_error`; the next drain sweep picks it up.

Per-spawn model selection: reads `proposalModel: { name, effort }` from `config.yaml`; when set, passes `--model <name> --effort <effort>` to `claude -p`. When absent, both flags are omitted and the user's `claude` CLI default applies.
