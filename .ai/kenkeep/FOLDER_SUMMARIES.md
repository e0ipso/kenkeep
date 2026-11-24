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
  conventions/development: >-
    source-of-truth, dogfooding, testing, formatting and scoping rules for work
    in this repo; read before editing harness dirs, writing tests or scoping a
    change
  conventions/git-and-release: >-
    commit, push, review, release and CI rules; read before committing, pushing,
    releasing or editing CI workflows
  conventions/writing-style: >-
    prose rules for docs, the README and nodes; read before writing or editing
    documentation
  curation: >-
    the curator pipeline from proposals to nodes, including conflicts; read when
    changing curation, dedup, or conflict handling
  harnesses: >-
    the five harness adapters and their isolation rules; read before adding a
    harness, changing hook wiring, or debugging a host integration
  harnesses/adapters: >-
    the adapter contract, each host's adapter and host-specific hook gotchas;
    read when changing one host's integration
  harnesses/cross-harness: >-
    adapter isolation rules and --harness flag selection; read before adding a
    harness or building a cross-harness feature
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
- `conventions/development`: source-of-truth, dogfooding, testing, formatting and scoping rules for work in this repo; read before editing harness dirs, writing tests or scoping a change
- `conventions/git-and-release`: commit, push, review, release and CI rules; read before committing, pushing, releasing or editing CI workflows
- `conventions/writing-style`: prose rules for docs, the README and nodes; read before writing or editing documentation
- `curation`: the curator pipeline from proposals to nodes, including conflicts; read when changing curation, dedup, or conflict handling
- `harnesses`: the five harness adapters and their isolation rules; read before adding a harness, changing hook wiring, or debugging a host integration
- `harnesses/adapters`: the adapter contract, each host's adapter and host-specific hook gotchas; read when changing one host's integration
- `harnesses/cross-harness`: adapter isolation rules and --harness flag selection; read before adding a harness or building a cross-harness feature
- `hooks`: the capture, session-start, drain, and lint-tick hooks and how they are built; read when changing any hook behavior
- `index`: the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when touching index generation or staleness checks
- `node-schema`: node frontmatter, naming, and schema-version rules; read before changing any node field or bumping the schema
- `overview`: what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to the project
- `pack`: Knowledge pack import, export, manifest, and safety rules.
- `state`: session logs and runtime state files; read when changing capture state, locks, or proposal tracking
