---
schema_version: 2
nodes_hash: 'sha256:20e01bb51b879e6353324adca8c52f5ba71f0e5d443aea773429ac96fd54f407'
node_count: 69
---
# kenkeep

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Branches
- Load [`bootstrap/`](nodes/bootstrap/index.md) for more information on seeding the knowledge base from existing docs via /kk-bootstrap; read when bootstrapping a repo or folding new docs in.
- Load [`cli/`](nodes/cli/index.md) for more information on the init/upgrade commands and AGENTS.md pointer injection; read when changing the CLI surface or install behavior.
- Load [`config-and-prompts/`](nodes/config-and-prompts/index.md) for more information on config.yaml settings and the prompt templates with their versioning; read when adding a setting or touching a prompt.
- Load [`conventions/`](nodes/conventions/index.md) for more information on commit, release, testing, CI, and writing-style rules; read before committing, releasing, or writing docs.
- Load [`curation/`](nodes/curation/index.md) for more information on the curator pipeline from proposals to nodes, including conflicts; read when changing curation, dedup, or conflict handling.
- Load [`harnesses/`](nodes/harnesses/index.md) for more information on the five harness adapters and their isolation rules; read before adding a harness, changing hook wiring, or debugging a host integration.
- Load [`hooks/`](nodes/hooks/index.md) for more information on the capture, session-start, drain, and lint-tick hooks and how they are built; read when changing any hook behavior.
- Load [`index/`](nodes/index/index.md) for more information on the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when touching index generation or staleness checks.
- Load [`node-schema/`](nodes/node-schema/index.md) for more information on node frontmatter, naming, and schema-version rules; read before changing any node field or bumping the schema.
- Load [`overview/`](nodes/overview/index.md) for more information on what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to the project.
- Load [`state/`](nodes/state/index.md) for more information on session logs and runtime state files; read when changing capture state, locks, or proposal tracking.

## Conventions (how we build)
- Open [**Keep template partials out of the knowledge base**](nodes/practice-keep-template-partials-out-of-the-knowledge-base.md) to learn about: Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown. #templates #prompts #knowledge-base #build
