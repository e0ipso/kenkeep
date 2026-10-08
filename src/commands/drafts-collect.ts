import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CuratorDraftSchema,
  appendBatchEvent,
  unresolvedOrigins,
  type ConsumedSession,
} from '../lib/curate-manifest.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { assertValidRunId } from '../lib/path-safety.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export interface DraftsCollectOptions {
  /** Run id whose `${RUN_ID}__*.draft.json` batch drafts are collected. */
  runId?: string | undefined;
  /** Override the curator log directory. Defaults to `<logsDir>/curator`. */
  curatorDir?: string | undefined;
}

export interface BatchReport {
  batch: number;
  status: 'valid' | 'invalid';
  /** Present for every invalid batch. */
  reason?: string;
}

/** The single JSON document `drafts collect` prints; `curate-dedup` reads it as its input. */
export interface CollectOutput {
  runId: string;
  batches: BatchReport[];
  /** Sessions listed by valid drafts only, in batch order. */
  consumed: ConsumedSession[];
  /** Actions from valid drafts only, in batch order. */
  actions: unknown[];
}

const DRAFT_SUFFIX = '.draft.json';

/** Parses the batch index out of `${runId}__${N}.draft.json`; null when not a positive integer. */
function batchIndex(prefix: string, filename: string): number | null {
  const raw = filename.slice(prefix.length, filename.length - DRAFT_SUFFIX.length);
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  return Number(raw);
}

/** The draft's sessions and actions, or the reason it cannot be consumed. */
function readDraft(path: string): { sessions: ConsumedSession[]; actions: unknown[] } | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return `not valid JSON: ${(err as Error).message}`;
  }
  const result = CuratorDraftSchema.safeParse(parsed);
  if (!result.success) {
    return result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  }
  const { sessions, actions } = result.data;
  const strays = unresolvedOrigins(actions, new Set(sessions.map(s => s.session_id)));
  if (strays.length > 0) {
    return `action origin(s) not among the draft's sessions: ${strays.join(', ')}`;
  }
  return { sessions, actions };
}

/**
 * Deterministic per-batch draft collector for curate. Reads every
 * `${RUN_ID}__<N>.draft.json` under the curator log dir. A draft is `valid`
 * when it parses, matches the `curator-draft` schema (`{ sessions, actions }`)
 * and every action origin names one of its listed sessions; anything else is
 * `invalid`. Prints one JSON document on stdout carrying the batch statuses,
 * the consumed-session set from valid drafts only, and their concatenated
 * actions in batch order; every diagnostic goes to stderr. One bad draft never
 * aborts the run: its sessions stay pending, as do those of a batch that wrote
 * no draft. Exits 1 only when no draft survived.
 */
export async function runDraftsCollectCommand(opts: DraftsCollectOptions = {}): Promise<number> {
  if (opts.runId === undefined || opts.runId === '') {
    log.error('drafts collect: --run-id is required.');
    return 1;
  }
  let runId: string;
  try {
    runId = assertValidRunId(opts.runId);
  } catch (err) {
    log.error(`drafts collect: ${(err as Error).message}`);
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
  const drafts = new Map<number, string>();
  for (const name of existsSync(curatorDir) ? readdirSync(curatorDir) : []) {
    if (!name.startsWith(prefix) || !name.endsWith(DRAFT_SUFFIX)) continue;
    const n = batchIndex(prefix, name);
    if (n !== null) drafts.set(n, name);
  }
  if (drafts.size === 0) {
    log.error(`drafts collect: no draft files for run-id "${runId}" under ${curatorDir}.`);
    return 1;
  }

  const batches: BatchReport[] = [];
  const consumed: ConsumedSession[] = [];
  const actions: unknown[] = [];

  // Deterministic batch order by numeric index (so 10 follows 9).
  for (const batch of [...drafts.keys()].sort((a, b) => a - b)) {
    const draft = readDraft(join(curatorDir, drafts.get(batch)!));
    if (typeof draft === 'string') {
      batches.push({ batch, status: 'invalid', reason: draft });
      appendBatchEvent(curatorDir, runId, batch, { event: 'invalid', reason: draft });
      continue;
    }
    batches.push({ batch, status: 'valid' });
    consumed.push(...draft.sessions);
    actions.push(...draft.actions);
    appendBatchEvent(curatorDir, runId, batch, {
      event: 'validated',
      sessions: draft.sessions.map(s => s.session_id),
      count: draft.actions.length,
    });
  }

  // Machine output: stdout carries only this document so the skill can
  // redirect it straight into curate-dedup; every diagnostic is on stderr.
  const output: CollectOutput = { runId, batches, consumed, actions };
  writeJsonDocument(output);

  const valid = batches.filter(b => b.status === 'valid').length;
  log.info(
    `drafts collect: ${batches.length} draft(s), ${valid} valid, ${batches.length - valid} invalid; ` +
      `${actions.length} action(s) aggregated; ${consumed.length} session(s) consumed.`
  );
  for (const b of batches) {
    if (b.status === 'invalid') {
      log.warn(
        `drafts collect: batch ${b.batch} produced invalid output, skipped (${b.reason}); its sessions stay pending.`
      );
    }
  }

  if (valid === 0) {
    log.error('drafts collect: no draft survived; nothing to dedup and nothing is consumed.');
    return 1;
  }
  return 0;
}
