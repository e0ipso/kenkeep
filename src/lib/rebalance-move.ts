import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { z } from 'zod';
import {
  deriveNodeId,
  ensureUniqueId,
  INDEX_FILENAME,
  readAllNodes,
  stampFolderSummary,
  writeNodeFile,
} from './nodes.js';
import { readRedirectsLedger, writeRedirectsLedger } from './redirects.js';
import { NODE_SCHEMA_VERSION, NodeFrontmatterSchema } from './schemas.js';

/**
 * One sub-document produced by a split-leaf: a brand new leaf carved out of the
 * bloated original. The id is minted deterministically from the title (the
 * caller never supplies an id); content is authored fresh, so this is the only
 * operation that serializes new bytes.
 */
const SplitLeafChildSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string(),
    body: z.string(),
    tags: z.array(z.string()).default([]),
    relates_to: z.array(z.string()).default([]),
  })
  .strict();

/**
 * The caller-supplied operation plan the move primitive executes. The trigger
 * (Task 1) decides WHICH branches and WHICH operation class; the curate skill's
 * quarantined LLM step decides the concrete grouping; this primitive only
 * executes the plan deterministically. It performs no clustering judgment.
 *
 * Operations:
 *   - split-folder: relocate named child leaves of `branch` into subfolders
 *     under it (groups: subfolder name -> leaf ids, plus a one-line `summary`
 *     authored for each new subfolder). Ids unchanged.
 *   - merge: relocate every leaf of the sparse `branch` into `into`. Ids
 *     unchanged. The now-empty source folder is removed. Creates no folder, so
 *     it authors no summary; the destination keeps its self-preserved summary.
 *   - create-branch: relocate named leaves into a new top-level folder (with an
 *     authored `summary` for it). Ids unchanged.
 *   - split-leaf: replace one bloated leaf (`leafId`) with a folder (carrying an
 *     authored `summary`) of an index node plus two or more new sub-documents.
 *     New ids minted; a redirect from the old id is recorded.
 *
 * The per-new-folder `summary` is the semantic, LLM-authored field of the
 * rebalance clustering step; `applyRebalancePlan` stamps it into the new
 * folder's `index.md` frontmatter so the subsequent rebuild self-preserves it.
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

/** One executed move, reported for the structural summary. */
export interface RebalanceMoveResult {
  operation: RebalanceOp['operation'];
  /** POSIX-style move/edit description for the summary legend. */
  from?: string;
  to?: string;
  id?: string;
  newIds?: string[];
  redirectFrom?: string;
}

/**
 * Resolve a POSIX-style folder under `nodesDir`, rejecting any absolute path or
 * `..` traversal so a caller-supplied target can never escape `nodes/`. Returns
 * the absolute directory; the empty string resolves to the `nodes/` root.
 */
function resolveFolder(nodesDir: string, relDir: string): string {
  const folder = relDir.trim();
  if (folder === '') return nodesDir;
  if (isAbsolute(folder) || folder.startsWith('/')) {
    throw new Error(`rebalance: target "${relDir}" escapes nodes/; must be a folder under nodes/`);
  }
  const resolved = join(nodesDir, ...folder.split(posix.sep));
  const rel = relative(nodesDir, resolved);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`rebalance: target "${relDir}" escapes nodes/; must be a folder under nodes/`);
  }
  return resolved;
}

/**
 * Content-preserving relocate: read the source file as raw bytes, write those
 * exact bytes to the destination via an atomic tmp+rename, then remove the
 * source. The bytes are never parsed or reserialized, so git records a rename
 * (an `R` entry) rather than a delete plus add, and the byte-stability
 * invariant holds. The destination must stay within `nodes/`.
 */
function relocateBytes(srcPath: string, destPath: string): void {
  if (!existsSync(srcPath)) {
    throw new Error(`rebalance: source leaf not found at ${srcPath}`);
  }
  if (destPath === srcPath) return;
  if (existsSync(destPath)) {
    throw new Error(`rebalance: refusing to overwrite existing file at ${destPath}`);
  }
  const bytes = readFileSync(srcPath); // Buffer: verbatim bytes, no decode.
  mkdirSync(dirname(destPath), { recursive: true });
  const tmp = `${destPath}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, destPath);
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

/**
 * Apply a deterministic rebalance operation plan to the tree under `nodesDir`.
 * Moves preserve content byte-for-byte (git renames), ids stay stable for
 * split-folder/merge/create-branch, and split-leaf mints new ids plus a
 * redirect for the retired id. This function does NOT rebuild indexes and does
 * NOT touch git; the command wrapper drives the deterministic rebuild and the
 * human accepts by commit / rejects by path-scoped restore.
 *
 * The tree is re-read from disk before every operation. A plan is a sequence,
 * and each operation mutates the tree (relocations, removed folders, minted
 * leaves), so a single snapshot captured up front would carry stale paths into
 * later operations — a merge could miss leaves an earlier op moved into its
 * source, and a leaf already relocated would no longer resolve. Re-resolving
 * per operation keeps every op working against the live tree and lets minted
 * split-leaf ids participate in later collision checks.
 */
export function applyRebalancePlan(nodesDir: string, plan: RebalancePlan): RebalanceMoveResult[] {
  const results: RebalanceMoveResult[] = [];

  for (const op of plan.operations) {
    // Re-read the live tree for this operation so it never acts on paths a
    // prior operation already invalidated.
    const nodes = readAllNodes(nodesDir);
    const byId = new Map(nodes.map(n => [n.frontmatter.kk_id, n]));
    const existingIds = new Set(nodes.map(n => n.frontmatter.kk_id));
    const leafFor = (id: string): (typeof nodes)[number] => {
      const leaf = byId.get(id);
      if (!leaf) throw new Error(`rebalance: no leaf with id "${id}" exists in the tree`);
      return leaf;
    };

    if (op.operation === 'split-folder') {
      // Validate the branch resolves under nodes/ (rejects traversal).
      resolveFolder(nodesDir, op.branch);
      for (const group of op.groups) {
        const subRel = posix.join(op.branch, group.subfolder);
        const destDir = resolveFolder(nodesDir, subRel);
        for (const id of group.ids) {
          const leaf = leafFor(id);
          const dest = join(destDir, leaf.filename);
          relocateBytes(leaf.path, dest);
          results.push({
            operation: 'split-folder',
            id,
            from: leaf.relPath,
            to: posix.join(subRel, leaf.filename),
          });
        }
        // Author the new subfolder's summary; the wrapper's rebuild self-preserves it.
        stampFolderSummary(nodesDir, subRel, group.summary);
      }
    } else if (op.operation === 'merge') {
      const intoDir = resolveFolder(nodesDir, op.into);
      const sourceDir = resolveFolder(nodesDir, op.branch);
      const sourceLeaves = nodes.filter(n => n.relDir === op.branch);
      for (const leaf of sourceLeaves) {
        const dest = join(intoDir, leaf.filename);
        relocateBytes(leaf.path, dest);
        results.push({
          operation: 'merge',
          id: leaf.frontmatter.kk_id,
          from: leaf.relPath,
          to: op.into === '' ? leaf.filename : posix.join(op.into, leaf.filename),
        });
      }
      removeIfEmptyOfLeaves(sourceDir);
    } else if (op.operation === 'create-branch') {
      const destDir = resolveFolder(nodesDir, op.folder);
      for (const id of op.ids) {
        const leaf = leafFor(id);
        const dest = join(destDir, leaf.filename);
        relocateBytes(leaf.path, dest);
        results.push({
          operation: 'create-branch',
          id,
          from: leaf.relPath,
          to: posix.join(op.folder, leaf.filename),
        });
      }
      // Author the new branch's summary; the wrapper's rebuild self-preserves it.
      stampFolderSummary(nodesDir, op.folder, op.summary);
    } else {
      // split-leaf: one document becomes a folder of an index node plus 2+ docs.
      const old = leafFor(op.leafId);
      const destDir = resolveFolder(nodesDir, op.folder);
      mkdirSync(destDir, { recursive: true });
      const mintedIds: string[] = [];
      for (const child of op.children) {
        const base = deriveNodeId(old.frontmatter.type, child.title);
        const id = ensureUniqueId(existingIds, base);
        existingIds.add(id);
        mintedIds.push(id);
        const fm = NodeFrontmatterSchema.parse({
          type: old.frontmatter.type,
          title: child.title,
          description: child.summary,
          tags: child.tags,
          kk_schema_version: NODE_SCHEMA_VERSION,
          kk_id: id,
          // The new parts are derived from the retired leaf; preserve the chain.
          kk_derived_from: [old.frontmatter.kk_id],
          kk_relates_to: child.relates_to,
          kk_confidence: old.frontmatter.kk_confidence,
        });
        const target = join(destDir, `${id}.md`);
        if (existsSync(target)) {
          throw new Error(`rebalance: refusing to overwrite existing file at ${target}`);
        }
        writeNodeFile({ nodesDir, frontmatter: fm, body: child.body, relDir: op.folder });
      }
      // Author the new folder's summary; the wrapper's rebuild self-preserves it.
      stampFolderSummary(nodesDir, op.folder, op.summary);
      // Retire the old leaf and record the redirect in history.
      rmSync(old.path);
      const ledger = readRedirectsLedger(nodesDir);
      ledger[old.frontmatter.kk_id] = mintedIds;
      writeRedirectsLedger(nodesDir, ledger);
      results.push({
        operation: 'split-leaf',
        redirectFrom: op.leafId,
        newIds: mintedIds,
        from: old.relPath,
        to: op.folder,
      });
    }
  }

  return results;
}
