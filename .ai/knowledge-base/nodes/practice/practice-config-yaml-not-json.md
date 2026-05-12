---
schema_version: 1
id: practice-config-yaml-not-json
title: 'ai-knowledge-base config is YAML, never JSON'
kind: practice
tags:
  - config
  - yaml
  - ai-knowledge-base
valid_from: '2026-05-12T10:09:28.964Z'
valid_until: null
updated: '2026-05-12T11:48:24.255Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-1009-937d05692312.md
relates_to:
  - map-project-config-json
depends_on: []
confidence: high
summary: >-
  The ai-knowledge-base config file is always YAML at config.yaml; do not
  introduce JSON config files or JSON parsing for it.
---
The ai-knowledge-base configuration uses YAML.

- Project config: `.ai/knowledge-base/config.yaml`
- User config: `~/.config/ai-knowledge-base/config.yaml` (no `@e0ipso` scope directory in the path)

Do not introduce a JSON variant, a `.json` fallback, or JSON parsing for these files. When writing examples, templates, or fixtures that reference the config, use YAML syntax and the `.yaml` extension.

The sibling `.ai/knowledge-base/.config/` directory is the prompts directory and is unrelated to the config file. See [[map-project-config-json]] for the full path inventory.
