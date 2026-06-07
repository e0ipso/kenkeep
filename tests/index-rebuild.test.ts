import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);

// Leaves live in topical folders, not kind buckets. Each leaf gets its own
// topical folder (named after its id) under nodes/.
function writeNode(sandbox: string, kind: 'practice' | 'map', id: string): void {
  const dir = join(sandbox, '.ai/kenkeep/nodes', id);
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 2,
    id,
    title: id,
    kind,
    tags: [],
    derived_from: [],
    relates_to: [],
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
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('regenerates ENTRY.md and GRAPH.md from the current nodes tree', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    writeNode(sandbox, 'map', 'map-bar');
    const before = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    const result = await runCli(sandbox, ['index', 'rebuild']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('index.md file(s) and GRAPH.md from 2 node(s)');
    const after = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(after).not.toBe(before);
    expect(after).toContain('practice-foo');
    expect(after).toContain('map-bar');
    const graph = readFileSync(join(sandbox, '.ai/kenkeep/GRAPH.md'), 'utf8');
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

  it('renders every valid node title in the catalog (no eviction)', async () => {
    const titles: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const id = `practice-${i}`;
      titles.push(id);
      writeNode(sandbox, 'practice', id);
    }
    const result = await runCli(sandbox, ['index', 'rebuild']);
    expect(result.exitCode).toBe(0);
    const body = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(body).not.toContain('additional nodes hidden by token budget');
    for (const title of titles) expect(body).toContain(title);
  });

  it('writes a freshness-aligned ENTRY (doctor reports fresh after rebuild)', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    // Run rebuild then doctor; ENTRY should be reported fresh.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.stdout + doc.stderr).toContain('ENTRY.md is fresh');
    expect((doc.stdout + doc.stderr).toLowerCase()).not.toContain('stale (nodes_hash');
  });

  it('--stage runs `git add` on ENTRY.md and GRAPH.md after writing', async () => {
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
    expect(staged).toContain('.ai/kenkeep/ENTRY.md');
    expect(staged).toContain('.ai/kenkeep/GRAPH.md');
    // Per-folder index nodes are staged too: the leaf's topical folder and the
    // nodes/ root both carry an index.md.
    expect(staged).toContain('.ai/kenkeep/nodes/index.md');
    expect(staged).toContain('.ai/kenkeep/nodes/practice-foo/index.md');
  });

  it('refuses to rebuild when a node has invalid frontmatter', async () => {
    const dir = join(sandbox, '.ai/kenkeep/nodes/topic');
    mkdirSync(dir, { recursive: true });
    const badPath = join(dir, 'practice-missing-summary.md');
    // Missing required `summary` triggers schema validation failure.
    writeFileSync(
      badPath,
      [
        '---',
        'schema_version: 2',
        'id: practice-missing-summary',
        'title: "missing summary"',
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
    const indexPath = join(sandbox, '.ai/kenkeep/ENTRY.md');
    const before = readFileSync(indexPath, 'utf8');

    const result = await runCli(sandbox, ['index', 'rebuild']);

    expect(result.exitCode).not.toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('practice-missing-summary.md');
    expect(combined).toContain('summary');
    // ENTRY.md must not be overwritten to an empty (0-node) state.
    expect(readFileSync(indexPath, 'utf8')).toBe(before);
  });

  it('--stage no-ops when nodes/ has not changed since the last index write', async () => {
    await exec('git', ['add', '.'], { cwd: sandbox });
    await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init'], {
      cwd: sandbox,
    });
    // Bring ENTRY.md in sync with current (empty) nodes/ tree. The shipped
    // template artifacts are byte-identical to generator output, so this is a
    // no-op diff; --allow-empty keeps the baseline commit regardless.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    await exec('git', ['add', '.'], { cwd: sandbox });
    await exec(
      'git',
      [
        '-c',
        'user.email=t@t',
        '-c',
        'user.name=t',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'baseline',
      ],
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

describe('doctor: stale ENTRY detection', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when nodes drift after ENTRY was written', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    // Drift: add another node without rebuilding.
    writeNode(sandbox, 'map', 'map-bar');
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.exitCode).toBe(0); // warning, not error
    expect(doc.stdout + doc.stderr).toContain('stale');
  });
});

describe('doctor: missing ENTRY', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when ENTRY.md was deleted', async () => {
    const indexFile = join(sandbox, '.ai/kenkeep/ENTRY.md');
    if (existsSync(indexFile)) {
      writeFileSync(indexFile, '');
      // Make it truly invalid (empty -> no frontmatter).
    }
    // Replace with no frontmatter so the freshness check warns.
    writeFileSync(indexFile, '# kenkeep\n');
    const doc = await runCli(sandbox, ['doctor']);
    expect(doc.stdout + doc.stderr).toContain('ENTRY.md');
  });
});
