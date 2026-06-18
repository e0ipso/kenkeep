---
schema_version: 2
id: map-proposal-drain-hook
title: kk-proposal-drain (extraction hook)
kind: map
tags:
  - hooks
  - extraction
  - llm
  - async
  - claude
  - billing
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to:
  - map-session-log
  - map-proposal-candidate-schema
  - practice-recursion-guard-kenkeep-builder-internal
  - map-curate-command
  - map-claude-harness
  - map-codex-harness
  - map-copilot-harness-adapter
  - map-cursor-harness-adapter
  - map-opencode-harness
depends_on: []
confidence: high
summary: >-
  Async SessionStart hook that sweeps pending _sessions/ and extracts proposals;
  the Claude adapter's hook is intentionally a no-op -- extraction runs inline
  during /kk-curate instead.
---

# `kk-proposal-drain` (extraction hook)

Asynchronous hook fired on `SessionStart`. Pipeline for Codex, Cursor, and OpenCode adapters:

1. Recursion guard: exit if `KENKEEP_BUILDER_INTERNAL=1`.
2. Acquire the proposal-drain lock on `state.json` via `proper-lockfile` (a `mkdir`-atomic `state.json.lock` directory whose mtime is refreshed on a heartbeat while held; 60s stale threshold). A drain killed mid-run by the host's outer timeout leaves a stale lock that the next drain auto-reclaims on acquire (`DrainSummary.recoveredStaleLock`); the ELOCKED path reports lock age + ETA.
3. Load the prompt: local override at `.ai/kenkeep/.config/prompts/proposal-extract.md` first, bundled fallback otherwise.
4. Sweep `_sessions/*.md` for frontmatter with `proposal_status: pending` and process each one.
5. Per log: spawn the adapter's headless runner (e.g. `codex exec`, `agent -p`, `opencode run`), stream to `_logs/proposal/<session-id>__<ts>.jsonl`, parse the final `result`, validate against `ProposalOutputSchema`.
6. On success: update the session-log frontmatter with `proposal_status: done`, populated `proposals.{practice,map}`, and a deduped `topics` array.
7. On failure: write `proposal_status: failed` with `proposal_error`. The drain does **not** retry.

To force re-extraction of a `failed` entry, set its `proposal_status` back to `pending` and clear `proposal_error`; the next drain sweep picks it up.

**Claude adapter exception:** The Claude adapter's `kk-proposal-drain` hook is intentionally a no-op -- its `main()` only runs the recursion guard and returns immediately. The reason is billing: `claude -p` consumes the same Max plan tokens or API credits as an interactive `claude` session, so spawning a background child for proposal extraction would silently cost the user money. Instead, proposal extraction runs inline during the `/kk-curate` skill, where the user is already paying for the context window.

Per-spawn model selection (non-Claude adapters): reads `proposalModel: { name, effort }` from `config.yaml`; when set, passes the appropriate model/effort flags to the headless runner. When absent, the runner's default applies.
