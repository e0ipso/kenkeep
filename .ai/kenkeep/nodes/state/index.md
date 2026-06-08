---
schema_version: 2
nodes_hash: 'sha256:421835fc136f940292b7e85b97eada1d812e3b0d0fd19069397acac4a675ab27'
node_count: 2
summary: >-
  the on-disk session logs and runtime state files that track capture, proposal,
  and lock state
---
# kenkeep Index: state

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
_None yet._

## Components (what exists)
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) to learn about: Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases. #session #capture #state #schema
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) to learn about: Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at. #state #lock #schema

## By topic

### #schema
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](curation/map-conflict-files.md) — Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit.
### #state
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #capture
- Open [**kk-capture.mjs (capture hook)**](hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline. Wired per-harness.
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #lock
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
### #session
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
