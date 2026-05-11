---
title: Tuning settings
parent: Customization
nav_order: 4
---

# Tuning settings

The defaults in `.ai/knowledge-base/.config.json` are aimed at a small-to-medium repo with a single contributor. This page walks through the knobs you'll most often want to change and what the trade-offs look like. For the full key reference see [Reference > Settings](../reference/settings.md).

## Where to put overrides

Two layers, both optional:

- **Project**: `.ai/knowledge-base/.config.json` — committed. Edit this when the override should apply to every contributor.
- **User**: `~/.config/@e0ipso/ai-knowledge-base/config.json` (or `$XDG_CONFIG_HOME/...`) — not committed. Edit this when only your machine needs the override (e.g. a slow laptop that times out on stage-2).

Project wins. So a contributor cannot accidentally relax a project-mandated value with a user override.

## Common changes

### "Stage-2 keeps timing out"

```json
{
  "schema_version": 1,
  "stage2Timeout": 180000
}
```

The default of 60 s is plenty for short user-turn transcripts but tight for long, dense sessions. Triple it; the cost is up to 3 × longer for a session-id to drain if it's actually stuck. The retry budget (`maxAttempts`) is unchanged, so a truly broken entry still gets skipped after three failed attempts.

### "The drain processes too few entries per session"

```json
{
  "schema_version": 1,
  "drainBound": 20
}
```

Useful when a developer comes back from a long break with a deep queue. Higher values keep session start async-but-slow until the queue is empty; lower values keep session start instant but spread the drain across many sessions.

### "INDEX.md is being trimmed but I want everything"

```json
{
  "schema_version": 1,
  "indexBudgetTokens": 8000
}
```

The default 2000-token budget is generous for ~50 nodes. Past ~200 nodes you'll start seeing the `_N additional nodes hidden_` footer. Bumping this trades context-window space for completeness; `GRAPH.md` is always the unfiltered source of truth, so the AI can still pull from it on demand.

### "The curate nudge is too quiet (or too loud)"

```json
{
  "schema_version": 1,
  "curationThreshold": 2
}
```

Lower threshold = nudge after fewer pending session logs. The nudge is still throttled to once per hour by `last_nudged_at` in `state.json`; if you want it more aggressive you currently have to drop the threshold instead of the throttle.

### "I want logs pruned more aggressively by default"

```json
{
  "schema_version": 1,
  "logsRetentionDays": 7
}
```

Affects the default `--older-than` window of `ai-knowledge-base logs prune`. The CLI flag still wins per invocation.

## Per-command flags vs. settings

Every per-command flag (`--batch-size`, `--token-budget`, `--timeout`, `--budget-tokens`, `--older-than`) wins over the settings file for that run. So you can keep the project default conservative and crank a single one-off invocation when needed:

```sh
ai-knowledge-base curate --token-budget 100000 --timeout 300000
```

## Verifying a settings change

```sh
ai-knowledge-base doctor
```

The `settings file is valid` check reports the number of overrides found and exits non-zero on a Zod validation failure (unknown key, negative number, wrong type). Pair it with `--verbose` for the rest of the diagnostics.

## Schema versioning

The Settings schema follows the moderate policy in CONTRIBUTING.md: `schema_version` bumps only on renames, removals, or semantic changes. Adding a new optional key does **not** bump the version, so your existing `.config.json` keeps working when the package adds new settings — they fall back to the documented defaults.
