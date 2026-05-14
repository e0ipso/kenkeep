---
schema_version: 1
id: map-config-yaml
title: ".ai/knowledge-base/config.yaml"
kind: map
tags: [config, settings, tunables]
derived_from:
  - docs/cli-reference.md
  - PRD.md
relates_to: []
confidence: high
summary: "Per-project tunables: curationThreshold, logsRetentionDays, lintEveryNSessions, plus model/effort overrides."
---

# `.ai/knowledge-base/config.yaml`

Committed per-project configuration. The schema is strict: unknown keys or malformed YAML cause a hard error naming the offending file.

Core keys:

```yaml
schema_version: 2
curationThreshold: 5       # pending logs that trigger the curate nudge
logsRetentionDays: 30      # retention window applied by `logs prune`
lintEveryNSessions: 50     # cadence for the background lint
```

Optional model/effort overrides per `claude -p` site:

```yaml
proposalModel:    { name: haiku,  effort: low }
curatorModel:     { name: opus,   effort: max }
bootstrapModel:   { name: sonnet, effort: high }
```

`name` accepts `haiku | sonnet | opus`; `effort` accepts `low | medium | high | xhigh | max`. Both sub-keys are required when the object is set. When a key is absent, the spawn omits both flags and the user's `claude` CLI default applies. The agent-driven `/kb-bootstrap` skill honors `bootstrapModel.name` only (no `effort` parameter on the `Task` tool).
