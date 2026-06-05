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
  const id = overrides.id ?? `${kind}-${filenameBase}`;
  const fm: NodeFrontmatter = {
    schema_version: 2,
    id,
    title: overrides.title ?? id,
    kind,
    tags: overrides.tags ?? [],
    derived_from: overrides.derived_from ?? [],
    relates_to: overrides.relates_to ?? [],
    confidence: overrides.confidence ?? 'high',
    summary: overrides.summary ?? 's',
  };
  const dir = join(sandbox, '.ai/kenkeep/nodes');
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

  it('exits 1 and names the offending file when --verbose finds a dangling edge', async () => {
    writeNode(sandbox, 'practice', 'practice-source', {
      id: 'practice-source',
      relates_to: ['practice-ghost'],
    });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      id: 'practice-anchor',
      relates_to: ['practice-source'],
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
      id: 'practice-one',
      relates_to: ['practice-two'],
      tags: ['hooks'],
    });
    writeNode(sandbox, 'practice', 'practice-two', {
      id: 'practice-two',
      relates_to: ['practice-one'],
      tags: ['hook'],
    });
    writeNode(sandbox, 'map', 'map-loner', { id: 'map-loner' });
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
      id: 'practice-NotASlug',
      relates_to: ['practice-anchor'],
    });
    writeNode(sandbox, 'practice', 'practice-anchor', {
      id: 'practice-anchor',
      relates_to: ['practice-NotASlug'],
    });
    const result = await runCli(sandbox, ['lint', '--verbose']);
    expect(result.exitCode).toBe(1);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('slug-id-mismatch');
    expect(combined).toContain('practice-NotASlug.md');
  });
});
