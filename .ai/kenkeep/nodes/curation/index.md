---
schema_version: 2
nodes_hash: 'sha256:6f6ed442ab2aa4427a1effcbdf360559f115e5785f8774707a0fb913c836eafa'
node_count: 8
summary: >-
  the curator pipeline from proposals to nodes, including conflicts; read when
  changing curation, dedup, or conflict handling
---
# kenkeep Index: curation

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) to learn about: Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate. #curator #conflicts #human-in-the-loop
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) to learn about: When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate. #kenkeep #kk-curate #conflicts #cli #ux
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) to learn about: Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak. #curator #prompts #calibration #anti-pattern

## Components (what exists)
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) to learn about: Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent. #cli #curate #skill
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](map-conflict-files.md) to learn about: Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit. #conflicts #curator #schema
- Open [**Curator action (add / modify / contradict / drop)**](map-curator-action.md) to learn about: Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/. #schema #curator #action
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) to learn about: Shape emitted by proposal-extract per practice/map candidate. supports_existing_node / contradicts_existing_node are the curator's join keys. #schema #proposal #candidate
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) to learn about: src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate. #cli #curate #conflicts #output

## By topic

### #conflicts
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](map-conflict-files.md) — Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit.
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) — Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate.
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
### #curator
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](map-conflict-files.md) — Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit.
- Open [**Curator action (add / modify / contradict / drop)**](map-curator-action.md) — Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/.
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) — Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate.
### #cli
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — Schema migrations are handled by one generic migrate command that detects the current schema and dispatches the appropriate step, not by separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #schema
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field.
- Open [**Node frontmatter schema**](../node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — Schema migrations are handled by one generic migrate command that detects the current schema and dispatches the appropriate step, not by separate commands per bump.
### #curate
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
### #action
- Open [**Curator action (add / modify / contradict / drop)**](map-curator-action.md) — Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/.
### #anti-pattern
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
### #calibration
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
- Open [**Default bootstrap nodes to confidence: medium**](../bootstrap/practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source doc states the rule with rationale and looks actively maintained.
### #candidate
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) — Shape emitted by proposal-extract per practice/map candidate. supports_existing_node / contradicts_existing_node are the curator's join keys.
### #human-in-the-loop
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) — Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate.
### #kenkeep
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
### #kk-curate
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](../cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #output
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
### #prompts
- Open [**Local prompt overrides fall back to bundled templates**](../config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
- Open [**Bump the prompt's Version comment on every behavior change**](../config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
### #proposal
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) — Shape emitted by proposal-extract per practice/map candidate. supports_existing_node / contradicts_existing_node are the curator's join keys.
### #skill
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
- Open [**/kk-bootstrap skill**](../bootstrap/map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit.
### #ux
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**Hook status messages include kk prefix after emoji**](../hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.
