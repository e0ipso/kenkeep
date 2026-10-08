import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import picomatch from 'picomatch';
import ignore, { type Ignore } from 'ignore';
import lockfile from 'proper-lockfile';
import {
  BootstrapStateSchema,
  type BootstrapDocEntry,
  type BootstrapInProgressEntry,
  type BootstrapState,
} from './schemas.js';
import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';
import { assertContained } from './path-safety.js';
import { repoPaths } from './paths.js';
import { STATE_LOCK_OPTIONS } from './state.js';

/**
 * Filenames that are categorically not project knowledge. Applied
 * unconditionally by `discoverMarkdownFiles` before `.gitignore` /
 * `.kkignore`. Use `.kkignore` to opt a specific path back in (or out)
 * — there is no flag-driven inversion.
 */
export const STATIC_SKIPS: readonly string[] = [
  '**/LICENSE',
  '**/LICENSE.md',
  '**/LICENSE.txt',
  '**/COPYING',
  '**/COPYING.md',
  '**/NOTICE',
  '**/NOTICE.md',
  '**/CODE_OF_CONDUCT',
  '**/CODE_OF_CONDUCT.md',
  '**/CONTRIBUTORS',
  '**/CONTRIBUTORS.md',
  '**/AUTHORS',
  '**/AUTHORS.md',
  '**/MAINTAINERS',
  '**/MAINTAINERS.md',
  '**/CHANGELOG',
  '**/CHANGELOG.md',
  '**/CHANGES',
  '**/CHANGES.md',
  '**/HISTORY',
  '**/HISTORY.md',
  '**/RELEASE_NOTES',
  '**/RELEASE_NOTES.md',
  '**/releases/**/*.md',
  '**/ENTRY.md',
  '**/INDEX.md',
  '**/GRAPH.md',
  '**/index.md',
];

/**
 * Computes SHA-256 (hex) of a string.
 */
export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Loads `bootstrap-state.json` from disk. Returns an empty state if missing
 * or unparseable (so a first run starts fresh).
 */
export function readBootstrapState(file: string): BootstrapState {
  return readJsonValidated(file, BootstrapStateSchema, { schema_version: 1, docs: {} });
}

/**
 * Atomically writes `bootstrap-state.json` (validated against the Zod schema).
 */
export function writeBootstrapState(file: string, state: BootstrapState): void {
  const validated = BootstrapStateSchema.parse(state);
  atomicWriteJson(file, validated);
}

/** `bootstrap-state.json` under the kenkeep `.state/` directory. */
export function bootstrapStateFile(stateDir: string): string {
  return join(stateDir, 'bootstrap-state.json');
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/**
 * Asserts `hash` is a lowercase SHA-256 hex digest, the form `finddocs
 * --with-hashes` prints. Returns it unchanged; throws otherwise.
 */
export function assertContentHash(hash: string): string {
  if (!SHA256_HEX_RE.test(hash)) {
    throw new Error(
      `content hash "${hash}" is not a lowercase 64-character SHA-256 hex digest (use the one \`finddocs --with-hashes\` printed)`
    );
  }
  return hash;
}

/**
 * Asserts `doc` is a bootstrap source document reference: the normalized
 * repo-relative POSIX path `finddocs` prints, naming an existing regular file
 * inside the repository (no `..`, no absolute path, no symlinked segment). The
 * same string becomes the leaf's `kk_derived_from` entry and the
 * `bootstrap-state.json` key, so it must resolve for doctor and match
 * discovery. Returns it unchanged; throws otherwise.
 */
export function assertSourceDoc(repoRoot: string, doc: string): string {
  const segments = doc.split('/');
  if (
    doc === '' ||
    isAbsolute(doc) ||
    doc.includes('\\') ||
    segments.some(s => s === '' || s === '.' || s === '..')
  ) {
    throw new Error(
      `source document "${doc}" must be a normalized repo-relative POSIX path, as printed by \`finddocs\``
    );
  }
  const abs = assertContained(repoRoot, join(repoRoot, ...segments), 'the repository root');
  let isFile = false;
  try {
    isFile = lstatSync(abs).isFile();
  } catch {
    throw new Error(`source document "${doc}" does not exist`);
  }
  if (!isFile) throw new Error(`source document "${doc}" is not a regular file`);
  return doc;
}

/**
 * Read-modify-write of `bootstrap-state.json` under its lock. `update` sees
 * the current state and returns the state to persist (`null` leaves the file
 * untouched) plus a result handed back to the caller. Anything `update` does
 * (e.g. writing a node file) happens while the lock is held, so concurrent
 * host sub-agents serialise on it. Retries on contention rather than failing
 * fast (cf. proposal-drain, which bails on ELOCKED for its single-drainer
 * contract).
 */
export async function updateBootstrapStateLocked<T>(
  file: string,
  update: (state: BootstrapState) => { next: BootstrapState | null; result: T }
): Promise<T> {
  // With `realpath: false` the lock is a sibling directory and the target may
  // be missing, so the first writer creates the file under the lock. Creating
  // it before locking would let a slow first writer replace a concurrent
  // writer's records with an empty state.
  mkdirSync(dirname(file), { recursive: true });
  const release = await lockfile.lock(file, {
    ...STATE_LOCK_OPTIONS,
    retries: { retries: 10, minTimeout: 25, maxTimeout: 200, factor: 1.5 },
  });
  try {
    const { next, result } = update(readBootstrapState(file));
    if (next !== null) writeBootstrapState(file, next);
    return result;
  } finally {
    await release();
  }
}

function withInProgress(
  state: BootstrapState,
  inProgress: Record<string, BootstrapInProgressEntry>
): BootstrapState {
  const next: BootstrapState = { ...state };
  delete next.in_progress;
  if (Object.keys(inProgress).length > 0) next.in_progress = inProgress;
  return next;
}

/**
 * The node id already written for draft `derivedId` in the unfinished attempt
 * at `doc`/`hash`, or `undefined`. An attempt at a different content hash
 * does not count: changed content is processed afresh.
 */
export function writtenInAttempt(
  state: BootstrapState,
  doc: string,
  hash: string,
  derivedId: string
): string | undefined {
  const attempt = state.in_progress?.[doc];
  return attempt?.content_sha256 === hash ? attempt.written[derivedId] : undefined;
}

/**
 * Records that the attempt at `doc`/`hash` wrote `nodeId` for draft
 * `derivedId`. Never marks the document complete. A new content hash starts a
 * fresh attempt.
 */
export function recordWrittenNode(
  state: BootstrapState,
  args: { doc: string; hash: string; derivedId: string; nodeId: string; now: string }
): BootstrapState {
  const attempt = state.in_progress?.[args.doc];
  const written = attempt?.content_sha256 === args.hash ? { ...attempt.written } : {};
  written[args.derivedId] = args.nodeId;
  return {
    ...withInProgress(state, {
      ...state.in_progress,
      [args.doc]: { content_sha256: args.hash, last_written_at: args.now, written },
    }),
    last_incremental_at: args.now,
  };
}

/**
 * Finalizes `doc` at `hash`: the skill declared the document fully handled,
 * whether it produced nodes or none. Moves the attempt's written ids into
 * `docs[doc].produced_nodes` (merged with any earlier completion's) and drops
 * the attempt. Throws, changing nothing, when the unfinished attempt is at a
 * different hash: the document changed mid-run, and completing it would skip
 * content no draft saw.
 */
export function completeDocument(
  state: BootstrapState,
  args: { doc: string; hash: string; now: string }
): { next: BootstrapState; entry: BootstrapDocEntry } {
  const attempt = state.in_progress?.[args.doc];
  if (attempt !== undefined && attempt.content_sha256 !== args.hash) {
    throw new Error(
      `"${args.doc}" has nodes in progress for content hash ${attempt.content_sha256}, not ${args.hash}; ` +
        'the document changed during bootstrap. Re-run discovery and process its current content.'
    );
  }
  const produced = new Set(state.docs[args.doc]?.produced_nodes ?? []);
  for (const id of Object.values(attempt?.written ?? {})) produced.add(id);
  const entry: BootstrapDocEntry = {
    content_sha256: args.hash,
    last_processed_at: args.now,
    produced_nodes: [...produced],
  };
  const remaining = { ...state.in_progress };
  delete remaining[args.doc];
  const next: BootstrapState = {
    ...withInProgress(state, remaining),
    last_incremental_at: args.now,
    docs: { ...state.docs, [args.doc]: entry },
  };
  return { next, entry };
}

export interface DiscoverOptions {
  /** Repo root. The walk is rooted here unconditionally. */
  repoRoot: string;
  /**
   * Root `.gitignore` rules (repo-root relative). Nested `.gitignore` files
   * in subdirectories are read by the walker itself and scoped to their own
   * directory; see `discoverMarkdownFiles`.
   */
  gitignore?: Ignore;
  /** `.kkignore` Ignore instance, applied at descent and filter stages. */
  kkignore?: Ignore;
}

/**
 * Result of `discoverMarkdownFiles`.
 *
 * `files`: repo-root-relative posix paths surviving the full filter chain.
 *
 * `scannedBeforeFilter`: count of `.md` files the walker visited after
 * `.git` / `node_modules` / kenkeep-root short-circuits and after
 * `.gitignore` / `.kkignore` directory-level descent short-circuits, but
 * **before** the per-file `STATIC_SKIPS` / `.gitignore` / `.kkignore`
 * filter chain. The gap between this and `files.length` is what the
 * `no-docs` diagnostic surfaces to the user: "walked N candidates, ignore
 * rules dropped them all".
 */
export interface DiscoverResult {
  files: string[];
  scannedBeforeFilter: number;
}

/**
 * A `.gitignore` rule set together with the repo-relative posix directory
 * that contains it (`''` for the repo root). Paths are matched relative to
 * that directory, mirroring git's per-directory scoping.
 */
interface ScopedIgnore {
  base: string;
  rules: Ignore;
}

interface WalkContext {
  rootDir: string;
  /** Repo-relative posix path of the kenkeep root, never descended into. */
  kbRel: string;
  kkignore: Ignore | undefined;
  staticSkips: ((rel: string) => boolean)[];
  files: string[];
  scanned: number;
}

/**
 * Walks `repoRoot` recursively returning every `.md` file (paths relative
 * to `repoRoot`, posix). Filter chain: posix-relativize → `STATIC_SKIPS`
 * → `.gitignore` (root plus nested) → `.kkignore` → sort.
 *
 * Containment: the kenkeep root (`.ai/kenkeep/`, holding nodes, conflicts,
 * private `_sessions/` and `.state/`) is never descended into, regardless
 * of `.gitignore` / `.kkignore`. Repository-document discovery must not
 * ingest the knowledge base itself or private runtime state. Harness-memory
 * ingestion is a separate, adapter-provided input surface and does not go
 * through this walker.
 *
 * Nested `.gitignore` files apply relative to their own directory and, as in
 * git, a deeper file's matching rule (including a `!` negation) takes
 * precedence over its ancestors'. A file under an excluded directory cannot
 * be re-included because excluded directories are never descended.
 *
 * Directory descent also short-circuits on `.git`, `node_modules`, and on
 * any directory matched by `.gitignore` or `.kkignore` (perf mitigation for
 * large monorepos with broadly-excluded subtrees).
 */
export function discoverMarkdownFiles(opts: DiscoverOptions): DiscoverResult {
  if (!existsSync(opts.repoRoot)) return { files: [], scannedBeforeFilter: 0 };
  const ctx: WalkContext = {
    rootDir: opts.repoRoot,
    kbRel: relativePosix(opts.repoRoot, repoPaths(opts.repoRoot).kkDir),
    kkignore: opts.kkignore,
    staticSkips: STATIC_SKIPS.map(p => picomatch(p, { dot: true })),
    files: [],
    scanned: 0,
  };
  const gitignores: ScopedIgnore[] = opts.gitignore ? [{ base: '', rules: opts.gitignore }] : [];
  walk(ctx, opts.repoRoot, gitignores);
  return { files: ctx.files.sort(), scannedBeforeFilter: ctx.scanned };
}

/**
 * Resolves `rel` (repo-relative posix; trailing `/` for directories) against
 * the stack of applicable `.gitignore` scopes, deepest first. The first scope
 * with a matching rule decides; no match anywhere means "not ignored".
 */
function gitignored(stack: readonly ScopedIgnore[], rel: string): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    const { base, rules } = stack[i]!;
    const verdict = rules.test(base === '' ? rel : rel.slice(base.length + 1));
    if (verdict.ignored) return true;
    if (verdict.unignored) return false;
  }
  return false;
}

function walk(ctx: WalkContext, currentDir: string, gitignores: readonly ScopedIgnore[]): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(currentDir, ent.name);
    const rel = relativePosix(ctx.rootDir, full);
    if (ent.isDirectory()) {
      if (ent.name === '.git' || ent.name === 'node_modules') continue;
      if (rel === ctx.kbRel) continue;
      // The `ignore` package treats a trailing-slash path as a directory
      // query, which is the semantics we want for short-circuiting.
      const dirKey = `${rel}/`;
      if (gitignored(gitignores, dirKey)) continue;
      if (ctx.kkignore && ctx.kkignore.ignores(dirKey)) continue;
      const nested = loadIgnoreFile(join(full, '.gitignore'));
      walk(ctx, full, nested ? [...gitignores, { base: rel, rules: nested }] : gitignores);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith('.md')) continue;
    ctx.scanned++;
    if (ctx.staticSkips.some(m => m(rel))) continue;
    if (gitignored(gitignores, rel)) continue;
    if (ctx.kkignore && ctx.kkignore.ignores(rel)) continue;
    ctx.files.push(rel);
  }
}

function relativePosix(from: string, to: string): string {
  return relative(from, to).split(sep).join(posix.sep);
}

/**
 * Reads an ignore-format file (`.gitignore`, `.kkignore`) and returns an
 * `Ignore` instance. Missing file → `undefined` (no filter). Read errors
 * (e.g. permission) bubble up — only ENOENT is silent.
 */
export function loadIgnoreFile(file: string): Ignore | undefined {
  if (!existsSync(file)) return undefined;
  return ignore().add(readFileSync(file, 'utf8'));
}
