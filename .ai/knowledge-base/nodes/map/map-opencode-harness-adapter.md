---
schema_version: 1
id: map-opencode-harness-adapter
title: "OpenCode harness adapter"
kind: map
tags: [harness, adapter, opencode, integration]
derived_from: []
relates_to: [map-adapter-interface, practice-explicit-harness-flag, practice-shared-skill-templates, map-codex-harness-adapter]
confidence: high
summary: "OpenCode harness id `opencode`; source under src/harnesses/opencode/, ships a TS plugin shim at .opencode/plugins/kb.mjs plus per-event Node scripts at .opencode/kb-hooks/."
---

# OpenCode harness adapter

The OpenCode harness implements the adapter contract defined by [[map-adapter-interface]] for the OpenCode runtime. Its identifier is `opencode`.

## File layout

- `src/harnesses/opencode/` holds the adapter implementation: `install.ts`, `headless.ts`, `transcript.ts`, `hook-spec.ts`, `doctor.ts`, `opts.ts`, and `index.ts` (the registry-facing surface).
- `src/harnesses/opencode/plugins/kb.ts` is the TS source for the long-lived plugin shim that subscribes to the OpenCode event bus.
- `src/harnesses/opencode/hooks/*.ts` are the per-event Node scripts the plugin spawns on each subscribed event.
- `templates/opencode/plugins/kb.mjs` and `templates/opencode/kb-hooks/*.mjs` are the built artifacts shipped to consumer repos. The hook output uses `kb-hooks/` rather than `hooks/` because OpenCode's runtime reserves `.opencode/hooks/` for its own use.

## Install paths

On `init --harnesses opencode`, `installOpenCode` writes into the consumer repo:

- `.opencode/plugins/kb.mjs`: the plugin shim. Self-registering by virtue of its location; OpenCode auto-loads every plugin under `.opencode/plugins/`.
- `.opencode/kb-hooks/{kb-capture,kb-session-start,kb-proposal-drain,kb-lint-tick}.mjs`: the per-event scripts.
- `.opencode/skills/kb-{add,bootstrap,curate}/SKILL.md`: the shared skill bytes, identical across every configured harness (see [[practice-shared-skill-templates]]).

## Events supported

The OpenCode runtime exposes a long-lived plugin event bus. The adapter declares two events directly in OpenCode-native names (no translation to Claude/Codex canonical names):

- `session.idle`: drives `kb-capture` (transcript discovery and session log write) and `kb-lint-tick` (lint cadence counter).
- `session.created`: drives `kb-session-start` (writes the INDEX context to `.opencode/AGENTS.md`) and the async `kb-proposal-drain`.

The plugin shim itself does no business logic; it dispatches `event.type` to the matching script name in `.opencode/kb-hooks/` via `child_process.spawn`, passing `{ session_id, hook_event_name, cwd }` as JSON on stdin and always setting `KB_BUILDER_INTERNAL=1` on the child env (recursion guard).

## Transcript discovery

OpenCode's hook payload does not carry a `transcript_path`. The capture script parses `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/storage/`:

1. `session/<projectID>/<sessionID>.json` for session metadata (informational).
2. `message/<sessionID>/*.json` sorted by `time.created`.
3. For each message, `part/<messageID>/*.json` filtered to `type === 'text'` parts.

When the on-disk parse yields zero turns (e.g. mid-flush), the capture script falls back to `opencode export <sessionID>` (30-second timeout) and adapts its JSON output through the same shape coercion.

## Headless mode

`runHeadlessOpenCode` spawns `opencode run --format json --model <provider>/<model>` plus optional `--agent <id>`. The output is a newline-delimited JSON event stream; the runner accumulates `message.part.updated` text deltas for the active assistant message (resetting on each new `messageID`), then parses the accumulated string as JSON and validates against the caller-supplied Zod schema.

## No env detection

OpenCode exports no in-session env var the adapter can rely on, so `detectFromEnv` is intentionally not implemented. Selection happens via `--harness opencode` on the CLI, `--hint opencode` inside skills, or `cliDefaultHarness: opencode` in `config.yaml`. See [[practice-explicit-harness-flag]].

## Capture-event gap with Claude

The Claude adapter wires capture to `Stop`, `SessionEnd`, and `PreCompact`. OpenCode has no equivalent of any of those: the session-idle event is its only end-of-turn signal, and there is no v1 equivalent of Claude's `SessionStart` `additionalContext` stdout channel (the OpenCode session-start hook writes to `.opencode/AGENTS.md` instead). Curation and review behavior are identical across harnesses; only the capture frequency and the session-start mechanism differ.
