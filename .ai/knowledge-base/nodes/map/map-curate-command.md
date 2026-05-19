---
schema_version: 1
id: map-curate-command
title: "curate (CLI command + /kb-curate skill)"
kind: map
tags: [cli, curate, skill]
derived_from:
  - docs/cli-reference.md
  - docs/daily-use.md
  - docs/how-it-works.md
relates_to:
  - map-curator-action
  - map-conflict-files
  - practice-curator-never-auto-resolves-contradictions
depends_on: []
confidence: high
summary: "Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kb-curate is the in-session equivalent."
---

# `curate` (CLI command + `/kb-curate` skill)

```sh
npx @e0ipso/ai-knowledge-base curate [--batch-size <n>] [--timeout <ms>]
```

Spawns `claude -p` under the hood, reads every session log that has been extracted (`proposal_status: done`) but not yet curated (no `curator_processed_at`), and applies the curator's decisions directly to `nodes/`:

- **add** → writes `nodes/<kind>/<id>.md`. Fails loud (recorded as `add_collision`) if the file already exists.
- **modify** → overwrites `nodes/<kind>/<target_node_id>.md`. Fails loud (recorded as `modify_missing_target`) if the target is missing.
- **contradict** → writes nothing to `nodes/`. Records one markdown file per conflict under `.ai/knowledge-base/conflicts/`.
- **drop** → no change.

At end-of-run, regenerates `INDEX.md` and `GRAPH.md` deterministically (no LLM).

The in-session equivalent is the `/kb-curate` skill. The skill runs the CLI, then walks any pending conflict files with the user (Accept / Reject / Keep as record) and applies the chosen resolution. Conflict resolution always goes through the user; the curator never auto-resolves.

Locking: takes the `curator` lock in `state.json` (30-min TTL). Distinct from the `bootstrap-incremental` lock, so the two CLIs do not block each other.

Per-spawn model selection from `curatorModel: { name, effort }` in `config.yaml`.
