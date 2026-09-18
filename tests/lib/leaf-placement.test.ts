import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  placeLeaf,
  type PlacementInput,
  type PlacementResult,
} from '../../src/lib/leaf-placement.js';
import { readAllNodes, type NodeFile } from '../../src/lib/nodes.js';
import { repoRoot } from '../helpers.js';

function leaf(opts: {
  id: string;
  relDir?: string;
  tags?: string[];
  relates_to?: string[];
  depends_on?: string[];
}): NodeFile {
  const relDir = opts.relDir ?? '';
  const filename = `${opts.id}.md`;
  return {
    path: `/tmp/${filename}`,
    filename,
    relPath: relDir === '' ? filename : `${relDir}/${filename}`,
    relDir,
    body: 'Body.',
    frontmatter: {
      kk_schema_version: 3,
      kk_id: opts.id,
      title: opts.id,
      type: 'practice',
      description: 's',
      tags: opts.tags ?? [],
      kk_derived_from: [],
      kk_relates_to: opts.relates_to ?? [],
      kk_depends_on: opts.depends_on ?? [],
      kk_confidence: 'high',
    },
  };
}

function loose(opts: {
  tags?: string[];
  relates_to?: string[];
  depends_on?: string[];
}): PlacementInput {
  return {
    tags: opts.tags ?? [],
    kk_relates_to: opts.relates_to ?? [],
    kk_depends_on: opts.depends_on ?? [],
  };
}

/** Two folders, one edge target in each, so step 1 always ties. */
function tiedTree(alphaTags: string[], betaTags: string[]): NodeFile[] {
  return [
    leaf({ id: 'practice-alpha-target', relDir: 'alpha', tags: alphaTags }),
    leaf({ id: 'practice-beta-target', relDir: 'beta', tags: betaTags }),
  ];
}

describe('placeLeaf', () => {
  it('places by edge count, ignoring dangling targets and targets sitting at the root', () => {
    const tree = [
      leaf({ id: 'practice-a1', relDir: 'alpha' }),
      leaf({ id: 'practice-a2', relDir: 'alpha' }),
      leaf({ id: 'practice-b1', relDir: 'beta' }),
      leaf({ id: 'practice-root-peer' }),
    ];
    const result = placeLeaf(
      loose({
        relates_to: ['practice-a1', 'practice-b1', 'practice-root-peer', 'practice-missing'],
        depends_on: ['practice-a2'],
      }),
      tree
    );
    expect(result).toEqual({ kind: 'placed', folder: 'alpha', reason: 'edges' });
  });

  it('breaks an edge tie on tag overlap summed over the folder direct leaves', () => {
    const tree = [
      ...tiedTree(['t1'], ['t1']),
      leaf({ id: 'practice-alpha-peer', relDir: 'alpha', tags: ['t1', 't2'] }),
    ];
    const result = placeLeaf(
      loose({ tags: ['t1', 't2'], relates_to: ['practice-alpha-target', 'practice-beta-target'] }),
      tree
    );
    expect(result).toEqual({ kind: 'placed', folder: 'alpha', reason: 'tags' });
  });

  it('breaks a remaining tie on the alphabetically first folder path', () => {
    const tree = [
      leaf({ id: 'practice-zeta-target', relDir: 'zeta', tags: ['t1'] }),
      leaf({ id: 'practice-alpha-target', relDir: 'alpha', tags: ['t1'] }),
    ];
    const result = placeLeaf(
      loose({ tags: ['t1'], relates_to: ['practice-zeta-target', 'practice-alpha-target'] }),
      tree
    );
    expect(result).toEqual({ kind: 'placed', folder: 'alpha', reason: 'alphabetical' });
  });

  it('places a leaf with no edges by tag overlap across every folder, direct leaves only', () => {
    const tree = [
      leaf({ id: 'practice-a1', relDir: 'alpha', tags: ['t1'] }),
      leaf({ id: 'practice-b1', relDir: 'beta', tags: ['t2'] }),
      leaf({ id: 'practice-d1', relDir: 'beta/deep', tags: ['t1'] }),
      leaf({ id: 'practice-d2', relDir: 'beta/deep', tags: ['t1'] }),
    ];
    const result = placeLeaf(loose({ tags: ['t1'] }), tree);
    expect(result).toEqual({ kind: 'placed', folder: 'beta/deep', reason: 'tags' });
  });

  it('reports a leaf with no edges and no tag overlap anywhere as unplaceable', () => {
    const tree = [
      leaf({ id: 'practice-a1', relDir: 'alpha', tags: ['t1'] }),
      leaf({ id: 'practice-b1', relDir: 'beta', tags: ['t2'] }),
    ];
    expect(placeLeaf(loose({ tags: ['nowhere'] }), tree)).toEqual({ kind: 'unplaceable' });
  });

  it('reports no-folders for a tree with no folders instead of unplaceable', () => {
    const rootOnly = [leaf({ id: 'practice-root-1', tags: ['t1'] })];
    expect(placeLeaf(loose({ tags: ['nowhere'] }), rootOnly)).toEqual({ kind: 'no-folders' });
    expect(placeLeaf(loose({ tags: ['t1'], relates_to: ['practice-root-1'] }), [])).toEqual({
      kind: 'no-folders',
    });
  });

  it('places two root leaves that edge only to each other by tag overlap', () => {
    const x = leaf({ id: 'practice-x', tags: ['t1'], relates_to: ['practice-y'] });
    const y = leaf({ id: 'practice-y', tags: ['t2'], relates_to: ['practice-x'] });
    const tree = [
      x,
      y,
      leaf({ id: 'practice-a1', relDir: 'alpha', tags: ['t1'] }),
      leaf({ id: 'practice-b1', relDir: 'beta', tags: ['t2'] }),
    ];
    expect(placeLeaf(x.frontmatter, tree, x.frontmatter.kk_id)).toEqual({
      kind: 'placed',
      folder: 'alpha',
      reason: 'tags',
    });
    expect(placeLeaf(y.frontmatter, tree, y.frontmatter.kk_id)).toEqual({
      kind: 'placed',
      folder: 'beta',
      reason: 'tags',
    });
  });

  it('follows an edge target that has itself moved to another folder', () => {
    const input = loose({ relates_to: ['practice-target'] });
    const before = [leaf({ id: 'practice-target', relDir: 'alpha' })];
    const after = [leaf({ id: 'practice-target', relDir: 'gamma' })];
    expect(placeLeaf(input, before)).toEqual({ kind: 'placed', folder: 'alpha', reason: 'edges' });
    expect(placeLeaf(input, after)).toEqual({ kind: 'placed', folder: 'gamma', reason: 'edges' });
  });

  it('returns deeply equal results on repeated runs over a tied input', () => {
    const tree = tiedTree(['t1'], ['t1']);
    const input = loose({
      tags: ['t1'],
      relates_to: ['practice-alpha-target', 'practice-beta-target'],
    });
    const first = placeLeaf(input, tree);
    const second = placeLeaf(input, tree);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('places the three loose leaves in this repository knowledge base', () => {
    const tree = readAllNodes(join(repoRoot, '.ai/kenkeep/nodes'));
    const expected: Array<[string, PlacementResult]> = [
      [
        'practice-copilot-file-based-sessionstart-must-use-shared-context-builder',
        { kind: 'placed', folder: 'harnesses', reason: 'tags' },
      ],
      [
        'practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product',
        { kind: 'placed', folder: 'conventions', reason: 'edges' },
      ],
      [
        'practice-keep-template-partials-out-of-the-knowledge-base',
        { kind: 'placed', folder: 'config-and-prompts', reason: 'alphabetical' },
      ],
    ];
    for (const [id, want] of expected) {
      const node = tree.find(n => n.frontmatter.kk_id === id);
      if (node === undefined) throw new Error(`${id} is missing from the live tree`);
      expect(placeLeaf(node.frontmatter, tree, id), id).toEqual(want);
    }
  });
});
