---
schema_version: 1
id: map-templates-npm-artifact
title: 'templates/: shipped npm artifact, regenerated on publish'
kind: map
tags:
  - npm
  - publish
  - artifact
derived_from:
  - 20260512-1439-722a03fa9cbe.md
relates_to:
  - map-build-templates-script
  - map-adapter-interface
  - practice-do-not-commit-bundled-output
depends_on: []
confidence: high
summary: >-
  templates/ is listed in package.json "files" and rebuilt by prepublishOnly
  before every npm publish.
---
The `templates/` directory is included in `package.json`'s `"files"` array, so it ships with the published npm package. The `prepublishOnly` script runs `npm run build`, which invokes `scripts/build-templates.mjs` and regenerates `templates/` from source before each publish. The CLI's `init` command copies from this directory when scaffolding into consumer projects.
