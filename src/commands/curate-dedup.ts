import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import matter from 'gray-matter';
import { atomicWriteJson } from '../lib/fs-atomic.js';
import {
  dedupActions,
  listPendingSessions,
  markSessionsProcessed,
  mintConflictId,
  type PendingSession,
} from '../lib/curate.js';
import { log } from '../lib/log.js';
import { assertValidSessionId } from '../lib/session-log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { CuratorOutputSchema, type CuratorAction } from '../lib/schemas.js';

export interface CurateDedupOptions {
  /** Path to a proposals JSON file. When omitted, read from stdin. */
  input?: string | undefined;
  /** Path the deduped survivors JSON is written to (atomic). */
  output?: string | undefined;
  /** Caller-supplied run id (for reproducibility). Defaults to randomUUID(). */
  runId?: string | undefined;
  /** Override the `_sessions/` directory. Defaults to `repoPaths(...).sessionsDir`. */
  sessionsDir?: string | undefined;
  /** Override the `conflicts/` directory. Defaults to `repoPaths(...).conflictsDir`. */
  conflictsDir?: string | undefined;
  /** When set, stamp only the unprocessed done log matching this session id. */
  sessionId?: string | undefined;
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
    if (action.action !== 'contradict' || !action.proposed_node) {
      survivors.push(action);
      continue;
    }
    n += 1;
    const id = mintConflictId(runId, n);
    const proposedNode = action.proposed_node;
    const frontmatter = {
      id,
      status: 'pending',
      detected_at: now.toISOString(),
      run_id: runId,
      candidate_origin: action.candidate_origin,
      target_node_id: action.target_node_id ?? null,
      proposed_kind: proposedNode.type,
      proposed_title: proposedNode.title,
      proposed_confidence: proposedNode.kk_confidence,
    };
    const body = `## Rationale\n\n${action.rationale}\n\n## Proposed node\n\n${proposedNode.body}\n`;
    conflicts.push({
      id,
      filePath: join(conflictsDir, `${id}.md`),
      serialized: matter.stringify(body, frontmatter),
    });
  }
  return { survivors, conflicts };
}

/**
 * Atomic tmp+rename of a markdown file. Mirrors `writeNodeFile`'s rename
 * shape so the dedup primitive can write conflict files without pulling in
 * the node-specific schema validation (conflicts are not nodes).
 */
function writeFileAtomic(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, filePath);
}

/**
 * `curate dedup` primitive. Reads a curator-actions JSON blob, dedups it,
 * mints `${runId}-${n}` conflict ids for the surviving conflict actions,
 * writes the surviving (non-conflict) actions to `--output`, materializes
 * each conflict markdown file, and stamps consumed pending session logs.
 *
 * Pure Node: no sub-agent, no LLM, no `proper-lockfile`. Validates the
 * input against `CuratorOutputSchema` before touching the filesystem.
 */
export async function runCurateDedupCommand(opts: CurateDedupOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const sessionsDir = opts.sessionsDir ?? paths.sessionsDir;
  const conflictsDir = opts.conflictsDir ?? paths.conflictsDir;
  const runId = opts.runId !== undefined && opts.runId !== '' ? opts.runId : randomUUID();

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

  const validated = CuratorOutputSchema.safeParse(parsedJson);
  if (!validated.success) {
    log.error(
      `curate dedup: input does not match CuratorOutputSchema: ${validated.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
    );
    return 1;
  }

  const merged = dedupActions(validated.data);
  const now = opts.now ?? new Date();
  const { survivors, conflicts } = planConflictWrites(merged, runId, conflictsDir, now);

  let filterSessionId: string | undefined;
  if (opts.sessionId !== undefined && opts.sessionId !== '') {
    try {
      filterSessionId = assertValidSessionId(opts.sessionId);
    } catch (err) {
      log.error(`curate dedup: ${(err as Error).message}`);
      return 1;
    }
  }

  // Discover pending sessions to stamp. The stamp is part of the same atomic
  // transaction as the survivors + conflict writes.
  let pending: PendingSession[] = listPendingSessions(sessionsDir);
  if (filterSessionId !== undefined) {
    pending = pending.filter(s => s.sessionId === filterSessionId);
    if (pending.length === 0) {
      log.error(
        `curate dedup: no unprocessed proposal_status=done session log for session_id ${filterSessionId}.`
      );
      return 1;
    }
  }

  // Atomicity protocol: ALL writes happen tmp+rename, in a fixed order
  // (survivors JSON → conflicts → session stamps). If a later write fails,
  // prior writes have already landed on disk — documented in the task.
  try {
    if (opts.output !== undefined && opts.output !== '') {
      const outAbs = isAbsolute(opts.output) ? opts.output : resolve(process.cwd(), opts.output);
      atomicWriteJson(outAbs, survivors);
    }
    if (conflicts.length > 0) {
      mkdirSync(conflictsDir, { recursive: true });
      for (const c of conflicts) {
        writeFileAtomic(c.filePath, c.serialized);
      }
    }
    if (pending.length > 0) {
      markSessionsProcessed(pending, runId, now);
    }
  } catch (err) {
    log.error(`curate dedup: write failed: ${(err as Error).message}`);
    return 1;
  }

  const summary: DedupSummary = {
    kept: survivors.length,
    conflicts: conflicts.length,
    stamped: pending.length,
    runId,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}
