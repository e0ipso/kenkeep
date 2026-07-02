---
type: map
title: OpenCode harness adapter
description: >-
  OpenCode adapter; plugin shim dispatches session.idle/created to kk-hooks/;
  capture via opencode export with raw ses_ id, temp-file stdout.
tags:
  - harness
  - opencode
  - hooks
  - plugin
kk_schema_version: 3
kk_id: map-opencode-harness
kk_derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - README.md
kk_relates_to:
  - map-harness-adapter
kk_depends_on: []
kk_confidence: high
---
OpenCode's idiomatic event surface is a long-lived plugin module subscribed to the runtime event bus, not per-event shell commands. The adapter ships a single TS plugin shim at `.opencode/plugins/kb.mjs` that subscribes to the event bus and dispatches `session.idle` and `session.created` to per-event Node scripts under `.opencode/kk-hooks/`.

Installed paths:

- `.opencode/plugins/kb.mjs` — TS plugin shim. Self-registering by virtue of its location; OpenCode auto-loads every plugin under `.opencode/plugins/` at startup.
- `.opencode/kk-hooks/` — per-event scripts (`kk-capture.mjs`, `kk-session-start.mjs`, `kk-proposal-drain.mjs`, `kk-lint-tick.mjs`). The directory is `kk-hooks/` rather than `hooks/` to avoid collision with the runtime-reserved `.opencode/hooks/`.
- `.opencode/skills/` — the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills.

OpenCode's hook payload does not carry a `transcript_path`. The capture script sources both the transcript and the read-usage paths from `opencode export <sessionID>` (30-second timeout) — its sole, primary source; there is no on-disk file-tree parser or fallback.

**Export session id:** `opencode export` keys on the raw `ses_<base62>` id from the plugin payload. The hook normalizes that id to a deterministic UUID v4 only for kenkeep session-log identity; the export subprocess always receives the original `ses_` value.

**Export stdout:** On OpenCode v1.17.3, `opencode export` exits before fully flushing stdout to a pipe, so `spawnSync({ encoding: 'utf8' })` returns truncated, unparseable JSON. The hook redirects export stdout to a temp file, reads it back, then deletes the temp dir.

Export JSON shape: `{ info, messages: [{ info: { role, time: { created } }, parts: [...] }] }`. Transcript text comes from `type === 'text'` parts; read usage from `type === 'tool' && tool === 'read'` parts at `state.input.filePath`.

OpenCode also has no v1 equivalent of Claude's `SessionStart` `additionalContext` stdout channel, so the session-start hook writes the current ENTRY body to `.opencode/AGENTS.md`; users opt in by referencing that file from their primary `AGENTS.md`.

OpenCode exports no in-session env var; pass `--harness opencode` or set `cliDefaultHarness: opencode`.

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/how-it-works.md](docs/how-it-works.md)
[3] [README.md](README.md)
<!-- kk:citations:end -->
