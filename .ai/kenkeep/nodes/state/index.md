---
schema_version: 2
nodes_hash: 'sha256:731dbb7e4239449d48496e8c93a25d8b635e64e1aa8e10a7938cd3ec271a9808'
node_count: 2
summary: >-
  session logs and runtime state files; read when changing capture state, locks,
  or proposal tracking
---
# kenkeep Index: state

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
_None yet._

## Components (what exists)
- Open [**Session log (_sessions/*.md)**](map-session-log.md) to learn about: Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases. #session #capture #state #schema
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) to learn about: Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field. #state #lock #schema

## By topic

### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A knowledge pack root carries kenkeep-pack.yaml, README.md, and knowledge/; the manifest is validated by PackManifestSchema and knowledge/ is a nodes/ shaped markdown tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — Schema migrations are handled by one generic migrate command that detects the current schema and dispatches the appropriate step, not by separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field.
### #state
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](../bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**Session log (_sessions/*.md)**](map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #capture
- Open [**kk-capture.mjs (capture hook)**](../hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Add hermetic end-to-end capture tests per harness**](../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
- Open [**Session log (_sessions/*.md)**](map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #lock
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field.
### #session
- Open [**Session log (_sessions/*.md)**](map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
