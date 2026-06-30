import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PACK_KNOWLEDGE_DIRNAME,
  PACK_MANIFEST_FILENAME,
  validatePack,
} from '../../src/lib/pack.js';

function writeManifest(root: string, overrides: Record<string, unknown> = {}): void {
  const values = {
    name: 'drupal',
    version: '1.2.0',
    schema_version: 2,
    summary: 'Drupal project conventions.',
    homepage: 'https://example.com/drupal-pack',
    ...overrides,
  };
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${String(value)}`);
  writeFileSync(join(root, PACK_MANIFEST_FILENAME), lines.join('\n') + '\n');
}

function writeKnowledgeIndex(dir: string, summary = 'Drupal conventions.'): void {
  writeFileSync(
    join(dir, 'index.md'),
    [
      '---',
      'schema_version: 2',
      'nodes_hash: sha256:test',
      'node_count: 1',
      `summary: ${summary}`,
      '---',
      '# Index',
    ].join('\n')
  );
}

function writeNode(
  root: string,
  relDir: string,
  id: string,
  overrides: string[] = [],
  filename = `${id}.md`
): void {
  const dir = join(root, PACK_KNOWLEDGE_DIRNAME, relDir);
  mkdirSync(dir, { recursive: true });
  writeKnowledgeIndex(dir);
  const kind = id.startsWith('map-') ? 'map' : 'practice';
  const base = [
    '---',
    'schema_version: 2',
    `id: ${id}`,
    `title: ${id}`,
    `kind: ${kind}`,
    'tags: [drupal]',
    'derived_from: []',
    'relates_to: []',
    'depends_on: []',
    'confidence: high',
    `summary: Summary for ${id}.`,
  ];
  writeFileSync(join(dir, filename), [...base, ...overrides, '---', '', '# Body'].join('\n'));
}

function seedValidPack(root: string): void {
  writeManifest(root);
  const knowledge = join(root, PACK_KNOWLEDGE_DIRNAME);
  mkdirSync(knowledge, { recursive: true });
  writeKnowledgeIndex(knowledge);
  writeNode(root, 'framework', 'practice-drupal-services');
  writeNode(root, 'framework', 'map-drupal-hooks');
}

describe('validatePack', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-pack-'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('accepts a valid pack', () => {
    seedValidPack(root);

    const result = validatePack(root);

    expect(result.ok).toBe(true);
    expect(result.manifest?.name).toBe('drupal');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects a missing manifest', () => {
    mkdirSync(join(root, PACK_KNOWLEDGE_DIRNAME), { recursive: true });

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('missing required manifest');
  });

  it('rejects malformed manifest YAML', () => {
    writeFileSync(join(root, PACK_MANIFEST_FILENAME), 'name: [unterminated');

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('malformed YAML');
  });

  it('rejects a manifest schema_version mismatch with schema guidance', () => {
    writeManifest(root, { schema_version: 1 });

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('different schemas');
  });

  it('rejects an invalid manifest shape', () => {
    writeManifest(root, { name: 'Bad_Name' });

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('PackManifestSchema');
    expect(result.errors.join('\n')).toContain('name');
  });

  it('rejects a missing knowledge directory', () => {
    writeManifest(root);

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('missing required knowledge/ directory');
  });

  it('rejects invalid node frontmatter', () => {
    writeManifest(root);
    const knowledge = join(root, PACK_KNOWLEDGE_DIRNAME);
    mkdirSync(join(knowledge, 'bad'), { recursive: true });
    writeKnowledgeIndex(knowledge);
    writeKnowledgeIndex(join(knowledge, 'bad'));
    writeFileSync(
      join(knowledge, 'bad', 'practice-missing-summary.md'),
      [
        '---',
        'schema_version: 2',
        'id: practice-missing-summary',
        'title: Missing summary',
        'kind: practice',
        'tags: []',
        'derived_from: []',
        'relates_to: []',
        'confidence: high',
        '---',
        '# Body',
      ].join('\n')
    );

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('invalid node frontmatter');
    expect(result.errors.join('\n')).toContain('summary');
  });

  it('rejects naming violations', () => {
    seedValidPack(root);
    writeNode(root, 'bad', 'practice-not-canonical', [], 'practice-different.md');

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('filename practice-different.md');
  });

  it('rejects duplicate ids within the pack', () => {
    seedValidPack(root);
    writeNode(root, 'other', 'practice-drupal-services');

    const result = validatePack(root);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('duplicate node id practice-drupal-services');
  });
});
