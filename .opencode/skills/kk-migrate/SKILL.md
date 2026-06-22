---
name: kk-migrate
description: Run any pending knowledge-base migration by querying the deterministic migration chain (`migrate status`) and executing each pending step's documented procedure in-host, with every write delegated to the step's deterministic CLI primitives. Use when the node reader, `doctor`, or `init` reports an out-of-date `schema_version` / legacy flat layout and asks you to migrate, or when the user asks to migrate the knowledge base.
---

<!-- Version: 5 -->

# kk-migrate

You are the migrator — for **any** pending knowledge-base migration, not one specific hop. The knowledge base stores its on-disk layout at a numbered `schema_version`, and each registered migration step takes the tree from one version to the next. Whatever judgment a step requires, you exercise **in this session**: there is no sub-agent, no runner, and no `-p` spawn — **you** are the LLM doing the judgment work. Every file write is delegated to the step's deterministic CLI primitives so ids and bytes are preserved by tested code, never by you.

## Resolve the active harness

Substitute your own best-guess id for `<hint>` based on the runtime you are running inside (one of `claude`, `codex`, `copilot`, `cursor`, `opencode`). Run the materialization block exactly as-is (it lazy-writes `/tmp/kk-detect-root.mjs` on first invocation):

```bash
if [ ! -f /tmp/kk-detect-root.mjs ]; then
cat << 'EOF' > /tmp/kk-detect-root.mjs
#!/usr/bin/env node
// kk-detect-root: resolves the project root containing .ai/kenkeep.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
let dir = process.cwd();
while (true) {
  if (existsSync(join(dir, '.ai', 'kenkeep'))) {
    process.stdout.write(dir);
    process.exit(0);
  }
  const parent = dirname(dir);
  if (parent === dir) {
    process.stderr.write('kk-detect-root: no .ai/kenkeep found in this directory or its parents.\n');
    process.exit(2);
  }
  dir = parent;
}
EOF
fi
KK_REPO_ROOT=$(node /tmp/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
HARNESS=$(node .ai/kenkeep/scripts/kk-detect-harness.mjs --hint <hint> --root "$KK_REPO_ROOT")
pwd
```

`$HARNESS` is not consumed by the `place` primitives, but `index rebuild` (the closing command of the flat-to-tree procedure) requires it. Treat the printed path as the working directory for every command below.

## Dispatch

Before anything else, ask the CLI which migrations are pending:

```bash
npx --yes kenkeep@latest migrate status
```

- If it prints a line like `Knowledge base is already at schema_version 2; nothing to do.` (or `No knowledge base found under nodes/; nothing to do.`), there is nothing to migrate. **Stop** and report that one line to the user. Do nothing else.
- Otherwise stdout is exactly one JSON line — the ordered chain of pending steps:

  ```
  {"current":1,"target":2,"steps":[{"id":"flat-to-tree","from":1,"to":2,"primitives":["place inventory","place apply"]}]}
  ```

  `current` is the detected on-disk schema version, `target` is the version this CLI ships, and `steps` is every step needed to bridge the gap, in execution order. Each entry carries the step's stable `id`, the `from`/`to` versions it bridges, and the deterministic CLI `primitives` it drives.

For each `steps[]` entry, **in order**, find the procedure section below whose heading carries that exact `id` and execute it. If no section in this document matches a step's `id`, **stop and report to the user** that this copy of the skill predates the registered step: the CLI knows a migration this skill copy cannot yet perform, so the skill must be upgraded (re-run `init --upgrade`) before migrating. Never improvise a procedure for an unknown step id.

## flat-to-tree (1 -> 2)

Migrates a v1 knowledge base — leaves stored in a flat `nodes/practice/` and `nodes/map/` layout — to the v2 nested topical folder tree. The one judgment call is clustering the flat leaves into topical folders; every write goes through the `place apply` primitive.

### 1. Get the inventory

Run the deterministic inventory primitive and capture stdout:

```bash
npx --yes kenkeep@latest place inventory
```

Dispatch already established this step is due, so expect exactly one JSON line. (If the primitive short-circuits or refuses instead — the tree changed since dispatch — stop and report its output to the user.)

```
{"leaves":[{"id":"<id>","title":"...","kind":"practice|map","tags":["..."],"summary":"...","relates_to":["..."],"sourcePath":"..."}, ...]}
```

This is your input. The primitive read and validated the frontmatter for you — cluster this JSON; never open or parse the leaf files yourself.

### 2. Cluster the leaves in-session

Group the leaves from the inventory into a small set of topical folders. Apply these rules:

- **Topical folders, small set.** Group related leaves into a small set of topical folders. A folder name is lowercase and dash-separated, and may nest with `/` (e.g. `cli`, `knowledge-base/index`). Do not create a folder per leaf; cluster.
- **Keep cross-referencing nodes close.** Leaves that reference each other (via `relates_to`) generally belong near each other.
- **Preserve every id exactly.** Every leaf in the inventory gets exactly one placement, and you place it under its exact `id` — never invent, rename, drop, or merge an id. The id is the node's identity; the folder is presentation only.
- **Author one `summary` per created folder.** For each distinct folder you use, write a one-line `summary`: a noun phrase / sentence fragment that completes "for more information on &lt;summary&gt;" (lowercase start, no trailing period, ≤ ~140 chars). Name what lives in the folder, then append a short `; read when <task pattern>` clause naming the tasks that should trigger descent — agents route by matching their task against these summaries, so the trigger clause is what makes descent reliable.

Assemble the placement-and-folders document. It must match the exact shape `place apply` parses:

```json
{
  "placements": [{ "id": "<leaf-id>", "targetFolder": "<folder>" }],
  "folders": [{ "folder": "<folder>", "summary": "<fragment>" }]
}
```

One placement for **every** leaf in the inventory, and one `folders` entry for **every** distinct `targetFolder` you used. (A leaf you want to leave at the `nodes/` root takes `"targetFolder": ""` and needs no `folders` entry for the empty root.)

**Surface the proposed grouping to the user for review** before applying: show the folder tree and which ids land in each folder, plus each folder's authored summary. This is a one-shot, high-impact reorganization of the whole KB — let the user steer it before any write.

### 3. Apply the placement deterministically

Write your document to a tmpfile and hand it to the deterministic apply primitive:

```bash
PLACE_PLAN=$(mktemp -t kk-place-plan.XXXXXX.json)
# Write your {"placements":[...],"folders":[...]} document to $PLACE_PLAN.
npx --yes kenkeep@latest place apply --input "$PLACE_PLAN"
```

The primitive validates every id against the leaves actually on disk and every authored folder summary against the folders the placements create — **before any write** — then relocates each leaf with its id and bytes preserved (only `schema_version` bumps) and stamps each folder summary into that folder's `index.md`. A bad plan (an unknown/omitted id, or a summary keyed to a folder no leaf is placed into) aborts with a clear message and makes **zero** filesystem changes; fix the document and re-run. Do not relocate files or stamp summaries yourself.

On success it prints one JSON line, the placement summary:

```
{"placed":[{"id":"<id>","targetFolder":"<folder>"}, ...]}
```

### 4. Rebuild the indices

Regenerate `ENTRY.md`, `GRAPH.md`, and every folder `index.md` from the relocated tree:

```bash
npx --yes kenkeep@latest index rebuild --harness "$HARNESS"
```

The rebuild self-preserves the folder summaries you stamped in step 3. A folder you left without an authored summary renders the Title-cased folder-name fallback; `index rebuild` warns and exits zero (warn, never block).

### 5. Hand off

Tell the user the migration is staged in the working tree and **no git command was run**. They review the result with:

```bash
git diff
```

Leaves moved into their topical folders show as renames (ids and bytes preserved); each created folder's `index.md` carries its authored summary; `ENTRY.md` / `GRAPH.md` are refreshed. The user accepts the migration with `git commit` and rejects it with `git restore` (path-scoped or whole-tree). Do not stage, commit, or restore anything yourself.

## Constraints

- **In-host only.** The judgment work runs in this session. There is no sub-agent and no `-p` spawn; do not dispatch one.
- **Never write node files directly.** Every file mutation goes through a step's deterministic primitive — in flat-to-tree, every leaf relocation and every folder-summary stamp goes through `place apply`. You only author the JSON documents the primitives consume.
- **Never invoke git.** Not `add`, not `commit`, not `restore`. The migration is left as an uncommitted diff for the human to accept or reject.
- **Ids and edges are sacred.** Every leaf keeps its exact id and every edge; a primitive's validation aborts before any write if a plan would drop, rename, or omit one.
- **Full migration requires this interactive session.** There is no headless/unattended migration; the judgment steps need you, the in-session agent.
