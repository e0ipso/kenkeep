import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJson } from '../lib/fs-atomic.js';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { nodeFileExists, nodeFilePath, writeNodeFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  type CuratorProposedNode,
  type NodeFrontmatter,
  PendingConflictsFileSchema,
} from '../lib/schemas.js';

export type ConflictAction = 'replace' | 'reject';

export interface ConflictResolveOptions {
  conflictId: string;
  action: ConflictAction;
}

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

export async function runConflictResolve(opts: ConflictResolveOptions): Promise<number> {
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
    const proposed = entry.proposed_node;
    const existingPath = nodeFilePath(paths.nodesDir, proposed.kind, entry.target_node_id);
    if (!nodeFileExists(paths.nodesDir, proposed.kind, entry.target_node_id)) {
      log.error(`replace target ${entry.target_node_id}.md missing on disk`);
      return 1;
    }
    unlinkSync(existingPath);
    const frontmatter = buildNodeFrontmatter(proposed);
    writeNodeFile({ nodesDir: paths.nodesDir, frontmatter, body: proposed.body });
  }

  const remaining = parsed.data.conflicts.filter(c => c.id !== opts.conflictId);
  atomicWriteJson(file, { schema_version: 1, conflicts: remaining });

  const index = generateIndex(paths.nodesDir);
  const graph = generateGraph(paths.nodesDir);
  writeIndex(join(paths.kbDir, 'INDEX.md'), index);
  writeGraph(join(paths.kbDir, 'GRAPH.md'), graph);

  process.stdout.write(
    `${opts.action === 'replace' ? 'replaced' : 'rejected'} ${opts.conflictId}\n`
  );
  return 0;
}

function buildNodeFrontmatter(proposed: CuratorProposedNode): NodeFrontmatter {
  return {
    schema_version: 1,
    id: proposed.id,
    title: proposed.title,
    kind: proposed.kind,
    tags: proposed.tags,
    derived_from: proposed.derived_from,
    relates_to: proposed.relates_to,
    confidence: proposed.confidence,
    summary: proposed.summary,
  };
}
