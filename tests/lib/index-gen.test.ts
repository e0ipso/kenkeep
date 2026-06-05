import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateGraph, generateIndex } from '../../src/lib/index-gen.js';
import { computeNodesHash } from '../../src/lib/nodes.js';

interface NodeSeed {
  /** Topical folder under nodes/ (POSIX-style; '' = root). */
  dir: string;
  kind: 'practice' | 'map';
  id: string;
  title: string;
  summary: string;
  tags?: string[];
  relates_to?: string[];
}

function seedNodes(root: string, seeds: NodeSeed[]): void {
  for (const s of seeds) {
    const dir = s.dir ? join(root, ...s.dir.split('/')) : root;
    mkdirSync(dir, { recursive: true });
    const body = `# ${s.title}\n\nBody.\n`;
    const fm = matter.stringify(body, {
      schema_version: 2,
      id: s.id,
      title: s.title,
      kind: s.kind,
      tags: s.tags ?? [],
      derived_from: [],
      relates_to: s.relates_to ?? [],
      confidence: 'high',
      summary: s.summary,
    });
    writeFileSync(join(dir, `${s.id}.md`), fm);
  }
}

describe('generateIndex (recursive per-folder)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-index-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('emits one index.md body per folder, including the root and ancestors', () => {
    seedNodes(root, [
      { dir: 'topic-a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'sa' },
      { dir: 'topic-a/sub', kind: 'map', id: 'map-deep', title: 'Deep', summary: 'sd' },
      { dir: 'topic-b', kind: 'map', id: 'map-b', title: 'B', summary: 'sb' },
    ]);
    const out = generateIndex(root);
    expect(out.nodeCount).toBe(3);
    // Root, topic-a, topic-a/sub, topic-b all carry an index node.
    expect([...out.folders.keys()].sort()).toEqual(['', 'topic-a', 'topic-a/sub', 'topic-b']);
    // Root rolls up its immediate subfolders, not its descendants' leaves.
    const rootBody = out.folders.get('')!.content;
    expect(rootBody).toContain('## Subfolders');
    expect(rootBody).toContain('**topic-a/**');
    expect(rootBody).toContain('**topic-b/**');
    expect(rootBody).not.toContain('**sub/**'); // not an immediate child of root
    // topic-a lists its leaf and its immediate subfolder.
    const aBody = out.folders.get('topic-a')!.content;
    expect(aBody).toContain('**A**');
    expect(aBody).toContain('**sub/**');
  });

  it('splits leaves by kind facet into Conventions and Components', () => {
    seedNodes(root, [
      { dir: 'topic', kind: 'practice', id: 'practice-x', title: 'X', summary: 's', tags: ['foo'] },
      { dir: 'topic', kind: 'map', id: 'map-y', title: 'Y', summary: 's', tags: ['bar'] },
    ]);
    const body = generateIndex(root).folders.get('topic')!.content;
    expect(body).toContain('## Conventions (how we build)');
    expect(body).toContain('## Components (what exists)');
    expect(body).toContain('## By topic');
    // Bullet shape carries title, current path, summary, and tags.
    expect(body).toContain('**X** [`topic/practice-x.md`]');
    expect(body).toContain(' #foo');
  });

  it('is byte-identical across two consecutive generations (deterministic)', () => {
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-1', title: 'One', summary: 's' },
      {
        dir: 'b',
        kind: 'map',
        id: 'map-2',
        title: 'Two',
        summary: 's',
        relates_to: ['practice-1'],
      },
    ]);
    const first = generateIndex(root);
    const second = generateIndex(root);
    expect([...second.folders.keys()]).toEqual([...first.folders.keys()]);
    for (const [dir, folder] of first.folders) {
      expect(second.folders.get(dir)!.content).toBe(folder.content);
    }
  });

  it('orders bullets by GLOBAL in-degree, counting cross-folder edges', () => {
    // hub lives in folder-a; two referrers live in folder-b and point at it.
    // Within folder-a, hub must outrank a same-folder zero-in-degree node even
    // though hub has no edges from within folder-a.
    seedNodes(root, [
      { dir: 'folder-a', kind: 'practice', id: 'practice-hub', title: 'Hub', summary: 's' },
      { dir: 'folder-a', kind: 'practice', id: 'practice-alone', title: 'Alone', summary: 's' },
      {
        dir: 'folder-b',
        kind: 'practice',
        id: 'practice-ref-1',
        title: 'Ref 1',
        summary: 's',
        relates_to: ['practice-hub'],
      },
      {
        dir: 'folder-b',
        kind: 'practice',
        id: 'practice-ref-2',
        title: 'Ref 2',
        summary: 's',
        relates_to: ['practice-hub'],
      },
    ]);
    const aBody = generateIndex(root).folders.get('folder-a')!.content;
    const hubIdx = aBody.indexOf('**Hub**');
    const aloneIdx = aBody.indexOf('**Alone**');
    expect(hubIdx).toBeGreaterThan(-1);
    expect(aloneIdx).toBeGreaterThan(-1);
    expect(hubIdx).toBeLessThan(aloneIdx);
  });

  it('renders an empty folder and a singleton folder with well-defined bodies', () => {
    // empty-topic is an explicit folder with no leaves; single-topic has one.
    mkdirSync(join(root, 'empty-topic'), { recursive: true });
    writeFileSync(join(root, 'empty-topic', '.gitkeep'), '');
    seedNodes(root, [
      { dir: 'single-topic', kind: 'map', id: 'map-only', title: 'Only', summary: 's' },
    ]);
    const out = generateIndex(root);
    // The empty folder is not a leaf dir, so it only appears if a leaf or an
    // ancestor chain references it. A truly empty sibling folder with no leaves
    // is not part of the leaf-derived dir set; the singleton folder is.
    const single = out.folders.get('single-topic');
    expect(single).toBeDefined();
    expect(single!.content).toContain('**Only**');
    expect(single!.metrics.occupancy).toBe(1);
    // Root always renders, even with no direct leaves.
    const rootFolder = out.folders.get('')!;
    expect(rootFolder.content).toContain('# kenkeep Index');
    expect(rootFolder.content).toContain('_None yet._');
  });

  it('exposes per-folder metrics (occupancy, tag diversity, leaf size)', () => {
    seedNodes(root, [
      { dir: 'm', kind: 'map', id: 'map-a', title: 'A', summary: 's', tags: ['x', 'y'] },
      { dir: 'm', kind: 'map', id: 'map-b', title: 'B', summary: 's', tags: ['y', 'z'] },
    ]);
    const metrics = generateIndex(root).folders.get('m')!.metrics;
    expect(metrics.occupancy).toBe(2);
    expect(metrics.tagDiversity).toBe(3); // x, y, z
    expect(metrics.leafSize).toBeGreaterThan(0);
  });

  it('renders missing nodes/ as a root-only empty index', () => {
    const out = generateIndex(join(root, 'nope'));
    expect(out.nodeCount).toBe(0);
    expect([...out.folders.keys()]).toEqual(['']);
    expect(out.folders.get('')!.content).toContain('_None yet._');
  });

  it('frontmatter carries the bumped schema_version', () => {
    seedNodes(root, [{ dir: 't', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    expect(generateIndex(root).folders.get('t')!.content).toMatch(/schema_version:\s*2/);
  });
});

describe('computeNodesHash stability (leaves only, excludes index.md)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-hash-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('is unchanged when generated index.md files are (re)written', () => {
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 's' },
      { dir: 'b', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
    ]);
    const baseline = computeNodesHash(root);
    // Write index.md into every folder (simulating an index rebuild).
    for (const [dir, folder] of generateIndex(root).folders) {
      const d = dir ? join(root, ...dir.split('/')) : root;
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'index.md'), folder.content);
    }
    expect(computeNodesHash(root)).toBe(baseline);
    // Rewriting index.md again does not perturb the hash.
    for (const [dir, folder] of generateIndex(root).folders) {
      const d = dir ? join(root, ...dir.split('/')) : root;
      writeFileSync(join(d, 'index.md'), folder.content);
    }
    expect(computeNodesHash(root)).toBe(baseline);
  });

  it('changes when a leaf changes', () => {
    seedNodes(root, [{ dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v1' }]);
    const h1 = computeNodesHash(root);
    seedNodes(root, [{ dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v2' }]);
    expect(computeNodesHash(root)).not.toBe(h1);
  });
});

describe('cross references render the current path resolved by id', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-ref-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('renders each leaf at its current path; GRAPH lists edges by id', () => {
    seedNodes(root, [
      {
        dir: 'deep/nested',
        kind: 'map',
        id: 'map-target',
        title: 'Target',
        summary: 's',
      },
      {
        dir: 'other',
        kind: 'practice',
        id: 'practice-src',
        title: 'Src',
        summary: 's',
        relates_to: ['map-target'],
      },
    ]);
    const out = generateIndex(root);
    // The target leaf renders at its current deep path in its own folder index.
    expect(out.folders.get('deep/nested')!.content).toContain('[`deep/nested/map-target.md`]');
    // GRAPH overlay references by id and records the current path.
    const graph = generateGraph(root).content;
    expect(graph).toContain('## map-target');
    expect(graph).toContain('## practice-src');
    expect(graph).toContain('relates_to:** map-target');
    expect(graph).toContain('path:** deep/nested/map-target.md');
  });
});

describe('generateGraph', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-graph-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('emits a per-node block with edges and frontmatter', () => {
    seedNodes(root, [
      { dir: 'x', kind: 'practice', id: 'practice-a', title: 'A', summary: 'a' },
      { dir: 'y', kind: 'map', id: 'map-b', title: 'B', summary: 'b' },
    ]);
    const out = generateGraph(root);
    expect(out.content).toContain('## practice-a');
    expect(out.content).toContain('## map-b');
    expect(out.content).toContain('Total nodes: 2');
    expect(out.content).toMatch(/schema_version:\s*2/);
    // Regression: removed per-node lines must not reappear.
    expect(out.content).not.toContain('**status:**');
    expect(out.content).not.toContain('**supersedes:**');
  });
});
