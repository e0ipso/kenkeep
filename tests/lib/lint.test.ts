import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runLint } from '../../src/lib/lint.js';
import type { NodeFrontmatter, NodeKind } from '../../src/lib/schemas.js';

interface Harness {
  root: string;
  nodesDir: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-lint-'));
  const nodesDir = join(root, '.ai/knowledge-base/nodes');
  mkdirSync(join(nodesDir, 'practice'), { recursive: true });
  mkdirSync(join(nodesDir, 'map'), { recursive: true });
  return { root, nodesDir };
}

function writeNode(
  harness: Harness,
  kind: NodeKind,
  filenameBase: string,
  overrides: Partial<NodeFrontmatter>
): string {
  const id = overrides.id ?? `${kind}-${filenameBase}`;
  const fm: NodeFrontmatter = {
    schema_version: 1,
    id,
    title: overrides.title ?? id,
    kind,
    tags: overrides.tags ?? [],
    derived_from: overrides.derived_from ?? [],
    relates_to: overrides.relates_to ?? [],
    confidence: overrides.confidence ?? 'high',
    summary: overrides.summary ?? 's',
  };
  const filePath = join(harness.nodesDir, kind, `${filenameBase}.md`);
  writeFileSync(filePath, matter.stringify(`# ${id}\nBody.`, fm));
  return filePath;
}

describe('runLint', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns no errors or findings for a clean linked-pair tree', () => {
    writeNode(harness, 'practice', 'practice-alpha', {
      id: 'practice-alpha',
      relates_to: ['practice-beta'],
    });
    writeNode(harness, 'practice', 'practice-beta', {
      id: 'practice-beta',
      relates_to: ['practice-alpha'],
    });
    expect(runLint({ nodesDir: harness.nodesDir })).toEqual({ errors: [], findings: [] });
  });

  it('reports exactly one entry per rule on a combined-failure tree', () => {
    // dangling-edge: references a node that does not exist.
    writeNode(harness, 'practice', 'practice-dangler', {
      id: 'practice-dangler',
      relates_to: ['practice-ghost'],
      tags: ['hooks'],
    });
    // partner of the dangler keeps it non-orphan and contributes the second
    // near-duplicate tag.
    writeNode(harness, 'practice', 'practice-partner', {
      id: 'practice-partner',
      relates_to: ['practice-dangler'],
      tags: ['hook'],
    });
    // slug-id-mismatch: id has uppercase, but filename matches the id so the
    // file is loadable. The rule fires because the slug is not canonical.
    writeNode(harness, 'practice', 'practice-NotASlug', {
      id: 'practice-NotASlug',
      relates_to: ['practice-dangler'],
    });
    // orphan: no incoming or outgoing edges.
    writeNode(harness, 'map', 'map-loner', { id: 'map-loner' });

    const result = runLint({ nodesDir: harness.nodesDir });

    expect(result.errors.map(e => e.rule).sort()).toEqual(['dangling-edge', 'slug-id-mismatch']);
    expect(result.findings.map(f => f.rule).sort()).toEqual(['orphan', 'tag-near-duplicate']);

    const dangling = result.errors.find(e => e.rule === 'dangling-edge')!;
    expect(dangling.file).toContain('practice-dangler.md');
    expect(dangling.message).toContain('practice-ghost');

    const mismatch = result.errors.find(e => e.rule === 'slug-id-mismatch')!;
    expect(mismatch.file).toContain('practice-NotASlug.md');

    const orphan = result.findings.find(f => f.rule === 'orphan')!;
    expect(orphan.file).toContain('map-loner.md');

    const dup = result.findings.find(f => f.rule === 'tag-near-duplicate')!;
    expect(dup.message).toContain('hook');
    expect(dup.message).toContain('hooks');
  });

  it('lints a 1000-node knowledge base within 200 ms', () => {
    for (let i = 0; i < 500; i += 1) {
      const a = `practice-perf-${i}-a`;
      const b = `practice-perf-${i}-b`;
      writeNode(harness, 'practice', a, { id: a, relates_to: [b] });
      writeNode(harness, 'practice', b, { id: b, relates_to: [a] });
    }
    const start = performance.now();
    const result = runLint({ nodesDir: harness.nodesDir });
    const elapsed = performance.now() - start;
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(elapsed).toBeLessThan(200);
  });
});
