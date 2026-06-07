import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import picomatch from 'picomatch';
import ignore, { type Ignore } from 'ignore';
import { BootstrapStateSchema, type BootstrapState } from './schemas.js';
import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';

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

export interface DiscoverOptions {
  /** Repo root. The walk is rooted here unconditionally. */
  repoRoot: string;
  /** `.gitignore` Ignore instance, applied at descent and filter stages. */
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
 * `.git` / `node_modules` short-circuits and after `.gitignore` /
 * `.kkignore` directory-level descent short-circuits, but **before** the
 * per-file `STATIC_SKIPS` / `.gitignore` / `.kkignore` filter chain. The
 * gap between this and `files.length` is what the `no-docs` diagnostic
 * surfaces to the user: "walked N candidates, ignore rules dropped them all".
 */
export interface DiscoverResult {
  files: string[];
  scannedBeforeFilter: number;
}

/**
 * Walks `repoRoot` recursively returning every `.md` file (paths relative
 * to `repoRoot`, posix). Filter chain: posix-relativize →
 * `STATIC_SKIPS` → `.gitignore` → `.kkignore` → sort. Directory descent
 * also short-circuits on `.git`, `node_modules`, and on any directory
 * matched by `.gitignore` or `.kkignore` (perf mitigation for large
 * monorepos with broadly-excluded subtrees).
 */
export function discoverMarkdownFiles(opts: DiscoverOptions): DiscoverResult {
  const empty: DiscoverResult = { files: [], scannedBeforeFilter: 0 };
  if (!existsSync(opts.repoRoot)) return empty;
  const out: string[] = [];
  walk(opts.repoRoot, opts.repoRoot, out, opts.gitignore, opts.kkignore);
  const staticSkipMatchers = STATIC_SKIPS.map(p => picomatch(p, { dot: true }));
  const ig = opts.gitignore;
  const kb = opts.kkignore;
  const rels = out.map(abs => relativePosix(opts.repoRoot, abs));
  const files = rels
    .filter(rel => {
      if (staticSkipMatchers.some(m => m(rel))) return false;
      if (ig && ig.ignores(rel)) return false;
      if (kb && kb.ignores(rel)) return false;
      return true;
    })
    .sort();
  return { files, scannedBeforeFilter: rels.length };
}

function walk(
  rootDir: string,
  currentDir: string,
  out: string[],
  gitignore: Ignore | undefined,
  kkignore: Ignore | undefined
): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(currentDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '.git' || ent.name === 'node_modules') continue;
      // Push `.gitignore` / `.kkignore` into directory-descent decisions.
      // The `ignore` package treats a trailing-slash path as a directory
      // query, which is the semantics we want for short-circuiting.
      const relDir = relativePosix(rootDir, full);
      if (relDir !== '') {
        const dirKey = `${relDir}/`;
        if (gitignore && gitignore.ignores(dirKey)) continue;
        if (kkignore && kkignore.ignores(dirKey)) continue;
      }
      walk(rootDir, full, out, gitignore, kkignore);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith('.md')) continue;
    out.push(full);
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
