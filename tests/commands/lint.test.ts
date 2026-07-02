import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import type { NodeFrontmatter, NodeKind } from '../../src/lib/schemas.js';

const exec = promisify(execFile);

// Leaves are placed directly under nodes/ (which already carries the generated
// index.md from init), so no missing-folder-index lint error fires; the tests
// target the slug/edge/tag/orphan rules. Filename always matches the id.
function writeNode(
  sandbox: string,
  kind: NodeKind,
  filenameBase: string,
  overrides: Partial<NodeFrontmatter>
): void {
  const id = overrides.kk_id ?? `${kind}-${filenameBase}`;
  const fm: NodeFrontmatter = {
    kk_schema_version: 3,
    kk_id: id,
    title: overrides.title ?? id,
    type: kind,
    description: overrides.description ?? 's',
    tags: overrides.tags ?? [],
    kk_derived_from: overrides.kk_derived_from ?? [],
    kk_relates_to: overrides.kk_relates_to ?? [],
    kk_depends_on: overrides.kk_depends_on ?? [],
    kk_confidence: overrides.kk_confidence ?? 'high',
  };
  const dir = join(sandbox, '.ai/kenkeep/nodes');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\nBody.`, fm));
}

function writeNestedNode(
  sandbox: string,
  relDir: string,
  kind: NodeKind,
  id: string,
  overrides: Partial<NodeFrontmatter> = {}
): void {
  const fm: NodeFrontmatter = {
    kk_schema_version: 3,
    kk_id: id,
    title: overrides.title ?? id,
    type: kind,
    description: overrides.description ?? 's',
    tags: overrides.tags ?? [],
    kk_derived_from: overrides.kk_derived_from ?? [],
    kk_relates_to: overrides.kk_relates_to ?? [],
    kk_depends_on: overrides.kk_depends_on ?? [],
    kk_confidence: overrides.kk_confidence ?? 'high',
  };
  const dir = join(sandbox, '.ai/kenkeep/nodes', relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\nBody.`, fm));
}

describe('lint command', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });

  afterEach(() => cleanSandbox(sandbox));

  it('exits 0 with no findings on an empty nodes directory', async () => {
    const result = await runCli(sandbox, ['lint']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Clean. No findings.');
  });

  it('ignores stale dotfile-only legacy compatibility node folders', async () => {
    const nodesDir = join(sandbox, '.ai/kenkeep/nodes');
    mkdirSync(join(nodesDir, 'map'), { recursive: true });
    mkdirSync(join(nodesDir, 'practice'), { recursive: true });
    writeFileSync(join(nodesDir, 'map', '.gitkeep'), '');
    writeFileSync(join(nodesDir, 'practice', '.gitkeep'), '');

    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).not.toContain('missing-folder-index');
    expect(combined).not.toContain('nodes/map');
    expect(combined).not.toContain('nodes/practice');
  });

  it('still reports a non-empty node folder that lacks index.md', async () => {
    writeNestedNode(sandbox, 'topic', 'practice', 'practice-topic');

    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('missing-folder-index');
    expect(combined).toContain('folder topic has no index.md');
  });

  it('reports a leaf missing the required OKF type field', async () => {
    const dir = join(sandbox, '.ai/kenkeep/nodes/topic');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'practice-missing-type.md'),
      [
        '---',
        'kk_schema_version: 3',
        'kk_id: practice-missing-type',
        'title: Missing type',
        'description: s',
        'tags: []',
        'kk_derived_from: []',
        'kk_relates_to: []',
        'kk_depends_on: []',
        'kk_confidence: high',
        '---',
        '',
        'Body.',
      ].join('\n')
    );

    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('okf-conformance');
    expect(combined).toContain('missing a non-empty type');
  });

  it('reports frontmatter on a non-root reserved index.md', async () => {
    writeNestedNode(sandbox, 'topic', 'practice', 'practice-topic');
    writeFileSync(
      join(sandbox, '.ai/kenkeep/nodes/topic/index.md'),
      matter.stringify('# Topic\n', { schema_version: 3 })
    );

    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('okf-conformance');
    expect(combined).toContain('reserved index.md files below the bundle root');
  });

  it('exits 1 and names the offending file when --verbose finds a dangling edge', async () => {
    writeNode(sandbox, 'practice', 'practice-source', {
      kk_id: 'practice-source',
      kk_relates_to: ['practice-ghost'],
    });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      kk_id: 'practice-anchor',
      kk_relates_to: ['practice-source'],
    });
    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('dangling-edge');
    expect(combined).toContain('practice-source.md');
    expect(combined).toContain('practice-ghost');
  });

  it('exits 0 and reports tag-near-duplicate and orphan findings under --verbose', async () => {
    writeNode(sandbox, 'practice', 'practice-one', {
      kk_id: 'practice-one',
      kk_relates_to: ['practice-two'],
      tags: ['hooks'],
    });
    writeNode(sandbox, 'practice', 'practice-two', {
      kk_id: 'practice-two',
      kk_relates_to: ['practice-one'],
      tags: ['hook'],
    });
    writeNode(sandbox, 'map', 'map-loner', { kk_id: 'map-loner' });
    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('tag-near-duplicate');
    expect(combined).toContain('hook');
    expect(combined).toContain('orphan');
    expect(combined).toContain('map-loner.md');
  });

  it('exits 1 on a slug-id-mismatch error and names the offending file under --verbose', async () => {
    // id is not a canonical slug (uppercase); the filename matches the id so
    // the file still loads, but the slug-id-mismatch rule must fire as an error.
    writeNode(sandbox, 'practice', 'practice-NotASlug', {
      kk_id: 'practice-NotASlug',
      kk_relates_to: ['practice-anchor'],
    });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      kk_id: 'practice-anchor',
      kk_relates_to: ['practice-NotASlug'],
    });
    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('slug-id-mismatch');
    expect(combined).toContain('practice-NotASlug.md');
  });

  it('treats a dangling depends_on edge as an error, like relates_to', async () => {
    writeNode(sandbox, 'practice', 'practice-src', {
      kk_id: 'practice-src',
      kk_depends_on: ['practice-ghost'],
    });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      kk_id: 'practice-anchor',
      kk_relates_to: ['practice-src'],
    });
    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('dangling-edge');
    expect(combined).toContain('practice-ghost');
  });

  it('resolves an edge to a retired id via the redirects ledger as a finding, not a dangling error', async () => {
    writeNode(sandbox, 'practice', 'practice-new', { kk_id: 'practice-new' });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      kk_id: 'practice-anchor',
      kk_relates_to: ['practice-retired'],
    });
    // The retired id is gone from disk but the ledger maps it to the live id.
    writeFileSync(
      join(sandbox, '.ai/kenkeep/nodes/.redirects.json'),
      `${JSON.stringify({ 'practice-retired': ['practice-new'] }, null, 2)}\n`
    );

    const result = await runCli(sandbox, ['lint', '--verbose']);
    // A redirected edge is fixable guidance, not a hard error: exit stays 0.
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('redirected-edge');
    expect(combined).toContain('practice-new');
    // No hard dangling error fired for the retired id (the summary still prints
    // a `dangling-edge: 0` count line, so assert on the error message itself).
    expect(combined).not.toContain('references unknown node practice-retired');
  });
});
