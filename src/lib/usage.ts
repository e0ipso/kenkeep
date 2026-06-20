import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import lockfile from 'proper-lockfile';
import { atomicWriteFile } from './fs-atomic.js';

/**
 * Records knowledge-base document usage during capture. The signal is the set of
 * file-read tool calls each harness adapter surfaces from its raw transcript;
 * this module turns those raw read paths into stable document identities and
 * appends one line per read occurrence to `.state/usage.jsonl`.
 *
 * Reconciliation is monotonic and keyed by `session_id`: capture re-runs every
 * turn over a cumulative transcript, so we append only the positive delta and
 * never remove or decrease a session's recorded count (which also keeps it
 * correct when a post-compaction transcript shows fewer reads).
 */

export interface ClassifiedRead {
  document: string;
  type: 'leaf' | 'index';
}

const USAGE_LOCK_OPTIONS = {
  stale: 30 * 1000,
  realpath: false,
  retries: { retries: 15, factor: 1.4, minTimeout: 25, maxTimeout: 250 },
} as const;

/** Resolves a path through realpath when possible, falling back to `resolve`. */
function safeResolve(p: string): string {
  try {
    return realpathSync(resolve(p));
  } catch {
    return resolve(p);
  }
}

/**
 * Explicit resolution contract for read candidates before classification.
 *
 * Dedicated read tools emit absolute paths, but command-extracted candidates
 * (see `extractCommandMarkdownCandidates`) commonly arrive as repo-relative
 * `.ai/kenkeep/nodes/...` or kk-root-relative `nodes/...`. Those two forms must
 * resolve deterministically against the known kk root rather than the hook
 * process cwd (which varies by harness and command shape):
 *
 * - absolute candidates: returned unchanged (existing behavior);
 * - `.ai/kenkeep/nodes/...`: resolved from the repository root implied by
 *   `kkDir` (`kkDir` is `<root>/.ai/kenkeep`, so the repo root is two levels up);
 * - `nodes/...`: resolved from `kkDir`;
 * - any other relative form: returned unchanged so the existing cwd-based
 *   `resolve` behavior in `safeResolve` still applies.
 *
 * This is presentation-only normalization; it never adds fields to
 * `UsageRecordSchema`.
 */
function resolveCandidatePath(readPath: string, kkDir: string): string {
  if (isAbsolute(readPath)) return readPath;
  const normalized = readPath.split(sep).join('/');
  if (normalized === 'nodes' || normalized.startsWith('nodes/')) {
    return resolve(kkDir, readPath);
  }
  if (normalized === '.ai/kenkeep/nodes' || normalized.startsWith('.ai/kenkeep/nodes/')) {
    return resolve(dirname(dirname(kkDir)), readPath);
  }
  return readPath;
}

/**
 * Classifies a file-read path as a knowledge-base document, or `null` when the
 * read does not target the node tree. A per-folder `index.md` is a branch index
 * named by its kk-root-relative POSIX path; any other `.md` leaf is named by its
 * node id (filename without extension).
 */
export function classifyRead(
  readPath: string,
  nodesDir: string,
  kkDir: string
): ClassifiedRead | null {
  if (!readPath) return null;
  const node = safeResolve(resolveCandidatePath(readPath, kkDir));
  const root = safeResolve(nodesDir);
  if (node !== root && !node.startsWith(root + sep)) return null;
  if (!node.endsWith('.md')) return null;
  if (basename(node) === 'index.md') {
    const rel = relative(safeResolve(kkDir), node).split(sep).join('/');
    return { document: rel, type: 'index' };
  }
  return { document: basename(node).slice(0, -'.md'.length), type: 'leaf' };
}

interface UsageLine {
  session_id?: unknown;
  document?: unknown;
}

/**
 * Appends one line per *new* read occurrence to `usageFile` for the given
 * session. Existing lines are never rewritten or removed; for each document the
 * recorded line count for this session becomes `max(existing, observed)`.
 * Serialized with a `.state` lock so concurrent captures cannot lose appends.
 */
export async function reconcileUsage(
  usageFile: string,
  sessionId: string,
  usedAt: string,
  reads: ClassifiedRead[]
): Promise<void> {
  if (reads.length === 0) return;

  const observed = new Map<string, { type: 'leaf' | 'index'; count: number }>();
  for (const r of reads) {
    const entry = observed.get(r.document);
    if (entry) entry.count += 1;
    else observed.set(r.document, { type: r.type, count: 1 });
  }

  // Ensure the lock target exists without truncating an existing ledger.
  mkdirSync(dirname(usageFile), { recursive: true });
  writeFileSync(usageFile, '', { flag: 'a' });

  const release = await lockfile.lock(usageFile, USAGE_LOCK_OPTIONS);
  try {
    const raw = existsSync(usageFile) ? readFileSync(usageFile, 'utf8') : '';
    const lines = raw.split('\n').filter(line => line.trim().length > 0);

    const existing = new Map<string, number>();
    for (const line of lines) {
      let rec: UsageLine;
      try {
        rec = JSON.parse(line) as UsageLine;
      } catch {
        continue; // a malformed line must never block capture
      }
      if (rec.session_id === sessionId && typeof rec.document === 'string') {
        existing.set(rec.document, (existing.get(rec.document) ?? 0) + 1);
      }
    }

    const appended: string[] = [];
    for (const [document, { type, count }] of observed) {
      const delta = Math.max(0, count - (existing.get(document) ?? 0));
      for (let i = 0; i < delta; i += 1) {
        appended.push(JSON.stringify({ document, type, session_id: sessionId, used_at: usedAt }));
      }
    }
    if (appended.length === 0) return;
    atomicWriteFile(usageFile, `${[...lines, ...appended].join('\n')}\n`);
  } finally {
    await release();
  }
}

/**
 * Capture-time entry point: classifies raw read paths against the node tree and
 * reconciles the surviving knowledge-base reads into the usage ledger.
 */
export async function recordUsage(opts: {
  usageFile: string;
  nodesDir: string;
  kkDir: string;
  sessionId: string;
  usedAt: string;
  readPaths: string[];
}): Promise<void> {
  const reads = opts.readPaths
    .map(p => classifyRead(p, opts.nodesDir, opts.kkDir))
    .filter((r): r is ClassifiedRead => r !== null);
  await reconcileUsage(opts.usageFile, opts.sessionId, opts.usedAt, reads);
}
