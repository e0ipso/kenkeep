import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, posix, sep } from 'node:path';
import matter from 'gray-matter';
import { NODE_SCHEMA_VERSION } from './schemas.js';
import { atomicWriteFile } from './fs-atomic.js';
import { INDEX_FILENAME } from './nodes.js';

/**
 * One leaf-to-folder placement produced by the treeify launcher's clustering
 * step and consumed by the deterministic write primitive. `id` is the node
 * identity (the migration anchor; never derived from or coupled to placement),
 * `sourcePath` is the absolute path of the flat leaf on disk, and
 * `targetFolder` is the POSIX-style topical folder under `nodes/` the leaf
 * should move into (empty string means the `nodes/` root).
 */
export interface TreeifyPlacement {
  id: string;
  sourcePath: string;
  targetFolder: string;
}

/**
 * One executed placement, reported back to the launcher so it can print the
 * migration report (plan Success Criterion 6). `from` and `to` are POSIX-style
 * paths relative to `nodes/`.
 */
export interface TreeifyPlacementResult {
  id: string;
  from: string;
  to: string;
  targetFolder: string;
}

/**
 * Discriminated verdict from `detectKbLayout`. `flat` is the old
 * `nodes/<kind>/` two-bucket shape (or `schema_version: 1` leaves), eligible
 * for migration. `tree` is the new nested topical layout (or
 * `schema_version: NODE_SCHEMA_VERSION` leaves), already migrated. `empty` is a
 * KB with no recognizable leaves (nothing to migrate).
 */
export type KbLayout = 'flat' | 'tree' | 'empty';

const LEGACY_KIND_DIRS = ['practice', 'map'];

/**
 * Thrown when treeify is run against a knowledge base that is already in the
 * tree layout. Treeify is a one-time migration; it never reshuffles an
 * established tree. The message is actionable: it points the user at `curate`
 * and `rebalance` to evolve an existing tree (the mitigation for the
 * "running on an already-migrated tree" technical risk in plan 45).
 */
export class AlreadyMigratedError extends Error {
  constructor() {
    super(
      'This knowledge base is already in the tree layout; treeify is a one-time ' +
        'migration and will not reshuffle an established tree. Use `kenkeep curate` ' +
        'to evolve nodes, or rebalance the topical folders by hand (ids are stable).'
    );
    this.name = 'AlreadyMigratedError';
  }
}

/**
 * Thrown by the write primitive when a target path already holds a file.
 * Mirrors `practice-bootstrap-never-overwrites-existing-nodes`: the migration
 * is all-or-nothing and never clobbers existing knowledge. No writes have been
 * made when this throws (the conflict is detected in a pre-pass).
 */
export class TreeifyTargetExistsError extends Error {
  readonly conflictPath: string;
  constructor(conflictPath: string) {
    super(
      `Refusing to overwrite an existing file at ${conflictPath}. ` +
        'treeify never overwrites; resolve the conflict and re-run, or restore the tree.'
    );
    this.name = 'TreeifyTargetExistsError';
    this.conflictPath = conflictPath;
  }
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listLeafMarkdown(dir: string): string[] {
  if (!existsSync(dir) || !isDirectory(dir)) return [];
  return readdirSync(dir).filter(name => name.endsWith('.md') && name !== INDEX_FILENAME);
}

/**
 * Read-only detector that decides whether a KB is the old flat layout, the new
 * tree layout, or empty. Deterministic and side-effect free.
 *
 * Signals, in order:
 *   1. No `nodes/` dir or no leaf `.md` files anywhere -> `empty`.
 *   2. A `nodes/practice/` or `nodes/map/` bucket holding leaf docs with no
 *      `index.md`, i.e. the legacy two-bucket shape -> `flat`.
 *   3. Any leaf carrying `schema_version: 1` -> `flat` (pre-migration).
 *   4. Otherwise (tree-shaped, leaves at the current schema_version) -> `tree`.
 *
 * The directory shape and the leaf `schema_version` corroborate each other; a
 * KB at the current `schema_version` laid out as a tree is `tree`.
 */
export function detectKbLayout(nodesDir: string): KbLayout {
  if (!existsSync(nodesDir) || !isDirectory(nodesDir)) return 'empty';

  // Legacy two-bucket shape: nodes/<kind>/ holding leaves with no index.md.
  for (const kind of LEGACY_KIND_DIRS) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir) || !isDirectory(dir)) continue;
    const hasLeafDocs = listLeafMarkdown(dir).length > 0;
    const hasIndex = existsSync(join(dir, INDEX_FILENAME));
    if (hasLeafDocs && !hasIndex) return 'flat';
  }

  const leaves = collectLeafPaths(nodesDir);
  if (leaves.length === 0) return 'empty';

  for (const leaf of leaves) {
    const version = readSchemaVersion(leaf);
    // Any pre-migration leaf marks the whole KB as flat and migratable.
    if (version === 1) return 'flat';
  }
  // Tree-shaped, no pre-migration leaves: already migrated.
  return 'tree';
}

function collectLeafPaths(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name === INDEX_FILENAME) continue;
      out.push(full);
    }
  };
  walk(rootDir);
  return out;
}

function readSchemaVersion(file: string): number | null {
  try {
    const parsed = matter(readFileSync(file, 'utf8'));
    const raw = (parsed.data as Record<string, unknown>).schema_version;
    return typeof raw === 'number' ? raw : null;
  } catch {
    return null;
  }
}

function toPosixRel(rootDir: string, fullPath: string): string {
  return fullPath
    .slice(rootDir.length)
    .split(sep)
    .join(posix.sep)
    .replace(/^\/+/, '');
}

function targetPathFor(nodesDir: string, placement: TreeifyPlacement): string {
  const filename = `${placement.id}.md`;
  const folder = placement.targetFolder.trim();
  if (folder === '') return join(nodesDir, filename);
  return join(nodesDir, ...folder.split(posix.sep), filename);
}

/**
 * Deterministic, non-LLM write primitive for the treeify migration. Takes a set
 * of leaf-to-folder placements (computed by the launcher) and moves each flat
 * leaf into its assigned topical folder, preserving the leaf's `id` and every
 * edge (`relates_to`, `derived_from`, `depends_on`, and any other field) and
 * bumping only `schema_version` to the current value.
 *
 * Contract:
 *   - All-or-nothing: a first pass verifies no target already exists. If any
 *     target is occupied it throws `TreeifyTargetExistsError` before writing
 *     anything, so an aborted migration leaves the KB unchanged.
 *   - Identity preserved: the id is asserted present and is never mutated; only
 *     `schema_version` changes. No clustering judgment lives here.
 *   - Atomic per leaf: each write goes through the atomic-write helper, then the
 *     old flat-location file is removed so `git diff` shows a rename, not a
 *     duplicate.
 *   - No git: this never stages, commits, or invokes git.
 */
export function writeTreeifyPlacements(
  nodesDir: string,
  placements: TreeifyPlacement[]
): TreeifyPlacementResult[] {
  // Pre-pass: verify every source exists, every id matches, and no target is
  // already occupied. Make zero writes if anything is wrong (all-or-nothing).
  const targets = new Set<string>();
  for (const placement of placements) {
    if (!existsSync(placement.sourcePath)) {
      throw new Error(`treeify: source leaf not found at ${placement.sourcePath}`);
    }
    const parsed = matter(readFileSync(placement.sourcePath, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    if (typeof data.id !== 'string' || data.id.length === 0) {
      throw new Error(`treeify: leaf at ${placement.sourcePath} has no id; cannot migrate`);
    }
    if (data.id !== placement.id) {
      throw new Error(
        `treeify: placement id "${placement.id}" does not match leaf id "${String(data.id)}" ` +
          `at ${placement.sourcePath}`
      );
    }
    const target = targetPathFor(nodesDir, placement);
    if (existsSync(target) && target !== placement.sourcePath) {
      throw new TreeifyTargetExistsError(target);
    }
    if (targets.has(target)) {
      throw new TreeifyTargetExistsError(target);
    }
    targets.add(target);
  }

  // Write pass: place each leaf, preserving all frontmatter except a
  // schema_version bump, then remove the old flat-location file.
  const results: TreeifyPlacementResult[] = [];
  for (const placement of placements) {
    const parsed = matter(readFileSync(placement.sourcePath, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    const nextFrontmatter: Record<string, unknown> = {
      ...data,
      schema_version: NODE_SCHEMA_VERSION,
    };
    const target = targetPathFor(nodesDir, placement);
    mkdirSync(dirname(target), { recursive: true });
    const out = matter.stringify(parsed.content, nextFrontmatter);
    atomicWriteFile(target, out);
    if (target !== placement.sourcePath) {
      rmSync(placement.sourcePath);
    }
    results.push({
      id: placement.id,
      from: toPosixRel(nodesDir, placement.sourcePath),
      to: toPosixRel(nodesDir, target),
      targetFolder: placement.targetFolder.trim(),
    });
  }
  return results;
}
