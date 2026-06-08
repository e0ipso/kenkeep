---
schema_version: 2
nodes_hash: 'sha256:b8fa8d34015e8a14245b3ee28bc40c25aabb7d54612eaca36da65251f53d2f08'
node_count: 4
summary: >-
  the CLI init and upgrade commands, AGENTS.md pointer injection, and how to run
  the CLI locally
---
# kenkeep Index: cli

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](cli/practice-init-does-not-install-commit-tooling.md) to learn about: init writes the knowledge base scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility. #init #install #scope
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) to learn about: During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency. #init #upgrade #agents-md #index #markers
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) to learn about: In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest. #kenkeep #kk-curate #repo-local #npx #cli

## Components (what exists)
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) to learn about: Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md. #init #upgrade #agents-md #markers #index

## By topic

### #init
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](cli/practice-init-does-not-install-commit-tooling.md) — init writes the knowledge base scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility.
### #agents-md
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
### #markers
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #upgrade
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
### #cli
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**curate CLI conflict-resolution output message**](curation/map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
- Open [**curate (CLI command + /kk-curate skill)**](curation/map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
### #install
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](cli/practice-init-does-not-install-commit-tooling.md) — init writes the knowledge base scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility.
### #kenkeep
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #kk-curate
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #npx
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #repo-local
- Open [**Inside the kenkeep source repo, run the CLI from dist/, not via npx**](cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md) — In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest.
### #scope
- Open [**init does not install husky/lint-staged/secretlint/commitlint**](cli/practice-init-does-not-install-commit-tooling.md) — init writes the knowledge base scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility.
