---
schema_version: 2
nodes_hash: 'sha256:041193d91dac8a0861ecb567d2c7b6227bc5d5a1bc0c5e1434dd14aca594f06f'
node_count: 2
summary: >-
  the kenkeep npm package, what it does, and the on-disk .ai/kenkeep/ directory
  layout
---
# kenkeep Index: overview

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
_None yet._

## Components (what exists)
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) to learn about: Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, conflicts/. #layout #state #directory
- Open [**kenkeep npm package**](map-kenkeep-package.md) to learn about: Per-repo knowledge base built from AI sessions; installs hooks, captures redacted slices, lets a curator write nodes/, injects ENTRY into every new session. #overview #package #npm

## By topic

### #directory
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) — Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, conflicts/.
### #layout
- Open [**.ai/kenkeep/ directory layout**](map-kenkeep-directory.md) — Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, conflicts/.
### #npm
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base built from AI sessions; installs hooks, captures redacted slices, lets a curator write nodes/, injects ENTRY into every new session.
### #overview
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base built from AI sessions; installs hooks, captures redacted slices, lets a curator write nodes/, injects ENTRY into every new session.
### #package
- Open [**kenkeep npm package**](map-kenkeep-package.md) — Per-repo knowledge base built from AI sessions; installs hooks, captures redacted slices, lets a curator write nodes/, injects ENTRY into every new session.
### #state
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](../bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**Session log (_sessions/*.md)**](../state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
