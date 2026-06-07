import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { FOLDER_OCCUPANCY_MAX } from '../../src/lib/rebalance.js';

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
    schema_version: 2,
    id,
    title: id,
    kind: 'practice',
    tags: opts.tags ?? [],
    derived_from: [],
    relates_to: opts.relates_to ?? [],
    confidence: 'high',
    summary: 's',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(opts.body ?? 'Body.', fm));
}

async function gitCommitAll(sandbox: string, msg: string): Promise<void> {
  await exec('git', ['add', '-A'], { cwd: sandbox });
  await exec('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', msg], {
    cwd: sandbox,
  });
}

async function triggerActions(sandbox: string): Promise<Array<{ branch: string; operation: string }>> {
  const res = await runCli(sandbox, ['rebalance', 'trigger']);
  expect(res.exitCode).toBe(0);
  return JSON.parse(res.stdout.trim()).actions;
}

async function move(sandbox: string, plan: unknown): Promise<{ moves: Array<Record<string, unknown>> }> {
  const planPath = join(sandbox, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
  expect(res.exitCode).toBe(0);
  // The structural-summary JSON is the last stdout line.
  const lines = res.stdout.trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

describe('rebalance trigger and move (integration)', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox('ai-kk-rebalance-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('skips when the tree is balanced (trigger reports no action)', async () => {
    // A healthy folder sitting inside the hysteresis band.
    for (let i = 0; i < 4; i += 1) writeLeaf(sandbox, 'topic', `practice-b${i}`, { relates_to: ['practice-b0'] });
    await runCli(sandbox, ['index', 'rebuild']);
    expect(await triggerActions(sandbox)).toEqual([]);
  });

  it('split-folder relocates as byte-stable renames keeping ids, and regenerates indexes', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 2; i += 1) {
      const id = `practice-leaf-${i}`;
      ids.push(id);
      writeLeaf(sandbox, 'over-full', id);
    }
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    // Capture pre-move bytes of a sample moved leaf.
    const sampleBefore = readFileSync(join(nodesDir(sandbox), 'over-full', 'practice-leaf-1.md'));

    const actions = await triggerActions(sandbox);
    expect(actions).toContainEqual({ branch: 'over-full', operation: 'split-folder' });

    const half = Math.ceil(ids.length / 2);
    const plan = {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [
            { subfolder: 'sub-a', ids: ids.slice(0, half) },
            { subfolder: 'sub-b', ids: ids.slice(half) },
          ],
        },
      ],
    };
    const summary = await move(sandbox, plan);
    expect(summary.moves.length).toBe(ids.length);

    // Bytes are identical post-move (rename, not rewrite); id preserved.
    const sampleAfter = readFileSync(join(nodesDir(sandbox), 'over-full', 'sub-a', 'practice-leaf-1.md'));
    expect(sampleAfter.equals(sampleBefore)).toBe(true);
    expect(matter(sampleAfter.toString()).data.id).toBe('practice-leaf-1');

    // git records renames (R entries), no content delta on moved leaves.
    await exec('git', ['add', '-A'], { cwd: sandbox });
    const { stdout: summaryOut } = await exec('git', ['diff', '--cached', '-M', '--summary'], { cwd: sandbox });
    expect(summaryOut).toMatch(/rename .*practice-leaf-1\.md \(100%\)/);

    // Affected index nodes regenerated.
    expect(existsSync(join(nodesDir(sandbox), 'over-full', 'sub-a', 'index.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'over-full', 'sub-b', 'index.md'))).toBe(true);
  });

  it('split-leaf becomes a folder of an index plus 2+ docs, mints new ids, records a redirect', async () => {
    writeLeaf(sandbox, 'bloat', 'practice-bloated', { tags: ['a', 'b', 'c'], body: 'Big body.' });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const plan = {
      operations: [
        {
          operation: 'split-leaf',
          leafId: 'practice-bloated',
          folder: 'bloat/practice-bloated',
          children: [
            { title: 'concept one', summary: 'first', body: 'First.', tags: ['a'], relates_to: [] },
            { title: 'concept two', summary: 'second', body: 'Second.', tags: ['b'], relates_to: [] },
          ],
        },
      ],
    };
    const summary = await move(sandbox, plan);
    const splitMove = summary.moves[0] as { newIds: string[]; redirectFrom: string };
    expect(splitMove.redirectFrom).toBe('practice-bloated');
    expect(splitMove.newIds.length).toBeGreaterThanOrEqual(2);

    // Old leaf gone; new folder has an index node plus 2+ docs.
    expect(existsSync(join(nodesDir(sandbox), 'bloat', 'practice-bloated.md'))).toBe(false);
    const folderDir = join(nodesDir(sandbox), 'bloat', 'practice-bloated');
    const docs = readdirSync(folderDir).filter(f => f.endsWith('.md') && f !== 'index.md');
    expect(docs.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(folderDir, 'index.md'))).toBe(true);

    // Redirect recorded from the old id.
    const ledger = JSON.parse(readFileSync(join(nodesDir(sandbox), '.redirects.json'), 'utf8'));
    expect(ledger['practice-bloated']).toEqual(splitMove.newIds);
  });

  it('post-move rebuild is byte-stable (a second rebuild is a no-op)', async () => {
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 2; i += 1) writeLeaf(sandbox, 'over-full', `practice-leaf-${i}`);
    await runCli(sandbox, ['index', 'rebuild']);
    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [{ subfolder: 'sub-a', ids: ['practice-leaf-1', 'practice-leaf-2'] }],
        },
      ],
    });
    const snapshot = (): string =>
      readdirRec(nodesDir(sandbox))
        .filter(f => f.endsWith('index.md'))
        .sort()
        .map(f => `${f}\n${readFileSync(f, 'utf8')}`)
        .join('\n');
    const before = snapshot();
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    expect(snapshot()).toBe(before);
  });

  it('no-thrash: the second rebalance pass on a borderline fixture is a structural no-op', async () => {
    // Borderline: a folder one leaf over the high-water mark. After a split into
    // two balanced subfolders, the second trigger pass trips nothing.
    const ids: string[] = [];
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 1; i += 1) {
      const id = `practice-leaf-${i}`;
      ids.push(id);
      writeLeaf(sandbox, 'over-full', id);
    }
    await runCli(sandbox, ['index', 'rebuild']);

    const first = await triggerActions(sandbox);
    expect(first).toContainEqual({ branch: 'over-full', operation: 'split-folder' });

    const half = Math.ceil(ids.length / 2);
    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [
            { subfolder: 'sub-a', ids: ids.slice(0, half) },
            { subfolder: 'sub-b', ids: ids.slice(half) },
          ],
        },
      ],
    });

    // Second pass: each subfolder sits in the hysteresis band, parent now empty
    // of direct leaves. No split-folder re-fires on the (now balanced) tree.
    const second = await triggerActions(sandbox);
    expect(second.some(a => a.operation === 'split-folder')).toBe(false);
  });

  it('leaves the working tree dirty: the primitives never commit', async () => {
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 2; i += 1) writeLeaf(sandbox, 'over-full', `practice-leaf-${i}`);
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [{ subfolder: 'sub-a', ids: ['practice-leaf-1', 'practice-leaf-2'] }],
        },
      ],
    });
    // Working tree is dirty; nothing was staged or committed by the primitive.
    const { stdout: status } = await exec('git', ['status', '--porcelain'], { cwd: sandbox });
    expect(status.trim().length).toBeGreaterThan(0);
    const { stdout: staged } = await exec('git', ['diff', '--cached', '--name-only'], { cwd: sandbox });
    expect(staged.trim()).toBe('');
  });

  it('rejects an out-of-tree target and makes no move', async () => {
    writeLeaf(sandbox, 'home', 'practice-x');
    await runCli(sandbox, ['index', 'rebuild']);
    const planPath = join(sandbox, 'bad.json');
    writeFileSync(
      planPath,
      JSON.stringify({ operations: [{ operation: 'create-branch', folder: '../escape', ids: ['practice-x'] }] })
    );
    const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr + res.stdout).toContain('escapes nodes/');
    // The leaf did not move.
    expect(existsSync(join(nodesDir(sandbox), 'home', 'practice-x.md'))).toBe(true);
  });
});

function readdirRec(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readdirRec(full));
    else out.push(full);
  }
  return out;
}
