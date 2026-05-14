---
schema_version: 1
id: practice-strict-config-yaml-schema
title: "config.yaml schema is strict; unknown keys are a hard error"
kind: practice
tags: [config, schema, strict]
derived_from:
  - PRD.md
  - docs/cli-reference.md
relates_to: []
confidence: high
summary: "Unknown keys or malformed YAML in .ai/knowledge-base/config.yaml cause a hard error naming the offending file."
---

# `config.yaml` schema is strict; unknown keys are a hard error

The per-project `.ai/knowledge-base/config.yaml` is validated strictly. Unknown keys or malformed YAML cause a hard error naming the offending file. There is no "ignore unknown keys" mode and no soft warning.

**Why:** the system never wants to silently drop user configuration. A typo (`curattionThreshold: 3`) would otherwise pretend to be honored. The strict schema turns these into loud, fixable failures at first run.

**How to apply:**

- When adding a new optional key, extend the Zod schema. The schema is the gate; documentation alone is not enough.
- For `proposalModel` / `curatorModel` / `bootstrapModel`: both `name` and `effort` sub-keys are required when the object is present. Either omit the object entirely or set both.
- Test new keys with a malformed-input case that asserts the hard error.
