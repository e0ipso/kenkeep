import { existsSync } from 'node:fs';
import {
  assertConflictWritable,
  computeConflictDefault,
  conflictsLocation,
  readOpenConflicts,
  writeConflictFile,
  type ConflictRecord,
} from '../lib/conflicts.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { findNodeById } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import type { ConflictFrontmatter } from '../lib/schemas.js';

export interface ConflictPrepareOptions {
  /** Override the conflicts directory. Defaults to repoPaths(...).conflictsDir. */
  conflictsDir?: string | undefined;
  /** Override the nodes directory. Defaults to repoPaths(...).nodesDir. */
  nodesDir?: string | undefined;
}

interface RenderedExisting {
  id: string;
  path: string;
  title: string;
  summary: string;
  body: string;
}

interface PreparedConflict extends ConflictFrontmatter {
  /** False when there is nothing to accept: the human only decides the target's fate. */
  has_proposal: boolean;
  group_id: number;
  first_in_group: boolean;
  /** The target as it is on disk, rendered once per group; `null` when missing. */
  existing: RenderedExisting | null;
  lines_changed: number;
  total_lines: number;
  ratio: number;
  /** The displayed default; identical to the `default_decision` stamped on the file. */
  default: 'accept' | 'reject' | 'skip';
}

/** Stable string comparison (code-point) returning -1/0/1. */
function cmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Presentation order: `target_node_id`, then the proposal's kind, then
 * `detected_at`. Consecutive conflicts sharing a target form a group so the
 * skill renders the existing node once.
 */
function conflictOrder(a: ConflictRecord, b: ConflictRecord): number {
  const t = cmp(a.frontmatter.target_node_id, b.frontmatter.target_node_id);
  if (t !== 0) return t;
  const k = cmp(a.frontmatter.proposal?.type ?? '', b.frontmatter.proposal?.type ?? '');
  if (k !== 0) return k;
  return cmp(a.frontmatter.detected_at, b.frontmatter.detected_at);
}

/**
 * Deterministic conflict-preparation primitive. Reads every open conflict
 * (`pending` or `skipped`), computes each one's default reply with the
 * diff-ratio rules against the target as it is on disk, stamps that default
 * on the conflict file (`default_decision`) so an empty reply later applies
 * exactly what was displayed, and prints the sorted/grouped JSON document the
 * kk-curate skill renders. It never asks the user and never decides: the
 * only write is the default stamp, and only when it changed.
 *
 * Exit 1 with every problem on stderr and nothing on stdout when any open
 * conflict file is unparseable, invalid or in the legacy unversioned shape.
 */
export async function runConflictPrepareCommand(
  opts: ConflictPrepareOptions = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const conflicts = conflictsLocation(root, paths.conflictsDir, opts.conflictsDir);
  const nodesDir = opts.nodesDir ?? paths.nodesDir;

  let open;
  try {
    open = readOpenConflicts(conflicts.dir);
  } catch (err) {
    log.error(`conflict prepare: cannot read conflicts directory: ${(err as Error).message}`);
    return 1;
  }
  if (open.problems.length > 0) {
    for (const p of open.problems) log.error(`conflict prepare: ${p.reason}`);
    return 1;
  }

  const sorted = [...open.conflicts].sort(conflictOrder);
  const prepared: PreparedConflict[] = [];
  const stamps: Array<{ file: string; fm: ConflictFrontmatter }> = [];
  let groupId = 0;
  let prevTarget: string | null = null;

  for (const record of sorted) {
    const fm = record.frontmatter;
    const firstInGroup = fm.target_node_id !== prevTarget;
    if (firstInGroup) groupId += 1;
    prevTarget = fm.target_node_id;

    let existing: RenderedExisting | null = null;
    try {
      const node = findNodeById(nodesDir, fm.target_node_id);
      if (node) {
        existing = {
          id: node.frontmatter.kk_id,
          path: `nodes/${node.relPath}`,
          title: node.frontmatter.title,
          summary: node.frontmatter.description,
          body: node.body,
        };
      }
    } catch (err) {
      log.error(`conflict prepare: cannot read nodes: ${(err as Error).message}`);
      return 1;
    }

    const def = computeConflictDefault(existing ? existing.body : null, fm);

    // Record the displayed default so `conflict resolve` with no decision
    // applies this exact value. Idempotent: rewrite only on change.
    const stamped: ConflictFrontmatter = { ...fm, default_decision: def.default };
    if (fm.default_decision !== def.default) stamps.push({ file: record.file, fm: stamped });

    prepared.push({
      ...stamped,
      has_proposal: fm.proposal !== null,
      group_id: groupId,
      first_in_group: firstInGroup,
      // Render the existing node only once per group (the first conflict).
      existing: firstInGroup ? existing : null,
      lines_changed: def.lines_changed,
      total_lines: def.total_lines,
      ratio: def.ratio,
      default: def.default,
    });
  }

  // Every stamp target passes the write boundary before the first stamp, so
  // a linked file later in the order cannot leave earlier stamps behind.
  for (const { file } of stamps) {
    try {
      assertConflictWritable(conflicts, file);
    } catch (err) {
      log.error(`conflict prepare: cannot stamp ${file}: ${(err as Error).message}`);
      return 1;
    }
  }
  for (const { file, fm } of stamps) {
    try {
      writeConflictFile(conflicts, file, fm);
    } catch (err) {
      log.error(`conflict prepare: cannot stamp ${file}: ${(err as Error).message}`);
      return 1;
    }
  }

  writeJsonDocument({ count: prepared.length, conflicts: prepared });
  return 0;
}
