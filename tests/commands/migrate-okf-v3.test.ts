import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFolderSummaries } from '../../src/lib/folder-summaries.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

function nodesDir(root: string): string {
  return join(root, '.ai/kenkeep/nodes');
}

function writeV2Node(
  root: string,
  relDir: string,
  kind: 'practice' | 'map',
  id: string,
  overrides: Record<string, unknown> = {}
): void {
  const dir = join(nodesDir(root), relDir);
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 2,
    id,
    title: id,
    kind,
    summary: `summary for ${id}`,
    tags: ['legacy'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    ...overrides,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n\nBody prose.\n`, fm));
}

function writeV2Index(root: string, relDir: string, summary: string): void {
  const dir = relDir === '' ? nodesDir(root) : join(nodesDir(root), relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.md'),
    matter.stringify('# Legacy index\n', {
      schema_version: 2,
      nodes_hash: 'sha256:legacy',
      node_count: 1,
      summary,
    })
  );
}

describe('migrate okf-v3', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox('kk-okf-v3-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    rmSync(nodesDir(sandbox), { recursive: true, force: true });
    mkdirSync(nodesDir(sandbox), { recursive: true });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('mechanically rewrites v2 leaves to v3, migrates summaries, and rebuilds OKF indexes', async () => {
    writeV2Node(sandbox, 'workflow', 'map', 'map-target');
    writeV2Node(sandbox, 'workflow', 'practice', 'practice-source', {
      derived_from: ['session-1.md'],
      relates_to: ['map-target'],
      depends_on: ['map-target'],
    });
    writeV2Index(sandbox, '', 'root legacy summary');
    writeV2Index(sandbox, 'workflow', 'workflow legacy summary');

    const status = await runCli(sandbox, ['migrate', 'status']);
    expect(JSON.parse(status.stdout.trim()).steps).toEqual([
      { id: 'okf-v3', from: 2, to: 3, primitives: ['migrate okf-v3'] },
    ]);

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim());
    expect(summary.converted).toBe(2);

    const sourcePath = join(nodesDir(sandbox), 'workflow', 'practice-source.md');
    const parsed = matter(readFileSync(sourcePath, 'utf8'));
    expect(parsed.data).toMatchObject({
      kk_schema_version: 3,
      kk_id: 'practice-source',
      type: 'practice',
      description: 'summary for practice-source',
      kk_derived_from: ['session-1.md'],
      kk_relates_to: ['map-target'],
      kk_depends_on: ['map-target'],
      kk_confidence: 'high',
    });
    expect(parsed.data.schema_version).toBeUndefined();
    expect(parsed.data.kind).toBeUndefined();
    expect(parsed.data.summary).toBeUndefined();
    expect(parsed.content).toContain('Body prose.');
    expect(parsed.content).toContain('- Related: [map-target](/workflow/map-target.md)');
    expect(parsed.content).toContain('- Depends on: [map-target](/workflow/map-target.md)');
    expect(parsed.content).toContain('[1] [session-1.md](session-1.md)');

    const summaries = readFolderSummaries(nodesDir(sandbox));
    expect(summaries.get('')).toBe('root legacy summary');
    expect(summaries.get('workflow')).toBe('workflow legacy summary');

    expect(matter(readFileSync(join(nodesDir(sandbox), 'index.md'), 'utf8')).data).toEqual({
      okf_version: '0.1',
    });
    expect(
      matter(readFileSync(join(nodesDir(sandbox), 'workflow', 'index.md'), 'utf8')).data
    ).toEqual({});
    expect(existsSync(join(sandbox, '.ai/kenkeep/ENTRY.md'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/kenkeep/GRAPH.md'))).toBe(true);
  });
});
