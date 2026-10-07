import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, posix, sep } from 'node:path';
import matter from 'gray-matter';
import { atomicWriteFile } from './fs-atomic.js';
import { assertContained, isCanonicalSlug, resolveContainedDir } from './path-safety.js';

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

/**
 * The contained target path for a placement. The id names the file, so it must
 * be a single canonical slug segment; the folder goes through the shared
 * resolver (normalized, no `..`/absolute escape, no symlinked segment) and the
 * joined file path is containment-checked too. Throws before any write.
 */
function targetPathFor(nodesDir: string, placement: Placement): string {
  if (!isCanonicalSlug(placement.id)) {
    throw new Error(
      `placement id "${placement.id}" is not a canonical <kind>-<slug> id; fix the leaf's id ` +
        'and filename before migrating'
    );
  }
  const dir = resolveContainedDir(nodesDir, placement.targetFolder);
  return assertContained(nodesDir, join(dir, `${placement.id}.md`));
}

/** One preflighted placement: its resolved target and the exact bytes to write there. */
interface PlannedWrite {
  placement: Placement;
  target: string;
  content: string;
}

/**
 * Deterministic, non-LLM write primitive: places each leaf into its assigned
 * topical folder, preserving the leaf's `id` and every edge and bumping only
 * `schema_version` to the tree-storage v2 value.
 *
 * Contract:
 *   - Placements come from `reconcilePlacements`, which matches each one to a
 *     leaf read from disk and places every id exactly once.
 *   - Preflight before any write: every target is contained, no two
 *     placements share a target and no target is already occupied
 *     (`TargetExistsError`). The output bytes are rendered up front, so a
 *     malformed leaf is caught here too. Nothing is written if anything is
 *     wrong.
 *   - Destinations before sources: every destination is written (atomically,
 *     per file) before any source is removed, so a failure mid-run never
 *     leaves a leaf with neither copy on disk. The two passes make `git diff`
 *     show each successful placement as a rename, not a duplicate.
 *   - Identity preserved: the id is never mutated.
 *   - No git: never stages, commits, or invokes git.
 */
export function writePlacements(nodesDir: string, placements: Placement[]): PlacementResult[] {
  const plan = preflightPlacements(nodesDir, placements);

  for (const entry of plan) {
    mkdirSync(dirname(entry.target), { recursive: true });
    atomicWriteFile(entry.target, entry.content);
  }
  for (const entry of plan) {
    if (entry.target !== entry.placement.sourcePath) rmSync(entry.placement.sourcePath);
  }

  return plan.map(entry => ({
    id: entry.placement.id,
    from: toPosixRel(nodesDir, entry.placement.sourcePath),
    to: toPosixRel(nodesDir, entry.target),
    targetFolder: entry.placement.targetFolder.trim(),
  }));
}

/**
 * The read-only pass: resolves the complete intended output tree (target path
 * and bytes per leaf) before `writePlacements` touches anything. Throws on the
 * first problem; the tree is untouched when it does.
 */
function preflightPlacements(nodesDir: string, placements: Placement[]): PlannedWrite[] {
  const targets = new Set<string>();
  const plan: PlannedWrite[] = [];
  for (const placement of placements) {
    const parsed = matter(readFileSync(placement.sourcePath, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    const target = targetPathFor(nodesDir, placement);
    if (existsSync(target) && target !== placement.sourcePath) {
      throw new TargetExistsError(target);
    }
    if (targets.has(target)) {
      throw new TargetExistsError(target);
    }
    targets.add(target);
    // Preserve all frontmatter except the schema_version bump.
    const content = matter.stringify(parsed.content, {
      ...data,
      schema_version: FLAT_TO_TREE_SCHEMA_VERSION,
    });
    plan.push({ placement, target, content });
  }
  return plan;
}
