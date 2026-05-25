---
schema_version: 1
id: map-hook-build-pipeline-ts-to-cjs
title: 'Hook build pipeline: TS sources to deployed .cjs bundles'
kind: map
tags:
  - build
  - hooks
  - tsup
  - templates
  - cjs
derived_from: []
relates_to: []
confidence: high
summary: >-
  tsup compiles per-adapter TS hook sources into self-contained CJS bundles;
  build-templates copies them into templates/; init deploys to the target
  harness directory.
---
The hook build pipeline has three stages:

1. **TS source** (`src/harnesses/<adapter>/hooks/*.ts`). Each adapter (claude, codex, cursor, opencode) has its own hook entry points. Example: `src/harnesses/claude/hooks/kb-session-start.ts`.

2. **tsup bundle** (`dist/hooks/<adapter>/*.cjs`). `npm run build:cli` invokes tsup, which discovers every `src/harnesses/*/hooks/*.ts` file via `discoverEntries()` in `tsup.config.ts`. Each hook is compiled to a self-contained CommonJS `.cjs` file with `noExternal: [/.*/]` so all runtime dependencies (zod, js-yaml, secretlint, etc.) are inlined — the consumer repo needs zero npm deps. Adapters that ship a plugin shim (detected by a sibling `plugins/` directory) emit hooks to `kb-hooks/` instead of `hooks/` to avoid colliding with the host's reserved `hooks/` directory.

3. **Template copy** (`templates/<adapter>/hooks/*.cjs`). `npm run build:templates` (via `scripts/build-templates.mjs`) copies each compiled `.cjs` from `dist/hooks/<adapter>/` into `templates/<adapter>/hooks/` (or `templates/<adapter>/kb-hooks/` for adapters with plugins). These template files are what `npx @e0ipso/ai-knowledge-base init --harnesses <adapter>` deploys into the target project (e.g. `.claude/hooks/kb-session-start.cjs`).

To rebuild after editing a hook TS source: `npm run build` (runs both `build:cli` and `build:templates`). To deploy into the current repo for testing: `npx @e0ipso/ai-knowledge-base init --upgrade`.
