---
schema_version: 2
nodes_hash: 'sha256:148d1f3a9a955820302587f8f1297b8f698e0eb75f096e5111e296b1e701350f'
node_count: 6
---
# kenkeep Index: hooks

_6 node(s) in this folder • ~2298 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child** [`hooks/practice-recursion-guard-kenkeep-builder-internal.md`] The CLI launchers (bootstrap, curate, node add) and the proposal-drain hook must set KENKEEP_BUILDER_INTERNAL=1 on the harness child they exec so the nested session's SessionStart hooks do not re-fire. #recursion #hooks #env
- **Hook status messages include kk prefix after emoji** [`hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md`] All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source. #hooks #messaging #ux

## Components (what exists)
- **kk-proposal-drain (extraction hook)** [`hooks/map-proposal-drain-hook.md`] Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead. #hooks #extraction #llm #async #claude #billing
- **kk-session-start.mjs (consume hook)** [`hooks/map-session-start-hook.md`] Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext. #hooks #consume #sessionstart #index
- **kk-capture.mjs (capture hook)** [`hooks/map-capture-hook.md`] Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline. Wired per-harness. #hooks #capture
- **Hook build pipeline: TS sources to deployed .cjs bundles** [`hooks/map-hook-build-pipeline-ts-to-cjs.md`] tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory. #build #hooks #tsup #templates #cjs

## By topic

- **#hooks (6):** kk-proposal-drain (extraction hook), kk-session-start.mjs (consume hook), kk-capture.mjs (capture hook), CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child, Hook build pipeline: TS sources to deployed .cjs bundles, Hook status messages include kk prefix after emoji
- **#async (1):** kk-proposal-drain (extraction hook)
- **#billing (1):** kk-proposal-drain (extraction hook)
- **#build (1):** Hook build pipeline: TS sources to deployed .cjs bundles
- **#capture (1):** kk-capture.mjs (capture hook)
- **#cjs (1):** Hook build pipeline: TS sources to deployed .cjs bundles
- **#claude (1):** kk-proposal-drain (extraction hook)
- **#consume (1):** kk-session-start.mjs (consume hook)
- **#env (1):** CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child
- **#extraction (1):** kk-proposal-drain (extraction hook)
- **#index (1):** kk-session-start.mjs (consume hook)
- **#llm (1):** kk-proposal-drain (extraction hook)
- **#messaging (1):** Hook status messages include kk prefix after emoji
- **#recursion (1):** CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child
- **#sessionstart (1):** kk-session-start.mjs (consume hook)
- **#templates (1):** Hook build pipeline: TS sources to deployed .cjs bundles
- **#tsup (1):** Hook build pipeline: TS sources to deployed .cjs bundles
- **#ux (1):** Hook status messages include kk prefix after emoji
