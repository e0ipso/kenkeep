import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import type { ZodSchema } from 'zod';
import {
  BootstrapOutputSchema,
  BootstrapStateSchema,
  type BootstrapCandidate,
  type BootstrapOutput,
  type BootstrapState,
  type ProposalFrontmatter,
} from './schemas.js';
import { acquireLock, releaseLock } from './state.js';
import { deriveNodeId, ensureUniqueId, proposalFilename, writeProposalFile } from './nodes.js';
import { ulid } from './ulid.js';

export const BOOTSTRAP_LOCK_NAME = 'bootstrap-incremental';
export const DEFAULT_TOKEN_BUDGET = 10_000;
export const DEFAULT_TIMEOUT_MS = 120_000;
const CHARS_PER_TOKEN = 4;
const CHUNK_PLACEHOLDER = '[CHUNK PLACEHOLDER — substituted at runtime]';

export type BootstrapRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: { timeoutMs: number; allowedTools?: string[]; logFile?: string },
) => Promise<T>;

export interface BootstrapContext {
  /** Root directory whose docs we scan (e.g. resolved `--from`). */
  sourceDir: string;
  /** Repo root (used to resolve `.gitignore` and shape `derived_from` paths). */
  repoRoot: string;
  /** `.ai/knowledge-base` directory (parent of `_proposed`, `_logs`). */
  kbDir: string;
  /** `_proposed/` directory. */
  proposedDir: string;
  /** `_logs/` directory. */
  logsDir: string;
  /** Path to `.ai/.kb-builder/state.json`. */
  stateFile: string;
  /** Path to `.ai/.kb-builder/bootstrap-state.json`. */
  bootstrapStateFile: string;
  /** Bootstrap-incremental prompt body. */
  promptTemplate: string;
  /** Subprocess runner (`claude -p` adapter). Unused when `dryRun: true`. */
  runner?: BootstrapRunner;
  include?: string[];
  exclude?: string[];
  dryRun?: boolean;
  tokenBudget?: number;
  timeoutMs?: number;
  now?: () => Date;
  pid?: number;
  /** Test seam: override the run id. */
  runId?: string;
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
  producedProposals: string[];
  error?: string;
}

export interface BootstrapResult {
  status: 'completed' | 'locked' | 'no-docs';
  runId?: string;
  /** Total markdown files discovered after applying glob/.gitignore filters. */
  discovered: number;
  /** Files whose hash matched the state file and were skipped. */
  unchanged: number;
  /** Files that were processed this run (or would be in --dry-run). */
  processed: BootstrapDocResult[];
  /** Total proposals written. */
  proposalsWritten: number;
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
  if (!existsSync(file)) return { schema_version: 1, docs: {} };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const parsed = BootstrapStateSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return { schema_version: 1, docs: {} };
}

/**
 * Atomically writes `bootstrap-state.json` (validated against the Zod schema).
 */
export function writeBootstrapState(file: string, state: BootstrapState): void {
  const validated = BootstrapStateSchema.parse(state);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(validated, null, 2)}\n`);
  renameSync(tmp, file);
}

/**
 * Lightweight glob matcher supporting the patterns documented for
 * `bootstrap-incremental --include` / `--exclude`:
 *
 * - `**` matches any number of path segments (including zero).
 * - `*` matches anything in a single segment.
 * - `?` matches a single non-slash character.
 *
 * Both pattern and path use posix-style separators.
 */
export function globMatch(pattern: string, path: string): boolean {
  const re = new RegExp(`^${globToRegex(pattern)}$`);
  return re.test(path);
}

function globToRegex(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // Handle `**/`, `/**`, and bare `**`.
        if (pattern[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 3;
          continue;
        }
        if (out.endsWith('/')) {
          out = out.slice(0, -1) + '(?:/.*)?';
          i += 2;
          continue;
        }
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    if ('\\^$.|+()[]{}'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
    i += 1;
  }
  return out;
}

/**
 * Parses a `.gitignore` file into an array of glob patterns. Comments,
 * blank lines, and negation patterns (`!…`) are dropped. Directory-suffix
 * patterns (`foo/`) become `foo/**`. Patterns without a leading `/` are
 * matched anywhere in the tree (prepended with `**\/`).
 */
export function parseGitignore(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('!')) continue; // v1: ignore negation
    let pat = line;
    const anchored = pat.startsWith('/');
    if (anchored) pat = pat.slice(1);
    if (pat.endsWith('/')) pat += '**';
    if (!anchored && !pat.includes('/')) {
      pat = `**/${pat}`;
    } else if (!anchored) {
      pat = `**/${pat}`;
    }
    out.push(pat);
  }
  return out;
}

export interface DiscoverOptions {
  sourceDir: string;
  repoRoot: string;
  include?: string[];
  exclude?: string[];
  gitignorePatterns?: string[];
}

/**
 * Walks `sourceDir` recursively returning every `.md` file (paths relative
 * to `repoRoot`, posix). Applies `--include` (every pattern must allow the
 * path — or the include list is empty), `--exclude` (any pattern blocks),
 * and `.gitignore` patterns (any pattern blocks).
 */
export function discoverMarkdownFiles(opts: DiscoverOptions): string[] {
  const out: string[] = [];
  if (!existsSync(opts.sourceDir)) return out;
  walk(opts.sourceDir, opts.sourceDir, out);
  const includes = opts.include ?? [];
  const excludes = opts.exclude ?? [];
  const ignore = opts.gitignorePatterns ?? [];
  return out
    .map((abs) => relativePosix(opts.repoRoot, abs))
    .filter((rel) => {
      if (excludes.some((p) => globMatch(p, rel))) return false;
      if (ignore.some((p) => globMatch(p, rel))) return false;
      if (includes.length > 0 && !includes.some((p) => globMatch(p, rel))) return false;
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
 * Splits the to-process doc set into batches sized by an approximate token
 * budget (chars/4). Each doc is treated as atomic — a single oversized doc
 * lands in its own batch.
 */
export function chunkDocs(docs: DocCandidateFile[], tokenBudget: number): DocCandidateFile[][] {
  const batches: DocCandidateFile[][] = [];
  let current: DocCandidateFile[] = [];
  let currentTokens = 0;
  for (const d of docs) {
    const cost = Math.max(1, Math.ceil(d.content.length / CHARS_PER_TOKEN));
    if (current.length > 0 && currentTokens + cost > tokenBudget) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(d);
    currentTokens += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
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

function buildPrompt(template: string, chunk: string): string {
  if (template.includes(CHUNK_PLACEHOLDER)) {
    return template.replace(CHUNK_PLACEHOLDER, chunk);
  }
  return `${template.trimEnd()}\n\n${chunk}\n`;
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
  const now = ctx.now ?? (() => new Date());
  const pid = ctx.pid ?? process.pid;
  const tokenBudget = ctx.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const gitignorePath = join(ctx.repoRoot, '.gitignore');
  const gitignorePatterns = existsSync(gitignorePath)
    ? parseGitignore(readFileSync(gitignorePath, 'utf8'))
    : [];

  const discoverOpts: DiscoverOptions = {
    sourceDir: ctx.sourceDir,
    repoRoot: ctx.repoRoot,
    gitignorePatterns,
  };
  if (ctx.include !== undefined) discoverOpts.include = ctx.include;
  if (ctx.exclude !== undefined) discoverOpts.exclude = ctx.exclude;
  const relPaths = discoverMarkdownFiles(discoverOpts);

  if (relPaths.length === 0) {
    return {
      status: 'no-docs',
      discovered: 0,
      unchanged: 0,
      processed: [],
      proposalsWritten: 0,
      batches: 0,
    };
  }

  const state = readBootstrapState(ctx.bootstrapStateFile);
  const candidates: DocCandidateFile[] = [];
  const unchanged: BootstrapDocResult[] = [];
  for (const rel of relPaths) {
    const abs = join(ctx.repoRoot, rel);
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
        producedProposals: prev.produced_proposals,
      });
      continue;
    }
    candidates.push({ relPath: rel, absPath: abs, sha256: sha, content });
  }

  if (candidates.length === 0) {
    return {
      status: 'completed',
      discovered: relPaths.length,
      unchanged: unchanged.length,
      processed: unchanged,
      proposalsWritten: 0,
      batches: 0,
    };
  }

  if (ctx.dryRun) {
    const dryResults: BootstrapDocResult[] = candidates.map((c) => ({
      relPath: c.relPath,
      status: 'skipped-dry-run',
      sha256: c.sha256,
      producedProposals: [],
    }));
    return {
      status: 'completed',
      discovered: relPaths.length,
      unchanged: unchanged.length,
      processed: [...dryResults, ...unchanged],
      proposalsWritten: 0,
      batches: chunkDocs(candidates, tokenBudget).length,
    };
  }

  if (!ctx.runner) {
    throw new Error('bootstrap-incremental: runner is required when dryRun is false');
  }

  const acquired = acquireLock(ctx.stateFile, {
    name: BOOTSTRAP_LOCK_NAME,
    pid,
    now: now(),
  });
  if (!acquired) {
    return {
      status: 'locked',
      discovered: relPaths.length,
      unchanged: unchanged.length,
      processed: unchanged,
      proposalsWritten: 0,
      batches: 0,
      reason: 'another bootstrap-incremental run holds the lock',
    };
  }

  const runId = ctx.runId ?? ulid(now());
  const startStamp = compactStamp(now());
  const logFile = join(ctx.logsDir, 'bootstrap-incremental', `${runId}__${startStamp}.jsonl`);
  mkdirSync(dirname(logFile), { recursive: true });

  const processed: BootstrapDocResult[] = [];
  const existingIds = new Set<string>();
  const seenSlugs = new Set<string>();
  let proposalsWritten = 0;
  const batches = chunkDocs(candidates, tokenBudget);

  try {
    for (const batch of batches) {
      const chunkStr = buildChunkString(batch);
      const prompt = buildPrompt(ctx.promptTemplate, chunkStr);
      let output: BootstrapOutput;
      try {
        output = await ctx.runner(prompt, '', BootstrapOutputSchema, {
          timeoutMs,
          allowedTools: [],
          logFile,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        for (const doc of batch) {
          processed.push({
            relPath: doc.relPath,
            status: 'failed',
            sha256: doc.sha256,
            producedProposals: [],
            error: message,
          });
        }
        // Do not update state for failed docs so a re-run retries them.
        continue;
      }

      const perDocProposals = new Map<string, string[]>();
      for (const doc of batch) perDocProposals.set(doc.relPath, []);

      const allCandidates: BootstrapCandidate[] = [...output.practice, ...output.map];
      for (const cand of allCandidates) {
        const derivedFrom =
          cand.derived_from.length > 0
            ? cand.derived_from
            : batch.length === 1
              ? [batch[0]!.relPath]
              : [];
        const written = writeBootstrapProposal({
          candidate: cand,
          derivedFrom,
          proposedDir: ctx.proposedDir,
          existingIds,
          seenSlugs,
          now: now(),
        });
        if (written) {
          proposalsWritten += 1;
          for (const src of derivedFrom) {
            const list = perDocProposals.get(src);
            if (list) list.push(written);
          }
        }
      }

      for (const doc of batch) {
        processed.push({
          relPath: doc.relPath,
          status: 'processed',
          sha256: doc.sha256,
          producedProposals: perDocProposals.get(doc.relPath) ?? [],
        });
      }
    }

    // Update state for every processed (successful) doc.
    const nextDocs: BootstrapState['docs'] = { ...state.docs };
    for (const r of processed) {
      if (r.status !== 'processed') continue;
      nextDocs[r.relPath] = {
        content_sha256: r.sha256,
        last_processed_at: now().toISOString(),
        produced_proposals: r.producedProposals,
      };
    }
    const nextState: BootstrapState = {
      schema_version: 1,
      last_full_bootstrap_at: state.last_full_bootstrap_at ?? null,
      last_incremental_at: now().toISOString(),
      docs: nextDocs,
    };
    writeBootstrapState(ctx.bootstrapStateFile, nextState);
  } finally {
    releaseLock(ctx.stateFile, BOOTSTRAP_LOCK_NAME, pid);
  }

  return {
    status: 'completed',
    runId,
    discovered: relPaths.length,
    unchanged: unchanged.length,
    processed: [...processed, ...unchanged],
    proposalsWritten,
    batches: batches.length,
  };
}

interface WriteBootstrapProposalArgs {
  candidate: BootstrapCandidate;
  derivedFrom: string[];
  proposedDir: string;
  existingIds: Set<string>;
  seenSlugs: Set<string>;
  now: Date;
}

function writeBootstrapProposal(args: WriteBootstrapProposalArgs): string | null {
  const { candidate, derivedFrom, proposedDir, existingIds, seenSlugs, now } = args;
  const id = ensureUniqueId(
    new Set([...existingIds, ...seenSlugs]),
    deriveNodeId(candidate.kind, candidate.title),
  );
  seenSlugs.add(id);
  const filename = proposalFilename(candidate.kind, id);
  const sourceLabel = derivedFrom[0] ?? '<unknown>';
  const frontmatter: ProposalFrontmatter = {
    schema_version: 1,
    id,
    title: candidate.title,
    kind: candidate.kind,
    tags: candidate.tags,
    valid_from: now.toISOString(),
    valid_until: null,
    updated: now.toISOString(),
    supersedes: null,
    superseded_by: null,
    derived_from: derivedFrom,
    relates_to: [],
    depends_on: [],
    confidence: candidate.confidence,
    summary: candidate.summary,
    proposal: {
      kind: 'addition',
      source_sessions: [],
      target_node: null,
      rationale: `bootstrap: ${sourceLabel}`,
      suggested_resolution: null,
      curator_log: null,
    },
  };
  writeProposalFile({
    proposedDir,
    proposalKind: 'additions',
    filename,
    frontmatter,
    body: candidate.body,
  });
  return join('additions', filename);
}

function compactStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
