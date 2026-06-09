import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { atomicWriteJson } from './fs-atomic.js';
import { log } from './log.js';
import { MemoryLedgerSchema, type MemoryLedger } from './schemas.js';
import type { RepoPaths } from './paths.js';
import type { HarnessAdapter } from '../harnesses/types.js';

/**
 * Bootstrap-shaped representation of a candidate document. Originally
 * exported from `./bootstrap.ts` for the deleted runner; kept here as the
 * shape the host-LLM bootstrap workflow still consumes when interleaving
 * harness memory files with markdown candidates.
 */
export interface DocCandidateFile {
  /** Path relative to the repo root (posix) or `memory://<basename>`. */
  relPath: string;
  /** Absolute path on disk. */
  absPath: string;
  /** SHA-256 of file contents (hex). */
  sha256: string;
  /** UTF-8 contents. */
  content: string;
}

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

export interface CurateMemoryCandidate {
  source: 'harness-memory';
  iri: string;
  sha256: string;
  content: string;
}

export interface MemoryDiscoveryContext {
  adapter: HarnessAdapter;
  paths: RepoPaths;
}

export interface MemoryDiscoveryResult {
  bootstrapCandidates: DocCandidateFile[];
  curateCandidates: CurateMemoryCandidate[];
  commit: (runId: string, succeeded: boolean) => Promise<void>;
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
 * Asks the active adapter for its auto-memory files, reads + hashes each,
 * consults the per-user ledger to skip unchanged entries, and returns:
 *
 *   - `bootstrapCandidates`: `DocCandidateFile`-shaped entries the bootstrap
 *     pipeline interleaves with markdown candidates. `relPath` is the synthetic
 *     `memory://<basename>` so the bootstrap collision logic still works.
 *   - `curateCandidates`: lightweight envelopes the curate pipeline tags with
 *     `source: 'harness-memory'` so the curator prompt can attribute origin.
 *   - `commit(runId, succeeded)`: updates ledger entries for every processed
 *     IRI to `{ sha256, lastSeenRunId, lastSeenAt }` and atomically writes the
 *     ledger — but only when `succeeded === true`. Pipeline failures leave the
 *     ledger untouched so the same files are reprocessed on the next run.
 */
export async function discoverHarnessMemoryFiles(
  ctx: MemoryDiscoveryContext
): Promise<MemoryDiscoveryResult> {
  const iris = await ctx.adapter.listMemoryFiles();
  const ledger = loadMemoryLedger(ctx.paths);
  const seen = new Set<string>();
  const pendingUpdates = new Map<string, string>();
  const bootstrapCandidates: DocCandidateFile[] = [];
  const curateCandidates: CurateMemoryCandidate[] = [];

  for (const iri of iris) {
    if (seen.has(iri)) continue;
    seen.add(iri);
    if (!/^file:\/\//.test(iri)) {
      log.warn(`listMemoryFiles returned a non-file IRI; skipping: ${iri}`);
      continue;
    }

    let absPath: string;
    try {
      absPath = fileURLToPath(iri);
    } catch (err) {
      log.warn(
        `unparseable memory IRI ${iri} (${err instanceof Error ? err.message : String(err)}); skipping.`
      );
      continue;
    }

    let buf: Buffer;
    try {
      buf = await readFile(absPath);
    } catch {
      log.warn(`memory file missing on disk; skipping: ${iri}`);
      continue;
    }
    if (buf.length === 0) continue;

    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (ledger.entries[iri]?.sha256 === sha256) continue;

    const content = buf.toString('utf8');
    pendingUpdates.set(iri, sha256);
    bootstrapCandidates.push({
      relPath: `memory://${basename(absPath)}`,
      absPath,
      sha256,
      content,
    });
    curateCandidates.push({
      source: 'harness-memory',
      iri,
      sha256,
      content,
    });
  }

  const commit = async (runId: string, succeeded: boolean): Promise<void> => {
    if (!succeeded) return;
    if (pendingUpdates.size === 0) return;
    const now = new Date().toISOString();
    const nextEntries: MemoryLedger['entries'] = { ...ledger.entries };
    for (const [iri, sha256] of pendingUpdates) {
      nextEntries[iri] = { sha256, lastSeenRunId: runId, lastSeenAt: now };
    }
    const nextLedger: MemoryLedger = { schema_version: 1, entries: nextEntries };
    atomicWriteJson(ctx.paths.memoryLedgerFile, nextLedger);
  };

  return { bootstrapCandidates, curateCandidates, commit };
}
