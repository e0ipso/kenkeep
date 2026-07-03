---
type: map
title: Copilot harness adapter
description: >-
  GitHub Copilot CLI adapter; repo-level .github/hooks/kk.json; captures on
  sessionEnd/agentStop; skills in .github/skills/; sentinel ENTRY.
tags:
  - harness
  - copilot
  - hooks
  - adapter
kk_schema_version: 3
kk_id: map-copilot-harness-adapter
kk_derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - 'https://github.com/github/copilot-cli'
  - >-
    https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference
kk_relates_to:
  - map-harness-adapter
  - map-codex-harness
  - map-opencode-harness
  - map-cursor-harness-adapter
kk_depends_on: []
kk_confidence: high
---

# Copilot harness adapter

The Copilot adapter targets the agentic `@github/copilot` binary (the `copilot` command), not `gh copilot` and not the cloud Copilot Coding Agent. Copilot's extension surface is a per-event JSON hook document: one `{ version, hooks }` object whose `hooks` map keys each event name to an array of `{ type, bash, timeoutSec, env }` command entries. The adapter aggregates every event handler into a single file rather than one file per `HookSpec`. Copilot CLI loads hooks from several sources in order (policy, **repository `.github/hooks/*.json`**, user-level `~/.copilot/hooks/`, inline settings, plugins) and combines them; the adapter writes only the repo-level source, so the registration is committed, team-shared, and never touches the user's home directory.

Installed paths:

- `.github/hooks/kk.json`: the **repo-level** file Copilot reads (loaded before user-level). Committed to the repo, shared by the team. `init` writes nothing outside the repository.
- `.copilot/kk-hooks/`: the actual hook scripts (`kk-capture.cjs`, `kk-session-start.cjs`, `kk-proposal-drain.cjs`, `kk-lint-tick.cjs`). The directory is `kk-hooks/` rather than `hooks/` so the scripts never collide with a config artifact. `.copilot/` is a kenkeep-tool convention: Copilot itself does not read it.
- `.github/skills/`: the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills, in Copilot's documented project skill location. Living outside `.copilot/` avoids colliding with `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
- `.github/copilot-instructions.md`: the ENTRY content under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block (see below).

Migration note: an older `init` wrote `~/.copilot/hooks/kk.json` (user-level). This version does not. If you upgraded from that version, remove the old `~/.copilot/hooks/kk.json` manually; otherwise Copilot loads both files and fires every hook twice.

Capture triggers: `sessionEnd` (mapped to the `session_end` capture trigger) and `agentStop` (mapped to `stop`, the Claude `Stop` analog at each agent-turn boundary). The shared `transcript_hash` dedup keeps one session log per unique transcript even when both fire.

Transcript source: Copilot exports no `sessionId` env var to children, so the capture hook reads `sessionId` from the hook's stdin JSON payload and locates the per-session log at `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl`. Each line is an event envelope `{ type, data, id, timestamp, parentId }` (measured against Copilot CLI v1.0.61). `parseCopilotTranscript` classifies turns by event `type`: `user.message` is a user turn and `assistant.message` is an assistant turn, with the text read from `data.content` (there is no `data.role` field on message events; `assistant.message` may also carry `data.toolRequests`, which is ignored). Every other event type (`assistant.turn_start`/`assistant.turn_end`, `session.*`, `hook.*`, `system.message`, tool events) is skipped. Chunked same-role events are concatenated into one turn, grouped by `turnId` (envelope or `data`) falling back to `parentId`; turns are ordered by `timestamp` with stream order as a tie-break. Malformed or truncated final lines are skipped silently. Capture now produces a non-empty role-tagged transcript for real Copilot sessions. The internal `session-store.db` SQLite file is not consumed.

Headless invocation: `copilot -p "<prompt>" --no-ask-user --allow-all-tools --add-dir <repo-root>`, plus `--model <id>` when configured. Both `--no-ask-user` and `--allow-all-tools` are required for fully autonomous non-interactive operation. Copilot has no `--json` programmatic-output flag, so the runner buffers the final stdout text and parses the embedded JSON payload the prompt instructs the model to emit. The child env carries `KENKEEP_BUILDER_INTERNAL=1` to suppress hook recursion.

No in-session env detection: Copilot exports no env var identifying an active session, so `detectFromEnv` is omitted. Selection happens via `--harness copilot`, `--hint copilot`, or `cliDefaultHarness: copilot`.

Session-start context injection: Copilot documents no stdout context-injection channel on `sessionStart`. As a workaround the session-start hook writes the current ENTRY into `.github/copilot-instructions.md` under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block (idempotent, preserves user content outside the block), which Copilot reads on session start. This mirrors the OpenCode `.opencode/AGENTS.md` strategy and is a documented known limitation.

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
- Related: [map-codex-harness](/harnesses/map-codex-harness.md)
- Related: [map-opencode-harness](/harnesses/map-opencode-harness.md)
- Related: [map-cursor-harness-adapter](/harnesses/map-cursor-harness-adapter.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/how-it-works.md](docs/how-it-works.md)
[3] [https://github.com/github/copilot-cli](https://github.com/github/copilot-cli)
[4] [https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference)
<!-- kk:citations:end -->
