import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import picomatch from 'picomatch';
import ignore, { type Ignore } from 'ignore';
import type { ZodSchema } from 'zod';
import {
  BootstrapOutputSchema,
  BootstrapStateSchema,
  type BootstrapCandidate,
  type BootstrapOutput,
  type BootstrapState,
  type NodeFrontmatter,
} from './schemas.js';
import lockfile from 'proper-lockfile';
import { STATE_LOCK_OPTIONS } from './state.js';
import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';
import { deriveNodeId, ensureUniqueId, nodeFileExists, writeNodeFile } from './nodes.js';
import type { RepoPaths } from './paths.js';
import { compactStamp } from './time.js';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const CHUNK_PLACEHOLDER = '[CHUNK PLACEHOLDER, substituted at runtime]';

/**
 * Filenames that are categorically not project knowledge. Applied by
 * `discoverMarkdownFiles` before `--include` / `--exclude` / `.gitignore`,
 * with one inversion: an explicit `--include` pattern that matches a
 * statically-skipped path admits the file (so callers can opt a specific
 * file back in without rewriting the deny list).
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
  '**/INDEX.md',
  '**/GRAPH.md',
];

export type BootstrapRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: {
    timeoutMs: number;
    logFile?: string;
    harnessOpts?: Record<string, unknown>;
  }
) => Promise<T>;

export interface BootstrapContext {
  /** Root directory whose docs we scan (e.g. resolved `--from`). */
  sourceDir: string;
  /** Repo + KB paths resolved from the repo root. */
  paths: RepoPaths;
  /** Bootstrap-incremental prompt body. */
  promptTemplate: string;
  /** Subprocess runner (per-adapter headless driver). Unused when `dryRun: true`. */
  runner?: BootstrapRunner;
  include?: string[];
  exclude?: string[];
  dryRun?: boolean;
  timeoutMs?: number;
  /** Adapter-specific knobs (model, effort, allowedTools, ...). */
  harnessOpts?: Record<string, unknown>;
}

export interface DocCandidateFile {
  /** Path relative to the repo root, posix separators. */
  relPath: string;
  /** Absolute path on disk. */
  absPath: string;
  /** SHA-256 of file contents (hex). */
  sha256: string;
  /** UTF-8 contents. */
  content: string;
}

export interface BootstrapDocResult {
  relPath: string;
  status: 'processed' | 'unchanged' | 'skipped-dry-run' | 'failed';
  sha256: string;
  producedNodes: string[];
  error?: string;
}

export interface BootstrapResult {
  status: 'completed' | 'locked' | 'no-docs';
  runId: string;
  /** Total markdown files discovered after applying glob/.gitignore filters. */
  discovered: number;
  /** Files whose hash matched the state file and were skipped. */
  unchanged: number;
  /** Files that were processed this run (or would be in --dry-run). */
  processed: BootstrapDocResult[];
  /** Total nodes written. */
  nodesWritten: number;
  /** Total nodes skipped because the target file already exists. */
  skippedCollisions: number;
  /** Batches sent to the runner (0 in dry-run). */
  batches: number;
  reason?: string;
}

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
  sourceDir: string;
  repoRoot: string;
  include?: string[];
  exclude?: string[];
  gitignore?: Ignore;
}

/**
 * Walks `sourceDir` recursively returning every `.md` file (paths relative
 * to `repoRoot`, posix). Applies `--include` (every pattern must allow the
 * path — or the include list is empty), `--exclude` (any pattern blocks),
 * and the provided `.gitignore` Ignore instance (any match blocks).
 */
export function discoverMarkdownFiles(opts: DiscoverOptions): string[] {
  const out: string[] = [];
  if (!existsSync(opts.sourceDir)) return out;
  walk(opts.sourceDir, opts.sourceDir, out);
  const includeMatchers = (opts.include ?? []).map(p => picomatch(p));
  const excludeMatchers = (opts.exclude ?? []).map(p => picomatch(p));
  const staticSkipMatchers = STATIC_SKIPS.map(p => picomatch(p, { dot: true }));
  const ig = opts.gitignore;
  return out
    .map(abs => relativePosix(opts.repoRoot, abs))
    .filter(rel => {
      const staticallySkipped = staticSkipMatchers.some(m => m(rel));
      const explicitlyIncluded = includeMatchers.length > 0 && includeMatchers.some(m => m(rel));
      if (staticallySkipped && !explicitlyIncluded) return false;
      if (excludeMatchers.some(m => m(rel))) return false;
      if (ig && ig.ignores(rel)) return false;
      if (includeMatchers.length > 0 && !includeMatchers.some(m => m(rel))) return false;
      return true;
    })
    .sort();
}

function walk(rootDir: string, currentDir: string, out: string[]): void {
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
      walk(rootDir, full, out);
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
 * Builds the per-batch chunk string fed into the bootstrap prompt:
 *
 *   === FILE: <path> ===
 *   <contents>
 *   === END FILE ===
 *
 *   === FILE: <path> ===
 *   ...
 */
export function buildChunkString(batch: DocCandidateFile[]): string {
  const parts: string[] = [];
  for (const d of batch) {
    parts.push(`=== FILE: ${d.relPath} ===`);
    parts.push(d.content.replace(/\r\n/g, '\n').trimEnd());
    parts.push('=== END FILE ===');
    parts.push('');
  }
  return parts.join('\n').trimEnd();
}

export function buildPrompt(template: string, chunk: string): string {
  if (!template.includes(CHUNK_PLACEHOLDER)) {
    throw new Error(
      `bootstrap prompt is missing the ${CHUNK_PLACEHOLDER} placeholder; the prompt template must contain it verbatim`
    );
  }
  return template.replace(CHUNK_PLACEHOLDER, chunk);
}

/**
 * Runs one bootstrap-incremental invocation. Acquires the shared
 * `state.json` lock (`name: bootstrap-incremental`), reads
 * `bootstrap-state.json`, skips unchanged docs, chunks the remainder, and
 * for each chunk calls `runner` against `BootstrapOutputSchema`. Per
 * candidate, writes an `addition` proposal under `_proposed/additions/` and
 * updates the state file. `dryRun: true` short-circuits the runner and
 * proposal writes; state is not mutated.
 */
export async function runBootstrapIncremental(ctx: BootstrapContext): Promise<BootstrapResult> {
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runId = randomUUID();
  const stateFile = join(ctx.paths.stateDir, 'state.json');
  const bootstrapStateFile = join(ctx.paths.stateDir, 'bootstrap-state.json');

  const gitignorePath = join(ctx.paths.root, '.gitignore');
  const gitignoreInstance = existsSync(gitignorePath)
    ? ignore().add(readFileSync(gitignorePath, 'utf8'))
    : undefined;

  const discoverOpts: DiscoverOptions = {
    sourceDir: ctx.sourceDir,
    repoRoot: ctx.paths.root,
  };
  if (gitignoreInstance) discoverOpts.gitignore = gitignoreInstance;
  if (ctx.include !== undefined) discoverOpts.include = ctx.include;
  if (ctx.exclude !== undefined) discoverOpts.exclude = ctx.exclude;
  const relPaths = discoverMarkdownFiles(discoverOpts);

  if (relPaths.length === 0) {
    return {
      status: 'no-docs',
      runId,
      discovered: 0,
      unchanged: 0,
      processed: [],
      nodesWritten: 0,
      skippedCollisions: 0,
      batches: 0,
    };
  }

  const state = readBootstrapState(bootstrapStateFile);
  const candidates: DocCandidateFile[] = [];
  const unchanged: BootstrapDocResult[] = [];
  for (const rel of relPaths) {
    const abs = join(ctx.paths.root, rel);
    let content: string;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const sha = sha256Hex(content);
    const prev = state.docs[rel];
    if (prev && prev.content_sha256 === sha) {
      unchanged.push({
        relPath: rel,
        status: 'unchanged',
        sha256: sha,
        producedNodes: prev.produced_nodes,
      });
      continue;
    }
    candidates.push({ relPath: rel, absPath: abs, sha256: sha, content });
  }

  if (candidates.length === 0) {
    return {
      status: 'completed',
      runId,
      discovered: relPaths.length,
      unchanged: unchanged.length,
      processed: unchanged,
      nodesWritten: 0,
      skippedCollisions: 0,
      batches: 0,
    };
  }

  if (ctx.dryRun) {
    const dryResults: BootstrapDocResult[] = candidates.map(c => ({
      relPath: c.relPath,
      status: 'skipped-dry-run',
      sha256: c.sha256,
      producedNodes: [],
    }));
    return {
      status: 'completed',
      runId,
      discovered: relPaths.length,
      unchanged: unchanged.length,
      processed: [...dryResults, ...unchanged],
      nodesWritten: 0,
      skippedCollisions: 0,
      batches: candidates.length,
    };
  }

  if (!ctx.runner) {
    throw new Error('bootstrap-incremental: runner is required when dryRun is false');
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(stateFile, STATE_LOCK_OPTIONS);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOCKED') {
      return {
        status: 'locked',
        runId,
        discovered: relPaths.length,
        unchanged: unchanged.length,
        processed: unchanged,
        nodesWritten: 0,
        skippedCollisions: 0,
        batches: 0,
        reason: 'another bootstrap-incremental run holds the lock',
      };
    }
    throw err;
  }

  const startStamp = compactStamp(new Date());
  const logFile = join(ctx.paths.logsDir, 'bootstrap-incremental', `${runId}__${startStamp}.jsonl`);
  mkdirSync(dirname(logFile), { recursive: true });

  const processed: BootstrapDocResult[] = [];
  const existingIds = new Set<string>();
  const seenSlugs = new Set<string>();
  let nodesWritten = 0;
  let skippedCollisions = 0;
  const batches: DocCandidateFile[][] = candidates.map(c => [c]);

  try {
    for (const batch of batches) {
      const chunkStr = buildChunkString(batch);
      const prompt = buildPrompt(ctx.promptTemplate, chunkStr);
      let output: BootstrapOutput;
      try {
        output = await ctx.runner(prompt, '', BootstrapOutputSchema, {
          timeoutMs,
          logFile,
          ...(ctx.harnessOpts !== undefined ? { harnessOpts: ctx.harnessOpts } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        for (const doc of batch) {
          processed.push({
            relPath: doc.relPath,
            status: 'failed',
            sha256: doc.sha256,
            producedNodes: [],
            error: message,
          });
        }
        // Do not update state for failed docs so a re-run retries them.
        continue;
      }

      const perDocNodes = new Map<string, string[]>();
      for (const doc of batch) perDocNodes.set(doc.relPath, []);

      const allCandidates: BootstrapCandidate[] = [...output.practice, ...output.map];
      const derivedFrom = [batch[0]!.relPath];
      for (const cand of allCandidates) {
        const written = writeBootstrapNode({
          candidate: cand,
          derivedFrom,
          nodesDir: ctx.paths.nodesDir,
          existingIds,
          seenSlugs,
        });
        if (written === 'collision') {
          skippedCollisions += 1;
          continue;
        }
        nodesWritten += 1;
        for (const src of derivedFrom) {
          const list = perDocNodes.get(src);
          if (list) list.push(written);
        }
      }

      for (const doc of batch) {
        processed.push({
          relPath: doc.relPath,
          status: 'processed',
          sha256: doc.sha256,
          producedNodes: perDocNodes.get(doc.relPath) ?? [],
        });
      }
    }

    // Update state for every processed (successful) doc.
    const nextDocs: BootstrapState['docs'] = { ...state.docs };
    for (const r of processed) {
      if (r.status !== 'processed') continue;
      nextDocs[r.relPath] = {
        content_sha256: r.sha256,
        last_processed_at: new Date().toISOString(),
        produced_nodes: r.producedNodes,
      };
    }
    const nextState: BootstrapState = {
      schema_version: 1,
      last_full_bootstrap_at: state.last_full_bootstrap_at ?? null,
      last_incremental_at: new Date().toISOString(),
      docs: nextDocs,
    };
    writeBootstrapState(bootstrapStateFile, nextState);
  } finally {
    if (release !== undefined) await release();
  }

  return {
    status: 'completed',
    runId,
    discovered: relPaths.length,
    unchanged: unchanged.length,
    processed: [...processed, ...unchanged],
    nodesWritten,
    skippedCollisions,
    batches: batches.length,
  };
}

interface WriteBootstrapNodeArgs {
  candidate: BootstrapCandidate;
  derivedFrom: string[];
  nodesDir: string;
  existingIds: Set<string>;
  seenSlugs: Set<string>;
}

/**
 * Returns the relative `<kind>/<filename>.md` path on success, or the
 * literal `'collision'` if the target file already exists on disk.
 * Bootstrap is conservative: never overwrite existing nodes.
 */
function writeBootstrapNode(args: WriteBootstrapNodeArgs): string | 'collision' {
  const { candidate, derivedFrom, nodesDir, existingIds, seenSlugs } = args;
  const baseId = deriveNodeId(candidate.kind, candidate.title);
  if (existingIds.has(baseId) || nodeFileExists(nodesDir, candidate.kind, baseId)) {
    return 'collision';
  }
  const id = ensureUniqueId(new Set([...existingIds, ...seenSlugs]), baseId);
  seenSlugs.add(id);
  const frontmatter: NodeFrontmatter = {
    schema_version: 1,
    id,
    title: candidate.title,
    kind: candidate.kind,
    tags: candidate.tags,
    derived_from: derivedFrom,
    relates_to: [],
    confidence: candidate.confidence,
    summary: candidate.summary,
  };
  writeNodeFile({ nodesDir, frontmatter, body: candidate.body });
  return join(candidate.kind, `${id}.md`);
}
