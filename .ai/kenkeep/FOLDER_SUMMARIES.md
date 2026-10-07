---
schema_version: 1
summaries:
  bootstrap: >-
    seeding the knowledge base from existing docs via /kk-bootstrap; read when
    bootstrapping a repo or folding new docs in
  cli: >-
    the init/upgrade commands and AGENTS.md pointer injection; read when
    changing the CLI surface or install behavior
  config-and-prompts: >-
    config.yaml settings and the prompt templates with their versioning; read
    when adding a setting or touching a prompt
  conventions: >-
    commit, release, testing, CI, and writing-style rules; read before
    committing, releasing, or writing docs
  curation: >-
    the curator pipeline from proposals to nodes, including conflicts; read when
    changing curation, dedup, or conflict handling
  harnesses: >-
    the five harness adapters and their isolation rules; read before adding a
    harness, changing hook wiring, or debugging a host integration
  hooks: >-
    the capture, session-start, drain, and lint-tick hooks and how they are
    built; read when changing any hook behavior
  index: >-
    the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when
    touching index generation or staleness checks
  node-schema: >-
    node frontmatter, naming, and schema-version rules; read before changing any
    node field or bumping the schema
  overview: >-
    what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to
    the project
  pack: 'Knowledge pack import, export, manifest, and safety rules.'
  state: >-
    session logs and runtime state files; read when changing capture state,
    locks, or proposal tracking
---
# kenkeep Folder Summaries

- `bootstrap`: seeding the knowledge base from existing docs via /kk-bootstrap; read when bootstrapping a repo or folding new docs in
- `cli`: the init/upgrade commands and AGENTS.md pointer injection; read when changing the CLI surface or install behavior
- `config-and-prompts`: config.yaml settings and the prompt templates with their versioning; read when adding a setting or touching a prompt
- `conventions`: commit, release, testing, CI, and writing-style rules; read before committing, releasing, or writing docs
- `curation`: the curator pipeline from proposals to nodes, including conflicts; read when changing curation, dedup, or conflict handling
- `harnesses`: the five harness adapters and their isolation rules; read before adding a harness, changing hook wiring, or debugging a host integration
- `hooks`: the capture, session-start, drain, and lint-tick hooks and how they are built; read when changing any hook behavior
- `index`: the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when touching index generation or staleness checks
- `node-schema`: node frontmatter, naming, and schema-version rules; read before changing any node field or bumping the schema
- `overview`: what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to the project
- `pack`: Knowledge pack import, export, manifest, and safety rules.
- `state`: session logs and runtime state files; read when changing capture state, locks, or proposal tracking
