---
schema_version: 2
nodes_hash: 'sha256:ee4f4c956ca163481ff9acdc3aa210b0e171748453a248c5c6cd68458ee4672d'
node_count: 4
---
# kenkeep Index: cli

_4 node(s) in this folder • ~966 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **init does not install husky/lint-staged/secretlint/commitlint** [`cli/practice-init-does-not-install-commit-tooling.md`] init writes the knowledge base scaffold and the harness's hooks/skills only. Commit-time tooling (husky, lint-staged, secretlint, commitlint) is the consumer's responsibility. #init #install #scope
- **init and upgrade inject a static kk index pointer into AGENTS.md** [`cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md`] During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency. #init #upgrade #agents-md #index #markers
- **Inside the kenkeep source repo, run the CLI from dist/, not via npx** [`cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md`] In the kenkeep source repo, invoke node ./dist/cli.js (after npm run build) instead of npx kenkeep@latest. #kenkeep #kk-curate #repo-local #npx #cli

## Components (what exists)
- **updateAgentsMd - kk index pointer injection into AGENTS.md** [`cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md`] Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md. #init #upgrade #agents-md #markers #index

## By topic

- **#init (3):** init does not install husky/lint-staged/secretlint/commitlint, init and upgrade inject a static kk index pointer into AGENTS.md, updateAgentsMd - kk index pointer injection into AGENTS.md
- **#agents-md (2):** init and upgrade inject a static kk index pointer into AGENTS.md, updateAgentsMd - kk index pointer injection into AGENTS.md
- **#index (2):** init and upgrade inject a static kk index pointer into AGENTS.md, updateAgentsMd - kk index pointer injection into AGENTS.md
- **#markers (2):** init and upgrade inject a static kk index pointer into AGENTS.md, updateAgentsMd - kk index pointer injection into AGENTS.md
- **#upgrade (2):** init and upgrade inject a static kk index pointer into AGENTS.md, updateAgentsMd - kk index pointer injection into AGENTS.md
- **#cli (1):** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **#install (1):** init does not install husky/lint-staged/secretlint/commitlint
- **#kenkeep (1):** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **#kk-curate (1):** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **#npx (1):** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **#repo-local (1):** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **#scope (1):** init does not install husky/lint-staged/secretlint/commitlint
