import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeNodesHash,
  deriveNodeId,
  ensureUniqueId,
  proposalFilename,
  readAllNodes,
  slugify,
  writeProposalFile,
} from '../../src/lib/nodes.js';
import type { ProposalFrontmatter } from '../../src/lib/schemas.js';

function seedNode(dir: string, kind: 'practice' | 'map', id: string, body = '# body\n'): void {
  const file = join(dir, kind, `${id}.md`);
  mkdirSync(join(dir, kind), { recursive: true });
  const fm = [
    '---',
    'schema_version: 1',
    `id: ${id}`,
    `title: "${id} title"`,
    `kind: ${kind}`,
    'tags: [a, b]',
    'valid_from: "2026-01-01T00:00:00Z"',
    'valid_until: null',
    'updated: "2026-01-01T00:00:00Z"',
    'supersedes: null',
    'superseded_by: null',
    'derived_from: []',
    'relates_to: []',
    'depends_on: []',
    'confidence: high',
    `summary: "summary for ${id}"`,
    '---',
    '',
    body,
  ].join('\n');
  writeFileSync(file, fm);
}

describe('nodes helpers', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-nodes-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reads all valid nodes and skips malformed files', () => {
    seedNode(root, 'practice', 'practice-x');
    seedNode(root, 'map', 'map-y');
    // Garbage file should be ignored.
    mkdirSync(join(root, 'practice'), { recursive: true });
    writeFileSync(join(root, 'practice', 'broken.md'), '---\nnot: valid\n---\nbody');

    const nodes = readAllNodes(root);
    expect(nodes.map((n) => n.frontmatter.id).sort()).toEqual(['map-y', 'practice-x']);
  });

  it('computeNodesHash is deterministic and content-sensitive', () => {
    seedNode(root, 'practice', 'practice-a', '# v1\n');
    const h1 = computeNodesHash(root);
    seedNode(root, 'practice', 'practice-a', '# v2\n');
    const h2 = computeNodesHash(root);
    seedNode(root, 'practice', 'practice-a', '# v1\n');
    const h3 = computeNodesHash(root);
    expect(h1).toBe(h3);
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash differs when adding a file', () => {
    seedNode(root, 'practice', 'practice-a');
    const before = computeNodesHash(root);
    seedNode(root, 'map', 'map-b');
    expect(computeNodesHash(root)).not.toBe(before);
  });

  it('slugify and deriveNodeId match the kind-slug pattern', () => {
    expect(slugify('Bravo Insider — module!!')).toBe('bravo-insider-module');
    expect(deriveNodeId('practice', 'Use DI in controllers')).toBe(
      'practice-use-di-in-controllers',
    );
    expect(slugify('   ')).toBe('untitled');
  });

  it('ensureUniqueId appends a suffix when colliding', () => {
    const set = new Set(['practice-foo']);
    expect(ensureUniqueId(set, 'practice-foo')).toBe('practice-foo-2');
    set.add('practice-foo-2');
    expect(ensureUniqueId(set, 'practice-foo')).toBe('practice-foo-3');
  });

  it('writeProposalFile serializes valid frontmatter and round-trips', () => {
    const proposedDir = join(root, '_proposed');
    const fm: ProposalFrontmatter = {
      schema_version: 1,
      id: 'practice-write-test',
      title: 'Write test',
      kind: 'practice',
      tags: ['x'],
      valid_from: '2026-05-11T10:00:00Z',
      valid_until: null,
      updated: '2026-05-11T10:00:00Z',
      supersedes: null,
      superseded_by: null,
      derived_from: ['session-1.md'],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
      summary: 'For testing the proposal writer.',
      proposal: {
        kind: 'addition',
        source_sessions: ['session-1'],
        target_node: null,
        rationale: 'unit test',
        suggested_resolution: null,
        curator_log: null,
      },
    };
    const written = writeProposalFile({
      proposedDir,
      proposalKind: 'additions',
      filename: proposalFilename('practice', 'practice-write-test'),
      frontmatter: fm,
      body: '# Write test\n\nBody.',
    });
    const raw = readFileSync(written, 'utf8');
    expect(raw).toContain('id: practice-write-test');
    expect(raw).toContain('proposal:');
    expect(raw).toContain('rationale: unit test');
    expect(raw).toContain('# Write test');
  });
});
