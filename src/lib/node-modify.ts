import { findNodeById, writeNodeFile, type NodeFile } from './nodes.js';
import {
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  type CuratorProposedNode,
  type NodeFrontmatter,
} from './schemas.js';

export type ModifyNodeOutcome =
  | { ok: true; id: string; filePath: string; relDir: string; frontmatter: NodeFrontmatter }
  | { ok: false; reason: string };

export interface ModifyNodeOptions {
  /**
   * An in-process `id -> leaf` snapshot of the tree. When given, the target
   * is looked up here instead of re-reading the whole tree, so a caller that
   * applies many modifies in one run (curate-persist) parses the tree once.
   * The caller keeps it current: after each write it records the returned
   * frontmatter, so a second modify of the same target merges on top.
   */
  snapshot?: ReadonlyMap<string, NodeFile>;
  /** Pre-minted paths of leaves not yet on disk; see `WriteNodeArgs.pendingPaths`. */
  pendingPaths?: ReadonlyMap<string, string>;
}

function mergeDerivedFrom(existing: string[], origin: string): string[] {
  return Array.from(new Set([...existing, origin]));
}

/**
 * The one deterministic in-place modify path. Rewrites the existing leaf
 * `targetId` at its current path from a validated proposal: the id and the
 * folder are preserved, `kk_derived_from` gains `candidateOrigin`, and every
 * other field comes from the proposal. Both `curate-persist` (a surviving
 * `modify` action) and `conflict resolve --decision accept` call this, so a
 * human's Accept lands exactly where an unopposed modify would have.
 *
 * Never creates a node: a missing target or a type mismatch is reported as a
 * failure with no write. Frontmatter validation failures are reported the same
 * way; an I/O error propagates as a thrown error.
 */
export function modifyNodeInPlace(
  nodesDir: string,
  targetId: string,
  candidateOrigin: string,
  node: CuratorProposedNode,
  options: ModifyNodeOptions = {}
): ModifyNodeOutcome {
  const existing =
    options.snapshot !== undefined
      ? (options.snapshot.get(targetId) ?? null)
      : findNodeById(nodesDir, targetId);
  if (!existing) {
    return { ok: false, reason: `target node "${targetId}" does not exist` };
  }
  if (existing.frontmatter.type !== node.type) {
    return {
      ok: false,
      reason: `target node "${targetId}" is ${existing.frontmatter.type}, not ${node.type}`,
    };
  }
  const frontmatter: NodeFrontmatter = {
    type: node.type,
    title: node.title,
    description: node.description,
    tags: node.tags,
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: targetId,
    kk_derived_from: mergeDerivedFrom(existing.frontmatter.kk_derived_from, candidateOrigin),
    kk_relates_to: node.kk_relates_to,
    kk_depends_on: node.kk_depends_on,
    kk_confidence: node.kk_confidence,
  };
  const checked = NodeFrontmatterSchema.safeParse(frontmatter);
  if (!checked.success) {
    const reason = checked.error.issues
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, reason: `frontmatter validation failed: ${reason}` };
  }
  const filePath = writeNodeFile({
    nodesDir,
    frontmatter: checked.data,
    body: node.body,
    relDir: existing.relDir,
    ...(options.pendingPaths !== undefined ? { pendingPaths: options.pendingPaths } : {}),
  });
  return {
    ok: true,
    id: checked.data.kk_id,
    filePath,
    relDir: existing.relDir,
    frontmatter: checked.data,
  };
}
