import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BRANCH_OCCUPANCY_MIN,
  FOLDER_OCCUPANCY_MAX,
  HYSTERESIS_GAP,
  LEAF_CONCEPT_MIN,
  LEAF_SIZE_SPLIT_THRESHOLD,
  decideRebalance,
  type FolderMetricEntry,
} from '../../src/lib/rebalance.js';
import { readAllNodes, type NodeFile } from '../../src/lib/nodes.js';
import { applyRebalancePlan, RebalancePlanSchema } from '../../src/lib/rebalance-move.js';
import {
  readRedirectsLedger,
  resolveRedirect,
  writeRedirectsLedger,
} from '../../src/lib/redirects.js';

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
      kk_schema_version: 3,
      kk_id: opts.id,
      title: opts.id,
      type: 'practice',
      description: 's',
      tags: opts.tags ?? [],
      kk_derived_from: opts.derived_from ?? [],
      kk_relates_to: opts.relates_to ?? [],
      kk_depends_on: [],
      kk_confidence: 'high',
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

  it('does not suggest merge for branch folders that only contain child folders', () => {
    const folders = [folder('parent', 0), folder('parent/child', 2)];
    expect(decideRebalance(folders, []).actions).toEqual([]);
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

  it('groups homeless root leaves that share a useful tag into one create-branch trigger', () => {
    const actions = decideRebalance(
      [],
      [
        leaf({
          id: 'practice-one',
          relDir: '',
          tags: ['billing', 'workflow'],
          derived_from: ['session-a'],
        }),
        leaf({ id: 'practice-two', relDir: '', tags: ['billing'], derived_from: ['session-b'] }),
        leaf({ id: 'practice-three', relDir: '', tags: ['testing'] }),
      ]
    ).actions;
    expect(actions).toEqual([
      {
        branch: 'practice-one.md',
        operation: 'create-branch',
        branches: ['practice-one.md', 'practice-two.md'],
        topic: 'billing',
      },
      { branch: 'practice-three.md', operation: 'create-branch' },
    ]);
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

describe('applyRebalancePlan: whole-plan preflight and provenance-preserving splits', () => {
  let root: string;
  let nodes: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ai-kk-rebalance-lib-'));
    nodes = join(root, 'nodes');
    mkdirSync(nodes, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function writeFixtureLeaf(
    relDir: string,
    id: string,
    opts: { derived_from?: string[]; relates_to?: string[]; depends_on?: string[] } = {}
  ): void {
    const dir = relDir === '' ? nodes : join(nodes, relDir);
    mkdirSync(dir, { recursive: true });
    const fm = {
      kk_schema_version: 3,
      kk_id: id,
      title: id,
      type: 'practice',
      description: 's',
      tags: [],
      kk_derived_from: opts.derived_from ?? [],
      kk_relates_to: opts.relates_to ?? [],
      kk_depends_on: opts.depends_on ?? [],
      kk_confidence: 'high',
    };
    writeFileSync(join(dir, `${id}.md`), matter.stringify('Body.', fm));
  }

  /** Every file under `root` with its content hash: the "zero changes" oracle. */
  function treeFingerprint(): string {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = join(dir, e.name);
        if (e.isDirectory()) return [`${full}/`, ...walk(full)];
        return [`${full}\t${createHash('sha256').update(readFileSync(full)).digest('hex')}`];
      });
    return walk(root).sort().join('\n');
  }

  it('rejects a plan whose third operation is invalid with zero changes on disk', () => {
    writeFixtureLeaf('alpha', 'practice-a');
    writeFixtureLeaf('beta', 'practice-b');
    const before = treeFingerprint();
    const plan = RebalancePlanSchema.parse({
      operations: [
        { operation: 'create-branch', folder: 'gamma', summary: 'g', ids: ['practice-a'] },
        { operation: 'merge', branch: 'beta', into: '' },
        { operation: 'create-branch', folder: 'delta', summary: 'd', ids: ['practice-missing'] },
      ],
    });
    expect(() => applyRebalancePlan(nodes, plan)).toThrow(/practice-missing/);
    expect(treeFingerprint()).toBe(before);
  });

  it('rejects duplicate split-group ids, duplicate subfolders and child collisions before writing', () => {
    writeFixtureLeaf('over', 'practice-a');
    writeFixtureLeaf('over', 'practice-b');
    const before = treeFingerprint();
    const dupIds = RebalancePlanSchema.parse({
      operations: [
        {
          operation: 'split-folder',
          branch: 'over',
          groups: [
            { subfolder: 'one', summary: 'one', ids: ['practice-a'] },
            { subfolder: 'two', summary: 'two', ids: ['practice-a', 'practice-b'] },
          ],
        },
      ],
    });
    expect(() => applyRebalancePlan(nodes, dupIds)).toThrow(/practice-a.*more than once/);
    const dupSubfolders = RebalancePlanSchema.parse({
      operations: [
        {
          operation: 'split-folder',
          branch: 'over',
          groups: [
            { subfolder: 'one', summary: 'one', ids: ['practice-a'] },
            { subfolder: 'one', summary: 'again', ids: ['practice-b'] },
          ],
        },
      ],
    });
    expect(() => applyRebalancePlan(nodes, dupSubfolders)).toThrow(
      /subfolder "one".*more than once/
    );
    expect(treeFingerprint()).toBe(before);
    // Destination conflict: a later op would land on a path another leaf
    // already occupies (a mis-named file the reader accepts and lint flags).
    writeFixtureLeaf('dest', 'practice-other');
    renameSync(join(nodes, 'dest/practice-other.md'), join(nodes, 'dest/practice-a.md'));
    const withConflict = treeFingerprint();
    const collision = RebalancePlanSchema.parse({
      operations: [
        { operation: 'merge', branch: 'over', into: '' },
        { operation: 'create-branch', folder: 'dest', summary: 'd', ids: ['practice-a'] },
      ],
    });
    expect(() => applyRebalancePlan(nodes, collision)).toThrow(/dest\/practice-a\.md/);
    expect(treeFingerprint()).toBe(withConflict);
  });

  it('rejects a split child that cites the retired id', () => {
    writeFixtureLeaf('home', 'practice-big');
    const before = treeFingerprint();
    const plan = RebalancePlanSchema.parse({
      operations: [
        {
          operation: 'split-leaf',
          leafId: 'practice-big',
          folder: 'home/practice-big',
          summary: 'split',
          children: [
            { title: 'one', summary: 's', body: 'x', depends_on: ['practice-big'] },
            { title: 'two', summary: 's', body: 'y' },
          ],
        },
      ],
    });
    expect(() => applyRebalancePlan(nodes, plan)).toThrow(/retired id "practice-big"/);
    expect(treeFingerprint()).toBe(before);
  });

  // A retired id is lineage. Minting it again would make
  // `resolveRedirect` prefer the new live leaf, so every edge that reached the
  // retired id's successors would silently bind to unrelated content. A
  // successor the ledger names but that is no longer live is the same hazard
  // one hop later.
  it('never mints an id the redirect ledger already records, retired or successor', () => {
    writeFixtureLeaf('home', 'practice-existing');
    writeFixtureLeaf('home', 'practice-big');
    writeRedirectsLedger(nodes, {
      'practice-old': ['practice-existing'],
      'practice-older': ['practice-gone'],
    });
    const plan = RebalancePlanSchema.parse({
      operations: [
        {
          operation: 'split-leaf',
          leafId: 'practice-big',
          folder: 'home/practice-big',
          summary: 'the two halves',
          children: [
            { title: 'old', summary: 'a', body: 'A.' },
            { title: 'gone', summary: 'b', body: 'B.' },
          ],
        },
      ],
    });

    const [result] = applyRebalancePlan(nodes, plan);

    expect(result?.newIds).toEqual(['practice-old-2', 'practice-gone-2']);
    const ledger = readRedirectsLedger(nodes);
    expect(ledger['practice-old']).toEqual(['practice-existing']);
    const live = new Set(readAllNodes(nodes).map(n => n.frontmatter.kk_id));
    expect(resolveRedirect(ledger, live, 'practice-old')).toEqual(['practice-existing']);
  });

  // A merge that moves nothing, or that would create its destination, is
  // a plan error, not a silent no-op or an unsummarized new folder.
  it('rejects a merge of a missing source or into a missing destination with zero changes', () => {
    writeFixtureLeaf('home', 'practice-a');
    const before = treeFingerprint();

    const missingSource = RebalancePlanSchema.parse({
      operations: [{ operation: 'merge', branch: 'ghost', into: '' }],
    });
    expect(() => applyRebalancePlan(nodes, missingSource)).toThrow(/ghost/);
    expect(treeFingerprint()).toBe(before);

    const missingDestination = RebalancePlanSchema.parse({
      operations: [{ operation: 'merge', branch: 'home', into: 'nowhere' }],
    });
    expect(() => applyRebalancePlan(nodes, missingDestination)).toThrow(/nowhere/);
    expect(existsSync(join(nodes, 'nowhere'))).toBe(false);
    expect(treeFingerprint()).toBe(before);

    // A destination an earlier operation of the same plan creates is fine.
    writeFixtureLeaf('sparse', 'practice-b');
    const chained = RebalancePlanSchema.parse({
      operations: [
        { operation: 'create-branch', folder: 'fresh', summary: 'f', ids: ['practice-a'] },
        { operation: 'merge', branch: 'sparse', into: 'fresh' },
      ],
    });
    expect(applyRebalancePlan(nodes, chained).map(m => m.to)).toEqual([
      'fresh/practice-a.md',
      'fresh/practice-b.md',
    ]);
  });
});
