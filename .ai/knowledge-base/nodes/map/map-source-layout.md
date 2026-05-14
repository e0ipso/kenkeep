---
schema_version: 1
id: map-source-layout
title: "Package source layout"
kind: map
tags: [layout, source, build]
derived_from:
  - CONTRIBUTING.md
  - docs/internals/architecture.md
relates_to: []
confidence: high
summary: "src/ holds cli, commands, hooks, lib, adapters, templates-source; tsup builds dist/ and bundled templates/."
---

# Package source layout

```
src/
├── cli.ts                       # Commander entry, registers subcommands
├── commands/                    # One file per subcommand (init, doctor, status, ...)
├── hooks/                       # Compiled-to-.mjs hook scripts
│   ├── kb-capture.ts            # capture     (Stop/SessionEnd/PreCompact)
│   ├── kb-proposal-drain.ts     # extraction  (SessionStart, async)
│   └── kb-session-start.ts      # consume     (SessionStart, sync)
├── lib/                         # Shared utilities (paths, log, version, ...)
├── adapters/
│   ├── types.ts                 # Assistant-agnostic adapter contract
│   └── claude.ts                # Claude Code adapter implementation
└── templates-source/            # Files copied into consumer repos
scripts/
└── build-templates.mjs          # Copies templates-source/ → templates/
templates/                       # Built; bundled into the npm package
tests/
└── fixtures/                    # Transcripts and bootstrap docs for integration tests
```

`tsup` builds `dist/cli.js` (CLI binary) and `dist/hooks/*.mjs` (one bundle per hook). The `prepare` script copies `templates-source/` to `templates/` and drops compiled hooks into `templates/claude/hooks/`. The npm package ships `dist/` and `templates/`.
