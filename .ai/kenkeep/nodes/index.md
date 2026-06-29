---
schema_version: 2
nodes_hash: 'sha256:12621a375d1dcbe79422b48502ea8398b6c593ffbc2d8141b323293164e5d061'
node_count: 1
---
# kenkeep Index

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
- Load [`bootstrap/`](bootstrap/index.md) for more information on seeding the knowledge base from existing docs via /kk-bootstrap; read when bootstrapping a repo or folding new docs in.
- Load [`cli/`](cli/index.md) for more information on the init/upgrade commands and AGENTS.md pointer injection; read when changing the CLI surface or install behavior.
- Load [`config-and-prompts/`](config-and-prompts/index.md) for more information on config.yaml settings and the prompt templates with their versioning; read when adding a setting or touching a prompt.
- Load [`conventions/`](conventions/index.md) for more information on commit, release, testing, CI, and writing-style rules; read before committing, releasing, or writing docs.
- Load [`curation/`](curation/index.md) for more information on the curator pipeline from proposals to nodes, including conflicts; read when changing curation, dedup, or conflict handling.
- Load [`harnesses/`](harnesses/index.md) for more information on the five harness adapters and their isolation rules; read before adding a harness, changing hook wiring, or debugging a host integration.
- Load [`hooks/`](hooks/index.md) for more information on the capture, session-start, drain, and lint-tick hooks and how they are built; read when changing any hook behavior.
- Load [`index/`](index/index.md) for more information on the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when touching index generation or staleness checks.
- Load [`node-schema/`](node-schema/index.md) for more information on node frontmatter, naming, and schema-version rules; read before changing any node field or bumping the schema.
- Load [`overview/`](overview/index.md) for more information on what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to the project.
- Load [`state/`](state/index.md) for more information on session logs and runtime state files; read when changing capture state, locks, or proposal tracking.

## Conventions (how we build)
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) to learn about: Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown. #templates #prompts #knowledge-base #build

## Components (what exists)
_None yet._

## By topic

### #build
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #knowledge-base
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #prompts
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md first, then the bundled fallback. Delete the override to revert.
- Open [**Curator drops non-productive and change-oriented candidates**](curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
### #templates
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
