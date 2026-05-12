---
schema_version: 1
id: map-build-templates-script
title: 'scripts/build-templates.mjs: regenerates templates/ from sources'
kind: map
tags:
  - build
  - templates
  - script
derived_from:
  - 20260512-1439-722a03fa9cbe.md
relates_to:
  - map-templates-npm-artifact
  - practice-do-not-commit-bundled-output
depends_on: []
confidence: high
summary: >-
  Build script that wipes templates/ and rebuilds it from src/templates-source/
  and dist/hooks/.
---
`scripts/build-templates.mjs` is the build step responsible for the `templates/` directory. It calls `rmSync(dest, ...)` at the start and regenerates the entire directory from two sources: static content under `src/templates-source/` and bundled hook output from `dist/hooks/`. `templates/` is therefore entirely build output, not authored content.
