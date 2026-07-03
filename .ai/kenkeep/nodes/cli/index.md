# kenkeep Index: cli

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](practice-init-does-not-install-commit-tooling.md) to learn about: init writes only the KB scaffold and the harness's hooks/skills; commit-time tooling (husky, lint-staged, commitlint) is the consumer's job. #init #install #scope
- Open [**Skills-first documentation, only init is CLI**](practice-skills-first-documentation-only-init-is-cli.md) to learn about: Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow. #documentation #skills #cli
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) to learn about: During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency. #init #upgrade #agents-md #index #markers
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) to learn about: In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest. #kenkeep #kk-curate #repo-local #npx #cli
- Open [**Surface schema mismatch errors on both init and node-read paths**](practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) to learn about: Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute. #kenkeep #migration #schema #error #cli
- Open [**Use a single generic migrate command for schema bumps**](practice-use-a-single-generic-migrate-command-for-schema-bumps.md) to learn about: One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump. #migration #cli #schema

## Components (what exists)
- Open [**migrate command — schema v1 to v2 migration**](map-migrate-command-schema-v1-to-v2-migration.md) to learn about: The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2. #kenkeep #migration #cli
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) to learn about: Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md. #init #upgrade #agents-md #markers #index

## By topic

### #cli
- Open [**migrate command — schema v1 to v2 migration**](map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #init
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](practice-init-does-not-install-commit-tooling.md) — init writes only the KB scaffold and the harness's hooks/skills; commit-time tooling (husky, lint-staged, commitlint) is the consumer's job.
### #kenkeep
- Open [**migrate command — schema v1 to v2 migration**](map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Surface schema mismatch errors on both init and node-read paths**](practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
- Open [**Curate CLI conflict output names the three resolution outcomes**](../curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
### #migration
- Open [**migrate command — schema v1 to v2 migration**](map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #agents-md
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](../index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branches. Injected each session by kk-session-start; regenerated deterministically from nodes/.
### #markers
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema validates the manifest; knowledge/ is a nodes/-shaped tree.
- Open [**Use a single generic migrate command for schema bumps**](practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #upgrade
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #documentation
- Open [**Skills-first documentation, only init is CLI**](practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Consumers are responsible for secret hygiene**](../conventions/practice-consumers-are-responsible-for-secret-hygiene.md) — kenkeep does not scan or redact secrets in the capture pipeline; secret hygiene is the consumer's responsibility.
- Open [**Avoid harness favoritism in examples and recommendations**](../config-and-prompts/practice-document-model-recommendations-with-harness-agnostic-framing-2.md) — Generated or documented examples and model recommendations must not favor one harness; use neutral placeholders or per-harness examples.
### #error
- Open [**Surface schema mismatch errors on both init and node-read paths**](practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #install
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](practice-init-does-not-install-commit-tooling.md) — init writes only the KB scaffold and the harness's hooks/skills; commit-time tooling (husky, lint-staged, commitlint) is the consumer's job.
### #kk-curate
- Open [**Curate CLI conflict output names the three resolution outcomes**](../curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #npx
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #repo-local
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #scope
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](practice-init-does-not-install-commit-tooling.md) — init writes only the KB scaffold and the harness's hooks/skills; commit-time tooling (husky, lint-staged, commitlint) is the consumer's job.
### #skills
- Open [**Skills-first documentation, only init is CLI**](practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Shipped skills and hook scripts must be self-contained**](../hooks/practice-shipped-skills-and-hook-scripts-must-be-self-contained.md) — Skills, CLI launchers, and hook scripts may use only Node built-ins and relative-path references — no external file dependencies.
- Open [**kk-session-extract**](../curation/map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.