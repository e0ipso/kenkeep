---
title: Tuning settings
parent: Customization
nav_order: 4
---

# Tuning settings

Defaults target a small-to-medium repo with a single contributor. Common knobs below; for the full key reference see [Reference > Settings](../reference/settings.md).

## Where overrides go

- **Project**: `.ai/knowledge-base/.config.json` (committed).
- **User**: `~/.config/@e0ipso/ai-knowledge-base/config.json` (not committed).

Project wins, so a contributor can't relax a project-mandated value.

## Common changes

### Stage-2 keeps timing out

```json
{ "schema_version": 1, "stage2Timeout": 180000 }
```

Default is 60s. Triple it for dense sessions. `maxAttempts` is unchanged, so a broken entry still gets skipped after 3 failures.

### Drain processes too few entries per session

```json
{ "schema_version": 1, "drainBound": 20 }
```

Higher values clear deep queues faster at the cost of slower session startup until the queue drains.

### INDEX is being trimmed

```json
{ "schema_version": 1, "indexBudgetTokens": 8000 }
```

Default 2000 is enough for ~50 nodes. Past ~200 you start seeing the `_N additional nodes hidden_` footer. `GRAPH.md` is always unfiltered.

### Curate nudge is too quiet (or too loud)

```json
{ "schema_version": 1, "curationThreshold": 2 }
```

Lower threshold means earlier nudges. Throttle is hourly via `last_nudged_at`.

### Default log retention

```json
{ "schema_version": 1, "logsRetentionDays": 7 }
```

Sets the default `--older-than` window for `logs prune`.

## CLI flags

Per-command flags (`--batch-size`, `--token-budget`, `--timeout`, `--budget-tokens`, `--older-than`) override settings for that run.

## Verifying

`ai-knowledge-base doctor` reports the settings file as valid (or names the violating key on a Zod failure).
