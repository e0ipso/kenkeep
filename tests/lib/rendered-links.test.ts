import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAllNodes, writeNodeFile } from '../../src/lib/nodes.js';
import { readRedirectsLedger, writeRedirectsLedger } from '../../src/lib/redirects.js';
import { runLint } from '../../src/lib/lint.js';
import { findRenderedLinkDrift, refreshRenderedLinks } from '../../src/lib/rendered-links.js';
import type { NodeFrontmatter } from '../../src/lib/schemas.js';

function fm(id: string, overrides: Partial<NodeFrontmatter> = {}): NodeFrontmatter {
  return {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: id.startsWith('map-') ? 'map' : 'practice',
    description: `summary for ${id}`,
    tags: [],
    kk_derived_from: [],
    kk_relates_to: [],
    kk_depends_on: [],
    kk_confidence: 'high',
    ...overrides,
  };
}

/** Every markdown link target in a rendered leaf, in order. */
function hrefs(content: string): string[] {
  return [...content.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]!);
}

describe('rendered Related/Citations link base', () => {
  let repo: string;
  let nodesDir: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'kk-links-'));
    nodesDir = join(repo, '.ai/kenkeep/nodes');
    mkdirSync(join(repo, 'docs'), { recursive: true });
    writeFileSync(join(repo, 'docs/x.md'), '# x\n');
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('renders leaf-relative hrefs that resolve from the leaf to the target and the repo doc', () => {
    writeNodeFile({ nodesDir, frontmatter: fm('map-x'), body: '# X', relDir: 'c' });
    const leaf = writeNodeFile({
      nodesDir,
      frontmatter: fm('practice-leaf', {
        kk_relates_to: ['map-x'],
        kk_derived_from: ['docs/x.md', 'https://example.com/a', 'sess-1:practice:0'],
      }),
      body: '# Leaf',
      relDir: 'a/b',
    });

    const content = readFileSync(leaf, 'utf8');
    expect(content).toContain('- Related: [map-x](../../c/map-x.md)');
    expect(content).toContain('[1] [docs/x.md](../../../../../docs/x.md)');
    expect(content).toContain('[2] [https://example.com/a](https://example.com/a)');
    // A session origin is provenance, not a path: rendered as text, never a link.
    expect(content).toContain('[3] sess-1:practice:0');

    const local = hrefs(content).filter(h => !/^[a-z][a-z0-9+.-]*:\/\//i.test(h));
    expect(local).toHaveLength(2);
    for (const href of local) {
      expect(existsSync(resolve(dirname(leaf), href)), href).toBe(true);
    }
  });

  it('reports drift only for present generated sections whose links no longer match the tree', () => {
    writeNodeFile({ nodesDir, frontmatter: fm('map-x'), body: '# X', relDir: 'c' });
    const leaf = writeNodeFile({
      nodesDir,
      frontmatter: fm('practice-leaf', { kk_relates_to: ['map-x'] }),
      body: '# Leaf',
      relDir: 'a',
    });
    // A hand-written leaf with edges but no generated section has no stale link.
    writeFileSync(
      join(nodesDir, 'a', 'practice-bare.md'),
      '---\nkk_schema_version: 3\nkk_id: practice-bare\ntitle: b\ntype: practice\n' +
        'description: b\ntags: []\nkk_derived_from: []\nkk_relates_to: [map-x]\n' +
        'kk_confidence: high\n---\n# Bare\n'
    );
    expect(findRenderedLinkDrift(readAllNodes(nodesDir))).toEqual([]);

    writeFileSync(leaf, readFileSync(leaf, 'utf8').replace('(../c/map-x.md)', '(/c/map-x.md)'));
    const drift = findRenderedLinkDrift(readAllNodes(nodesDir));
    expect(drift.map(d => d.node.frontmatter.kk_id)).toEqual(['practice-leaf']);
    expect(drift[0]!.message).toContain('../c/map-x.md');
  });

  // A leaf whose edge names a retired id links to the successor's path, so a
  // boundary that moves the successor stales that leaf too. The scope
  // names the successor (the id that moved), never the retired id the edge
  // carries, so the match has to go through the ledger.
  it('refreshes a leaf whose edge names a retired id when its live successor moves', () => {
    writeNodeFile({ nodesDir, frontmatter: fm('map-live'), body: '# Live', relDir: 'c' });
    writeRedirectsLedger(nodesDir, { 'map-old': ['map-live'] });
    const linker = writeNodeFile({
      nodesDir,
      frontmatter: fm('practice-linker', { kk_relates_to: ['map-old'] }),
      body: '# Linker',
      relDir: 'a',
    });
    expect(readFileSync(linker, 'utf8')).toContain(
      '- Related: [map-old → map-live](../c/map-live.md)'
    );
    // Simulate a byte-preserving move of map-live from c/ to d/.
    mkdirSync(join(nodesDir, 'd'), { recursive: true });
    writeFileSync(join(nodesDir, 'd/map-live.md'), readFileSync(join(nodesDir, 'c/map-live.md')));
    rmSync(join(nodesDir, 'c'), { recursive: true });

    expect(refreshRenderedLinks(nodesDir, new Set(['map-live']))).toEqual([linker]);
    expect(readFileSync(linker, 'utf8')).toContain(
      '- Related: [map-old → map-live](../d/map-live.md)'
    );
    expect(findRenderedLinkDrift(readAllNodes(nodesDir), readRedirectsLedger(nodesDir))).toEqual(
      []
    );
  });

  // A dangling edge renders the same fallback on every refresh, so reporting
  // it as rendered-link drift would be a warning `refresh-links` cannot clear.
  it('reports a dangling edge only as dangling-edge, not as rendered-link drift', () => {
    const leaf = writeNodeFile({
      nodesDir,
      frontmatter: fm('practice-leaf', { kk_relates_to: ['map-ghost'] }),
      body: '# Leaf',
      relDir: 'a',
    });
    const bytes = readFileSync(leaf, 'utf8');
    expect(bytes).toContain('(../map-ghost.md)');

    const lint = runLint({ nodesDir });
    expect(lint.errors.map(e => e.rule)).toContain('dangling-edge');
    expect(lint.findings.filter(f => f.rule === 'stale-rendered-link')).toEqual([]);
    expect(refreshRenderedLinks(nodesDir)).toEqual([]);
    expect(readFileSync(leaf, 'utf8')).toBe(bytes);
  });
});
