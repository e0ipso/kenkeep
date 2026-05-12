---
schema_version: 1
id: map-project-config-json
title: ".ai/knowledge-base/config.yaml: project-level tunables"
kind: map
tags: [settings, config, tunables]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/cli-reference.md
relates_to: [map-ai-knowledge-base-cli]
depends_on: []
confidence: high
summary: "Project-level tunables, committed. Layered behind a user file at ~/.config/ai-knowledge-base/config.yaml; project wins; CLI flags win over both."
---

# `.ai/knowledge-base/config.yaml`: project-level tunables

Project-level settings. Committed. Defaults defined in `src/lib/settings.ts`.

| Key | Default | What it does |
|---|---|---|
| `drainBound` | `5` | Max background extractions processed per session start. |
| `lockTtlMs` | `1800000` | Default lock TTL (30 minutes). |
| `stage2Timeout` | `60000` | Per-entry extraction timeout (ms). |
| `indexBudgetTokens` | `2000` | Token budget for `INDEX.md`. |
| `curationThreshold` | `5` | Pending logs that trigger the curate nudge. |
| `bootstrapTokenBudget` | `10000` | Per-batch budget for `bootstrap-incremental`. |
| `logsRetentionDays` | `30` | Default window for `logs prune`. |

A user-level file at `~/.config/ai-knowledge-base/config.yaml` provides personal defaults. Precedence: CLI flags > project `config.yaml` > user file > built-in defaults. An unparseable file warns and falls back to defaults rather than bricking the CLI.

Validated by the `ProjectConfigSchema` shape in `src/lib/schemas.ts`. Carries `schema_version: 1`.
