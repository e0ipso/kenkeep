import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeNodesHash,
  deriveNodeId,
  ensureUniqueId,
  InvalidNodeFrontmatterError,
  nodeFileExists,
  readAllNodes,
  slugify,
  writeNodeFile,
} from '../../src/lib/nodes.js';
import type { NodeFrontmatter } from '../../src/lib/schemas.js';

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
    'derived_from: []',
    'relates_to: []',
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

  it('reads all valid nodes when every file parses', () => {
    seedNode(root, 'practice', 'practice-x');
    seedNode(root, 'map', 'map-y');

    const nodes = readAllNodes(root);
    expect(nodes.map(n => n.frontmatter.id).sort()).toEqual(['map-y', 'practice-x']);
  });

  it('throws InvalidNodeFrontmatterError naming any malformed file', () => {
    seedNode(root, 'practice', 'practice-x');
    mkdirSync(join(root, 'practice'), { recursive: true });
    const brokenPath = join(root, 'practice', 'broken.md');
    writeFileSync(brokenPath, '---\nnot: valid\n---\nbody');

    let caught: unknown;
    try {
      readAllNodes(root);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidNodeFrontmatterError);
    const failures = (caught as InvalidNodeFrontmatterError).failures;
    expect(failures).toHaveLength(1);
    expect(failures[0]!.file).toBe(brokenPath);
  });

  it('aggregates failures across multiple malformed files', () => {
    mkdirSync(join(root, 'practice'), { recursive: true });
    const missingFieldPath = join(root, 'practice', 'practice-missing-summary.md');
    writeFileSync(
      missingFieldPath,
      [
        '---',
        'schema_version: 1',
        'id: practice-missing-summary',
        'title: "no summary"',
        'kind: practice',
        'tags: []',
        'derived_from: []',
        'relates_to: []',
        'confidence: high',
        '---',
        '',
        'body',
      ].join('\n')
    );
    const garbagePath = join(root, 'practice', 'practice-garbage.md');
    writeFileSync(garbagePath, '---\nnot: valid\n---\nbody');

    let caught: InvalidNodeFrontmatterError | undefined;
    try {
      readAllNodes(root);
    } catch (err) {
      caught = err as InvalidNodeFrontmatterError;
    }
    expect(caught).toBeInstanceOf(InvalidNodeFrontmatterError);
    expect(caught!.failures.map(f => f.file).sort()).toEqual(
      [garbagePath, missingFieldPath].sort()
    );
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
      'practice-use-di-in-controllers'
    );
    expect(slugify('   ')).toBe('untitled');
  });

  it('ensureUniqueId returns the candidate when no collision exists', () => {
    expect(ensureUniqueId(new Set(), 'practice-foo')).toBe('practice-foo');
  });

  it('ensureUniqueId appends -2, -3, -4 on successive collisions', () => {
    expect(ensureUniqueId(new Set(['practice-foo']), 'practice-foo')).toBe('practice-foo-2');
    expect(ensureUniqueId(new Set(['practice-foo', 'practice-foo-2']), 'practice-foo')).toBe(
      'practice-foo-3'
    );
    expect(
      ensureUniqueId(new Set(['practice-foo', 'practice-foo-2', 'practice-foo-3']), 'practice-foo')
    ).toBe('practice-foo-4');
  });

  it('ensureUniqueId throws after 4 collisions with a guiding message', () => {
    const set = new Set(['practice-foo', 'practice-foo-2', 'practice-foo-3', 'practice-foo-4']);
    expect(() => ensureUniqueId(set, 'practice-foo')).toThrow(
      'id "practice-foo" collides with 4 existing ids; choose a more distinct title'
    );
  });

  it('writeNodeFile validates frontmatter and atomically writes nodes/<kind>/<id>.md', () => {
    const fm: NodeFrontmatter = {
      schema_version: 1,
      id: 'practice-write-test',
      title: 'Write test',
      kind: 'practice',
      tags: ['x'],
      derived_from: ['session-1.md'],
      relates_to: [],
      confidence: 'high',
      summary: 'For testing the node writer.',
    };
    const written = writeNodeFile({
      nodesDir: root,
      frontmatter: fm,
      body: '# Write test\n\nBody.',
    });
    expect(written).toBe(join(root, 'practice', 'practice-write-test.md'));
    const raw = readFileSync(written, 'utf8');
    expect(raw).toContain('id: practice-write-test');
    expect(raw).not.toContain('proposal:');
    expect(raw).toContain('# Write test');
    expect(nodeFileExists(root, 'practice', 'practice-write-test')).toBe(true);
    expect(nodeFileExists(root, 'practice', 'practice-other')).toBe(false);
  });
});
