---
type: practice
title: Hook behavior changes must be applied to every harness adapter
description: >-
  Fixing hook logic in one harness does not fix the others; each of the five
  adapters has its own copy of every hook.
tags:
  - harness
  - hooks
  - architecture
  - drift
kk_schema_version: 3
kk_id: practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters
kk_derived_from: []
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The session-start, lint-tick, capture, and proposal-drain hooks each have five near-identical implementations under `src/harnesses/{claude,codex,copilot,cursor,opencode}/hooks/`. There is no shared runner for these files — each harness has its own full copy.

Consequence: any fix, feature, or behavior change to hook logic must be applied separately to all five harnesses. Missing even one adapter leaves that harness with the old behavior. The highest-risk areas are: session-start nudge rendering, proposal drain pipeline, and lint-tick counter logic.

Before closing a hook-related fix, verify all five harness files are updated.
