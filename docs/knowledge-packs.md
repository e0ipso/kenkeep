---
title: Knowledge packs
nav_order: 5
---

# Knowledge packs

Knowledge packs are portable, reviewed `nodes/` trees. They let a team publish
domain knowledge for a framework, platform, client, or internal system, then let
another repo graft that knowledge into its own `.ai/kenkeep/nodes/` tree.

Pack import and export are CLI workflows by design. They move already-reviewed
markdown and do not ask an LLM to curate, summarize, or rebalance anything. The
skills-first rule still applies to authoring new knowledge: use `/kk-bootstrap`,
`/kk-curate`, and `/kk-add` to create or refine nodes, then use `pack export` to
publish the reviewed result.

## Import a pack

Run import from a repo that already has kenkeep initialized:

```sh
npx kenkeep pack import e0ipso/kenkeep-pack-drupal
```

The source can be any of these forms:

```sh
npx kenkeep pack import e0ipso/kenkeep-pack-drupal
npx kenkeep pack import https://github.com/e0ipso/kenkeep-pack-drupal
npx kenkeep pack import ./kenkeep-pack-drupal.tar.gz
```

For GitHub sources, kenkeep first asks GitHub for the latest release tarball. If
the repo has no latest release, it falls back to the repository default branch
tarball. Local `.tar.gz` sources are extracted locally and must contain exactly
one `kenkeep-pack.yaml` at the pack root or inside one wrapping directory.

By default, the destination branch name under `nodes/` comes from the manifest
`name`. Use `--as` to override it:

```sh
npx kenkeep pack import e0ipso/kenkeep-pack-drupal --as drupal
```

Import validates the manifest and every knowledge node, then copies only the
pack's `knowledge/` markdown into `.ai/kenkeep/nodes/<name>/`. The imported pack
lands as one isolated branch. If `nodes/<name>/` already exists, import stops
and asks you to choose another name with `--as`.

If a pack leaf has the same node id as one already present in the consumer repo,
kenkeep skips that leaf and prints a warning listing the skipped ids. It does not
merge or overwrite reviewed local knowledge.

After the graft, import rebuilds `ENTRY.md`, `GRAPH.md`, and folder indexes.
Import does not rebalance the tree. Structural cleanup happens later through the
normal `/kk-curate` rebalance phase, where it is reviewed in the same git diff as
other knowledge-base changes.

## Export a pack

Author a pack in an ordinary repository:

1. Create a new folder or repository for the pack.
2. Add source docs, READMEs, ADRs, or other material the pack should teach.
3. Run `npx kenkeep init --harnesses <id>` and seed the knowledge base with the
   supervised `/kk-bootstrap` workflow.
4. Review the generated `.ai/kenkeep/nodes/` changes with `git diff`, curate or
   edit as needed, and commit the reviewed nodes.
5. Run `npx kenkeep pack export`.

Export turns the current `.ai/kenkeep/nodes/` tree into a publishable pack under
`dist/` by default:

```sh
npx kenkeep pack export \
  --name drupal \
  --version 1.0.0 \
  --summary "Drupal conventions for kenkeep-enabled projects" \
  --homepage https://github.com/e0ipso/kenkeep-pack-drupal
```

`--name`, `--version`, and `--summary` are required. If you omit any of them,
the command prompts for the missing values. `--homepage` is optional and is
included only when supplied. `--out <dir>` changes the output directory; the
default is `dist/`.

The command copies `nodes/` to `dist/knowledge/`, writes
`dist/kenkeep-pack.yaml`, and writes a minimal `dist/README.md`. It auto-stamps
`schema_version` from the installed kenkeep node schema, so the manifest tracks
the version the current CLI can validate.

Before replacing the output directory, export runs the same knowledge-base lint
gate against the copied `knowledge/` tree. Lint errors block the export and leave
the previous output untouched. Lint findings are printed as warnings, but do not
block the pack.

## Pack format

A pack repository root has this layout:

```text
<pack-root>/
|-- kenkeep-pack.yaml
|-- README.md
`-- knowledge/
```

`kenkeep-pack.yaml` is the manifest:

```yaml
name: drupal
version: 1.0.0
schema_version: 2
summary: Drupal conventions for kenkeep-enabled projects
homepage: https://github.com/e0ipso/kenkeep-pack-drupal
```

Manifest fields:

| Field | Required | Meaning |
|---|---:|---|
| `name` | Yes | Lowercase pack slug. It becomes `nodes/<name>/` unless import uses `--as`. |
| `version` | Yes | Pack version string. Kenkeep records and validates it, but does not resolve version ranges. |
| `schema_version` | Yes | Must equal the installed kenkeep node schema version. Export writes this automatically. |
| `summary` | Yes | One-line pack summary. Import uses it as the imported branch summary when needed. |
| `homepage` | No | URL for pack docs or source. |

`README.md` is for humans and is ignored by import. `knowledge/` is the only
content import reads. It contains the same shape as a kenkeep `nodes/` tree:
topical folders, `practice-*` and `map-*` leaf nodes, and generated per-folder
`index.md` files. Folder `index.md` summaries survive the import rebuild, so pack
authors can describe branches before publishing.
