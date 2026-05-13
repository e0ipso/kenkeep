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
  relates_to?: string[];
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
      derived_from: [],
      relates_to: s.relates_to ?? [],
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

  it('renders Conventions, Components, and By topic sections with the catalog bullet shape', () => {
    seedNodes(root, [
      {
        kind: 'practice',
        id: 'practice-a',
        title: 'A practice',
        summary: 'A summary',
        tags: ['foo', 'bar'],
      },
      {
        kind: 'practice',
        id: 'practice-b',
        title: 'B practice',
        summary: 'B summary',
        tags: ['foo'],
      },
      {
        kind: 'map',
        id: 'map-x',
        title: 'X map',
        summary: 'X summary',
        tags: ['bar'],
      },
    ]);
    const out = generateIndex(root);
    expect(out.nodeCount).toBe(3);
    expect(out.content).toContain('## Conventions (how we build)');
    expect(out.content).toContain('## Components (what exists)');
    expect(out.content).toContain('## By topic');
    expect(out.content).not.toMatch(/^- \*\*[^*]+\*\* — /m);
    expect(out.content).toContain('** [`');
    expect(out.content).toContain(' #foo');
    expect(out.content).toContain(' #bar');
    expect(out.content).toContain('**#foo (2):**');
    expect(out.content).toContain('**#bar (2):**');
    expect(out.content).toMatch(/nodes_hash:\s+['"]?sha256:/);
    expect(out.content).toMatch(/_3 nodes • ~\d+ estimated tokens_/);
    // Regression: removed features must not reappear.
    expect(out.content).not.toContain('Recently superseded');
    expect(out.content).not.toContain('superseded');
  });

  it('sorts nodes within a section by in-degree DESC, with title ASC as tiebreaker', () => {
    seedNodes(root, [
      { kind: 'practice', id: 'practice-hub', title: 'Hub', summary: 's' },
      {
        kind: 'practice',
        id: 'practice-ref-a',
        title: 'Ref A',
        summary: 's',
        relates_to: ['practice-hub'],
      },
      {
        kind: 'practice',
        id: 'practice-ref-b',
        title: 'Ref B',
        summary: 's',
        relates_to: ['practice-hub'],
      },
      { kind: 'practice', id: 'practice-alone', title: 'Alone', summary: 's' },
    ]);
    const out = generateIndex(root);
    const hubIdx = out.content.indexOf('**Hub**');
    const aloneIdx = out.content.indexOf('**Alone**');
    expect(hubIdx).toBeGreaterThan(-1);
    expect(aloneIdx).toBeGreaterThan(-1);
    expect(hubIdx).toBeLessThan(aloneIdx);
    // Tiebreaker: Ref A and Ref B both have in-degree 0; Ref A comes first.
    const refAIdx = out.content.indexOf('**Ref A**');
    const refBIdx = out.content.indexOf('**Ref B**');
    expect(refAIdx).toBeLessThan(refBIdx);
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
    // Regression: removed per-node lines must not reappear.
    expect(out.content).not.toContain('**status:**');
    expect(out.content).not.toContain('**supersedes:**');
    expect(out.content).not.toContain('**superseded_by:**');
  });
});
