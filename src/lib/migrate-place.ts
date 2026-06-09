import type { Placement } from './migrate-flat-to-tree.js';
import type { FlatLeaf } from './migrate-read.js';

/**
 * Maps proposed `{ id, targetFolder }` back to full placements carrying each
 * leaf's source path. Throws on an unknown id or a missing placement so a bad
 * clustering result aborts before any write.
 */
export function reconcilePlacements(leaves: FlatLeaf[], proposed: Placement[]): Placement[] {
  const byId = new Map(leaves.map(l => [l.id, l]));
  const seen = new Set<string>();
  const placements: Placement[] = [];
  for (const p of proposed) {
    const leaf = byId.get(p.id);
    if (!leaf) {
      throw new Error(`clustering returned an unknown leaf id "${p.id}"`);
    }
    seen.add(p.id);
    placements.push({ id: p.id, sourcePath: leaf.sourcePath, targetFolder: p.targetFolder });
  }
  const missing = leaves.filter(l => !seen.has(l.id)).map(l => l.id);
  if (missing.length > 0) {
    throw new Error(`clustering omitted ${missing.length} leaf/leaves: ${missing.join(', ')}`);
  }
  return placements;
}

/**
 * Cross-check the LLM-authored folder-summary keys against the folders the
 * placements will actually create — each placement's `targetFolder` and every
 * ancestor of it (the rebuild stamps an `index.md` at each). `reconcilePlacements`
 * validates the leaf-id channel; this guards the parallel `folders` channel. A
 * summary keyed to a folder no leaf is placed into (nor an ancestor of one)
 * would `mkdirSync` + stamp an `index.md` into a directory the subsequent
 * rebuild never regenerates, orphaning it on disk. Throw before any write,
 * mirroring `reconcilePlacements`' abort-on-bad-clustering. Folder keys are
 * normalized (slash-split, blanks dropped) so a trailing/duplicate slash never
 * triggers a false orphan; the empty root key is skipped (it stamps no folder).
 */
export function reconcileFolderSummaries(
  folderSummaries: Record<string, string>,
  placements: Placement[]
): void {
  const created = new Set<string>();
  for (const p of placements) {
    let acc = '';
    for (const seg of p.targetFolder.split('/').filter(Boolean)) {
      acc = acc === '' ? seg : `${acc}/${seg}`;
      created.add(acc);
    }
  }
  const orphaned = Object.keys(folderSummaries).filter(folder => {
    const norm = folder.split('/').filter(Boolean).join('/');
    return norm !== '' && !created.has(norm);
  });
  if (orphaned.length > 0) {
    throw new Error(
      `clustering authored a folder summary for ${orphaned.length} folder(s) no leaf was ` +
        `placed into: ${orphaned.join(', ')}`
    );
  }
}
