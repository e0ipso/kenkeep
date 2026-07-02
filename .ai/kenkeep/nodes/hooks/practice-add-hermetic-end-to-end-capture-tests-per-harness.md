---
type: practice
title: Add hermetic end-to-end capture tests per harness
description: >-
  Unit tests alone miss capture regressions; each harness needs a hermetic
  integration test that exercises the built hook end-to-end.
tags:
  - testing
  - hooks
  - capture
  - harnesses
kk_schema_version: 3
kk_id: practice-add-hermetic-end-to-end-capture-tests-per-harness
kk_derived_from: []
kk_relates_to:
  - practice-testing-philosophy-few-tests-mostly-integration
  - map-capture-hook
kk_depends_on: []
kk_confidence: high
---
Capture hooks for OpenCode, Cursor, and Copilot can pass the full unit suite while failing real sessions — pipe truncation, wrong export session ids, and read-tool name drift are examples that only surface when the built hook runs against realistic transcript or export fixtures.

Each harness adapter carries at least one hermetic end-to-end capture test that invokes the compiled hook against a checked-in fixture (transcript JSONL, `opencode export` JSON, or Copilot `events.jsonl`) and asserts both a non-empty `_sessions/*.md` and, when the fixture includes a `nodes/` read, a matching `usage.jsonl` leaf.

These tests complement the existing parametrized read-extract and transcript-parser unit tests; they do not replace them.

<!-- kk:related:start -->
# Related

- Related: [practice-testing-philosophy-few-tests-mostly-integration](/conventions/practice-testing-philosophy-few-tests-mostly-integration.md)
- Related: [map-capture-hook](/hooks/map-capture-hook.md)
<!-- kk:related:end -->
