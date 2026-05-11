import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateGraph, generateIndex } from '../../src/lib/index-gen.js';

interface NodeSeed {
  kind: 'practice' | 'map';
  id: string;
  title: string;
  summary: string;
  tags?: string[];
  updated?: string;
  valid_until?: string | null;
  superseded_by?: string | null;
}

function seedNodes(root: string, seeds: NodeSeed[]): void {
  for (const s of seeds) {
    const dir = join(root, s.kind);
    mkdirSync(dir, { recursive: true });
    const body = `# ${s.title}\n\nBody.\n`;
    const fm = matter.stringify(body, {
      schema_version: 1,
      id: s.id,
      title: s.title,
      kind: s.kind,
      tags: s.tags ?? [],
      valid_from: '2026-01-01T00:00:00Z',
      valid_until: s.valid_until ?? null,
      updated: s.updated ?? '2026-01-01T00:00:00Z',
      supersedes: null,
      superseded_by: s.superseded_by ?? null,
      derived_from: [],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
      summary: s.summary,
    });
    writeFileSync(join(dir, `${s.id}.md`), fm);
  }
}

describe('generateIndex', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-index-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('renders practice and map sections sorted by updated desc', () => {
    seedNodes(root, [
      {
        kind: 'practice',
        id: 'practice-a',
        title: 'A practice',
        summary: 'A summary',
        updated: '2026-04-01T00:00:00Z',
      },
      {
        kind: 'practice',
        id: 'practice-b',
        title: 'B practice',
        summary: 'B summary',
        updated: '2026-05-01T00:00:00Z',
      },
      { kind: 'map', id: 'map-x', title: 'X map', summary: 'X summary' },
    ]);
    const out = generateIndex(root, { now: new Date('2026-05-11T10:00:00Z') });
    expect(out.nodeCount).toBe(3);
    expect(out.content).toContain('## Practice (how we build)');
    expect(out.content).toContain('## Map (what exists)');
    const aIdx = out.content.indexOf('A practice');
    const bIdx = out.content.indexOf('B practice');
    expect(bIdx).toBeGreaterThan(0);
    expect(bIdx).toBeLessThan(aIdx);
    expect(out.content).toMatch(/nodes_hash:\s+['"]?sha256:/);
    expect(out.content).toMatch(/3 nodes • 3 currently valid • 0 superseded/);
  });

  it('lists superseded nodes in their own section and counts them as invalid', () => {
    seedNodes(root, [
      {
        kind: 'practice',
        id: 'practice-old',
        title: 'Old',
        summary: 'old summary',
        valid_until: '2026-04-01T00:00:00Z',
        superseded_by: 'practice-new',
      },
      { kind: 'practice', id: 'practice-new', title: 'New', summary: 'new summary' },
    ]);
    const out = generateIndex(root);
    expect(out.content).toContain('## Recently superseded');
    expect(out.content).toContain('superseded by practice-new');
    expect(out.content).toMatch(/2 nodes • 1 currently valid • 1 superseded/);
  });

  it('renders an empty index gracefully when nodes/ is missing', () => {
    const out = generateIndex(join(root, 'nope'));
    expect(out.nodeCount).toBe(0);
    expect(out.content).toContain('_None yet._');
  });
});

describe('generateGraph', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-graph-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('emits a per-node block with edges and frontmatter', () => {
    seedNodes(root, [
      { kind: 'practice', id: 'practice-a', title: 'A', summary: 'a' },
      { kind: 'map', id: 'map-b', title: 'B', summary: 'b' },
    ]);
    const out = generateGraph(root);
    expect(out.content).toContain('## practice-a');
    expect(out.content).toContain('## map-b');
    expect(out.content).toContain('Total nodes: 2');
  });
});
