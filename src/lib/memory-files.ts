import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { assertContentHash } from './bootstrap.js';
import { atomicWriteJson } from './fs-atomic.js';
import { log } from './log.js';
import { MemoryLedgerSchema, type MemoryLedger } from './schemas.js';
import type { RepoPaths } from './paths.js';
import type { HarnessAdapter } from '../harnesses/types.js';

/**
 * Verbatim discovery prompt sent to the active harness via a headless child.
 * Adapters MUST NOT modify or inline this string; they always import it from
 * here so the contract is the same across harnesses.
 *
 * The reply must be ONLY a JSON array (no prose, no fences) of absolute
 * `file://` IRIs pointing at the harness's auto-memory files. If the host
 * harness has no native memory feature, the reply must be the empty array
 * `[]`.
 */
export const HARNESS_MEMORY_DISCOVERY_PROMPT = [
  'You are being asked to list the auto-memory files that this harness',
  'persists for the current user/project across sessions.',
  '',
  'Auto-memory files are the files the harness writes to remember user',
  'preferences, project facts, feedback, or external references between',
  "sessions (e.g. Claude Code's memory files under the user/project memory",
  'directory). Configuration files, transcripts, hook scripts, and skill',
  'definitions are NOT memory files and must be excluded.',
  '',
  'Reply with ONLY a JSON array of absolute `file://` IRIs, one per memory',
  'file currently on disk and readable. Do not wrap the array in any other',
  'object, do not add commentary or code fences, and do not include',
  'placeholder entries.',
  '',
  'If this harness has no native auto-memory feature, or no memory files',
  'currently exist, reply with exactly: []',
].join('\n');

/**
 * Zod schema for the parsed JSON reply. Adapters validate with this and then
 * apply the `file://` regex filter + de-duplication themselves.
 */
export const MemoryIriListSchema = z.array(z.string());

/**
 * One harness memory file whose content the ledger has not seen yet (new
 * file, or content changed since it was last marked).
 */
export interface HarnessMemoryFile {
  /** Absolute `file://` IRI as the adapter reported it; the ledger key. */
  iri: string;
  /** Absolute filesystem path. */
  absPath: string;
  /** SHA-256 of the raw file bytes (lowercase hex). */
  sha256: string;
  /** Raw size in bytes. */
  bytes: number;
  /** UTF-8 contents, passed through as-is. */
  content: string;
  /**
   * Deterministic UUID v4 derived from `sha256`, so the curate skill can
   * stage the file as a session log idempotently: the same content always
   * maps to the same log, and changed content to a new one.
   */
  sessionId: string;
}

export interface MemoryDiscoveryContext {
  adapter: HarnessAdapter;
  paths: RepoPaths;
}

/**
 * Loads `.state/memory-ledger.json` and validates it against
 * `MemoryLedgerSchema`. Missing or malformed files yield a fresh
 * empty ledger; a malformed file also emits a single warning so the user
 * notices that a rewrite is happening.
 */
export function loadMemoryLedger(paths: RepoPaths): MemoryLedger {
  if (!existsSync(paths.memoryLedgerFile)) {
    return { schema_version: 1, entries: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(paths.memoryLedgerFile, 'utf8')) as unknown;
    const parsed = MemoryLedgerSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn(
        `memory-ledger.json failed schema validation (${parsed.error.message}); rebuilding from empty.`
      );
      return { schema_version: 1, entries: {} };
    }
    return parsed.data;
  } catch (err) {
    log.warn(
      `memory-ledger.json could not be read (${err instanceof Error ? err.message : String(err)}); rebuilding from empty.`
    );
    return { schema_version: 1, entries: {} };
  }
}

/**
 * Folds a SHA-256 hex digest into a UUID v4-shaped id (version nibble `4`,
 * variant nibble `8`). Stable for equal content; `assertValidSessionId`
 * accepts it, so `session-log stage-live --session-id` can key a memory
 * file's staged log by its content.
 */
export function memorySessionId(sha256: string): string {
  const h = assertContentHash(sha256);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function sha256Of(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function iriToPath(iri: string): string | undefined {
  if (!/^file:\/\//.test(iri)) {
    log.warn(`listMemoryFiles returned a non-file IRI; skipping: ${iri}`);
    return undefined;
  }
  try {
    return fileURLToPath(iri);
  } catch (err) {
    log.warn(
      `unparseable memory IRI ${iri} (${err instanceof Error ? err.message : String(err)}); skipping.`
    );
    return undefined;
  }
}

/**
 * Asks the active adapter for its auto-memory files, reads and hashes each,
 * and returns only the ones the per-user ledger has not recorded at their
 * current content hash. Non-file, unparseable, missing and empty entries are
 * skipped with a warning (missing/empty silently). Reading never touches the
 * ledger: a file stays listed until `recordHarnessMemoryFile` marks it.
 */
export async function discoverHarnessMemoryFiles(
  ctx: MemoryDiscoveryContext
): Promise<HarnessMemoryFile[]> {
  const iris = await ctx.adapter.listMemoryFiles();
  const ledger = loadMemoryLedger(ctx.paths);
  const seen = new Set<string>();
  const out: HarnessMemoryFile[] = [];

  for (const iri of iris) {
    if (seen.has(iri)) continue;
    seen.add(iri);
    const absPath = iriToPath(iri);
    if (absPath === undefined) continue;

    let buf: Buffer;
    try {
      buf = await readFile(absPath);
    } catch {
      log.warn(`memory file missing on disk; skipping: ${iri}`);
      continue;
    }
    if (buf.length === 0) continue;

    const sha256 = sha256Of(buf);
    if (ledger.entries[iri]?.sha256 === sha256) continue;

    out.push({
      iri,
      absPath,
      sha256,
      bytes: buf.length,
      content: buf.toString('utf8'),
      sessionId: memorySessionId(sha256),
    });
  }

  return out;
}

export interface RecordHarnessMemoryFileArgs {
  iri: string;
  /** The `sha256` that `discoverHarnessMemoryFiles` listed for this file. */
  sha256: string;
  runId: string;
}

/**
 * Marks one memory file as processed at `sha256` in the ledger. Called only
 * after the knowledge derived from the file was persisted, so an interrupted
 * or failed run leaves the file listed for the next one.
 *
 * Refuses, writing nothing, when the file is gone or its current content no
 * longer hashes to `sha256`: the knowledge that was written came from the
 * listed version, and the changed file must be listed again.
 */
export async function recordHarnessMemoryFile(
  paths: RepoPaths,
  args: RecordHarnessMemoryFileArgs
): Promise<MemoryLedger['entries'][string]> {
  const sha256 = assertContentHash(args.sha256);
  if (args.runId.trim().length === 0) throw new Error('run id must be a non-empty string');
  const absPath = iriToPath(args.iri);
  if (absPath === undefined) throw new Error(`memory IRI "${args.iri}" is not a file:// IRI`);

  let buf: Buffer;
  try {
    buf = await readFile(absPath);
  } catch {
    throw new Error(
      `memory file ${args.iri} is not readable; it will be listed again if it returns`
    );
  }
  if (sha256Of(buf) !== sha256) {
    throw new Error(
      `memory file ${args.iri} changed since it was listed; it will be listed again on the next run`
    );
  }

  const ledger = loadMemoryLedger(paths);
  const entry = { sha256, lastSeenRunId: args.runId, lastSeenAt: new Date().toISOString() };
  const next: MemoryLedger = {
    schema_version: 1,
    entries: { ...ledger.entries, [args.iri]: entry },
  };
  atomicWriteJson(paths.memoryLedgerFile, next);
  return entry;
}
