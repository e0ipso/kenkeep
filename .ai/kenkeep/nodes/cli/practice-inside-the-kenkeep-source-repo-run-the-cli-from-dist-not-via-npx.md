---
type: practice
title: 'Inside the kenkeep source repo, run the CLI from dist/, not via npx'
description: >-
  In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build)
  instead of npx kenkeep@latest.
tags:
  - kenkeep
  - kk-curate
  - repo-local
  - npx
  - cli
kk_schema_version: 3
kk_id: practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx
kk_derived_from: []
kk_relates_to:
  - map-curate-command
  - map-kenkeep-package
kk_depends_on: []
kk_confidence: high
---
The `/kk-curate` skill template ships an `npx --yes kenkeep@latest curate ...` invocation because it is package-agnostic and runs in consumer repos. Inside the `kenkeep` source repo, the correct invocation is `node ./dist/cli.js curate --harness <id>` (after `npm run build` if freshness matters).

`dist/cli.js` is the exact same binary npx would download, minus a registry round-trip and minus the risk of version skew between the source you are editing and the published binary that ran. Following the skill's npx line verbatim inside the source repo wastes a network round-trip and can run a different version than the working tree.

Applies to: any session inside the `kenkeep` source repo that invokes the CLI directly (curate, index rebuild, etc.).

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-kenkeep-package](/overview/map-kenkeep-package.md)
<!-- kk:related:end -->
