import { existsSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { readConflictFile, resolveConflictPath, writeConflictFile } from '../lib/conflicts.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { modifyNodeInPlace } from '../lib/node-modify.js';
import { findNodeById } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  ConflictDecisionSchema,
  OPEN_CONFLICT_STATUSES,
  type ConflictDecision,
  type ConflictFrontmatter,
  type ConflictStatus,
} from '../lib/schemas.js';

export interface ConflictResolveOptions {
  /** The human's decision. When omitted, the `default_decision` stamped by `conflict prepare`. */
  decision?: string | undefined;
  /** Override the conflicts directory. Defaults to repoPaths(...).conflictsDir. */
  conflictsDir?: string | undefined;
  /** Override the nodes directory. Defaults to repoPaths(...).nodesDir. */
  nodesDir?: string | undefined;
}

interface ResolveReport {
  id: string;
  file: string;
  decision: ConflictDecision;
  status: ConflictStatus;
  target_node_id: string;
  /** The target's current path relative to `nodes/`, or `null` when it is missing. */
  target_path: string | null;
  decided_at: string | null;
  error?: string;
}

const STATUS_FOR: Record<ConflictDecision, ConflictStatus> = {
  accept: 'accepted',
  reject: 'rejected',
  keep: 'kept',
  skip: 'skipped',
};

function relPath(from: string, to: string): string {
  return relative(from, to).split(sep).join('/');
}

/**
 * Deterministic conflict-resolution primitive: applies one recorded human
 * decision to one open conflict file. `accept` rewrites the existing target in
 * place through the same modify path as `curate-persist` (same id, same
 * folder, never a new node) and records `accepted`; `reject`, `keep` and
 * `skip` touch no node and record `rejected`, `kept` and `skipped`. A skipped
 * conflict stays open and resurfaces in `conflict prepare`. The primitive
 * never asks and never chooses: with no `--decision` it applies the
 * `default_decision` that `conflict prepare` stamped, and refuses when none
 * was recorded.
 *
 * Output contract: one JSON document on stdout. Input problems (unknown
 * conflict, legacy shape, bad decision, already resolved) exit 1 with the
 * reason on stderr and nothing on stdout. A decision that cannot be applied
 * (missing target, type mismatch, no proposal to accept) exits 1 with the
 * document carrying `error` and the unchanged `status`, so the skill can show
 * the human exactly what did not happen.
 */
export async function runConflictResolveCommand(
  ref: string,
  opts: ConflictResolveOptions = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const conflictsDir = opts.conflictsDir ?? paths.conflictsDir;
  const nodesDir = opts.nodesDir ?? paths.nodesDir;

  let file: string;
  try {
    file = resolveConflictPath(conflictsDir, ref);
  } catch (err) {
    log.error(`conflict resolve: ${(err as Error).message}`);
    return 1;
  }

  const read = readConflictFile(file);
  if (!read.ok) {
    log.error(`conflict resolve: ${read.reason}`);
    return 1;
  }
  const fm = read.record.frontmatter;

  if (!OPEN_CONFLICT_STATUSES.has(fm.status)) {
    log.error(
      `conflict resolve: conflict "${fm.id}" is already ${fm.status}; nothing to apply. Delete the file or leave it as a record.`
    );
    return 1;
  }

  let decision: ConflictDecision;
  if (opts.decision !== undefined && opts.decision !== '') {
    const checked = ConflictDecisionSchema.safeParse(opts.decision);
    if (!checked.success) {
      log.error(
        `conflict resolve: --decision must be one of ${ConflictDecisionSchema.options.join('|')}, got "${opts.decision}".`
      );
      return 1;
    }
    decision = checked.data;
  } else if (fm.default_decision !== null) {
    decision = fm.default_decision;
  } else {
    log.error(
      `conflict resolve: conflict "${fm.id}" has no recorded default. Run \`conflict prepare\` first (it stamps default_decision) or pass --decision <accept|reject|keep|skip>.`
    );
    return 1;
  }

  let targetPath: string | null;
  try {
    const target = findNodeById(nodesDir, fm.target_node_id);
    targetPath = target ? target.relPath : null;
  } catch (err) {
    log.error(`conflict resolve: cannot read nodes: ${(err as Error).message}`);
    return 1;
  }

  const report: ResolveReport = {
    id: fm.id,
    file,
    decision,
    status: fm.status,
    target_node_id: fm.target_node_id,
    target_path: targetPath,
    decided_at: null,
  };

  const fail = (error: string): number => {
    report.error = error;
    writeJsonDocument(report);
    return 1;
  };

  if (decision === 'accept') {
    if (fm.proposal === null) {
      return fail(
        `conflict "${fm.id}" carries no proposal to accept; decide reject, keep or skip instead`
      );
    }
    let outcome;
    try {
      outcome = modifyNodeInPlace(nodesDir, fm.target_node_id, fm.candidate_origin, fm.proposal);
    } catch (err) {
      return fail(`cannot rewrite target "${fm.target_node_id}": ${(err as Error).message}`);
    }
    if (!outcome.ok) return fail(outcome.reason);
    report.target_path = relPath(nodesDir, outcome.filePath);
  }

  const decidedAt = new Date().toISOString();
  const updated: ConflictFrontmatter = {
    ...fm,
    status: STATUS_FOR[decision],
    decided_at: decidedAt,
  };
  try {
    writeConflictFile(conflictsDir, file, updated);
  } catch (err) {
    return fail(
      `decision applied to the target but the conflict file could not be updated: ${(err as Error).message}`
    );
  }

  report.status = updated.status;
  report.decided_at = decidedAt;
  writeJsonDocument(report);
  return 0;
}
