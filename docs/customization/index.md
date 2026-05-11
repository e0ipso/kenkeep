---
title: Customization
nav_order: 5
has_children: true
permalink: /customization/
---

# Customization

Pages:

- [Editing the stage-2 prompt](stage-2-prompt.md) — tune the capture extractor for your project's vocabulary.
- [Editing the curator prompt](curator-prompt.md) — control how stage-2 candidates become proposals.
- [Editing the bootstrap-incremental prompt](bootstrap-incremental-prompt.md) — tune the chunked extraction for `bootstrap-incremental`.
- [Tuning settings](tuning-settings.md) — recipes for the most common `.config.json` changes; trade-offs explained.

Prompts are copied to `.ai/knowledge-base/.state/prompts/` during `init` so you can override locally; hooks pick up the local copy if present and fall back to the bundled template. Reference settings live under [Reference > Settings](../reference/settings.md).
