import { existsSync, readFileSync } from 'node:fs';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { evaluateRebalance } from '../lib/rebalance.js';
import {
  applyRebalancePlan,
  RebalancePlanSchema,
  type RebalanceMoveResult,
} from '../lib/rebalance-move.js';
import { readStdin } from '../lib/stdin.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * Deterministic, LLM-free rebalance trigger command. Reads the live tree under
 * `nodes/`, computes Plan 1's per-folder metrics, applies the hysteresis-gated
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
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses claude`.'
    );
    return 1;
  }

  const decision = evaluateRebalance(paths.nodesDir);
  // Machine-readable contract: exactly the JSON decision on stdout, nothing
  // else. Use process.stdout (not `log`) so no prefix/color corrupts the JSON.
  process.stdout.write(`${JSON.stringify(decision)}\n`);
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
 * new ids and records a redirect), then drives Plan 1's deterministic rebuild
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
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses claude`.'
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
    return 1;
  }

  // Drive Plan 1's deterministic rebuild so the affected index nodes and
  // nodes_hash regenerate from the relocated leaves.
  const rebuildCode = await runIndexRebuild();
  if (rebuildCode !== 0) {
    log.error('rebalance move: index rebuild failed after applying moves; review with `git diff`.');
    return rebuildCode;
  }

  // Structural summary: the legend the human reads alongside the diff.
  process.stdout.write(`${JSON.stringify({ moves: results })}\n`);
  return 0;
}
