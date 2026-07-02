---
type: map
title: kk-session-start.mjs (consume hook)
description: >-
  Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may
  append curate nudge, emits additionalContext.
tags:
  - hooks
  - consume
  - sessionstart
  - index
kk_schema_version: 3
kk_id: map-session-start-hook
kk_derived_from:
  - docs/internals/hooks.md
  - docs/index.md
kk_relates_to:
  - map-entry-md
  - practice-recursion-guard-kenkeep-builder-internal
kk_depends_on: []
kk_confidence: high
---

# `kk-session-start.mjs` (consume hook)

Synchronous hook fired on `SessionStart`. 1-second hard deadline; overrun exits 0 so session startup is never blocked.

Pipeline:

1. Recursion guard: exit if `KENKEEP_BUILDER_INTERNAL=1`.
2. Load `ENTRY.md`. If missing, emit `_The knowledge base is empty._`.
3. Compare frontmatter `nodes_hash` against the live hash of `nodes/`. On drift, append: `> kk index is stale, run \`npx kenkeep index rebuild\``.
4. Count pending session logs. If above `curationThreshold` AND `last_nudged_at` was over an hour ago, append a curate nudge and write `last_nudged_at`.
5. Emit a JSON envelope that the harness merges into the session's system prompt:

   ```json
   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
   ```

The OpenCode adapter has no equivalent of Claude's `additionalContext` stdout channel, so its version of this hook writes the body to `.opencode/AGENTS.md` instead; users opt in by referencing that file from their primary `AGENTS.md`.

<!-- kk:related:start -->
# Related

- Related: [map-entry-md](/index/map-entry-md.md)
- Related: [practice-recursion-guard-kenkeep-builder-internal](/hooks/practice-recursion-guard-kenkeep-builder-internal.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/hooks.md](docs/internals/hooks.md)
[2] [docs/index.md](docs/index.md)
<!-- kk:citations:end -->
