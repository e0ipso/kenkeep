---
title: Knowledge packs
nav_order: 5
---

# Knowledge packs

A pack is a reviewed `nodes/` tree published for a framework, platform, client, or internal system. Another repo imports it and gets the whole thing as one isolated branch. Import and export move markdown only. No LLM is involved.

<p align="center">
  <img src="{{ '/assets/diagrams/packs.svg' | relative_url }}" alt="A pack author exports their reviewed nodes tree into dist/ with pack export, publishes it as a GitHub release or tarball, and a consumer runs pack import to land it as one isolated branch under their own nodes tree" />
</p>

## Import a pack

From a repo where kenkeep is already initialized:

```sh
npx kenkeep pack import e0ipso/kenkeep-pack-drupal
npx kenkeep pack import https://github.com/e0ipso/kenkeep-pack-drupal --as drupal
npx kenkeep pack import ./kenkeep-pack-drupal.tar.gz
npx kenkeep pack import ./dist
```

A GitHub source resolves to the latest release tarball, or the default branch when there is no release. A tarball or directory must contain one `kenkeep-pack.yaml` at its root or inside one wrapping directory. The source is never modified.

The pack lands under `nodes/<name>/`, where `name` comes from the manifest unless you pass `--as`. If that folder already exists, import stops and asks for another name. A note whose id already exists in your repo is skipped with a warning. Nothing local is merged or overwritten.

A pack published against the previous node schema is rejected unless you add `--migrate`, which converts a copy and reports how many notes it changed. Older packs are rejected either way.

After the copy, import rebuilds `ENTRY.md`, `GRAPH.md`, and the folder indexes. It does not rebalance. Structural cleanup happens in the next `/kk-curate`, where you review it like any other change.

## Export a pack

1. Start a repo for the pack and add the docs it should teach.
2. Run `npx kenkeep init --harnesses <id>`, then `/kk-bootstrap` in a session.
3. Review and commit the notes.
4. Export:

```sh
npx kenkeep pack export \
  --name drupal \
  --version 1.0.0 \
  --summary "Drupal conventions for kenkeep-enabled projects" \
  --homepage https://github.com/e0ipso/kenkeep-pack-drupal
```

`--name`, `--version`, and `--summary` are required, and the command prompts for any you omit. `--out <dir>` changes the destination from `dist/`. Export runs the lint gate first. Lint errors block it and leave the previous output untouched. Findings print as warnings.

## Pack format

```text
<pack-root>/
|-- kenkeep-pack.yaml
|-- README.md
|-- knowledge.FOLDER_SUMMARIES.md
`-- knowledge/
```

```yaml
name: drupal
version: 1.0.0
schema_version: 3
summary: Drupal conventions for kenkeep-enabled projects
homepage: https://github.com/e0ipso/kenkeep-pack-drupal
```

`name` becomes `nodes/<name>/` unless import uses `--as`. `version` is recorded, not range-resolved. `schema_version` must match the installed node schema, or the one before it with `--migrate`. `summary` becomes the imported branch's description. `homepage` is optional.

`knowledge/` has the same shape as a `nodes/` tree and is the only content import reads. Folder descriptions travel in `knowledge.FOLDER_SUMMARIES.md`, and import re-keys them under the destination branch. A pack without that file still imports. The next index rebuild warns how many folders lack a description and shows the folder name instead.
