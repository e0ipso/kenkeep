import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { SCHEMA_NAMES, resolveNamedSchema } from '../lib/schema-registry.js';

export interface DraftsCollectOptions {
  /** Run id whose `${RUN_ID}__*.draft.json` batch files are aggregated. */
  runId?: string | undefined;
  /** Registered schema name each batch array validates against. Defaults to curator-output. */
  schema?: string | undefined;
  /** Override the curator log directory. Defaults to `<logsDir>/curator`. */
  curatorDir?: string | undefined;
}

interface InvalidBatch {
  batchN: string;
  reason: string;
}

/** Parses the numeric batch index out of `${runId}__${N}.draft.json`. */
function batchIndex(prefix: string, filename: string): string {
  return filename.slice(prefix.length, filename.length - '.draft.json'.length);
}

function appendEvent(curatorDir: string, runId: string, batchN: string, event: object): void {
  const file = join(curatorDir, `${runId}__${batchN}.jsonl`);
  const line = JSON.stringify({ ts: new Date().toISOString(), runId, batchN, ...event });
  try {
    appendFileSync(file, `${line}\n`);
  } catch {
    // The audit line is best-effort; a write failure must not abort aggregation.
  }
}

/**
 * Deterministic per-batch draft collector for the curate parallel path. Reads
 * `${RUN_ID}__*.draft.json` under the curator log dir, validates each batch
 * array against the named Zod schema (default `curator-output`), concatenates
 * the survivors in batch order to stdout, and reports counts plus invalid
 * batches on stderr. A single malformed batch is skipped (not fatal), matching
 * the skill's "never abort the run" contract.
 */
export async function runDraftsCollectCommand(opts: DraftsCollectOptions = {}): Promise<number> {
  const runId = opts.runId;
  if (runId === undefined || runId === '') {
    log.error('drafts collect: --run-id is required.');
    return 1;
  }

  const schemaName = opts.schema ?? 'curator-output';
  const schema = resolveNamedSchema(schemaName);
  if (schema === undefined) {
    log.error(
      `drafts collect: unknown schema "${schemaName}". Available: ${SCHEMA_NAMES.join(', ')}`
    );
    return 1;
  }

  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const curatorDir = opts.curatorDir ?? join(paths.logsDir, 'curator');
  const prefix = `${runId}__`;

  let drafts: string[] = [];
  if (existsSync(curatorDir)) {
    drafts = readdirSync(curatorDir).filter(
      n => n.startsWith(prefix) && n.endsWith('.draft.json')
    );
  }
  if (drafts.length === 0) {
    log.error(`drafts collect: no draft files for run-id "${runId}" under ${curatorDir}.`);
    return 1;
  }

  // Deterministic batch order by numeric index (so __10 follows __9).
  drafts.sort((a, b) => {
    const na = Number(batchIndex(prefix, a));
    const nb = Number(batchIndex(prefix, b));
    if (Number.isNaN(na) || Number.isNaN(nb)) return a < b ? -1 : a > b ? 1 : 0;
    return na - nb;
  });

  mkdirSync(curatorDir, { recursive: true });

  const survivors: unknown[] = [];
  const invalid: InvalidBatch[] = [];
  let validBatches = 0;

  for (const filename of drafts) {
    const batchN = batchIndex(prefix, filename);
    let raw: string;
    try {
      raw = readFileSync(join(curatorDir, filename), 'utf8');
    } catch (err) {
      invalid.push({ batchN, reason: `unreadable: ${(err as Error).message}` });
      appendEvent(curatorDir, runId, batchN, { event: 'invalid', reason: 'unreadable' });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      invalid.push({ batchN, reason: `not valid JSON: ${(err as Error).message}` });
      appendEvent(curatorDir, runId, batchN, { event: 'invalid', reason: 'not valid JSON' });
      continue;
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      const reason = result.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      invalid.push({ batchN, reason });
      appendEvent(curatorDir, runId, batchN, { event: 'invalid', reason });
      continue;
    }

    const actions = result.data as unknown[];
    survivors.push(...actions);
    validBatches += 1;
    appendEvent(curatorDir, runId, batchN, { event: 'validated', count: actions.length });
  }

  // stdout carries the pure JSON array so the skill can redirect it into
  // $PROPOSALS; the human/diagnostic report goes to stderr.
  process.stdout.write(`${JSON.stringify(survivors)}\n`);
  log.info(
    `drafts collect: ${drafts.length} batch(es), ${validBatches} valid, ${invalid.length} invalid` +
      (invalid.length > 0 ? ` (skipped: ${invalid.map(b => b.batchN).join(', ')})` : '') +
      `; ${survivors.length} action(s) aggregated.`
  );
  for (const b of invalid) {
    log.warn(`drafts collect: batch ${b.batchN} produced invalid output, skipped — ${b.reason}`);
  }

  // Aggregation completed: success even when some batches were skipped.
  return 0;
}
