---
type: practice
title: Ignore harness JavaScript artifacts in Prettier
description: >-
  Prettier ignores JavaScript-family files under harness and agent folders,
  including CJS and MJS bundles.
tags:
  - prettier
  - harnesses
  - formatting
kk_schema_version: 3
kk_id: practice-ignore-harness-javascript-artifacts-in-prettier
kk_derived_from:
  - 'c65744ae-f92d-453a-97cb-16f2298e6645:practice:0'
kk_relates_to:
  - map-hook-build-pipeline-ts-to-cjs
  - map-copilot-harness-adapter
kk_depends_on: []
kk_confidence: medium
---
# Ignore harness JavaScript artifacts in Prettier

Prettier is configured to ignore JavaScript-family files under agent and harness-owned folders. Use patterns that cover `.js`, `.cjs`, and `.mjs`; a bare `*.js` pattern is insufficient because it misses CommonJS and ESM hook artifacts.

This applies to `.agents/`, `.claude/`, `.codex/`, `.cursor/`, `.opencode/`, and `.github/` hook-related output. Keep the ignore broad enough for generated or host-owned hook files so formatting does not churn deployed harness artifacts.

<!-- kk:related:start -->
# Related

- Related: [map-hook-build-pipeline-ts-to-cjs](/hooks/map-hook-build-pipeline-ts-to-cjs.md)
- Related: [map-copilot-harness-adapter](/harnesses/map-copilot-harness-adapter.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [c65744ae-f92d-453a-97cb-16f2298e6645:practice:0](c65744ae-f92d-453a-97cb-16f2298e6645:practice:0)
<!-- kk:citations:end -->
