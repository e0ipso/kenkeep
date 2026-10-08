import { lstatSync, type Stats } from 'node:fs';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

/**
 * The single id/folder/path containment boundary.
 *
 * Every write or move into the knowledge base goes through these checks before
 * any mutation, so a caller-supplied id, folder key, run id or resolved path
 * can never land outside its authorized root. A canonical id is a fixed
 * character class, a folder key is one normalized POSIX spelling, and
 * containment also checks the real filesystem: every existing segment is
 * `lstat`ed, so a symlink planted inside the tree cannot redirect a write.
 *
 * This module imports nothing from the schema or node modules, so both can
 * depend on it without a cycle.
 */

/**
 * A pack name: the manifest `name` and the branch folder an import grafts
 * into, so it is one lowercase path segment.
 */
export const PACK_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** True when `child` is `parent` or lies below it, compared as resolved paths. */
export function isWithin(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/**
 * A canonical slug: lowercase ascii letters/digits in dash-separated runs, no
 * leading/trailing/double dashes. This is exactly the fixed point of the
 * `slugify` normalization (`s === slugify(s)`), and it contains no path
 * separator, no `.`, and no whitespace, so a canonical id is always a single
 * safe filename segment.
 */
const CANONICAL_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when `value` is a canonical slug (see `CANONICAL_SLUG_RE`). */
export function isCanonicalSlug(value: string): boolean {
  return CANONICAL_SLUG_RE.test(value);
}

/**
 * Validates the canonical node id contract lint enforces: `<kind>-<slug>`,
 * where `kind` is the leaf's `type` facet and `slug` is canonical. Returns a
 * human-readable problem, or `null` when the id is valid. The message names
 * the expected prefix / canonical shape so a hand-edited leaf can be fixed.
 */
export function validateNodeId(id: string, kind: string): string | null {
  if (id.trim() === '') {
    return 'leaf has an empty id; every leaf must carry a stable id';
  }
  const prefix = `${kind}-`;
  if (!id.startsWith(prefix)) {
    return `id ${id} does not start with type prefix ${prefix}`;
  }
  const bare = id.slice(prefix.length);
  if (!isCanonicalSlug(bare)) {
    return `id ${id} is not canonical; expected ${kind}-<slug> where <slug> is lowercase ascii letters, digits and single dashes`;
  }
  return null;
}

/** Throws when `id` is not a canonical `<kind>-<slug>` id. */
export function assertCanonicalNodeId(id: string, kind: string): string {
  const problem = validateNodeId(id, kind);
  if (problem !== null) throw new Error(problem);
  return id;
}

/**
 * Normalizes a folder key relative to a root (`nodes/`, a pack's
 * `knowledge/`) to one canonical POSIX spelling: no leading `./`, no
 * duplicate or trailing slashes, `.` segments collapsed. `''`, `.` and `/`
 * all denote the root and normalize to `''`. Returns `null` when the key
 * escapes the root (absolute, or `..` climbing above it). Kind names such as
 * `map` and `practice` are ordinary topical folder names here.
 */
export function tryNormalizeFolderKey(key: string): string | null {
  const trimmed = key.trim();
  // `''`, `.` and a bare `/` all spell the root; any other absolute path is an
  // escape, rejected before `normalize` could fold it into a subfolder.
  if (trimmed === '' || trimmed === '.' || trimmed === '/') return '';
  if (isAbsolute(trimmed) || trimmed.startsWith('/')) return null;
  const normalized = posix.normalize(trimmed.split(sep).join(posix.sep));
  if (normalized === '.' || normalized === './') return '';
  if (normalized === '..' || normalized.startsWith('../')) return null;
  return normalized.replace(/\/+$/u, '');
}

/**
 * `tryNormalizeFolderKey` for trusted-but-checked input: throws a message that
 * names the offending key when it escapes `root` (the label is for the message
 * only, e.g. `nodes/`).
 */
export function normalizeFolderKey(key: string, root = 'nodes/'): string {
  const normalized = tryNormalizeFolderKey(key);
  if (normalized === null) {
    throw new Error(
      `folder "${key}" escapes ${root}; placement must target a folder under ${root}`
    );
  }
  return normalized;
}

/**
 * Run ids name files (`conflicts/<runId>-<n>.md`, `_logs/<runId>__<n>.jsonl`),
 * so they must be a single safe filename segment: ascii letters, digits, `.`,
 * `_` and `-`, starting with a letter or digit (so `.`/`..`/dotfiles are out),
 * at most 128 characters. Accepts the UUIDs and `<skill>-<timestamp>` ids the
 * skills mint. Returns the id unchanged; throws otherwise.
 */
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertValidRunId(runId: string): string {
  if (!RUN_ID_RE.test(runId)) {
    throw new Error(
      `run id "${runId}" is not valid; use letters, digits, '.', '_' or '-' (starting with a letter or digit)`
    );
  }
  return runId;
}

function lstatOrNull(p: string): Stats | null {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

/**
 * True when an entry other than a real directory sits at `path`, so a writer
 * cannot create files below it. A missing path is not one.
 */
export function isNonDirectory(path: string): boolean {
  const stat = lstatOrNull(path);
  return stat !== null && !stat.isDirectory();
}

/**
 * Asserts that `target` lies within `root` on the real filesystem and returns
 * the absolute target. Rejects:
 *
 *   - lexical escapes: after `resolve`, `target` is not `root` or below it
 *     (`..` traversal, absolute paths elsewhere);
 *   - symlinked segments: every path segment below `root` that already exists
 *     is `lstat`ed, and any symlink (directory or file, whether it points
 *     inside or outside the tree) is refused, because a writer that follows it
 *     would write where the link says, not where the path says.
 *
 * With no symlink between `root` and `target`, the real path of `target` is
 * the real path of `root` plus the same segments, so no separate realpath
 * check is needed. `root` itself may be a symlink (e.g. a tmpdir), and
 * `target` may not exist yet (the writer creates it); only the segments
 * between the two are checked. `label` names the root in error messages
 * (default `nodes/`).
 */
export function assertContained(root: string, target: string, label = 'nodes/'): string {
  const absRoot = resolve(root);
  const absTarget = resolve(target);
  if (!isWithin(absRoot, absTarget)) {
    throw new Error(`path "${target}" escapes ${label}; it must stay under ${label}`);
  }

  let cursor = absRoot;
  for (const segment of relative(absRoot, absTarget).split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    const stat = lstatOrNull(cursor);
    if (stat === null) break; // Remaining segments do not exist yet; the writer creates them.
    if (stat.isSymbolicLink()) {
      throw new Error(
        `path "${target}" crosses the symlink "${cursor}"; symlinks under ${label} are not followed for writes`
      );
    }
  }
  return absTarget;
}

/**
 * Resolves a folder key under `rootDir` to an absolute, contained directory:
 * normalizes the key (`normalizeFolderKey`), joins it, and runs
 * `assertContained`. The empty/root key resolves to `rootDir` itself. This is
 * the one folder resolver every write/move boundary uses.
 */
export function resolveContainedDir(rootDir: string, folderKey: string, label = 'nodes/'): string {
  const key = normalizeFolderKey(folderKey, label);
  const dir = key === '' ? rootDir : join(rootDir, ...key.split(posix.sep));
  return assertContained(rootDir, dir, label);
}
