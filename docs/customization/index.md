---
title: Customization
nav_order: 5
has_children: true
permalink: /customization/
---

# Customization

Pages:

- [Editing the stage-2 prompt](stage-2-prompt.md) — tune the capture extractor for your project's vocabulary.
- Editing the curator prompt — _coming in M3._
- Editing the bootstrap-incremental prompt — _coming in M3.5._

Prompts are copied to `.ai/.kb-builder/prompts/` during `init` so you can override locally; hooks pick up the local copy if present and fall back to the bundled template. Reference settings live under [Reference > Settings](../reference/settings.md).
