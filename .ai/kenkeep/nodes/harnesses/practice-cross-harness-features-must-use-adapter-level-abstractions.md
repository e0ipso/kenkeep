---
type: practice
title: Cross-harness features must use adapter-level abstractions
description: >-
  For features spanning all harnesses, build adapter-level abstractions that
  work everywhere rather than assuming Claude's shape is universal.
tags:
  - harnesses
  - cross-harness
  - abstractions
  - architecture
kk_schema_version: 3
kk_id: practice-cross-harness-features-must-use-adapter-level-abstractions
kk_derived_from: []
kk_relates_to:
  - practice-adapters-never-cross-directories
  - practice-no-event-translation-across-adapters
  - map-harness-adapter
kk_depends_on: []
kk_confidence: high
---
When designing features that affect all harnesses, do not assume Claude Code's path is the universal path. Every harness has a distinct raw transcript format, event vocabulary, and storage model. The correct design is a first-class adapter-level abstraction that each harness implements independently, with graceful degradation (`[]` for unsupported capabilities) rather than centralizing logic around Claude's specific shape.

This applies to capture hooks, transcript parsing, tool-call extraction, and any cross-harness feature. The shared `HookEvent` is deliberately opaque; shared code iterates `adapter.hooks` and never branches on Claude's event names. Each adapter declares its own native events and capabilities.

<!-- kk:related:start -->
# Related

- Related: [practice-adapters-never-cross-directories](/harnesses/practice-adapters-never-cross-directories.md)
- Related: [practice-no-event-translation-across-adapters](/harnesses/practice-no-event-translation-across-adapters.md)
- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
<!-- kk:related:end -->
