import { existsSync } from 'node:fs';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { evaluateRebalance } from '../lib/rebalance.js';

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
