import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { atomicWriteFile, atomicWriteJson } from '../lib/fs-atomic.js';
import { assertConflictWritable, renderConflictFile } from '../lib/conflicts.js';
import {
  dedupActions,
  markSessionsProcessed,
  mintConflictId,
  type SessionStamp,
} from '../lib/curate.js';
import {
  CurateDedupInputSchema,
  readConsumableSession,
  unresolvedOrigins,
  type ConsumedSession,
} from '../lib/curate-manifest.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { assertContained, assertValidRunId } from '../lib/path-safety.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import {
  CONFLICT_SCHEMA_VERSION,
  type ConflictFrontmatter,
  type CuratorAction,
} from '../lib/schemas.js';

export interface CurateDedupOptions {
  /**
   * Path to the dedup input document (`{ actions, consumed }`, the document
   * `drafts collect` prints). When omitted, read from stdin.
   */
  input?: string | undefined;
  /** Path the deduped survivors JSON is written to (atomic). */
  output?: string | undefined;
  /** Caller-supplied run id (for reproducibility). Defaults to randomUUID(). */
  runId?: string | undefined;
  /** Override the `_sessions/` directory. Defaults to `repoPaths(...).sessionsDir`. */
  sessionsDir?: string | undefined;
  /** Override the `conflicts/` directory. Defaults to `repoPaths(...).conflictsDir`. */
  conflictsDir?: string | undefined;
  /**
   * Wall-clock injection point. Defaults to `new Date()`. Exposed for tests
   * that need byte-identical conflict-file frontmatter across runs; not
   * surfaced as a CLI flag because real callers want the current time.
   */
  now?: Date | undefined;
}

interface PlannedConflict {
  id: string;
  filePath: string;
  serialized: string;
}

interface DedupSummary {
  kept: number;
  conflicts: number;
  stamped: number;
  runId: string;
}

/**
 * Reads `--input` from a path or stdin and returns the raw string. We do not
 * parse here so callers can surface JSON parse errors uniformly below.
 */
async function readInput(input: string | undefined): Promise<string> {
  if (input !== undefined && input !== '') {
    const abs = isAbsolute(input) ? input : resolve(process.cwd(), input);
    if (!existsSync(abs)) {
      throw new Error(`--input ${input}: file does not exist (${abs}).`);
    }
    return readFileSync(abs, 'utf8');
  }
  // Drain stdin into a buffer. Empty stdin is treated as invalid input.
  return new Promise<string>((resolveStdin, rejectStdin) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      buf += chunk;
    });
    process.stdin.on('end', () => resolveStdin(buf));
    process.stdin.on('error', rejectStdin);
  });
}

/**
 * Plans every conflict-file write for the surviving conflict-bearing actions.
 * Owns the canonical conflict-file shape so the in-host skill curator and
 * any future consumer produce byte-identical files for the same inputs.
 */
function planConflictWrites(
  actions: CuratorAction[],
  runId: string,
  conflictsDir: string,
  now: Date
): { survivors: CuratorAction[]; conflicts: PlannedConflict[] } {
  const survivors: CuratorAction[] = [];
  const conflicts: PlannedConflict[] = [];
  let n = 0;
  for (const action of actions) {
    if (action.action !== 'contradict') {
      survivors.push(action);
      continue;
    }
    n += 1;
    const id = mintConflictId(runId, n);
    // Every admitted contradiction becomes a pending conflict, including one
    // that proposes no rewrite: it must never fall through to persist (which
    // cannot act on it) or be dropped. The frontmatter persists the complete
    // validated proposal (or `null`) so `conflict resolve` can apply Accept
    // without reconstructing anything from prose.
    const frontmatter: ConflictFrontmatter = {
      schema_version: CONFLICT_SCHEMA_VERSION,
      id,
      status: 'pending',
      detected_at: now.toISOString(),
      run_id: runId,
      candidate_origin: action.candidate_origin,
      target_node_id: action.target_node_id,
      rationale: action.rationale,
      proposal: action.proposed_node,
      default_decision: null,
      decided_at: null,
    };
    conflicts.push({
      id,
      // The run id is validated as a single filename segment up front; this
      // check is the write-boundary guarantee that no conflict file lands
      // outside conflicts/ or through a link, regardless of how the id was
      // minted. Planning runs before any write, so a refusal writes nothing.
      filePath: assertConflictWritable(conflictsDir, join(conflictsDir, `${id}.md`)),
      serialized: renderConflictFile(frontmatter),
    });
  }
  return { survivors, conflicts };
}

/**
 * Resolves every consumed session against `_sessions/` before any write: the
 * file must still exist, be directly under the sessions dir (no symlink),
 * match the draft's session id and transcript version, and still be a done,
 * unprocessed log. Returns the stamps to write (each path with the
 * version validated here, which is what the stamp records even if a capture
 * moves the log on before the stamp lands), or the first problem.
 */
function resolveConsumedSessions(
  consumed: ConsumedSession[],
  sessionsDir: string
): { stamps: SessionStamp[] } | { problem: string } {
  const stamps: SessionStamp[] = [];
  const seen = new Set<string>();
  for (const entry of consumed) {
    if (seen.has(entry.session_id)) {
      return { problem: `consumed session ${entry.session_id} is listed twice.` };
    }
    seen.add(entry.session_id);
    let filePath: string;
    try {
      filePath = assertContained(sessionsDir, join(sessionsDir, entry.file), '_sessions/');
    } catch (err) {
      return { problem: (err as Error).message };
    }
    if (!existsSync(filePath)) {
      return {
        problem: `consumed session ${entry.session_id} (${entry.file}) is missing from _sessions/.`,
      };
    }
    const read = readConsumableSession(filePath);
    if (!read.ok) {
      return {
        problem: `consumed session ${entry.session_id} (${entry.file}) is no longer pending: ${read.reason}.`,
      };
    }
    if (read.session.session_id !== entry.session_id) {
      return {
        problem: `consumed session ${entry.session_id} (${entry.file}) now carries session_id ${read.session.session_id}.`,
      };
    }
    // The draft names the transcript version it was made from; a capture
    // that landed since would make the stamp cover turns nobody curated.
    // Refuse and leave the session pending for the next run.
    if (read.session.transcript_hash !== entry.transcript_hash) {
      return {
        problem: `consumed session ${entry.session_id} (${entry.file}) changed since it was drafted (transcript_hash ${read.session.transcript_hash}, drafted from ${entry.transcript_hash}); it stays pending for the next run.`,
      };
    }
    stamps.push({
      path: filePath,
      transcript_hash: entry.transcript_hash,
      transcript_chars: read.transcript_chars,
    });
  }
  return { stamps };
}

/**
 * `curate dedup` primitive. Reads the dedup input document (`actions` plus
 * the `consumed` sessions `drafts collect` assembled from valid drafts),
 * dedups the actions, mints `${runId}-${n}` conflict ids for the
 * surviving conflict actions, writes the surviving (non-conflict) actions to
 * `--output`, materializes each conflict markdown file, and stamps exactly
 * the consumed sessions, never whatever happens to be pending on disk.
 *
 * Pure Node: no sub-agent, no LLM, no `proper-lockfile`. Validates the
 * input shape, the consumed set (each session still a done, unprocessed log)
 * and every action origin (must belong to a consumed session) before any
 * write.
 */
export async function runCurateDedupCommand(opts: CurateDedupOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const sessionsDir = opts.sessionsDir ?? paths.sessionsDir;
  const conflictsDir = opts.conflictsDir ?? paths.conflictsDir;
  // A caller-supplied run id names conflict files and session stamps, so it is
  // validated as a single safe filename segment before anything is read or
  // written (`--run-id ../../x` would otherwise plan a path outside conflicts/).
  let runId: string;
  try {
    runId =
      opts.runId !== undefined && opts.runId !== '' ? assertValidRunId(opts.runId) : randomUUID();
  } catch (err) {
    log.error(`curate dedup: ${(err as Error).message}`);
    return 1;
  }

  let raw: string;
  try {
    raw = await readInput(opts.input);
  } catch (err) {
    log.error(`curate dedup: ${(err as Error).message}`);
    return 1;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    log.error(`curate dedup: input is not valid JSON: ${(err as Error).message}`);
    return 1;
  }

  const validated = CurateDedupInputSchema.safeParse(parsedJson);
  if (!validated.success) {
    log.error(
      `curate dedup: input does not match the dedup input contract ({ actions, consumed }): ${validated.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
    );
    return 1;
  }
  const { actions, consumed } = validated.data;

  // Every action must come from a consumed session; otherwise the input was
  // not produced by this run's drafts and stamping would be unsound.
  const strays = unresolvedOrigins(actions, new Set(consumed.map(s => s.session_id)));
  if (strays.length > 0) {
    log.error(
      `curate dedup: action origin(s) do not resolve within the consumed sessions: ${strays.join(', ')}.`
    );
    return 1;
  }

  // Resolve the consumed set against disk before any write so a session that
  // was stamped by another run (or re-captured into a non-done state) in the
  // meantime fails the whole call rather than being double-curated.
  const resolvedSessions = resolveConsumedSessions(consumed, resolve(sessionsDir));
  if ('problem' in resolvedSessions) {
    log.error(`curate dedup: ${resolvedSessions.problem}`);
    return 1;
  }
  const stamps = resolvedSessions.stamps;

  const merged = dedupActions(actions);
  const now = opts.now ?? new Date();
  let planned: ReturnType<typeof planConflictWrites>;
  try {
    planned = planConflictWrites(merged, runId, conflictsDir, now);
  } catch (err) {
    log.error(`curate dedup: ${(err as Error).message}`);
    return 1;
  }
  const { survivors, conflicts } = planned;

  // Atomicity protocol: ALL writes happen tmp+rename, in a fixed order
  // (survivors JSON → conflicts → session stamps). If a later write fails,
  // prior writes have already landed on disk (the kk-curate skill says how
  // to recover). The
  // stamps carry the version resolved above, not whatever the log holds by
  // the time they are written (see `markSessionsProcessed`).
  try {
    if (opts.output !== undefined && opts.output !== '') {
      const outAbs = isAbsolute(opts.output) ? opts.output : resolve(process.cwd(), opts.output);
      atomicWriteJson(outAbs, survivors);
    }
    if (conflicts.length > 0) {
      mkdirSync(conflictsDir, { recursive: true });
      for (const c of conflicts) {
        atomicWriteFile(c.filePath, c.serialized);
      }
    }
    if (stamps.length > 0) {
      await markSessionsProcessed(stamps, runId, now);
    }
  } catch (err) {
    log.error(`curate dedup: write failed: ${(err as Error).message}`);
    return 1;
  }

  const summary: DedupSummary = {
    kept: survivors.length,
    conflicts: conflicts.length,
    stamped: stamps.length,
    runId,
  };
  writeJsonDocument(summary);
  return 0;
}
