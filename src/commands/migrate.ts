import { log } from '../lib/log.js';
import { detectSchemaVersion, MIGRATION_STEPS, planMigration } from '../lib/migrate.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { NODE_SCHEMA_VERSION } from '../lib/schemas.js';

/**
 * Deterministic, LLM-free dispatch primitive: reports which migrations are
 * pending without ever executing one. Detects the on-disk schema version and,
 * when the knowledge base lags behind `NODE_SCHEMA_VERSION`, resolves the
 * ordered step chain from the registry and emits it as a single JSON line for
 * the in-host `kk-migrate` skill to dispatch on:
 *
 *   {"current":1,"target":2,"steps":[{"id":"flat-to-tree","from":1,"to":2,"primitives":["place inventory","place apply"]}]}
 *
 * When the knowledge base is already current (or absent) it reports "nothing
 * to do" and exits 0, mirroring `place inventory`'s short-circuits. An
 * unbridgeable gap (no registered step from the detected version) fails
 * loudly with a non-zero exit. The JSON payload is written with
 * `process.stdout` (not `log`) so no prefix/color corrupts it — mirroring
 * `place inventory`'s machine-readable contract.
 */
export async function runMigrateStatus(): Promise<number> {
  const paths = repoPaths(findRepoRoot());

  const current = detectSchemaVersion(paths.nodesDir);
  if (current === null) {
    log.plain('No knowledge base found under nodes/; nothing to do.');
    return 0;
  }
  if (current >= NODE_SCHEMA_VERSION) {
    log.plain(`Knowledge base is already at schema_version ${current}; nothing to do.`);
    return 0;
  }

  // Migration is due: resolve the ordered pending chain. A gap in the registry
  // (no step from the detected version) throws — surface it and exit non-zero
  // rather than report an incomplete chain.
  let steps;
  try {
    steps = planMigration(MIGRATION_STEPS, current, NODE_SCHEMA_VERSION);
  } catch (err) {
    log.error(`migrate status: ${(err as Error).message}`);
    return 1;
  }

  // Machine-readable contract: exactly one JSON line on stdout, nothing else.
  // Use process.stdout (not `log`) so no prefix/color corrupts the JSON.
  const payload = {
    current,
    target: NODE_SCHEMA_VERSION,
    steps: steps.map(s => ({ id: s.id, from: s.from, to: s.to, primitives: s.primitives })),
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  return 0;
}
