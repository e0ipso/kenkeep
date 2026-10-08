import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import matter from 'gray-matter';
import { atomicWriteFile } from './fs-atomic.js';
import { assertContained } from './path-safety.js';
import {
  CONFLICT_SCHEMA_VERSION,
  ConflictFrontmatterSchema,
  OPEN_CONFLICT_STATUSES,
  type ConflictFrontmatter,
  type ConflictStatus,
} from './schemas.js';

export const CONFLICTS_LABEL = 'conflicts/';

/** A conflict file read from disk and validated against the current shape. */
export interface ConflictRecord {
  /** Absolute path of the conflict file. */
  file: string;
  frontmatter: ConflictFrontmatter;
}

export type ConflictReadResult =
  | { ok: true; record: ConflictRecord }
  | { ok: false; file: string; reason: string };

/**
 * Renders a conflict file. The frontmatter is the authoritative, lossless
 * record (full proposal, rationale, target, status); the markdown body is a
 * human-readable rendering of the rationale and the proposed body for review
 * in git, and is never parsed back. One renderer keeps the producer
 * (`curate-dedup`) and the writers that update status byte-consistent.
 */
export function renderConflictFile(fm: ConflictFrontmatter): string {
  let body = `## Rationale\n\n${fm.rationale.trimEnd()}\n`;
  if (fm.proposal !== null) {
    body += `\n## Proposed node\n\n${fm.proposal.body.trimEnd()}\n`;
  }
  return matter.stringify(body, fm);
}

/**
 * Where conflict files live and the directory their write boundary starts
 * from. `trustedRoot` is the repository root for the default
 * `.ai/kenkeep/conflicts/`, so `.ai` and `.ai/kenkeep` are checked too. An
 * explicit directory override is the caller's own choice, so only its
 * `conflicts` segment and the files below it are checked.
 */
export interface ConflictsLocation {
  dir: string;
  trustedRoot: string;
}

/** The conflicts location for a command: the repo default unless `override` is given. */
export function conflictsLocation(
  repoRoot: string,
  defaultDir: string,
  override: string | undefined
): ConflictsLocation {
  if (override !== undefined) return { dir: override, trustedRoot: dirname(resolve(override)) };
  return { dir: defaultDir, trustedRoot: repoRoot };
}

/**
 * The write boundary for one conflict file. `file` must stay under the
 * conflicts directory, and no existing segment from the trusted root down to
 * the file may be a symlink: a linked `.ai`, `.ai/kenkeep` or `conflicts/`
 * would put the write outside the knowledge base, and the atomic rename would
 * replace a linked file instead of writing through it. Writers run this for
 * every file before their first write, so a refusal never leaves a partial
 * set of writes behind.
 */
export function assertConflictWritable(loc: ConflictsLocation, file: string): string {
  const abs = assertContained(loc.dir, file, CONFLICTS_LABEL);
  return assertContained(loc.trustedRoot, abs, CONFLICTS_LABEL);
}

/** Atomically writes a conflict file from its validated frontmatter. */
export function writeConflictFile(
  loc: ConflictsLocation,
  file: string,
  fm: ConflictFrontmatter
): void {
  atomicWriteFile(assertConflictWritable(loc, file), renderConflictFile(fm));
}

function isOpenStatus(status: unknown): status is ConflictStatus {
  return typeof status === 'string' && OPEN_CONFLICT_STATUSES.has(status as ConflictStatus);
}

function legacyGuidance(file: string, found: unknown, target: unknown): string {
  const version =
    found === undefined ? 'has no schema_version' : `has schema_version ${JSON.stringify(found)}`;
  const targetText = typeof target === 'string' ? `"${target}"` : 'its target';
  return (
    `conflict file ${basename(file)} ${version}; expected schema_version: ${CONFLICT_SCHEMA_VERSION}. ` +
    'This legacy conflict does not carry the full proposal, so `conflict resolve` cannot apply it. ' +
    `Review it by hand: to accept, edit the target node ${targetText} yourself from the file's ` +
    '`## Proposed node` section and run `npx kenkeep index rebuild`; then delete the file, or set ' +
    '`status: kept` in its frontmatter to keep it as a record. To discard it, delete the file.'
  );
}

/**
 * Reads and validates one conflict file. Rejects an unparseable file, the
 * legacy unversioned shape (with hand-review guidance) and any frontmatter
 * that does not match `ConflictFrontmatterSchema`.
 */
export function readConflictFile(file: string): ConflictReadResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(readFileSync(file, 'utf8'));
  } catch (err) {
    return { ok: false, file, reason: `cannot parse ${basename(file)}: ${(err as Error).message}` };
  }
  const raw = parsed.data as Record<string, unknown>;
  if (raw['schema_version'] !== CONFLICT_SCHEMA_VERSION) {
    return {
      ok: false,
      file,
      reason: legacyGuidance(file, raw['schema_version'], raw['target_node_id']),
    };
  }
  const checked = ConflictFrontmatterSchema.safeParse(raw);
  if (!checked.success) {
    const issues = checked.error.issues
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, file, reason: `conflict file ${basename(file)} is invalid: ${issues}` };
  }
  return { ok: true, record: { file, frontmatter: checked.data } };
}

/** Sorted absolute paths of the `.md` files under `conflictsDir` (none when absent). */
export function listConflictFiles(conflictsDir: string): string[] {
  if (!existsSync(conflictsDir)) return [];
  return readdirSync(conflictsDir)
    .filter(name => name.endsWith('.md'))
    .sort()
    .map(name => join(conflictsDir, name));
}

export interface OpenConflicts {
  conflicts: ConflictRecord[];
  problems: Array<{ file: string; reason: string }>;
}

/**
 * Reads every *open* conflict (status `pending` or `skipped`) under
 * `conflictsDir`, validating each against the current shape. Files whose raw
 * status is already terminal are left alone unvalidated, so a legacy file the
 * human marked `kept` by hand stops blocking review. Any open file that fails
 * to parse or validate is reported in `problems` instead of being silently
 * dropped: a conflict the human never sees is a decision never made.
 */
export function readOpenConflicts(conflictsDir: string): OpenConflicts {
  const conflicts: ConflictRecord[] = [];
  const problems: Array<{ file: string; reason: string }> = [];
  for (const file of listConflictFiles(conflictsDir)) {
    let raw: Record<string, unknown>;
    try {
      raw = matter(readFileSync(file, 'utf8')).data as Record<string, unknown>;
    } catch (err) {
      problems.push({ file, reason: `cannot parse ${basename(file)}: ${(err as Error).message}` });
      continue;
    }
    if (!isOpenStatus(raw['status'])) continue;
    const result = readConflictFile(file);
    if (result.ok) conflicts.push(result.record);
    else problems.push({ file, reason: result.reason });
  }
  return { conflicts, problems };
}

/**
 * Target ids of every open conflict, read leniently (any parseable file with an
 * open status and a string `target_node_id`, legacy shape included). Used by
 * the rebalance trigger to hold a target stable while a human decision is
 * outstanding; a malformed file is skipped rather than failing the trigger,
 * because `conflict prepare` is the place that reports it.
 */
export function openConflictTargetIds(conflictsDir: string): Set<string> {
  const ids = new Set<string>();
  for (const file of listConflictFiles(conflictsDir)) {
    let raw: Record<string, unknown>;
    try {
      raw = matter(readFileSync(file, 'utf8')).data as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!isOpenStatus(raw['status'])) continue;
    const target = raw['target_node_id'];
    if (typeof target === 'string' && target !== '') ids.add(target);
  }
  return ids;
}

/**
 * Resolves the `<conflict>` argument of `conflict resolve` to an absolute file
 * under `loc.dir`. A bare id maps to `<loc.dir>/<id>.md`; anything
 * that looks like a path (`.md` suffix, a separator, or an existing file) is
 * taken as a path. Either way the result must pass `assertConflictWritable`,
 * because `conflict resolve` rewrites it after applying the decision.
 */
export function resolveConflictPath(loc: ConflictsLocation, ref: string): string {
  const looksLikePath =
    ref.endsWith('.md') || ref.includes('/') || ref.includes('\\') || isAbsolute(ref);
  const candidate = looksLikePath
    ? isAbsolute(ref)
      ? ref
      : resolve(process.cwd(), ref)
    : join(loc.dir, `${ref}.md`);
  const abs = assertConflictWritable(loc, candidate);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error(`conflict "${ref}" not found under ${CONFLICTS_LABEL} (${abs})`);
  }
  return abs;
}

/**
 * Line-level diff size between two bodies using an LCS (longest common
 * subsequence): deletions plus insertions. Deterministic and dependency-free.
 * Identical bodies yield 0; a one-line edit in an otherwise-shared body yields 2.
 */
export function lineDiffCount(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  let prev = new Array<number>(m + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const curr = new Array<number>(m + 1).fill(0);
    const ai = a[i];
    for (let j = m - 1; j >= 0; j--) {
      curr[j] = ai === b[j] ? (prev[j + 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, curr[j + 1] ?? 0);
    }
    prev = curr;
  }
  const lcs = prev[0] ?? 0;
  return n - lcs + (m - lcs);
}

function bodyLines(body: string): string[] {
  const trimmed = body.replace(/\n+$/, '');
  if (trimmed === '') return [];
  return trimmed.split('\n');
}

export interface ConflictDefault {
  lines_changed: number;
  total_lines: number;
  ratio: number;
  default: 'accept' | 'reject' | 'skip';
}

/**
 * The displayed default for one conflict (the `kk-curate` diff-ratio rules,
 * first match wins): a small change (< 5 lines) at high confidence defaults
 * to `accept`; a rewrite touching more than half the lines defaults to
 * `reject`; everything else, a missing target on disk, or a conflict with no
 * proposal to accept defaults to `skip`.
 */
export function computeConflictDefault(
  existingBody: string | null,
  fm: Pick<ConflictFrontmatter, 'proposal'>
): ConflictDefault {
  if (existingBody === null || fm.proposal === null) {
    return { lines_changed: 0, total_lines: 0, ratio: 0, default: 'skip' };
  }
  const proposed = bodyLines(fm.proposal.body);
  const current = bodyLines(existingBody);
  const linesChanged = lineDiffCount(proposed, current);
  const totalLines = Math.max(proposed.length, current.length);
  const ratio = totalLines === 0 ? 0 : linesChanged / totalLines;
  let def: ConflictDefault['default'];
  if (linesChanged < 5 && fm.proposal.kk_confidence === 'high') def = 'accept';
  else if (ratio > 0.5) def = 'reject';
  else def = 'skip';
  return { lines_changed: linesChanged, total_lines: totalLines, ratio, default: def };
}
