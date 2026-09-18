import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

function nodesDir(sandbox: string): string {
  return join(sandbox, '.ai/kenkeep/nodes');
}

function writeLeaf(
  sandbox: string,
  relDir: string,
  id: string,
  opts: { tags?: string[]; body?: string; relates_to?: string[] } = {}
): void {
  const dir = relDir === '' ? nodesDir(sandbox) : join(nodesDir(sandbox), relDir);
  mkdirSync(dir, { recursive: true });
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    description: 's',
    tags: opts.tags ?? [],
    kk_derived_from: [],
    kk_relates_to: opts.relates_to ?? [],
    kk_confidence: 'high',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(opts.body ?? 'Body.', fm));
}

async function gitCommitAll(sandbox: string, msg: string): Promise<void> {
  await exec('git', ['add', '-A'], { cwd: sandbox });
  await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', msg], {
    cwd: sandbox,
  });
}

async function gitStatus(sandbox: string): Promise<string> {
  const { stdout } = await exec('git', ['status', '--porcelain'], { cwd: sandbox });
  return stdout;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

interface SweepSummary {
  relocated: Array<{ id: string; from: string; to: string; reason: string }>;
  deleted: Array<{ id: string; path: string; reason: string }>;
  skipped?: string;
}

async function sweep(sandbox: string): Promise<{ exitCode: number; summary: SweepSummary }> {
  const res = await runCli(sandbox, ['node', 'sweep']);
  // The index rebuild logs to stdout ahead of the summary; the JSON is the last line.
  const lines = res.stdout.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] ?? '';
  if (!last.startsWith('{')) {
    throw new Error(`node sweep printed no JSON summary (exit ${res.exitCode}): ${res.stderr}`);
  }
  return { exitCode: res.exitCode, summary: JSON.parse(last) as SweepSummary };
}

describe('node sweep (integration)', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox('ai-kk-node-sweep-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('relocates a loose leaf as a byte-stable rename, stages nothing, and no-ops on a second run', async () => {
    writeLeaf(sandbox, 'harnesses', 'practice-h1', { tags: ['harness', 'copilot'] });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness', 'copilot'] });
    writeLeaf(sandbox, 'hooks', 'practice-k1', { tags: ['hooks'] });
    writeLeaf(sandbox, 'hooks', 'practice-k2', { tags: ['hooks'] });
    // One edge into each folder ties the edge tally; the tags break it toward harnesses/.
    writeLeaf(sandbox, '', 'practice-loose', {
      tags: ['harness', 'copilot'],
      relates_to: ['practice-h1', 'practice-k1'],
    });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const before = sha256(join(nodesDir(sandbox), 'practice-loose.md'));
    const first = await sweep(sandbox);
    expect(first.exitCode).toBe(0);
    expect(first.summary.relocated).toEqual([
      {
        id: 'practice-loose',
        from: 'practice-loose.md',
        to: 'harnesses/practice-loose.md',
        reason: 'tags',
      },
    ]);
    expect(first.summary.deleted).toEqual([]);
    expect(first.summary.skipped).toBeUndefined();

    // Bytes survive the move, so the id is untouched and no redirect is recorded.
    const moved = join(nodesDir(sandbox), 'harnesses', 'practice-loose.md');
    expect(sha256(moved)).toBe(before);
    expect(existsSync(join(nodesDir(sandbox), 'practice-loose.md'))).toBe(false);
    expect(existsSync(join(nodesDir(sandbox), '.redirects.json'))).toBe(false);

    // The command writes files only: the index is untouched.
    const { stdout: staged } = await exec('git', ['diff', '--cached', '--name-only'], {
      cwd: sandbox,
    });
    expect(staged.trim()).toBe('');

    // The rebuild ran: the destination index lists the leaf it just gained.
    expect(readFileSync(join(nodesDir(sandbox), 'harnesses', 'index.md'), 'utf8')).toContain(
      'practice-loose'
    );

    // Rename detection needs both paths in the index, so stage before asking git.
    await exec('git', ['add', '-A'], { cwd: sandbox });
    const afterFirst = await gitStatus(sandbox);
    expect(afterFirst).toMatch(/^R.*practice-loose\.md/m);

    const second = await sweep(sandbox);
    expect(second.exitCode).toBe(0);
    expect(second.summary.relocated).toEqual([]);
    expect(second.summary.deleted).toEqual([]);
    expect(await gitStatus(sandbox)).toBe(afterFirst);
  });

  it('deletes a leaf that matches no folder, names it in the summary, and leaves it restorable', async () => {
    writeLeaf(sandbox, 'harnesses', 'practice-h1', { tags: ['harness'] });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-orphan', { tags: ['nowhere-else'] });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const orphan = join(nodesDir(sandbox), 'practice-orphan.md');
    const { exitCode, summary } = await sweep(sandbox);
    expect(exitCode).toBe(0);
    expect(existsSync(orphan)).toBe(false);
    expect(summary.relocated).toEqual([]);
    expect(summary.deleted).toHaveLength(1);
    expect(summary.deleted[0]!.id).toBe('practice-orphan');
    expect(summary.deleted[0]!.path).toBe('practice-orphan.md');
    expect(summary.deleted[0]!.reason).toContain('no tag overlap');

    // The deletion is a reviewable working-tree change, not a commit.
    await exec('git', ['restore', '--', '.ai/kenkeep/nodes/practice-orphan.md'], { cwd: sandbox });
    expect(existsSync(orphan)).toBe(true);
  });

  it('reports no-folders and writes nothing when the tree has nowhere to file into', async () => {
    writeLeaf(sandbox, '', 'practice-a', { tags: ['alpha'] });
    writeLeaf(sandbox, '', 'practice-b', { tags: ['beta'] });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const { exitCode, summary } = await sweep(sandbox);
    expect(exitCode).toBe(0);
    expect(summary).toEqual({ relocated: [], deleted: [], skipped: 'no-folders' });
    expect(existsSync(join(nodesDir(sandbox), 'practice-a.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'practice-b.md'))).toBe(true);
    // No write of any kind, including the index rebuild.
    expect(await gitStatus(sandbox)).toBe('');
  });
});
