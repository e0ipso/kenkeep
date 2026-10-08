import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './fs-atomic.js';
import {
  assertContained,
  isNonDirectory,
  normalizeFolderKey,
  resolveContainedDir,
} from './path-safety.js';
import {
  deriveNodeId,
  ensureUniqueId,
  INDEX_FILENAME,
  nodeFilename,
  readAllNodes,
  reservedNodeIds,
  stampFolderSummary,
  writeNodeFile,
  type NodeFile,
} from './nodes.js';
import { readRedirectsLedger, writeRedirectsLedger } from './redirects.js';
import { refreshRenderedLinks } from './rendered-links.js';
import { NODE_SCHEMA_VERSION, NodeFrontmatterSchema, type NodeFrontmatter } from './schemas.js';

/**
 * One sub-document produced by a split-leaf: a brand new leaf carved out of the
 * bloated original. The id is minted deterministically from the title (the
 * caller never supplies an id); content is authored fresh, so this is the only
 * operation that serializes new bytes.
 *
 * Edges are distributed deliberately: the plan names, per child, which
 * `relates_to` / `depends_on` targets that child keeps. The source's factual
 * provenance (`kk_derived_from`) is inherited by every child unchanged; the
 * retired id is identity lineage and lives in the redirect ledger, never in a
 * child's citations or edges.
 */
const SplitLeafChildSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string(),
    body: z.string(),
    tags: z.array(z.string()).default([]),
    relates_to: z.array(z.string()).default([]),
    depends_on: z.array(z.string()).default([]),
  })
  .strict();

/**
 * The caller-supplied operation plan the move primitive executes. The trigger
 * decides WHICH branches and WHICH operation class; the curate skill's
 * quarantined LLM step decides the concrete grouping; this primitive only
 * executes the plan deterministically. It performs no clustering judgment.
 *
 * Operations:
 *   - split-folder: relocate named child leaves of `branch` into subfolders
 *     under it (groups: subfolder name -> leaf ids, plus a one-line `summary`
 *     authored for each new subfolder). Ids unchanged.
 *   - merge: relocate every direct leaf of the sparse `branch` into the
 *     existing folder `into`. Ids unchanged. The now-empty source folder is
 *     removed. Creates no folder, so it authors no summary; the destination
 *     keeps its self-preserved summary. Preflight rejects a source with no
 *     direct leaves and a destination that does not exist.
 *   - create-branch: relocate named leaves into a new top-level folder (with an
 *     authored `summary` for it). Ids unchanged.
 *   - split-leaf: replace one bloated leaf (`leafId`) with a folder (carrying an
 *     authored `summary`) of an index node plus two or more new sub-documents.
 *     New ids minted; a redirect from the old id is recorded.
 *
 * The per-new-folder `summary` is the semantic, LLM-authored field of the
 * rebalance clustering step; `applyRebalancePlan` stamps it into
 * `FOLDER_SUMMARIES.md` so the subsequent rebuild self-preserves it.
 */
export const RebalanceOpSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('split-folder'),
      branch: z.string().min(1),
      groups: z.array(
        z
          .object({
            subfolder: z.string().min(1),
            summary: z.string(),
            ids: z.array(z.string().min(1)).min(1),
          })
          .strict()
      ),
    })
    .strict(),
  z
    .object({
      operation: z.literal('merge'),
      branch: z.string().min(1),
      into: z.string(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('create-branch'),
      folder: z.string().min(1),
      summary: z.string(),
      ids: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      operation: z.literal('split-leaf'),
      leafId: z.string().min(1),
      folder: z.string().min(1),
      summary: z.string(),
      children: z.array(SplitLeafChildSchema).min(2),
    })
    .strict(),
]);
export type RebalanceOp = z.infer<typeof RebalanceOpSchema>;

export const RebalancePlanSchema = z.object({ operations: z.array(RebalanceOpSchema) });
export type RebalancePlan = z.infer<typeof RebalancePlanSchema>;

/**
 * The retired leaf's edges that no child took over. Keyed by the OLD edge kind;
 * a target counts as assigned when any child cites it in either edge field.
 * Reported, never silently dropped, so the curator can decide where they go.
 */
export interface UnassignedEdges {
  relates_to: string[];
  depends_on: string[];
}

/** One executed move, reported for the structural summary. */
export interface RebalanceMoveResult {
  operation: RebalanceOp['operation'];
  /** POSIX-style move/edit description for the summary legend. */
  from?: string;
  to?: string;
  id?: string;
  newIds?: string[];
  redirectFrom?: string;
  unassignedEdges?: UnassignedEdges;
}

/**
 * Thrown when a preflighted plan fails on disk part-way through (permissions,
 * a full disk). `completedMoves` lists every move that landed, so the caller
 * can reverse them, or keep them and rebuild.
 */
export class RebalanceApplyError extends Error {
  readonly completedMoves: RebalanceMoveResult[];
  constructor(message: string, completedMoves: RebalanceMoveResult[]) {
    super(message);
    this.name = 'RebalanceApplyError';
    this.completedMoves = completedMoves;
  }
}

function joinRel(relDir: string, filename: string): string {
  return relDir === '' ? filename : posix.join(relDir, filename);
}

/**
 * Content-preserving relocate: read the source file as raw bytes, write those
 * exact bytes to the destination via an atomic tmp+rename, then remove the
 * source. The bytes are never parsed or reserialized, so git records a rename
 * (an `R` entry) rather than a delete plus add, and the byte-stability
 * invariant holds. The destination must stay within `nodes/`; callers resolve
 * it through a containment check (`resolveContainedDir`, or `resolveLeafDir`
 * for outside callers) before calling.
 *
 * Exported because `node sweep` relocates loose root leaves with the same
 * guarantees. One relocation path, so byte stability can never drift between
 * the two callers.
 */
export function relocateBytes(srcPath: string, destPath: string): void {
  if (!existsSync(srcPath)) {
    throw new Error(`relocate: source leaf not found at ${srcPath}`);
  }
  if (destPath === srcPath) return;
  if (existsSync(destPath)) {
    throw new Error(`relocate: refusing to overwrite existing file at ${destPath}`);
  }
  const bytes = readFileSync(srcPath); // Buffer: verbatim bytes, no decode.
  atomicWriteFile(destPath, bytes);
  rmSync(srcPath);
}

/** Remove a folder if it holds no leaf files (ignoring a stray index.md). */
function removeIfEmptyOfLeaves(dir: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  const hasLeaves = entries.some(e => e.endsWith('.md') && e !== INDEX_FILENAME);
  const hasSubdirs = entries.some(e => !e.endsWith('.md'));
  if (hasLeaves || hasSubdirs) return;
  // Only a generated index.md (or nothing) remains: drop it and the folder so
  // the merge leaves no empty husk behind.
  for (const e of entries) rmSync(join(dir, e));
  try {
    rmdirSync(dir);
  } catch {
    // Non-fatal: a concurrent writer or a non-empty dir leaves it in place.
  }
}

interface SimLeaf {
  id: string;
  relPath: string;
  relDir: string;
  filename: string;
  absPath: string;
  frontmatter: NodeFrontmatter;
}

/**
 * In-memory model of the leaf tree as the plan transforms it. Every operation
 * is resolved against this model before anything is written, so a later
 * operation sees the paths earlier ones will produce, a minted split-leaf id
 * participates in later uniqueness checks, and a destination conflict anywhere
 * in the plan is caught up front.
 */
class SimulatedTree {
  private readonly byId = new Map<string, SimLeaf>();
  private readonly byPath = new Map<string, SimLeaf>();
  /**
   * Every id a mint may not take: current, retired and minted during this
   * plan, plus every id the on-disk ledger already records from earlier runs.
   */
  private readonly reservedIds: Set<string>;
  /** Paths the plan vacates; a vacated path may be reused by a later op. */
  private readonly vacated = new Set<string>();

  constructor(
    private readonly nodesDir: string,
    nodes: readonly NodeFile[]
  ) {
    this.reservedIds = reservedNodeIds(nodesDir, nodes);
    for (const n of nodes) {
      this.insert({
        id: n.frontmatter.kk_id,
        relPath: n.relPath,
        relDir: n.relDir,
        filename: n.filename,
        absPath: n.path,
        frontmatter: n.frontmatter,
      });
    }
  }

  private insert(leaf: SimLeaf): void {
    this.byId.set(leaf.id, leaf);
    this.byPath.set(leaf.relPath, leaf);
    this.reservedIds.add(leaf.id);
    this.vacated.delete(leaf.relPath);
  }

  leaf(id: string): SimLeaf {
    const leaf = this.byId.get(id);
    if (!leaf) throw new Error(`rebalance: no leaf with id "${id}" exists in the tree`);
    return leaf;
  }

  leavesIn(relDir: string): SimLeaf[] {
    return [...this.byId.values()]
      .filter(l => l.relDir === relDir)
      .sort((a, b) => a.relPath.localeCompare(b.relPath));
  }

  /**
   * A folder exists for the plan when it is the root, holds a simulated leaf
   * at any depth (including one an earlier operation of this plan placed
   * there), or is a directory on disk.
   */
  folderExists(relDir: string): boolean {
    if (relDir === '') return true;
    const prefix = `${relDir}/`;
    for (const leaf of this.byId.values()) {
      if (leaf.relDir === relDir || leaf.relDir.startsWith(prefix)) return true;
    }
    try {
      return statSync(this.abs(relDir)).isDirectory();
    } catch {
      return false;
    }
  }

  /** The absolute on-disk path a relPath will occupy. */
  abs(relPath: string): string {
    return join(this.nodesDir, ...relPath.split(posix.sep));
  }

  /**
   * A destination is free when no simulated leaf occupies it or lives below
   * it and, unless the plan itself vacates it first, nothing already sits
   * there on disk. Every folder above it must be able to be a folder: no
   * simulated leaf sits at that path, and no file does on disk unless an
   * earlier move of the plan takes it away.
   */
  assertVacant(relPath: string): void {
    if (this.byPath.has(relPath) || (!this.vacated.has(relPath) && existsSync(this.abs(relPath)))) {
      throw new Error(`rebalance: destination ${relPath} is already occupied`);
    }
    const prefix = `${relPath}/`;
    if ([...this.byPath.keys()].some(path => path.startsWith(prefix))) {
      throw new Error(`rebalance: destination ${relPath} is a folder the plan places leaves in`);
    }
    const segments = relPath.split(posix.sep);
    for (let depth = 1; depth < segments.length; depth++) {
      const dir = segments.slice(0, depth).join(posix.sep);
      if (this.byPath.has(dir) || (!this.vacated.has(dir) && isNonDirectory(this.abs(dir)))) {
        throw new Error(`rebalance: destination ${relPath} needs folder ${dir}, which is a file`);
      }
    }
  }

  relocate(
    id: string,
    relDir: string
  ): { from: string; to: string; srcAbs: string; destAbs: string } {
    const leaf = this.leaf(id);
    const to = joinRel(relDir, leaf.filename);
    if (to === leaf.relPath) {
      throw new Error(`rebalance: leaf "${id}" already lives at ${to}`);
    }
    this.assertVacant(to);
    // The move reads the source, removes it and writes the destination: none
    // of the three may go through a symlink.
    assertContained(this.nodesDir, leaf.absPath);
    assertContained(this.nodesDir, this.abs(to));
    const from = leaf.relPath;
    const srcAbs = leaf.absPath;
    this.byPath.delete(from);
    this.vacated.add(from);
    const moved: SimLeaf = { ...leaf, relPath: to, relDir, absPath: this.abs(to) };
    this.insert(moved);
    return { from, to, srcAbs, destAbs: moved.absPath };
  }

  retire(id: string): SimLeaf {
    const leaf = this.leaf(id);
    assertContained(this.nodesDir, leaf.absPath);
    this.byId.delete(id);
    this.byPath.delete(leaf.relPath);
    this.vacated.add(leaf.relPath);
    // The id stays reserved: a retired id is ledger lineage, never reusable.
    return leaf;
  }

  mint(kind: NodeFrontmatter['type'], title: string): string {
    const id = ensureUniqueId(this.reservedIds, deriveNodeId(kind, title));
    this.reservedIds.add(id);
    return id;
  }

  add(leaf: SimLeaf): void {
    this.assertVacant(leaf.relPath);
    assertContained(this.nodesDir, leaf.absPath);
    this.insert(leaf);
  }
}

interface ResolvedMove {
  id: string;
  from: string;
  to: string;
  srcAbs: string;
  destAbs: string;
}

interface ResolvedChild {
  frontmatter: NodeFrontmatter;
  body: string;
  relPath: string;
}

type ResolvedOp =
  | {
      operation: 'split-folder';
      groups: Array<{ subRel: string; summary: string; moves: ResolvedMove[] }>;
    }
  | { operation: 'merge'; sourceDirAbs: string; moves: ResolvedMove[] }
  | { operation: 'create-branch'; folder: string; summary: string; moves: ResolvedMove[] }
  | {
      operation: 'split-leaf';
      leafId: string;
      oldRelPath: string;
      oldAbs: string;
      folder: string;
      summary: string;
      children: ResolvedChild[];
      unassignedEdges: UnassignedEdges;
    };

function resolveSplitLeaf(
  sim: SimulatedTree,
  nodesDir: string,
  op: Extract<RebalanceOp, { operation: 'split-leaf' }>
): ResolvedOp {
  const old = sim.leaf(op.leafId);
  const folder = normalizeFolderKey(op.folder);
  resolveContainedDir(nodesDir, folder);
  for (const child of op.children) {
    if ([...child.relates_to, ...child.depends_on].includes(op.leafId)) {
      throw new Error(
        `rebalance: split child "${child.title}" cites the retired id "${op.leafId}"; ` +
          'children keep the source provenance, and the old id is resolved through the redirect ledger'
      );
    }
  }
  // Mint every child id and path first, so each child renders its siblings'
  // real paths and every destination is checked before anything is written.
  const minted = op.children.map(child => {
    const id = sim.mint(old.frontmatter.type, child.title);
    return { id, relPath: joinRel(folder, nodeFilename(id)) };
  });
  const children: ResolvedChild[] = op.children.map((child, i) => {
    const { id, relPath } = minted[i]!;
    const frontmatter = NodeFrontmatterSchema.parse({
      type: old.frontmatter.type,
      title: child.title,
      description: child.summary,
      tags: child.tags,
      kk_schema_version: NODE_SCHEMA_VERSION,
      kk_id: id,
      kk_derived_from: old.frontmatter.kk_derived_from,
      kk_relates_to: child.relates_to,
      kk_depends_on: child.depends_on,
      kk_confidence: old.frontmatter.kk_confidence,
    });
    sim.add({
      id,
      relPath,
      relDir: folder,
      filename: nodeFilename(id),
      absPath: sim.abs(relPath),
      frontmatter,
    });
    return { frontmatter, body: child.body, relPath };
  });
  // Retired only after its children are placed: the apply writes them before
  // it removes the old leaf, so the old path cannot be one of their folders.
  sim.retire(op.leafId);
  const cited = new Set(op.children.flatMap(c => [...c.relates_to, ...c.depends_on]));
  const unassignedEdges: UnassignedEdges = {
    relates_to: old.frontmatter.kk_relates_to.filter(t => !cited.has(t)),
    depends_on: old.frontmatter.kk_depends_on.filter(t => !cited.has(t)),
  };
  return {
    operation: 'split-leaf',
    leafId: op.leafId,
    oldRelPath: old.relPath,
    oldAbs: old.absPath,
    folder,
    summary: op.summary,
    children,
    unassignedEdges,
  };
}

/**
 * Validate and resolve a whole plan against a simulated tree without touching
 * disk: every folder, source leaf and destination is containment-checked (no
 * symlinked segment or leaf), every id resolved at the path an
 * earlier operation leaves it, every split-leaf child id minted and its path
 * reserved, duplicate split groups and destination conflicts rejected. Throws
 * on the first problem; a thrown preflight guarantees zero changes on disk.
 */
export function preflightRebalancePlan(
  nodesDir: string,
  plan: RebalancePlan,
  nodes: readonly NodeFile[] = readAllNodes(nodesDir)
): ResolvedOp[] {
  const sim = new SimulatedTree(nodesDir, nodes);
  const resolved: ResolvedOp[] = [];
  for (const op of plan.operations) {
    if (op.operation === 'split-folder') {
      const branch = normalizeFolderKey(op.branch);
      resolveContainedDir(nodesDir, branch);
      const seenIds = new Set<string>();
      const seenSubfolders = new Set<string>();
      const groups = op.groups.map(group => {
        const subRel = joinRel(branch, normalizeFolderKey(group.subfolder));
        if (seenSubfolders.has(subRel)) {
          throw new Error(
            `rebalance: split-folder "${branch}" names subfolder "${group.subfolder}" more than once`
          );
        }
        seenSubfolders.add(subRel);
        resolveContainedDir(nodesDir, subRel);
        const moves = group.ids.map(id => {
          if (seenIds.has(id)) {
            throw new Error(
              `rebalance: split-folder "${branch}" assigns leaf "${id}" more than once`
            );
          }
          seenIds.add(id);
          return { id, ...sim.relocate(id, subRel) };
        });
        return { subRel, summary: group.summary, moves };
      });
      resolved.push({ operation: 'split-folder', groups });
    } else if (op.operation === 'merge') {
      const branch = normalizeFolderKey(op.branch);
      const into = normalizeFolderKey(op.into);
      if (branch === into) {
        throw new Error(`rebalance: merge of "${op.branch}" into itself is not a move`);
      }
      const sourceDirAbs = resolveContainedDir(nodesDir, branch);
      resolveContainedDir(nodesDir, into);
      // A merge relocates the source's direct leaves into an existing folder.
      // Nothing to move is a plan error, not a silent no-op; a destination
      // that does not exist would be created without a summary, which only
      // create-branch / split-folder may do (they author one).
      const sourceLeaves = sim.leavesIn(branch);
      if (sourceLeaves.length === 0) {
        const why = sim.folderExists(branch) ? 'has no direct leaves' : 'does not exist';
        throw new Error(`rebalance: merge source "${op.branch}" ${why}; nothing to move`);
      }
      if (!sim.folderExists(into)) {
        throw new Error(
          `rebalance: merge destination "${op.into}" does not exist; a merge creates no folder, ` +
            'so pick an existing folder (or "" for the root) or use create-branch'
        );
      }
      const moves = sourceLeaves.map(leaf => ({ id: leaf.id, ...sim.relocate(leaf.id, into) }));
      resolved.push({ operation: 'merge', sourceDirAbs, moves });
    } else if (op.operation === 'create-branch') {
      const folder = normalizeFolderKey(op.folder);
      resolveContainedDir(nodesDir, folder);
      const seenIds = new Set<string>();
      const moves = op.ids.map(id => {
        if (seenIds.has(id)) {
          throw new Error(`rebalance: create-branch "${folder}" names leaf "${id}" more than once`);
        }
        seenIds.add(id);
        return { id, ...sim.relocate(id, folder) };
      });
      resolved.push({ operation: 'create-branch', folder, summary: op.summary, moves });
    } else {
      resolved.push(resolveSplitLeaf(sim, nodesDir, op));
    }
  }
  return resolved;
}

/** Every id whose leaf a resolved plan moved, minted or retired. */
function affectedIds(ops: readonly ResolvedOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.operation === 'split-folder') {
      for (const group of op.groups) for (const move of group.moves) ids.add(move.id);
    } else if (op.operation === 'split-leaf') {
      ids.add(op.leafId);
      for (const child of op.children) ids.add(child.frontmatter.kk_id);
    } else {
      for (const move of op.moves) ids.add(move.id);
    }
  }
  return ids;
}

/**
 * Apply a deterministic rebalance operation plan to the tree under `nodesDir`.
 * Moves relocate content byte-for-byte (git renames), ids stay stable for
 * split-folder/merge/create-branch, and split-leaf mints new ids plus a
 * redirect for the retired id. Once every operation has landed, the rendered
 * Related/Citations links of the moved, minted and retired leaves, and of the
 * leaves linking to them, are refreshed. This function does not rebuild
 * indexes and does not touch git: the command drives the rebuild, and the
 * human accepts by commit or rejects by path-scoped restore.
 *
 * The whole plan is preflighted against a simulated tree first, so an invalid
 * later operation is rejected before the first byte moves. An I/O failure
 * after that throws `RebalanceApplyError` with the moves that completed.
 */
export function applyRebalancePlan(nodesDir: string, plan: RebalancePlan): RebalanceMoveResult[] {
  const ops = preflightRebalancePlan(nodesDir, plan);
  const results: RebalanceMoveResult[] = [];

  try {
    for (const op of ops) {
      if (op.operation === 'split-folder') {
        for (const group of op.groups) {
          for (const move of group.moves) {
            relocateBytes(move.srcAbs, move.destAbs);
            results.push({ operation: 'split-folder', id: move.id, from: move.from, to: move.to });
          }
          stampFolderSummary(nodesDir, group.subRel, group.summary);
        }
      } else if (op.operation === 'merge') {
        for (const move of op.moves) {
          relocateBytes(move.srcAbs, move.destAbs);
          results.push({ operation: 'merge', id: move.id, from: move.from, to: move.to });
        }
        removeIfEmptyOfLeaves(op.sourceDirAbs);
      } else if (op.operation === 'create-branch') {
        for (const move of op.moves) {
          relocateBytes(move.srcAbs, move.destAbs);
          results.push({ operation: 'create-branch', id: move.id, from: move.from, to: move.to });
        }
        stampFolderSummary(nodesDir, op.folder, op.summary);
      } else {
        // Every sibling path was minted in preflight, so each child's Related
        // links render the real sibling path even before that sibling exists.
        const pendingPaths = new Map(op.children.map(c => [c.frontmatter.kk_id, c.relPath]));
        for (const child of op.children) {
          writeNodeFile({
            nodesDir,
            frontmatter: child.frontmatter,
            body: child.body,
            relDir: op.folder,
            pendingPaths,
          });
        }
        stampFolderSummary(nodesDir, op.folder, op.summary);
        rmSync(op.oldAbs);
        const ledger = readRedirectsLedger(nodesDir);
        ledger[op.leafId] = op.children.map(c => c.frontmatter.kk_id);
        writeRedirectsLedger(nodesDir, ledger);
        results.push({
          operation: 'split-leaf',
          redirectFrom: op.leafId,
          newIds: op.children.map(c => c.frontmatter.kk_id),
          from: op.oldRelPath,
          to: op.folder,
          unassignedEdges: op.unassignedEdges,
        });
      }
    }
    refreshRenderedLinks(nodesDir, affectedIds(ops));
  } catch (err) {
    throw new RebalanceApplyError((err as Error).message, results);
  }

  return results;
}
