---
schema_version: 2
nodes_hash: 'sha256:163b56837ee0804a75fdb62b0a1dbc679040f600c3fcf7028252e43875ede0cd'
node_count: 58
---
# kenkeep

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Branches
- Load [`bootstrap/`](nodes/bootstrap/index.md) for more information on seeding the knowledge base from existing docs via /kk-bootstrap and the bootstrap-incremental command.
- Load [`cli/`](nodes/cli/index.md) for more information on the CLI init and upgrade commands, AGENTS.md pointer injection, and how to run the CLI locally.
- Load [`config-and-prompts/`](nodes/config-and-prompts/index.md) for more information on config.yaml project settings and the prompt templates, their versioning, and local overrides.
- Load [`conventions/`](nodes/conventions/index.md) for more information on project-wide conventions for commits, releases, testing, CI, writing style, and reviewing nodes via git.
- Load [`curation/`](nodes/curation/index.md) for more information on the curator pipeline that turns proposals into nodes, including conflict handling and the /kk-curate flow.
- Load [`harnesses/`](nodes/harnesses/index.md) for more information on the per-runtime harness adapters (claude, codex, cursor, opencode, copilot) and the rules keeping them isolated.
- Load [`hooks/`](nodes/hooks/index.md) for more information on the capture, session-start, and proposal-drain hooks, how they are built, and the conventions they follow.
- Load [`index/`](nodes/index/index.md) for more information on the deterministic ENTRY.md and GRAPH.md indexes and the nodes_hash that drives their regeneration.
- Load [`node-schema/`](nodes/node-schema/index.md) for more information on the node frontmatter schema, the nodes/ directory model, and the naming and schema-version rules.
- Load [`overview/`](nodes/overview/index.md) for more information on the kenkeep npm package, what it does, and the on-disk .ai/kenkeep/ directory layout.
- Load [`state/`](nodes/state/index.md) for more information on the on-disk session logs and runtime state files that track capture, proposal, and lock state.

## Conventions (how we build)
- Open [**Never force push**](practice-never-force-push.md) to learn about: Force pushing rewrites remote history and can lose collaborators' work. #git #conventions
