---
schema_version: 2
id: map-copilot-harness-adapter
title: Copilot harness adapter
kind: map
tags:
  - harness
  - copilot
  - hooks
  - adapter
derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - 'https://github.com/github/copilot-cli'
  - >-
    https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference
relates_to:
  - map-harness-adapter
  - map-codex-harness
  - map-opencode-harness
  - map-cursor-harness-adapter
depends_on: []
confidence: high
summary: >-
  GitHub Copilot CLI adapter; per-event JSON hook config at
  ~/.copilot/hooks/kk.json; captures on sessionEnd/agentStop from events.jsonl;
  skills in .github/skills/; no detectFromEnv; session-start ENTRY via a
  sentinel block in .github/copilot-instructions.md.
---

# Copilot harness adapter

The Copilot adapter targets the agentic `@github/copilot` binary (the `copilot` command), not `gh copilot` and not the cloud Copilot Coding Agent. Copilot's extension surface is a per-event JSON hook document: one `{ version, hooks }` object whose `hooks` map keys each event name to an array of `{ type, bash, timeoutSec, env }` command entries. The adapter aggregates every event handler into a single file rather than one file per `HookSpec`.

Installed paths:

- `~/.copilot/hooks/kk.json`: the user-level file Copilot actually reads (honors `COPILOT_HOME`). This file is shared across every repo where the user runs `copilot`; the hook scripts no-op silently when the current directory has no `.ai/kenkeep/` project.
- `.copilot/hooks/kk.json`: a byte-identical in-repo copy committed as a documentation artifact so the registration is visible in source control.
- `.copilot/kk-hooks/`: the actual hook scripts (`kk-capture.cjs`, `kk-session-start.cjs`, `kk-proposal-drain.cjs`, `kk-lint-tick.cjs`). The directory is `kk-hooks/` rather than `hooks/` so the scripts never collide with the `kk.json` config artifact under `.copilot/hooks/`. The build emits to `kk-hooks/` because the adapter carries a `src/harnesses/copilot/.kk-hooks-output` marker. `.copilot/` is a kenkeep-tool convention: Copilot itself does not read it.
- `.github/skills/`: the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills, in Copilot's documented project skill location. Living outside `.copilot/` avoids colliding with `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
- `.github/copilot-instructions.md`: the ENTRY content under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block (see below).

Capture triggers: `sessionEnd` (mapped to the `session_end` capture trigger) and `agentStop` (mapped to `stop`, the Claude `Stop` analog at each agent-turn boundary). The shared `transcript_hash` dedup keeps one session log per unique transcript even when both fire.

Transcript source: Copilot exports no `sessionId` env var to children, so the capture hook reads `sessionId` from the hook's stdin JSON payload and locates the per-session log at `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl`. The parser scans for `userMessage` / `agentMessage` event types (falling back to `data.role` of `user` / `assistant`), concatenates same-`parentId` chunks, tolerates truncated final lines, and orders by `timestamp`. The internal `session-store.db` SQLite file is not consumed.

Headless invocation: `copilot -p "<prompt>" --no-ask-user --allow-all-tools --add-dir <repo-root>`, plus `--model <id>` when configured. Both `--no-ask-user` and `--allow-all-tools` are required for fully autonomous non-interactive operation. Copilot has no `--json` programmatic-output flag, so the runner buffers the final stdout text and parses the embedded JSON payload the prompt instructs the model to emit. The child env carries `KENKEEP_BUILDER_INTERNAL=1` to suppress hook recursion.

No in-session env detection: Copilot exports no env var identifying an active session, so `detectFromEnv` is omitted. Selection happens via `--harness copilot`, `--hint copilot`, or `cliDefaultHarness: copilot`.

Session-start context injection: Copilot documents no stdout context-injection channel on `sessionStart`. As a workaround the session-start hook writes the current ENTRY into `.github/copilot-instructions.md` under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block (idempotent, preserves user content outside the block), which Copilot reads on session start. This mirrors the OpenCode `.opencode/AGENTS.md` strategy and is a documented known limitation.
