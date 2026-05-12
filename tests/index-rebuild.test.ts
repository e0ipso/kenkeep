import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);

function writeNode(sandbox: string, kind: 'practice' | 'map', id: string): void {
  const dir = join(sandbox, '.ai/knowledge-base/nodes', kind);
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 1,
    id,
    title: id,
    kind,
    tags: [],
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: null,
    updated: '2026-01-01T00:00:00Z',
    supersedes: null,
    superseded_by: null,
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: 's',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify('# x\nBody.', fm));
}

describe('index rebuild', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('regenerates INDEX.md and GRAPH.md from the current nodes tree', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    writeNode(sandbox, 'map', 'map-bar');
    const before = readFileSync(join(sandbox, '.ai/knowledge-base/INDEX.md'), 'utf8');
    const result = await runCli(sandbox, ['index', 'rebuild']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Regenerated INDEX.md and GRAPH.md from 2 node(s)');
    const after = readFileSync(join(sandbox, '.ai/knowledge-base/INDEX.md'), 'utf8');
    expect(after).not.toBe(before);
    expect(after).toContain('practice-foo');
    expect(after).toContain('map-bar');
    const graph = readFileSync(join(sandbox, '.ai/knowledge-base/GRAPH.md'), 'utf8');
    expect(graph).toContain('## practice-foo');
    expect(graph).toContain('## map-bar');
  });

  it('errors when the repo is not initialized', async () => {
    const other = makeSandbox();
    try {
      await exec('git', ['init', '-q'], { cwd: other });
      const result = await runCli(other, ['index', 'rebuild']);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('not initialized');
    } finally {
      cleanSandbox(other);
    }
  });

  it('honors --budget-tokens for INDEX trimming', async () => {
    // Seed enough practice nodes that a tiny budget triggers a hidden footer.
    for (let i = 0; i < 12; i += 1) writeNode(sandbox, 'practice', `practice-${i}`);
    const result = await runCli(sandbox, ['index', 'rebuild', '--budget-tokens', '50']);
    expect(result.exitCode).toBe(0);
    const body = readFileSync(join(sandbox, '.ai/knowledge-base/INDEX.md'), 'utf8');
    expect(body).toContain('additional nodes hidden by token budget');
    // INDEX records the requested budget.
    const fm = matter(body).data as { budget_tokens?: number };
    expect(fm.budget_tokens).toBe(50);
  });

  it('writes a freshness-aligned INDEX (doctor reports fresh after rebuild)', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    // Run rebuild then doctor; INDEX should be reported fresh.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.stdout + doc.stderr).toContain('INDEX.md is fresh');
    expect((doc.stdout + doc.stderr).toLowerCase()).not.toContain('stale (nodes_hash');
  });

  it('--stage runs `git add` on INDEX.md and GRAPH.md after writing', async () => {
    // Baseline commit so the diff is meaningful.
    await exec('git', ['add', '.'], { cwd: sandbox });
    await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], {
      cwd: sandbox,
    });
    writeNode(sandbox, 'practice', 'practice-foo');
    const result = await runCli(sandbox, ['index', 'rebuild', '--stage']);
    expect(result.exitCode).toBe(0);
    const { stdout } = await exec('git', ['diff', '--cached', '--name-only'], { cwd: sandbox });
    const staged = stdout.trim().split('\n');
    expect(staged).toContain('.ai/knowledge-base/INDEX.md');
    expect(staged).toContain('.ai/knowledge-base/GRAPH.md');
  });

  it('--stage no-ops when nodes/ has not changed since the last index write', async () => {
    await exec('git', ['add', '.'], { cwd: sandbox });
    await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], {
      cwd: sandbox,
    });
    // Bring INDEX.md in sync with current (empty) nodes/ tree.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    await exec('git', ['add', '.'], { cwd: sandbox });
    await exec(
      'git',
      ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'baseline'],
      { cwd: sandbox }
    );
    // No node changes — --stage should short-circuit and nothing should be staged.
    const result = await runCli(sandbox, ['index', 'rebuild', '--stage']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('already match nodes/');
    const { stdout } = await exec('git', ['diff', '--cached', '--name-only'], { cwd: sandbox });
    expect(stdout.trim()).toBe('');
  });
});

describe('doctor: stale INDEX detection', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when nodes drift after INDEX was written', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    // Drift: add another node without rebuilding.
    writeNode(sandbox, 'map', 'map-bar');
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.exitCode).toBe(0); // warning, not error
    expect(doc.stdout + doc.stderr).toContain('stale');
  });
});

describe('doctor: missing INDEX', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when INDEX.md was deleted', async () => {
    const indexFile = join(sandbox, '.ai/knowledge-base/INDEX.md');
    if (existsSync(indexFile)) {
      writeFileSync(indexFile, '');
      // Make it truly invalid (empty -> no frontmatter).
    }
    // Replace with no frontmatter so the freshness check warns.
    writeFileSync(indexFile, '# KB Index\n');
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.stdout + doc.stderr).toContain('INDEX.md');
  });
});
