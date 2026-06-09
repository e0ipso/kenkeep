import { describe, expect, it } from 'vitest';
import {
  BRANCH_OCCUPANCY_MIN,
  FOLDER_OCCUPANCY_MAX,
  HYSTERESIS_GAP,
  LEAF_CONCEPT_MIN,
  LEAF_SIZE_SPLIT_THRESHOLD,
  decideRebalance,
  type FolderMetricEntry,
} from '../../src/lib/rebalance.js';
import type { NodeFile } from '../../src/lib/nodes.js';

function folder(
  relDir: string,
  occupancy: number,
  tagDiversity = 1,
  leafSize = 100
): FolderMetricEntry {
  return { relDir, metrics: { occupancy, tagDiversity, leafSize } };
}

function leaf(opts: {
  id: string;
  relDir?: string;
  tags?: string[];
  relates_to?: string[];
  derived_from?: string[];
  bodyChars?: number;
}): NodeFile {
  const relDir = opts.relDir ?? '';
  const filename = `${opts.id}.md`;
  return {
    path: `/tmp/${filename}`,
    filename,
    relPath: relDir === '' ? filename : `${relDir}/${filename}`,
    relDir,
    body: 'x'.repeat(opts.bodyChars ?? 10),
    frontmatter: {
      schema_version: 2,
      id: opts.id,
      title: opts.id,
      kind: 'practice',
      tags: opts.tags ?? [],
      derived_from: opts.derived_from ?? [],
      relates_to: opts.relates_to ?? [],
      confidence: 'high',
      summary: 's',
    },
  };
}

describe('rebalance trigger thresholds', () => {
  it('asserts a real hysteresis gap between merge low-water and split high-water', () => {
    expect(BRANCH_OCCUPANCY_MIN).toBeLessThan(FOLDER_OCCUPANCY_MAX);
    expect(HYSTERESIS_GAP).toBe(FOLDER_OCCUPANCY_MAX - BRANCH_OCCUPANCY_MIN);
    expect(HYSTERESIS_GAP).toBeGreaterThan(0);
  });

  it('is deterministic: identical input yields byte-identical output', () => {
    const folders = [folder('alpha', FOLDER_OCCUPANCY_MAX + 5), folder('beta', 1)];
    const leaves = [
      leaf({ id: 'practice-a', relDir: 'alpha' }),
      leaf({ id: 'practice-b', relDir: 'beta' }),
    ];
    const a = JSON.stringify(decideRebalance(folders, leaves));
    const b = JSON.stringify(decideRebalance(folders, leaves));
    expect(a).toBe(b);
  });

  it('trips nothing inside the hysteresis gap (above merge low-water, below split high-water)', () => {
    // A folder sitting in the band trips neither split nor merge.
    const mid = Math.floor((BRANCH_OCCUPANCY_MIN + FOLDER_OCCUPANCY_MAX) / 2);
    const folders = [folder('settled', mid)];
    const leaves = [leaf({ id: 'practice-x', relDir: 'settled' })];
    expect(decideRebalance(folders, leaves)).toEqual({ actions: [] });
  });

  it('fires split-folder only strictly past the high-water mark', () => {
    expect(decideRebalance([folder('f', FOLDER_OCCUPANCY_MAX)], []).actions).toEqual([]);
    expect(decideRebalance([folder('f', FOLDER_OCCUPANCY_MAX + 1)], []).actions).toEqual([
      { branch: 'f', operation: 'split-folder' },
    ]);
  });

  it('fires merge only strictly below the low-water mark, and never for the root', () => {
    expect(decideRebalance([folder('f', BRANCH_OCCUPANCY_MIN)], []).actions).toEqual([]);
    expect(decideRebalance([folder('f', BRANCH_OCCUPANCY_MIN - 1)], []).actions).toEqual([
      { branch: 'f', operation: 'merge' },
    ]);
    // The root (empty relDir) is the deliberate fallback home, never a merge.
    expect(decideRebalance([folder('', 1)], []).actions).toEqual([]);
  });

  it('fires split-leaf only when both the size AND concept gates are met', () => {
    const bigChars = (LEAF_SIZE_SPLIT_THRESHOLD + 100) * 4;
    const manyTags = Array.from({ length: LEAF_CONCEPT_MIN }, (_, i) => `t${i}`);
    // Both gates: fires.
    expect(
      decideRebalance(
        [],
        [leaf({ id: 'practice-big', relDir: 'home', tags: manyTags, bodyChars: bigChars })]
      ).actions
    ).toEqual([{ branch: 'home/practice-big.md', operation: 'split-leaf' }]);
    // Big but too few concepts: does not fire.
    expect(
      decideRebalance(
        [],
        [leaf({ id: 'practice-big', relDir: 'home', tags: ['only-one'], bodyChars: bigChars })]
      ).actions
    ).toEqual([]);
    // Many concepts but small: does not fire.
    expect(
      decideRebalance(
        [],
        [leaf({ id: 'practice-small', relDir: 'home', tags: manyTags, bodyChars: 40 })]
      ).actions
    ).toEqual([]);
  });

  it('signals create-branch for a homeless root leaf with no edges', () => {
    expect(decideRebalance([], [leaf({ id: 'practice-novel', relDir: '' })]).actions).toEqual([
      { branch: 'practice-novel.md', operation: 'create-branch' },
    ]);
    // A root leaf that relates to something is not homeless: no create-branch.
    expect(
      decideRebalance(
        [],
        [leaf({ id: 'practice-linked', relDir: '', relates_to: ['practice-other'] })]
      ).actions
    ).toEqual([]);
  });

  it('sorts actions by branch then operation for stable output', () => {
    const folders = [
      folder('zeta', FOLDER_OCCUPANCY_MAX + 1),
      folder('alpha', BRANCH_OCCUPANCY_MIN - 1),
    ];
    const actions = decideRebalance(folders, []).actions;
    expect(actions).toEqual([
      { branch: 'alpha', operation: 'merge' },
      { branch: 'zeta', operation: 'split-folder' },
    ]);
  });
});
