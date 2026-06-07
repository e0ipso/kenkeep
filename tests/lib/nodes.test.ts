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
  resolveLeafDir,
  slugify,
  writeNodeFile,
} from '../../src/lib/nodes.js';
import type { NodeFrontmatter } from '../../src/lib/schemas.js';

// Leaves live in topical folders, not kind buckets. `topic` defaults to the
// node's id so each leaf gets its own folder; pass an explicit topic to colocate.
function seedNode(
  dir: string,
  kind: 'practice' | 'map',
  id: string,
  body = '# body\n',
  topic = id
): void {
  const folder = join(dir, topic);
  mkdirSync(folder, { recursive: true });
  const fm = [
    '---',
    'schema_version: 2',
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
  writeFileSync(join(folder, `${id}.md`), fm);
}

describe('nodes helpers', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-nodes-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reads all valid nodes when every file parses', () => {
    seedNode(root, 'practice', 'practice-x');
    seedNode(root, 'map', 'map-y');

    const nodes = readAllNodes(root);
    expect(nodes.map(n => n.frontmatter.id).sort()).toEqual(['map-y', 'practice-x']);
  });

  it('throws InvalidNodeFrontmatterError aggregating every malformed file', () => {
    seedNode(root, 'practice', 'practice-x');
    mkdirSync(join(root, 'bad'), { recursive: true });
    const missingFieldPath = join(root, 'bad', 'practice-missing-summary.md');
    writeFileSync(
      missingFieldPath,
      [
        '---',
        'schema_version: 2',
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
    const garbagePath = join(root, 'bad', 'practice-garbage.md');
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

  it('computeNodesHash is deterministic, content-sensitive, and changes when a file is added', () => {
    seedNode(root, 'practice', 'practice-a', '# v1\n');
    const h1 = computeNodesHash(root);
    seedNode(root, 'practice', 'practice-a', '# v2\n');
    const h2 = computeNodesHash(root);
    seedNode(root, 'practice', 'practice-a', '# v1\n');
    const h3 = computeNodesHash(root);
    expect(h1).toBe(h3);
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    seedNode(root, 'map', 'map-b');
    expect(computeNodesHash(root)).not.toBe(h1);
  });

  it('slugify and deriveNodeId match the kind-slug pattern', () => {
    expect(slugify('Bravo Insider — module!!')).toBe('bravo-insider-module');
    expect(deriveNodeId('practice', 'Use DI in controllers')).toBe(
      'practice-use-di-in-controllers'
    );
    expect(slugify('   ')).toBe('untitled');
  });

  it('ensureUniqueId returns the candidate, appends suffixes on collisions, and throws after 4', () => {
    expect(ensureUniqueId(new Set(), 'practice-foo')).toBe('practice-foo');
    expect(ensureUniqueId(new Set(['practice-foo']), 'practice-foo')).toBe('practice-foo-2');
    expect(
      ensureUniqueId(new Set(['practice-foo', 'practice-foo-2', 'practice-foo-3']), 'practice-foo')
    ).toBe('practice-foo-4');
    const full = new Set(['practice-foo', 'practice-foo-2', 'practice-foo-3', 'practice-foo-4']);
    expect(() => ensureUniqueId(full, 'practice-foo')).toThrow(
      'id "practice-foo" collides with 4 existing ids; choose a more distinct title'
    );
  });

  it('writeNodeFile validates frontmatter and atomically writes a leaf (kind-independent placement)', () => {
    const fm: NodeFrontmatter = {
      schema_version: 2,
      id: 'practice-write-test',
      title: 'Write test',
      kind: 'practice',
      tags: ['x'],
      derived_from: ['session-1.md'],
      relates_to: [],
      confidence: 'high',
      summary: 'For testing the node writer.',
    };
    // Default placement: nodes/ root (no kind bucket).
    const written = writeNodeFile({
      nodesDir: root,
      frontmatter: fm,
      body: '# Write test\n\nBody.',
    });
    expect(written).toBe(join(root, 'practice-write-test.md'));
    const raw = readFileSync(written, 'utf8');
    expect(raw).toContain('id: practice-write-test');
    expect(raw).not.toContain('proposal:');
    expect(raw).toContain('# Write test');
    expect(nodeFileExists(root, 'practice-write-test')).toBe(true);
    expect(nodeFileExists(root, 'practice-other')).toBe(false);

    // Explicit topical folder placement.
    const inTopic = writeNodeFile({
      nodesDir: root,
      frontmatter: { ...fm, id: 'map-topical', kind: 'map' },
      body: '# Topical',
      relDir: 'topic/sub',
    });
    expect(inTopic).toBe(join(root, 'topic', 'sub', 'map-topical.md'));
    expect(nodeFileExists(root, 'map-topical')).toBe(true);
  });

  it('writeNodeFile updates a leaf in place by id at its folder, with no relocation', () => {
    const fm: NodeFrontmatter = {
      schema_version: 2,
      id: 'practice-in-place',
      title: 'In place',
      kind: 'practice',
      tags: [],
      derived_from: [],
      relates_to: [],
      confidence: 'high',
      summary: 'placed in a folder',
    };
    // Initial placement into an existing folder.
    const first = writeNodeFile({
      nodesDir: root,
      frontmatter: fm,
      body: '# Original\n\noriginal body',
      relDir: 'storage',
    });
    expect(first).toBe(join(root, 'storage', 'practice-in-place.md'));

    // Re-writing the same id at the same folder overwrites in place: same path,
    // updated body, and no copy at the root or anywhere else (identity is the
    // id; the filename stem stays <id>.md).
    const second = writeNodeFile({
      nodesDir: root,
      frontmatter: { ...fm, summary: 'updated' },
      body: '# Updated\n\nupdated body',
      relDir: 'storage',
    });
    expect(second).toBe(first);
    expect(readFileSync(first, 'utf8')).toContain('updated body');
    expect(readAllNodes(root).filter(n => n.frontmatter.id === 'practice-in-place')).toHaveLength(1);
    expect(nodeFileExists(root, 'practice-in-place')).toBe(true);
  });

  it('resolveLeafDir routes a relative folder under nodes/ and rejects escapes', () => {
    // Relative folder resolves under nodes/.
    expect(resolveLeafDir(root, 'practice/sub')).toBe(join(root, 'practice', 'sub'));
    // Empty/omitted folder is the root fallback, not an error.
    expect(resolveLeafDir(root, '')).toBe(root);
    expect(resolveLeafDir(root)).toBe(root);
    // A `..` traversal and an absolute path both escape nodes/ and are rejected.
    expect(() => resolveLeafDir(root, '../escape')).toThrow(/escapes nodes\//);
    expect(() => resolveLeafDir(root, '/etc/evil')).toThrow(/escapes nodes\//);
  });
});
