import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, posix, sep } from 'node:path';
import { discoverMarkdownFiles, loadIgnoreFile, type DiscoverOptions } from '../lib/bootstrap.js';
import { findRepoRoot } from '../lib/paths.js';
import { log } from '../lib/log.js';

export interface FindDocsOptions {
  /** Subdirectory (relative to repo root) to narrow discovery to. */
  from?: string | undefined;
  /** When true, emit a tab-separated SHA-256 hex digest after each path. */
  withHashes?: boolean | undefined;
}

/**
 * Streams a file through SHA-256 and returns its hex digest. Streaming keeps
 * the memory footprint flat regardless of document size, which matters here
 * because `finddocs` is the discovery primitive callers (skills) drive
 * across potentially large monorepos.
 */
function sha256File(absPath: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absPath);
    stream.on('error', rejectHash);
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

function toPosix(p: string): string {
  return p.split(sep).join(posix.sep);
}

/**
 * Discovers candidate markdown files under the repo (or a `--from` scope)
 * applying the same `.gitignore` + `.kkignore` + `STATIC_SKIPS` chain as
 * the bootstrap path, then prints `+ <relpath>` (one per surviving file).
 * With `--with-hashes`, each line is suffixed with a tab and the file's
 * SHA-256 hex digest, so callers can compare against `bootstrap-state.json`.
 *
 * Read-only: no state mutation, no harness invocation. Exits 0 even when
 * the surviving set is empty; nonzero only on hard errors.
 */
export async function runFindDocsCommand(opts: FindDocsOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const gitignoreInstance = loadIgnoreFile(join(root, '.gitignore'));
  const kkignoreInstance = loadIgnoreFile(join(root, '.kkignore'));

  // Resolve --from to an absolute path under repo root, validate it exists
  // and is a directory. When omitted, the scope is the repo root itself.
  let scopeRel: string | null = null;
  if (opts.from !== undefined && opts.from !== '') {
    const fromArg = opts.from;
    const fromAbs = isAbsolute(fromArg) ? resolve(fromArg) : resolve(root, fromArg);
    const rel = relative(root, fromAbs);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      log.error(`--from ${fromArg}: path escapes the repo root (${root}).`);
      return 1;
    }
    if (!existsSync(fromAbs)) {
      log.error(`--from ${fromArg}: directory does not exist (${fromAbs}).`);
      return 1;
    }
    let st;
    try {
      st = statSync(fromAbs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`--from ${fromArg}: ${msg}`);
      return 1;
    }
    if (!st.isDirectory()) {
      log.error(`--from ${fromArg}: not a directory (${fromAbs}).`);
      return 1;
    }
    scopeRel = toPosix(rel);
  }

  // Walk from repo root so `.gitignore` / `.kkignore` pattern semantics
  // (anchored to the repo root) match what bootstrap sees. When --from is
  // set, filter the survivors to paths under that subdirectory.
  const discoverOpts: DiscoverOptions = { repoRoot: root };
  if (gitignoreInstance) discoverOpts.gitignore = gitignoreInstance;
  if (kkignoreInstance) discoverOpts.kkignore = kkignoreInstance;

  let discovery;
  try {
    discovery = discoverMarkdownFiles(discoverOpts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`finddocs: discovery failed: ${msg}`);
    return 1;
  }

  let files = discovery.files;
  if (scopeRel !== null && scopeRel !== '') {
    const prefix = scopeRel.endsWith('/') ? scopeRel : `${scopeRel}/`;
    files = files.filter(rel => rel === scopeRel || rel.startsWith(prefix));
  }

  for (const rel of files) {
    if (opts.withHashes) {
      const abs = join(root, rel);
      let hex: string;
      try {
        hex = await sha256File(abs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`finddocs: failed to hash ${rel}: ${msg}`);
        return 1;
      }
      process.stdout.write(`+ ${rel}\t${hex}\n`);
    } else {
      process.stdout.write(`+ ${rel}\n`);
    }
  }
  return 0;
}
