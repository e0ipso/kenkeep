# kenkeep Index: state

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
_None yet._

## Components (what exists)
- Open [**Session log (_sessions/*.md)**](map-session-log.md) to learn about: Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id; frontmatter tracks capture, proposal, and curator phases. #session #capture #state #schema
- Open [**session-log stage-live**](map-session-log-stage-live.md) to learn about: Deterministic CLI primitive that stages live proposal JSON into a done session log. #session-log #cli #curation
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) to learn about: Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field. #state #lock #schema
- Open [**Usage ledger depends on successful capture**](map-usage-ledger-depends-on-successful-capture.md) to learn about: usage.jsonl records node reads only from sessions whose capture hook persists usage rows. #usage #capture #state #hooks

## By topic

### #state
- Open [**Session log (_sessions/*.md)**](map-session-log.md) — Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id; frontmatter tracks capture, proposal, and curator phases.
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](../bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
### #capture
- Open [**kk-capture.mjs (capture hook)**](../hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Usage ledger depends on successful capture**](map-usage-ledger-depends-on-successful-capture.md) — usage.jsonl records node reads only from sessions whose capture hook persists usage rows.
- Open [**Add hermetic end-to-end capture tests per harness**](../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema validates the manifest; knowledge/ is a nodes/-shaped tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #cli
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #curation
- Open [**curate-dedup scoped session mode**](../curation/map-curate-dedup-scoped-session-mode.md) — \`curate-dedup --session-id\` stamps only the matching done session log.
- Open [**kk-session-extract**](../curation/map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.
- Open [**session-log stage-live**](map-session-log-stage-live.md) — Deterministic CLI primitive that stages live proposal JSON into a done session log.
### #hooks
- Open [**Claude Code harness adapter**](../harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Cursor harness adapter**](../harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](../harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #lock
- Open [**.state/state.json (lock + nudge state)**](map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #session
- Open [**Session log (_sessions/*.md)**](map-session-log.md) — Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id; frontmatter tracks capture, proposal, and curator phases.
### #session-log
- Open [**session-log stage-live**](map-session-log-stage-live.md) — Deterministic CLI primitive that stages live proposal JSON into a done session log.
### #usage
- Open [**Usage ledger depends on successful capture**](map-usage-ledger-depends-on-successful-capture.md) — usage.jsonl records node reads only from sessions whose capture hook persists usage rows.