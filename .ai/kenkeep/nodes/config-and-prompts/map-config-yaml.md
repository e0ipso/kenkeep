---
type: map
title: config.yaml (project settings)
description: >-
  Committed project settings at .ai/kenkeep/config.yaml. Strict: unknown keys
  are a hard error.
tags:
  - config
  - settings
  - model
kk_schema_version: 3
kk_id: map-config-yaml
kk_derived_from:
  - docs/internals/architecture.md
kk_relates_to:
  - map-curate-command
  - map-bootstrap-incremental-command
  - map-proposal-drain-hook
kk_depends_on: []
kk_confidence: high
---

# `config.yaml`

Project-level settings at `.ai/kenkeep/config.yaml`. Committed. Strict: any unknown key causes a hard error naming the offending file.

```yaml
schema_version: 1
curationThreshold: 5
logsRetentionDays: 30
lintEveryNSessions: 50
cliDefaultHarness: claude   # optional; one of claude, codex, copilot, cursor, opencode
```

Keys:

| Key | Default | What it does |
|---|---|---|
| `curationThreshold` | `5` | Pending logs that trigger the curate nudge. |
| `logsRetentionDays` | `30` | Retention window applied by `logs prune`. |
| `lintEveryNSessions` | `50` | Run cadence for the background lint, in SessionEnd ticks. |
| `cliDefaultHarness` | _(unset)_ | Picks the adapter for plain-shell CLI invocations. Skills and hooks ignore this and resolve via env detection or explicit `--harness`. |

## Model and effort selection

Three optional model-selection objects pick the model and effort level for each headless-driver subprocess. Each object is keyed by a `harness` discriminator; only the variant matching the active adapter is consumed. When unset, the harness CLI's default applies.

```yaml
proposalModel:
  harness: claude
  name: haiku        # haiku | sonnet | opus
  effort: low        # low | medium | high | xhigh | max

# Per-harness shapes:
#   claude:   { harness: claude, name: haiku|sonnet|opus, effort: low|medium|high|xhigh|max }
#   codex:    { harness: codex, model: <id>, reasoningEffort: <str>? }
#   opencode: { harness: opencode, model: <id>, agent: <str>? }
#   cursor:   { harness: cursor, model: <id> }
#   copilot:  { harness: copilot, model: <id> }
```

- `proposalModel` — passed on proposal-drain spawns.
- `curatorModel` — passed on `curate` spawns.
- `bootstrapModel` — passed on `bootstrap-incremental` spawns. Also honored on a best-effort basis by the agent-driven `/kk-bootstrap` skill, but the skill ignores `bootstrapModel.effort` because the `Task` tool has no `effort` parameter.

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-bootstrap-incremental-command](/bootstrap/map-bootstrap-incremental-command.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/architecture.md](docs/internals/architecture.md)
<!-- kk:citations:end -->
