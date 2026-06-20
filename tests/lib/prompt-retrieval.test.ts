import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeRedirectsLedger } from '../../src/lib/redirects.js';
import {
  buildPromptKnowledgeContext,
  DEFAULT_MAX_NODES,
  rankNodes,
  renderPromptKnowledgeContext,
  tokenize,
} from '../../src/lib/prompt-retrieval.js';
import { readAllNodes } from '../../src/lib/nodes.js';

interface SeedOpts {
  id: string;
  title: string;
  kind?: 'practice' | 'map';
  tags?: string[];
  summary?: string;
  body?: string;
  relates_to?: string[];
  depends_on?: string[];
  relDir?: string;
}

function seed(nodesDir: string, opts: SeedOpts): void {
  const relDir = opts.relDir ?? opts.id;
  const dir = relDir === '' ? nodesDir : join(nodesDir, ...relDir.split('/'));
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 2,
    id: opts.id,
    title: opts.title,
    kind: opts.kind ?? 'practice',
    tags: opts.tags ?? [],
    derived_from: [],
    relates_to: opts.relates_to ?? [],
    depends_on: opts.depends_on ?? [],
    confidence: 'high',
    summary: opts.summary ?? '',
  };
  writeFileSync(join(dir, `${opts.id}.md`), matter.stringify(opts.body ?? '# body\n', fm));
}

describe('prompt-retrieval tokenize', () => {
  it('lowercases, splits on non-alphanumerics, drops short terms and stopwords', () => {
    expect(tokenize('How do I configure the Codex hook?')).toEqual(['configure', 'codex', 'hook']);
  });

  it('returns empty for whitespace-only or punctuation-only input', () => {
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('-- !! ??')).toEqual([]);
  });
});

describe('rankNodes', () => {
  let nodesDir: string;
  beforeEach(() => {
    nodesDir = mkdtempSync(join(tmpdir(), 'kk-retrieval-'));
  });
  afterEach(() => rmSync(nodesDir, { recursive: true, force: true }));

  it('ranks a title/tag/summary match above a body-only match', () => {
    seed(nodesDir, {
      id: 'practice-codex-hooks',
      title: 'Wire Codex hooks',
      tags: ['codex', 'hooks'],
      summary: 'How to register Codex hook commands',
      body: 'Details.',
    });
    seed(nodesDir, {
      id: 'practice-other',
      title: 'Unrelated convention',
      tags: ['misc'],
      summary: 'Something else entirely',
      body: 'A passing mention of codex deep in the body text.',
    });

    const matches = rankNodes(readAllNodes(nodesDir), 'how do I wire codex hooks');
    expect(matches[0]?.node.frontmatter.id).toBe('practice-codex-hooks');
    expect(matches[0]?.score).toBeGreaterThan(matches[1]?.score ?? 0);
  });

  it('omits low-relevance nodes for an unrelated prompt', () => {
    seed(nodesDir, {
      id: 'practice-codex-hooks',
      title: 'Wire Codex hooks',
      tags: ['codex'],
      summary: 'Codex hook registration',
      body: 'codex codex codex',
    });
    seed(nodesDir, {
      id: 'practice-indexing',
      title: 'Index generation',
      tags: ['index'],
      summary: 'Deterministic index rendering',
      body: 'index index',
    });

    const matches = rankNodes(readAllNodes(nodesDir), 'deploying kubernetes ingress controllers');
    expect(matches).toEqual([]);
  });

  it('is deterministic and order-stable for the same prompt and tree', () => {
    seed(nodesDir, {
      id: 'practice-a',
      title: 'Alpha config',
      tags: ['config'],
      summary: 'config',
    });
    seed(nodesDir, { id: 'practice-b', title: 'Beta config', tags: ['config'], summary: 'config' });
    const prompt = 'config';
    const first = rankNodes(readAllNodes(nodesDir), prompt).map(m => m.node.frontmatter.id);
    const second = rankNodes(readAllNodes(nodesDir), prompt).map(m => m.node.frontmatter.id);
    expect(first).toEqual(second);
    // Equal scores tie-break by id ascending.
    expect(first).toEqual(['practice-a', 'practice-b']);
  });

  it('applies a small graph boost without overriding lexical relevance', () => {
    // hub matches the prompt strongly; neighbor matches only weakly but is
    // linked to hub, so the boost should lift it above an equally-weak unlinked node.
    seed(nodesDir, {
      id: 'practice-hub',
      title: 'Retrieval scoring core',
      tags: ['retrieval', 'scoring'],
      summary: 'Scoring core for retrieval',
      body: 'retrieval scoring',
    });
    seed(nodesDir, {
      id: 'practice-neighbor',
      title: 'Linked helper',
      tags: ['helper'],
      summary: 'A helper that mentions scoring once',
      body: 'scoring',
      relates_to: ['practice-hub'],
    });
    seed(nodesDir, {
      id: 'practice-loner',
      title: 'Standalone helper',
      tags: ['helper'],
      summary: 'A helper that mentions scoring once',
      body: 'scoring',
    });

    const matches = rankNodes(readAllNodes(nodesDir), 'retrieval scoring');
    const order = matches.map(m => m.node.frontmatter.id);
    expect(order[0]).toBe('practice-hub');
    // Neighbor (boosted via edge to the matched hub) ranks above the unlinked loner.
    expect(order.indexOf('practice-neighbor')).toBeLessThan(order.indexOf('practice-loner'));
  });

  it('resolves graph edges through the redirects ledger', () => {
    seed(nodesDir, {
      id: 'practice-hub',
      title: 'Scoring core',
      tags: ['scoring'],
      summary: 'scoring core',
      body: 'scoring',
    });
    // Neighbor links to a RETIRED id; the ledger redirects it to the live hub.
    seed(nodesDir, {
      id: 'practice-neighbor',
      title: 'Helper',
      tags: ['helper'],
      summary: 'helper mentions scoring',
      body: 'scoring',
      relates_to: ['practice-old-hub'],
    });
    seed(nodesDir, {
      id: 'practice-loner',
      title: 'Loner',
      tags: ['helper'],
      summary: 'loner mentions scoring',
      body: 'scoring',
    });
    writeRedirectsLedger(nodesDir, { 'practice-old-hub': ['practice-hub'] });

    const order = rankNodes(readAllNodes(nodesDir), 'scoring').map(m => m.node.frontmatter.id);
    expect(order.indexOf('practice-neighbor')).toBeLessThan(order.indexOf('practice-loner'));
  });

  it('caps the number of matches at maxNodes', () => {
    for (let i = 0; i < DEFAULT_MAX_NODES + 4; i += 1) {
      seed(nodesDir, {
        id: `practice-config-${i}`,
        title: `Config topic ${i}`,
        tags: ['config'],
        summary: 'config',
      });
    }
    expect(rankNodes(readAllNodes(nodesDir), 'config').length).toBe(DEFAULT_MAX_NODES);
    expect(rankNodes(readAllNodes(nodesDir), 'config', { maxNodes: 2 }).length).toBe(2);
  });

  it('returns nothing for an empty prompt', () => {
    seed(nodesDir, { id: 'practice-a', title: 'Alpha', tags: ['config'], summary: 'config' });
    expect(rankNodes(readAllNodes(nodesDir), '   ')).toEqual([]);
  });
});

describe('renderPromptKnowledgeContext', () => {
  it('renders title, id, repo-relative link, summary, and tags but never the body', () => {
    const nodesDir = mkdtempSync(join(tmpdir(), 'kk-render-'));
    try {
      seed(nodesDir, {
        id: 'practice-codex-hooks',
        title: 'Wire Codex hooks',
        tags: ['codex', 'hooks'],
        summary: 'How to register Codex hook commands',
        body: 'SECRET_BODY_MARKER should never be rendered',
        relDir: 'harnesses',
      });
      const block = renderPromptKnowledgeContext(rankNodes(readAllNodes(nodesDir), 'codex hooks'));
      expect(block).toContain('Wire Codex hooks');
      expect(block).toContain('`practice-codex-hooks`');
      expect(block).toContain('.ai/kenkeep/nodes/harnesses/practice-codex-hooks.md');
      expect(block).toContain('How to register Codex hook commands');
      expect(block).toContain('#codex');
      expect(block).toContain('open the linked node');
      expect(block).not.toContain('SECRET_BODY_MARKER');
    } finally {
      rmSync(nodesDir, { recursive: true, force: true });
    }
  });

  it('returns the empty string for no matches', () => {
    expect(renderPromptKnowledgeContext([])).toBe('');
  });

  it('truncates entries to stay within the character budget', () => {
    const nodesDir = mkdtempSync(join(tmpdir(), 'kk-budget-'));
    try {
      for (let i = 0; i < 5; i += 1) {
        seed(nodesDir, {
          id: `practice-config-${i}`,
          title: `Configuration topic number ${i} with a deliberately long title`,
          tags: ['config'],
          summary: 'A reasonably long summary string to consume the character budget quickly.',
        });
      }
      const matches = rankNodes(readAllNodes(nodesDir), 'config', { maxNodes: 5 });
      const maxChars = 900;
      const bounded = renderPromptKnowledgeContext(matches, { maxChars });
      // Budget bounds the block (the trailing newline is the only slack).
      expect(bounded.length).toBeLessThanOrEqual(maxChars + 1);
      const entryCount = bounded.split('\n').filter(l => l.startsWith('- ')).length;
      // At least one entry renders; the budget drops the rest.
      expect(entryCount).toBeGreaterThanOrEqual(1);
      expect(entryCount).toBeLessThan(5);
    } finally {
      rmSync(nodesDir, { recursive: true, force: true });
    }
  });
});

describe('buildPromptKnowledgeContext', () => {
  it('returns empty for an empty prompt without reading nodes', () => {
    expect(buildPromptKnowledgeContext('/nonexistent/nodes', '   ')).toBe('');
  });

  it('returns empty when the knowledge base is missing', () => {
    expect(buildPromptKnowledgeContext('/nonexistent/nodes', 'codex hooks')).toBe('');
  });

  it('reads the live tree and renders a relevant block end to end', () => {
    const nodesDir = mkdtempSync(join(tmpdir(), 'kk-e2e-'));
    try {
      seed(nodesDir, {
        id: 'practice-codex-hooks',
        title: 'Wire Codex hooks',
        tags: ['codex'],
        summary: 'register codex hooks',
        body: 'body',
      });
      const block = buildPromptKnowledgeContext(nodesDir, 'how do I wire codex hooks');
      expect(block).toContain('Wire Codex hooks');
      expect(block).toContain('`practice-codex-hooks`');
    } finally {
      rmSync(nodesDir, { recursive: true, force: true });
    }
  });
});
