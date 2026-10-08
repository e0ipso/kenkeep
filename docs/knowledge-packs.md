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

From a repo where kenkeep is already initialized and committed:

```sh
npx kenkeep pack import e0ipso/kenkeep-pack-drupal
npx kenkeep pack import https://github.com/e0ipso/kenkeep-pack-drupal --as drupal
npx kenkeep pack import ./kenkeep-pack-drupal.tar.gz
npx kenkeep pack import ./dist
```

A GitHub source resolves to the latest release tarball, or the default branch when there is no release. A tarball or directory must contain one `kenkeep-pack.yaml` at its root or inside one wrapping directory. The source is never modified.

The pack lands under `nodes/<name>/`, where `name` comes from the manifest unless you pass `--as`. If that folder already exists, import stops and asks for another name. Nothing local is merged or overwritten.

Import checks the whole pack before it writes anything, and stops with an error when:

- The manifest, `knowledge/`, the folder summary file, or any file under `knowledge/` is a symlink. The check runs before import reads anything, so a link is never followed, even one that points at a valid file.
- A pack note id matches a note id in your tree, or one your tree retired. Import does not skip it or bind the pack's edges to your note. Pick a different pack or rename the note by hand.
- A `kk_relates_to` or `kk_depends_on` edge resolves to nothing in the pack plus your tree. A pack may point at a base pack you already imported.
- The pack's `knowledge/.redirects.json` is malformed, or maps a retired id differently from your own ledger.

Notes are copied byte for byte. A pack's own `index.md` files are never imported, and the rebuild generates every index from the notes that arrive. The pack's redirects merge into your `nodes/.redirects.json`, so a note that was split before export still resolves. If one of your notes links to an id the pack retired, import re-renders that link onto the successor note inside the graft. The summary prints `Redirects merged: N`.

Import refuses to start unless git can undo it. The repo must be a git work tree, and `.ai/kenkeep/` and `AGENTS.md` must have no uncommitted or untracked changes. The refusal names the dirty paths; commit or stash them and run the import again. If a write then fails partway, import prints the two git commands that put `.ai/kenkeep/` and `AGENTS.md` back to `HEAD` (`git restore --source=HEAD --staged --worktree` and `git clean -fd`). Run them, fix the cause, and import again.

A pack published against the previous node schema is rejected unless you add `--migrate`, which converts a copy and reports how many notes it changed. Older packs are rejected either way.

After the copy, import refreshes the Related and Citations links of the notes it grafted, then rebuilds `ENTRY.md`, `GRAPH.md`, and the folder indexes. It does not rebalance. Structural cleanup happens in the next `/kk-curate`, where you review it like any other change.

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

Export writes only its own entries: `kenkeep-pack.yaml`, `README.md`, `knowledge/` and `knowledge.FOLDER_SUMMARIES.md`. Anything else in the output directory stays, so you can keep the pack's git repository, license and CI files there and export into it again. `--out` must be missing, empty, or a pack you exported before. Export refuses a symlink, any other non-empty directory, and a path inside `.ai/kenkeep`.

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

`knowledge/` has the same shape as a `nodes/` tree, including its `.redirects.json` when notes were split, and is the only content import reads. Folder descriptions travel in `knowledge.FOLDER_SUMMARIES.md`, and import re-keys them under the destination branch. A pack without that file still imports. The next index rebuild warns how many folders lack a description and shows the folder name instead.
