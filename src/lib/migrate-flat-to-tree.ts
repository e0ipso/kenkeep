import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, posix, sep } from 'node:path';
import matter from 'gray-matter';
import { atomicWriteFile } from './fs-atomic.js';

const FLAT_TO_TREE_SCHEMA_VERSION = 2;

/**
 * One leaf-to-folder placement: `id` is the node identity, `sourcePath` is the
 * leaf's current absolute path, and `targetFolder` is the POSIX-style folder
 * under `nodes/` it should move into (empty string means the `nodes/` root).
 */
export interface Placement {
  id: string;
  sourcePath: string;
  targetFolder: string;
}

/** One executed placement, returned for the run summary. */
export interface PlacementResult {
  id: string;
  from: string;
  to: string;
  targetFolder: string;
}

/**
 * Thrown when a target path already holds a file. The write primitive is
 * all-or-nothing and never overwrites: the conflict is caught in a pre-pass, so
 * no writes have been made when this throws.
 */
export class TargetExistsError extends Error {
  readonly conflictPath: string;
  constructor(conflictPath: string) {
    super(
      `Refusing to overwrite an existing file at ${conflictPath}. ` +
        'Resolve the conflict and retry, or restore the tree.'
    );
    this.name = 'TargetExistsError';
    this.conflictPath = conflictPath;
  }
}

function toPosixRel(rootDir: string, fullPath: string): string {
  return fullPath.slice(rootDir.length).split(sep).join(posix.sep).replace(/^\/+/, '');
}

function targetPathFor(nodesDir: string, placement: Placement): string {
  const filename = `${placement.id}.md`;
  const folder = placement.targetFolder.trim();
  if (folder === '') return join(nodesDir, filename);
  return join(nodesDir, ...folder.split(posix.sep), filename);
}

/**
 * Deterministic, non-LLM write primitive: places each leaf into its assigned
 * topical folder, preserving the leaf's `id` and every edge and bumping only
 * `schema_version` to the tree-storage v2 value.
 *
 * Contract:
 *   - All-or-nothing: a first pass verifies no target already exists; it throws
 *     `TargetExistsError` before any write if one does.
 *   - Identity preserved: the id is asserted present and never mutated.
 *   - Atomic per leaf, then the old-location file is removed so `git diff` shows
 *     a rename, not a duplicate.
 *   - No git: never stages, commits, or invokes git.
 */
export function writePlacements(nodesDir: string, placements: Placement[]): PlacementResult[] {
  // Pre-pass: verify every source exists, every id matches, and no target is
  // already occupied. Make zero writes if anything is wrong.
  const targets = new Set<string>();
  for (const placement of placements) {
    if (!existsSync(placement.sourcePath)) {
      throw new Error(`source leaf not found at ${placement.sourcePath}`);
    }
    const data = matter(readFileSync(placement.sourcePath, 'utf8')).data as Record<string, unknown>;
    if (typeof data.id !== 'string' || data.id.length === 0) {
      throw new Error(`leaf at ${placement.sourcePath} has no id; cannot place it`);
    }
    if (data.id !== placement.id) {
      throw new Error(
        `placement id "${placement.id}" does not match leaf id "${String(data.id)}" ` +
          `at ${placement.sourcePath}`
      );
    }
    const target = targetPathFor(nodesDir, placement);
    if (existsSync(target) && target !== placement.sourcePath) {
      throw new TargetExistsError(target);
    }
    if (targets.has(target)) {
      throw new TargetExistsError(target);
    }
    targets.add(target);
  }

  // Write pass: place each leaf, preserving all frontmatter except a
  // schema_version bump, then remove the old-location file.
  const results: PlacementResult[] = [];
  for (const placement of placements) {
    const parsed = matter(readFileSync(placement.sourcePath, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    const nextFrontmatter: Record<string, unknown> = {
      ...data,
      schema_version: FLAT_TO_TREE_SCHEMA_VERSION,
    };
    const target = targetPathFor(nodesDir, placement);
    mkdirSync(dirname(target), { recursive: true });
    atomicWriteFile(target, matter.stringify(parsed.content, nextFrontmatter));
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
