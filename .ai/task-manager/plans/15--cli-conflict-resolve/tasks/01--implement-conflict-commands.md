---
id: 1
group: "cli-commands"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---

# Implement `src/commands/conflict.ts` with `list` and `resolve` subcommand entry points

## Objective

Create a new CLI module that owns the two `conflict` subcommand entry points (`runConflictList` and `runConflictResolve`). The module performs every file mutation the `kb-curate` skill currently asks the LLM to do: filtering the pending-conflicts JSON, overwriting the old node on `replace`, and regenerating `INDEX.md` / `GRAPH.md`.

## Skills Required

- `typescript`: write a new TypeScript module following the existing `src/commands/*.ts` shape (commander entry, repoPaths, zod-validated state, atomic writes).

## Acceptance Criteria

- [ ] New file `src/commands/conflict.ts` exists and compiles under `tsc --noEmit`.
- [ ] Exports `runConflictList(): Promise<number>` that prints the conflicts array as JSON to stdout (or `[]` when the file is missing or `conflicts: []`) and resolves to exit code `0`. Schema-validation failures print a clear error to stderr and resolve to a non-zero code.
- [ ] Exports `runConflictResolve(opts: { conflictId: string; action: 'replace' | 'reject' }): Promise<number>`. The function:
  - Loads and validates `pending-conflicts.json` via `PendingConflictsFileSchema`.
  - Exits non-zero with `unknown conflict id <id>` on stderr when no entry matches.
  - On `action === 'replace'`: refuses (non-zero, no mutation) when `proposed_node` is null or when the target node file does not exist on disk; otherwise `unlinkSync`s the existing node file and calls `writeNodeFile` with frontmatter built from `proposed_node`.
  - On `action === 'reject'`: performs no node-side work.
  - In both success branches, atomically rewrites `pending-conflicts.json` with the resolved entry removed (tmp + rename), then regenerates `INDEX.md` and `GRAPH.md`, then prints `replaced <id>` or `rejected <id>` to stdout and exits `0`.
- [ ] Writes happen in this order: node-side write (if any) → atomic JSON rewrite → INDEX/GRAPH regen. A crash between steps leaves the resolution idempotently re-runnable.
- [ ] No new third-party dependencies are introduced.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Resolve paths via `repoPaths(findRepoRoot())` (`src/lib/paths.ts:23, 71`), reading `pending-conflicts.json` from `paths.stateDir`.
- Validate the file with `PendingConflictsFileSchema` (`src/lib/schemas.ts:229`).
- Build frontmatter the same way `buildNodeFrontmatter` does in `src/lib/curate.ts:475` (id, title, kind, tags, derived_from, relates_to, confidence, summary, schema_version: 1). Either copy that small function inline or export it from `src/lib/curate.ts` and import it; do not invent a new shape.
- Call `writeNodeFile` from `src/lib/nodes.ts:197` to write the proposed node body (it validates frontmatter and writes atomically).
- Locate node files with `nodeFilePath` / `nodeFileExists` from `src/lib/nodes.ts:168, 172`.
- For INDEX/GRAPH regen, use `generateIndex`, `generateGraph`, `writeIndex`, `writeGraph` from `src/lib/index-gen.ts:111, 167, 201, 205` directly against `paths.nodesDir` and `paths.kbDir`. Do not export the private `regenerateIndexAndGraph` from `src/lib/curate.ts` (the four-call sequence is short enough to inline; see `src/commands/index-rebuild.ts:65` for the same pattern).
- Atomically rewrite the JSON file by writing to a sibling `.tmp` path with the final content (`JSON.stringify(payload, null, 2) + '\n'`, payload shape `{ schema_version: 1, conflicts: <filtered> }`) and then `renameSync` over the target. The pattern lives at `src/lib/proposal-drain.ts:311`; duplicate it inline rather than exporting the private helper.
- Use `log.error` for stderr-style messages (matches `src/commands/index-rebuild.ts` style) and `console.log` / `process.stdout.write` for the JSON output `conflict list` emits (the skill consumes it via JSON.parse, so it must be plain JSON on stdout, not log-decorated).

## Input Dependencies

None. All schemas, path helpers, and node-write helpers already exist.

## Output Artifacts

- `src/commands/conflict.ts` exporting `runConflictList` and `runConflictResolve`.

## Implementation Notes

<details>
<summary>Implementation walkthrough</summary>

Skeleton:

```ts
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { nodeFileExists, nodeFilePath, writeNodeFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  type ConflictReport,
  type NodeFrontmatter,
  PendingConflictsFileSchema,
} from '../lib/schemas.js';

export async function runConflictList(): Promise<number> {
  const paths = repoPaths(findRepoRoot());
  const file = join(paths.stateDir, 'pending-conflicts.json');
  if (!existsSync(file)) {
    process.stdout.write('[]\n');
    return 0;
  }
  const parsed = PendingConflictsFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    log.error(`pending-conflicts.json failed schema validation: ${parsed.error.message}`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(parsed.data.conflicts, null, 2)}\n`);
  return 0;
}

export async function runConflictResolve(opts: {
  conflictId: string;
  action: 'replace' | 'reject';
}): Promise<number> {
  const paths = repoPaths(findRepoRoot());
  const file = join(paths.stateDir, 'pending-conflicts.json');
  if (!existsSync(file)) {
    log.error(`unknown conflict id ${opts.conflictId}`);
    return 1;
  }
  const parsed = PendingConflictsFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    log.error(`pending-conflicts.json failed schema validation: ${parsed.error.message}`);
    return 1;
  }
  const entry = parsed.data.conflicts.find(c => c.id === opts.conflictId);
  if (!entry) {
    log.error(`unknown conflict id ${opts.conflictId}`);
    return 1;
  }

  if (opts.action === 'replace') {
    if (!entry.proposed_node) {
      log.error(`conflict ${opts.conflictId} has no proposed_node; cannot replace`);
      return 1;
    }
    if (entry.target_node_id === null) {
      log.error(`conflict ${opts.conflictId} has no target_node_id; cannot replace`);
      return 1;
    }
    const kind = entry.proposed_node.kind;
    const existingPath = nodeFilePath(paths.nodesDir, kind, entry.target_node_id);
    if (!nodeFileExists(paths.nodesDir, kind, entry.target_node_id)) {
      log.error(`replace target ${entry.target_node_id}.md missing on disk`);
      return 1;
    }
    unlinkSync(existingPath);
    const frontmatter: NodeFrontmatter = {
      schema_version: 1,
      id: entry.proposed_node.id,
      title: entry.proposed_node.title,
      kind: entry.proposed_node.kind,
      tags: entry.proposed_node.tags,
      derived_from: entry.proposed_node.derived_from,
      relates_to: entry.proposed_node.relates_to,
      confidence: entry.proposed_node.confidence,
      summary: entry.proposed_node.summary,
    };
    writeNodeFile({ nodesDir: paths.nodesDir, frontmatter, body: entry.proposed_node.body });
  }

  const remaining: ConflictReport[] = parsed.data.conflicts.filter(c => c.id !== opts.conflictId);
  atomicWriteJson(file, { schema_version: 1, conflicts: remaining });

  const index = generateIndex(paths.nodesDir);
  const graph = generateGraph(paths.nodesDir);
  writeIndex(join(paths.kbDir, 'INDEX.md'), index);
  writeGraph(join(paths.kbDir, 'GRAPH.md'), graph);

  process.stdout.write(`${opts.action === 'replace' ? 'replaced' : 'rejected'} ${opts.conflictId}\n`);
  return 0;
}

function atomicWriteJson(target: string, data: unknown): void {
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, target);
}
```

Notes:
- Do not introduce a `--force` flag or any extra options. The plan keeps the surface to `{ conflictId, action }`.
- Do not call `regenerateIndexAndGraph` from `src/lib/curate.ts` directly; it is private and inlining the four library calls is cheaper than exposing it.
- `process.stdout.write` (not `log.success` or `log.plain`) for the JSON / one-line result so the skill can parse it without log prefixes. Use `log.error` for failures so the existing CLI styling is preserved.
- The `entry.target_node_id === null` guard is required because `ConflictReport.target_node_id` is nullable per the schema (`src/lib/schemas.ts:223`); the curator currently only emits non-null targets for `contradict` actions but the schema allows null, so the CLI must refuse defensively here (this is the boundary, not internal code).

</details>
