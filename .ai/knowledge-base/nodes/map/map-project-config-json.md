---
schema_version: 1
id: map-project-config-json
title: '.ai/knowledge-base/config.yaml: project-level tunables'
kind: map
tags:
  - settings
  - config
  - tunables
  - yaml
valid_from: '2026-05-12T10:09:28.964Z'
valid_until: null
updated: '2026-05-12T11:48:24.255Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-1009-937d05692312.md
relates_to:
  - practice-config-yaml-not-json
depends_on: []
confidence: high
summary: >-
  Project config at .ai/knowledge-base/config.yaml; user config at
  ~/.config/ai-knowledge-base/config.yaml; prompts dir at
  .ai/knowledge-base/.config/.
---
Project-level tunables for ai-knowledge-base, committed to the repo.

**Paths**

- **Project config:** `.ai/knowledge-base/config.yaml` (YAML)
- **User config:** `~/.config/ai-knowledge-base/config.yaml` (YAML, no `@e0ipso` scope directory)
- **Prompts directory:** `.ai/knowledge-base/.config/` (separate from the config file; holds prompt assets, not config)

**Layering**

User config is layered behind the project file: project wins. CLI flags win over both.

**Code references**

Hook source files reference the project config via the `paths.projectConfigFile` abstraction rather than hardcoded strings.

See [[practice-config-yaml-not-json]] for the format rule.
