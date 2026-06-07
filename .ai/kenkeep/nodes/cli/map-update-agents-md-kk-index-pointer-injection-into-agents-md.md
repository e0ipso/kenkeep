---
schema_version: 2
id: map-update-agents-md-kk-index-pointer-injection-into-agents-md
title: updateAgentsMd - kk index pointer injection into AGENTS.md
kind: map
tags:
  - init
  - upgrade
  - agents-md
  - markers
  - index
derived_from: []
relates_to:
  - map-entry-md
  - practice-init-does-not-install-commit-tooling
confidence: high
summary: >-
  Function in src/commands/init.ts that injects or replaces a sentinel-guarded
  static pointer to ENTRY.md in AGENTS.md.
---
`updateAgentsMd(root: string)` in `src/commands/init.ts` injects a static pointer block into `AGENTS.md` at the project root. It is called from both `runInit()` and `runUpgrade()`.

The block is bounded by `<!-- >>> kenkeep:kk-index >>> -->` and `<!-- <<< kenkeep:kk-index <<< -->`. If the start sentinel is found, the content between markers is replaced; otherwise the block is appended at the end of the file. If `AGENTS.md` does not exist, it is created.

The injected pointer content: `Curated project knowledge lives in [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md). Consult it before designing a non-trivial change.`
