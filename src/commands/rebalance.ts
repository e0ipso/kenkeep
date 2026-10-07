import { existsSync, readFileSync } from 'node:fs';
import { openConflictTargetIds } from '../lib/conflicts.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { evaluateRebalance } from '../lib/rebalance.js';
import {
  applyRebalancePlan,
  RebalanceApplyError,
  RebalancePlanSchema,
  type RebalanceMoveResult,
} from '../lib/rebalance-move.js';
import { readStdin } from '../lib/stdin.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * Deterministic, LLM-free rebalance trigger command. Reads the live tree under
 * `nodes/`, computes the per-folder metrics, applies the hysteresis-gated
 * decision rules, and prints a stable JSON decision to stdout:
 *
 *   {"actions":[{"branch":"<path>","operation":"<class>"}, ...]}
 *
 * or `{"actions":[]}` when nothing trips past the hysteresis margin. The output
 * is byte-identical for identical tree input (sorted, no clock, no randomness,
 * no LLM) so the curate skill can branch on it and so tests can assert it. When
 * `actions` is empty the caller skips the expensive LLM clustering phase
 * entirely (zero added cost).
 */
export async function runRebalanceTrigger(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  // Targets of open human conflicts are held stable until the human decides
  // (`conflict resolve`): they never become split-leaf/create-branch candidates.
  const decision = evaluateRebalance(paths.nodesDir, {
    protectedLeafIds: openConflictTargetIds(paths.conflictsDir),
  });
  // Machine output: exactly the JSON decision on stdout, nothing else.
  writeJsonDocument(decision);
  return 0;
}

export interface RebalanceMoveOptions {
  /** Path to the operation-plan JSON; reads stdin when omitted. */
  input?: string;
}

/**
 * Deterministic move primitive. Reads a caller-supplied operation plan
 * (RebalancePlanSchema) from `--input` or stdin and applies the four structural
 * operations as content-byte-stable, id-stable git renames (split-leaf mints
 * new ids and records a redirect), then drives the deterministic rebuild
 * of the affected index nodes and nodes_hash. It executes the plan only; it
 * performs no clustering judgment, no LLM call, and never stages or commits.
 * The combined diff is left uncommitted for the human (commit accepts,
 * path-scoped restore rejects).
 *
 * Emits the structural summary (the legend for the structural diff) as JSON on
 * stdout so the curate skill can surface it.
 */
export async function runRebalanceMove(opts: RebalanceMoveOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const raw = opts.input ? readFileSync(opts.input, 'utf8') : await readStdin();
  if (raw.trim() === '') {
    log.error('rebalance move: no operation plan provided (pass --input <file> or pipe JSON).');
    return 1;
  }

  let plan;
  try {
    plan = RebalancePlanSchema.parse(JSON.parse(raw));
  } catch (err) {
    log.error(`rebalance move: invalid operation plan: ${(err as Error).message}`);
    return 1;
  }

  let results: RebalanceMoveResult[];
  try {
    results = applyRebalancePlan(paths.nodesDir, plan);
  } catch (err) {
    log.error(`rebalance move: ${(err as Error).message}`);
    if (err instanceof RebalanceApplyError) {
      log.error(
        'rebalance move: the plan was applied only partially and no index was rebuilt. ' +
          'stdout lists the moves that landed; `git status` shows every changed and new file. ' +
          'Reverse them, or keep them and run `npx kenkeep index rebuild`.'
      );
      writeJsonDocument({ error: err.message, moves: err.completedMoves });
    }
    return 1;
  }

  // Drive the deterministic rebuild so the affected index nodes and
  // nodes_hash regenerate from the relocated leaves. Its report goes to stderr
  // so the structural summary stays the only thing on stdout.
  const rebuildCode = await runIndexRebuild({ logger: log });
  if (rebuildCode !== 0) {
    log.error('rebalance move: index rebuild failed after applying moves; review with `git diff`.');
    return rebuildCode;
  }

  // Structural summary: the legend the human reads alongside the diff.
  writeJsonDocument({ moves: results });
  return 0;
}
