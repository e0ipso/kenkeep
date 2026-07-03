# kenkeep Index: curation

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) to learn about: Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate. #curator #conflicts #human-in-the-loop
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) to learn about: When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate. #kenkeep #kk-curate #conflicts #cli #ux
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) to learn about: Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak. #curator #prompts #calibration #anti-pattern

## Components (what exists)
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) to learn about: Runs the curator on processed session logs, applying add/modify/contradict/drop actions to nodes/. /kk-curate is the in-session equivalent. #cli #curate #skill
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](map-conflict-files.md) to learn about: Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit. #conflicts #curator #schema
- Open [**Curator action (add / modify / contradict / drop)**](map-curator-action.md) to learn about: Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/. #schema #curator #action
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) to learn about: Shape emitted by proposal-extract per practice/map candidate; supports_existing_node/contradicts_existing_node are the curator's join keys. #schema #proposal #candidate
- Open [**curate-dedup scoped session mode**](map-curate-dedup-scoped-session-mode.md) to learn about: \`curate-dedup --session-id\` stamps only the matching done session log. #curation #dedup #sessions
- Open [**kk-session-extract**](map-kk-session-extract.md) to learn about: Shared skill for extracting durable knowledge from the visible live session and immediately curating it. #skills #curation #sessions
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
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema validates the manifest; knowledge/ is a nodes/-shaped tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #curate
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) — Runs the curator on processed session logs, applying add/modify/contradict/drop actions to nodes/. /kk-curate is the in-session equivalent.
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
### #curation
- Open [**curate-dedup scoped session mode**](map-curate-dedup-scoped-session-mode.md) — \`curate-dedup --session-id\` stamps only the matching done session log.
- Open [**kk-session-extract**](map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.
- Open [**session-log stage-live**](../state/map-session-log-stage-live.md) — Deterministic CLI primitive that stages live proposal JSON into a done session log.
### #sessions
- Open [**curate-dedup scoped session mode**](map-curate-dedup-scoped-session-mode.md) — \`curate-dedup --session-id\` stamps only the matching done session log.
- Open [**kk-session-extract**](map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.
### #action
- Open [**Curator action (add / modify / contradict / drop)**](map-curator-action.md) — Curator emits an array of {action, candidate_origin, target_node_id, proposed_node, rationale}. Wrapper applies each directly to nodes/.
### #anti-pattern
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak.
### #calibration
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak.
- Open [**Default bootstrap nodes to confidence: medium**](../bootstrap/practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source states the rule with rationale and looks actively maintained.
### #candidate
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) — Shape emitted by proposal-extract per practice/map candidate; supports_existing_node/contradicts_existing_node are the curator's join keys.
### #dedup
- Open [**curate-dedup scoped session mode**](map-curate-dedup-scoped-session-mode.md) — \`curate-dedup --session-id\` stamps only the matching done session log.
### #human-in-the-loop
- Open [**Curator never auto-resolves contradictions**](practice-curator-never-auto-resolves-contradictions.md) — Curator emits contradict; the wrapper writes a conflict file and writes nothing to nodes/. Resolution is always user-driven via /kk-curate.
### #kenkeep
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
### #kk-curate
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](../cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #output
- Open [**curate CLI conflict-resolution output message**](map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
### #prompts
- Open [**Bump the prompt's Version comment on every behavior change**](../config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record it so audits stay coherent.
- Open [**Local prompt overrides fall back to bundled templates**](../config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md, then the bundled fallback; delete the override to revert.
- Open [**Curator drops non-productive and change-oriented candidates**](practice-curator-drops-non-productive-candidates.md) — Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak.
### #proposal
- Open [**Proposal candidate schema**](map-proposal-candidate-schema.md) — Shape emitted by proposal-extract per practice/map candidate; supports_existing_node/contradicts_existing_node are the curator's join keys.
### #skill
- Open [**curate (CLI command + /kk-curate skill)**](map-curate-command.md) — Runs the curator on processed session logs, applying add/modify/contradict/drop actions to nodes/. /kk-curate is the in-session equivalent.
- Open [**/kk-bootstrap skill**](../bootstrap/map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap: surveys docs and writes practice/map nodes under nodes/. Reviewer accepts via git commit.
### #skills
- Open [**Skills-first documentation, only init is CLI**](../cli/practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Shipped skills and hook scripts must be self-contained**](../hooks/practice-shipped-skills-and-hook-scripts-must-be-self-contained.md) — Skills, CLI launchers, and hook scripts may use only Node built-ins and relative-path references — no external file dependencies.
- Open [**kk-session-extract**](map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.
### #ux
- Open [**Curate CLI conflict output names the three resolution outcomes**](practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
- Open [**Hook status messages include kk prefix after emoji**](../hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.