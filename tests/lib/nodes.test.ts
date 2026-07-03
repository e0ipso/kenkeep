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
    'kk_schema_version: 3',
    `kk_id: ${id}`,
    `title: "${id} title"`,
    `type: ${kind}`,
    `description: "summary for ${id}"`,
    'tags: [a, b]',
    'kk_derived_from: []',
    'kk_relates_to: []',
    'kk_confidence: high',
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
    expect(nodes.map(n => n.frontmatter.kk_id).sort()).toEqual(['map-y', 'practice-x']);
  });

  it('ignores OKF reserved log.md files when reading and hashing leaves', () => {
    seedNode(root, 'practice', 'practice-x');
    const before = computeNodesHash(root);
    writeFileSync(join(root, 'log.md'), '# Bundle log\n');
    mkdirSync(join(root, 'topic'), { recursive: true });
    writeFileSync(join(root, 'topic', 'log.md'), '# Topic log\n');

    const nodes = readAllNodes(root);
    expect(nodes.map(n => n.frontmatter.kk_id)).toEqual(['practice-x']);
    expect(computeNodesHash(root)).toBe(before);
  });

  it('rejects the legacy flat nodes/<kind>/ layout and points to the kk-migrate skill, not init --upgrade', () => {
    // A v1 flat bucket: leaf docs under nodes/practice/ with no generated index.md.
    const bucket = join(root, 'practice');
    mkdirSync(bucket, { recursive: true });
    writeFileSync(
      join(bucket, 'practice-old.md'),
      '---\nschema_version: 1\nid: practice-old\n---\n\n# old\n'
    );

    let msg = '';
    try {
      readAllNodes(root);
    } catch (err) {
      msg = (err as Error).message;
    }
    // The removed `npx kenkeep --harness <id> migrate` command is gone; the
    // rejection now names the in-session kk-migrate skill.
    expect(msg).toMatch(/`\/kk-migrate` skill/);
    expect(msg).not.toMatch(/npx kenkeep --harness <id> migrate/);
    expect(msg).not.toMatch(/init --upgrade/);
  });

  it('rejects nested schema_version 2 leaves with the migrate guidance', () => {
    const dir = join(root, 'topic');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'practice-old.md'),
      [
        '---',
        'schema_version: 2',
        'id: practice-old',
        'title: old',
        'kind: practice',
        'summary: old summary',
        'tags: []',
        'derived_from: []',
        'relates_to: []',
        'depends_on: []',
        'confidence: high',
        '---',
        '',
        'body',
      ].join('\n')
    );

    expect(() => readAllNodes(root)).toThrow(/`\/kk-migrate` skill/);
  });

  it('throws InvalidNodeFrontmatterError aggregating every malformed file', () => {
    seedNode(root, 'practice', 'practice-x');
    mkdirSync(join(root, 'bad'), { recursive: true });
    const missingFieldPath = join(root, 'bad', 'practice-missing-summary.md');
    writeFileSync(
      missingFieldPath,
      [
        '---',
        'kk_schema_version: 3',
        'kk_id: practice-missing-summary',
        'title: "no summary"',
        'type: practice',
        'tags: []',
        'kk_derived_from: []',
        'kk_relates_to: []',
        'kk_confidence: high',
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
      kk_schema_version: 3,
      kk_id: 'practice-write-test',
      title: 'Write test',
      type: 'practice',
      description: 'For testing the node writer.',
      tags: ['x'],
      kk_derived_from: ['session-1.md'],
      kk_relates_to: [],
      kk_confidence: 'high',
    };
    // Default placement: nodes/ root (no kind bucket).
    const written = writeNodeFile({
      nodesDir: root,
      frontmatter: fm,
      body: '# Write test\n\nBody.',
    });
    expect(written).toBe(join(root, 'practice-write-test.md'));
    const raw = readFileSync(written, 'utf8');
    expect(raw).toContain('kk_id: practice-write-test');
    expect(raw).not.toContain('proposal:');
    expect(raw).toContain('# Write test');
    expect(nodeFileExists(root, 'practice-write-test')).toBe(true);
    expect(nodeFileExists(root, 'practice-other')).toBe(false);

    // Explicit topical folder placement.
    const inTopic = writeNodeFile({
      nodesDir: root,
      frontmatter: { ...fm, kk_id: 'map-topical', type: 'map' },
      body: '# Topical',
      relDir: 'topic/sub',
    });
    expect(inTopic).toBe(join(root, 'topic', 'sub', 'map-topical.md'));
    expect(nodeFileExists(root, 'map-topical')).toBe(true);
  });

  it('writeNodeFile updates a leaf in place by id at its folder, with no relocation', () => {
    const fm: NodeFrontmatter = {
      kk_schema_version: 3,
      kk_id: 'practice-in-place',
      title: 'In place',
      type: 'practice',
      description: 'placed in a folder',
      tags: [],
      kk_derived_from: [],
      kk_relates_to: [],
      kk_confidence: 'high',
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
      frontmatter: { ...fm, description: 'updated' },
      body: '# Updated\n\nupdated body',
      relDir: 'storage',
    });
    expect(second).toBe(first);
    expect(readFileSync(first, 'utf8')).toContain('updated body');
    expect(
      readAllNodes(root).filter(n => n.frontmatter.kk_id === 'practice-in-place')
    ).toHaveLength(1);
    expect(nodeFileExists(root, 'practice-in-place')).toBe(true);
  });

  it('writeNodeFile regenerates Related and Citations sections without touching prose', () => {
    const base: NodeFrontmatter = {
      kk_schema_version: 3,
      kk_id: 'map-target',
      title: 'Target',
      type: 'map',
      description: 'target',
      tags: [],
      kk_derived_from: [],
      kk_relates_to: [],
      kk_confidence: 'high',
    };
    writeNodeFile({
      nodesDir: root,
      frontmatter: base,
      body: '# Target\n\nTarget body.',
      relDir: 'refs',
    });
    writeNodeFile({
      nodesDir: root,
      frontmatter: { ...base, kk_id: 'map-dependency', title: 'Dependency' },
      body: '# Dependency\n\nDependency body.',
      relDir: 'refs',
    });

    const source: NodeFrontmatter = {
      kk_schema_version: 3,
      kk_id: 'practice-source',
      title: 'Source',
      type: 'practice',
      description: 'source',
      tags: [],
      kk_derived_from: ['session-1.md'],
      kk_relates_to: ['map-target'],
      kk_depends_on: ['map-dependency'],
      kk_confidence: 'high',
    };
    const sourcePath = writeNodeFile({
      nodesDir: root,
      frontmatter: source,
      body: '# Source\n\nHand prose.',
      relDir: 'work',
    });
    const first = readFileSync(sourcePath, 'utf8');
    expect(first).toContain('Hand prose.');
    expect(first).toContain('# Related');
    expect(first).toContain('- Related: [map-target](/refs/map-target.md)');
    expect(first).toContain('- Depends on: [map-dependency](/refs/map-dependency.md)');
    expect(first).toContain('# Citations');
    expect(first).toContain('[1] [session-1.md](session-1.md)');

    const parsed = readAllNodes(root).find(n => n.frontmatter.kk_id === 'practice-source')!;
    writeNodeFile({
      nodesDir: root,
      frontmatter: {
        ...parsed.frontmatter,
        kk_relates_to: [],
        kk_depends_on: ['map-target'],
        kk_derived_from: ['docs/source.md'],
      },
      body: parsed.body,
      relDir: parsed.relDir,
    });
    const second = readFileSync(sourcePath, 'utf8');
    expect(second).toContain('Hand prose.');
    expect(second).not.toContain('Related: [map-target]');
    expect(second).toContain('- Depends on: [map-target](/refs/map-target.md)');
    expect(second).toContain('[1] [docs/source.md](docs/source.md)');

    const reparsed = readAllNodes(root).find(n => n.frontmatter.kk_id === 'practice-source')!;
    writeNodeFile({
      nodesDir: root,
      frontmatter: reparsed.frontmatter,
      body: reparsed.body,
      relDir: reparsed.relDir,
    });
    expect(readFileSync(sourcePath, 'utf8')).toBe(second);
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
