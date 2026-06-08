---
schema_version: 2
id: map-config-yaml
title: config.yaml (project settings)
kind: map
tags:
  - config
  - settings
  - model
derived_from:
  - docs/cli-reference.md
  - docs/internals/architecture.md
relates_to:
  - map-curate-command
  - map-bootstrap-incremental-command
  - map-proposal-drain-hook
depends_on: []
confidence: high
summary: >-
  Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys
  are a hard error.
---

# `config.yaml`

Project-level settings at `.ai/kenkeep/config.yaml`. Committed. Strict: any unknown key causes a hard error naming the offending file.

```yaml
schema_version: 1
curationThreshold: 5
logsRetentionDays: 30
lintEveryNSessions: 50
cliDefaultHarness: claude   # optional; one of claude, codex, opencode
```

Keys:

| Key | Default | What it does |
|---|---|---|
| `curationThreshold` | `5` | Pending logs that trigger the curate nudge. |
| `logsRetentionDays` | `30` | Retention window applied by `logs prune`. |
| `lintEveryNSessions` | `50` | Run cadence for the background lint, in SessionEnd ticks. |
| `cliDefaultHarness` | _(unset)_ | Picks the adapter for plain-shell CLI invocations. Skills and hooks ignore this and resolve via env detection or explicit `--harness`. |

## Model and effort selection

Three optional `{ name, effort }` objects pick the model family and effort level for each headless-driver subprocess. Both sub-keys are required when the object is present; when unset, neither flag is passed and the harness CLI's default applies.

```yaml
proposalModel: { name: haiku, effort: low }
curatorModel:  { name: opus,  effort: max }
bootstrapModel: { name: sonnet, effort: high }
```

- `proposalModel` — passed on proposal-drain spawns.
- `curatorModel` — passed on `curate` spawns.
- `bootstrapModel` — passed on `bootstrap-incremental` spawns. Also honored on a best-effort basis by the agent-driven `/kk-bootstrap` skill, but the skill ignores `bootstrapModel.effort` because the `Task` tool has no `effort` parameter.

Accepted `name`: `haiku`, `sonnet`, `opus`. Accepted `effort`: `low`, `medium`, `high`, `xhigh`, `max`.
