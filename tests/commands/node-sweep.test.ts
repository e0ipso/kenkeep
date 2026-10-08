import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { writeNodeFile } from '../../src/lib/nodes.js';
import { writeRedirectsLedger } from '../../src/lib/redirects.js';
import { unresolvedHrefs } from '../helpers/rendered-links.js';

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
  deleted: Array<{ id: string; path: string; reason: string; restore: string }>;
  kept: Array<{ id: string; path: string; reason: string; referenced_by: string[] }>;
  skipped?: string;
}

async function sweep(sandbox: string): Promise<{ exitCode: number; summary: SweepSummary }> {
  const res = await runCli(sandbox, ['node', 'sweep']);
  // Machine-output contract: the COMPLETE stdout is the one JSON summary.
  const summary = JSON.parse(res.stdout) as SweepSummary;
  // A sweep that moved or deleted anything runs the index rebuild, whose
  // status line goes to stderr so it cannot corrupt the summary.
  if (summary.relocated.length > 0 || summary.deleted.length > 0) {
    expect(res.stderr).toContain('Regenerated');
  }
  return { exitCode: res.exitCode, summary };
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
    expect(first.summary.kept).toEqual([]);
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

  it('deletes a tracked, unreferenced leaf that matches no folder and names its git restore', async () => {
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
    expect(summary.kept).toEqual([]);
    expect(summary.deleted).toHaveLength(1);
    expect(summary.deleted[0]!.id).toBe('practice-orphan');
    expect(summary.deleted[0]!.path).toBe('practice-orphan.md');
    expect(summary.deleted[0]!.reason).toContain('no tag overlap');
    expect(summary.deleted[0]!.restore).toBe('git restore -- .ai/kenkeep/nodes/practice-orphan.md');

    // The deletion is a reviewable working-tree change, and the reported
    // command is the one that brings it back.
    const [cmd, ...args] = summary.deleted[0]!.restore.split(' ');
    expect(cmd).toBe('git');
    await exec('git', args, { cwd: sandbox });
    expect(existsSync(orphan)).toBe(true);
  });

  // A root leaf other nodes link to (directly or through a ledger redirect)
  // is never removed, so no edge dangles; an untracked or edited leaf is never
  // removed, because git cannot bring it back. Both stay at the root. A filed
  // leaf gets its own links refreshed, and so do the leaves linking to it.
  it('keeps referenced and unrestorable leaves at the root and refreshes the links of a filed one', async () => {
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs/x.md'), '# x\n');
    const fm = (id: string, tags: string[], extra: Record<string, string[]> = {}) => ({
      kk_schema_version: 3 as const,
      kk_id: id,
      title: id,
      type: 'practice' as const,
      description: 's',
      tags,
      kk_derived_from: extra.derived_from ?? [],
      kk_relates_to: extra.relates_to ?? [],
      kk_depends_on: [],
      kk_confidence: 'high' as const,
    });
    const nd = nodesDir(sandbox);
    const referrer = writeNodeFile({
      nodesDir: nd,
      frontmatter: fm('practice-h1', ['harness'], {
        relates_to: ['practice-referenced', 'practice-old', 'practice-filed'],
      }),
      body: 'H1',
      relDir: 'harnesses',
    });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness'] });
    writeLeaf(sandbox, 'hooks', 'practice-k1', { tags: ['hooks'] });
    // No own placement signal (no edges, no tag overlap), but referenced.
    writeLeaf(sandbox, '', 'practice-referenced', { tags: ['nowhere-else'] });
    writeLeaf(sandbox, '', 'practice-live', { tags: ['nowhere-else'] });
    writeRedirectsLedger(nd, { 'practice-old': ['practice-live'] });
    // Placed by its tags; its citation and the referrer's link both move.
    writeNodeFile({
      nodesDir: nd,
      frontmatter: fm('practice-filed', ['harness'], { derived_from: ['docs/x.md'] }),
      body: 'F',
      relDir: '',
    });
    writeLeaf(sandbox, '', 'practice-edited', { tags: ['nowhere-else'] });
    expect(readFileSync(referrer, 'utf8')).toContain('(../practice-filed.md)');
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    // A leaf git never saw, and a tracked one with unstaged edits.
    writeLeaf(sandbox, '', 'practice-novel', { tags: ['nowhere-else'], body: 'Novel.' });
    writeLeaf(sandbox, '', 'practice-edited', { tags: ['nowhere-else'], body: 'Edited.' });
    const novelBytes = sha256(join(nd, 'practice-novel.md'));

    const { exitCode, summary } = await sweep(sandbox);
    expect(exitCode).toBe(0);
    expect(summary.deleted).toEqual([]);
    expect(summary.relocated).toEqual([
      {
        id: 'practice-filed',
        from: 'practice-filed.md',
        to: 'harnesses/practice-filed.md',
        reason: 'tags',
      },
    ]);
    expect(summary.kept.map(k => [k.id, k.referenced_by])).toEqual([
      ['practice-edited', []],
      ['practice-live', ['practice-h1']],
      ['practice-novel', []],
      ['practice-referenced', ['practice-h1']],
    ]);
    expect(summary.kept[0]!.reason).toContain('git cannot restore');
    expect(summary.kept[1]!.reason).toContain('other nodes reference it');
    expect(sha256(join(nd, 'practice-novel.md'))).toBe(novelBytes);
    expect(existsSync(join(nd, 'practice-referenced.md'))).toBe(true);
    expect(existsSync(join(nd, 'practice-live.md'))).toBe(true);

    const filed = join(nd, 'harnesses/practice-filed.md');
    expect(readFileSync(referrer, 'utf8')).toContain(
      '- Related: [practice-filed](practice-filed.md)'
    );
    expect(readFileSync(filed, 'utf8')).toContain('[1] [docs/x.md](../../../../docs/x.md)');
    expect(unresolvedHrefs(referrer)).toEqual([]);
    expect(unresolvedHrefs(filed)).toEqual([]);
    const lint = await runCli(sandbox, ['lint', '--verbose']);
    expect(lint.stdout + lint.stderr).toMatch(/^dangling-edge: 0$/m);
    expect(lint.stdout + lint.stderr).toContain('stale-rendered-link: 0');
    expect(lint.exitCode).toBe(0);
  });

  it('reports no-folders and writes nothing when the tree has nowhere to file into', async () => {
    writeLeaf(sandbox, '', 'practice-a', { tags: ['alpha'] });
    writeLeaf(sandbox, '', 'practice-b', { tags: ['beta'] });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const { exitCode, summary } = await sweep(sandbox);
    expect(exitCode).toBe(0);
    expect(summary).toEqual({
      relocated: [],
      deleted: [],
      kept: [],
      skipped: 'no-folders',
    });
    expect(existsSync(join(nodesDir(sandbox), 'practice-a.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'practice-b.md'))).toBe(true);
    // No write of any kind, including the index rebuild.
    expect(await gitStatus(sandbox)).toBe('');
  });
  // `assume-unchanged` and `skip-worktree` hide an edit from `git diff`, and
  // `git restore` skips a skip-worktree path, so neither edited leaf may go. A
  // staged edit may: `git restore` writes back the index copy, which equals
  // the working copy. The sweep changes no index flag and stages nothing.
  it('deletes only a leaf whose working bytes equal what git restore writes back', async () => {
    writeLeaf(sandbox, 'harnesses', 'practice-h1', { tags: ['harness'] });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness'] });
    for (const id of ['practice-assumed', 'practice-skipped', 'practice-staged']) {
      writeLeaf(sandbox, '', id, { tags: ['nowhere-else'] });
    }
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    const nd = nodesDir(sandbox);
    const gitPath = (id: string): string => `.ai/kenkeep/nodes/${id}.md`;
    const git = (...args: string[]) => exec('git', args, { cwd: sandbox });
    await git('update-index', '--assume-unchanged', '--', gitPath('practice-assumed'));
    await git('update-index', '--skip-worktree', '--', gitPath('practice-skipped'));
    for (const id of ['practice-assumed', 'practice-skipped', 'practice-staged']) {
      writeLeaf(sandbox, '', id, { tags: ['nowhere-else'], body: 'Uncommitted fact.' });
    }
    await git('add', '--', gitPath('practice-staged'));
    const bytes = (id: string): string => sha256(join(nd, `${id}.md`));
    const assumed = bytes('practice-assumed');
    const skipped = bytes('practice-skipped');
    const staged = bytes('practice-staged');

    const { exitCode, summary } = await sweep(sandbox);
    expect(exitCode).toBe(0);
    expect(summary.kept.map(k => k.id)).toEqual(['practice-assumed', 'practice-skipped']);
    for (const k of summary.kept) expect(k.reason).toContain('git cannot restore');
    expect(bytes('practice-assumed')).toBe(assumed);
    expect(bytes('practice-skipped')).toBe(skipped);
    expect(summary.deleted.map(d => d.id)).toEqual(['practice-staged']);
    expect(existsSync(join(nd, 'practice-staged.md'))).toBe(false);

    const { stdout: flags } = await git(
      'ls-files',
      '-v',
      '--',
      gitPath('practice-assumed'),
      gitPath('practice-skipped')
    );
    expect(flags.trim().split('\n')).toEqual([
      `h ${gitPath('practice-assumed')}`,
      `S ${gitPath('practice-skipped')}`,
    ]);
    const { stdout: stagedNames } = await git('diff', '--cached', '--name-only');
    expect(stagedNames.trim()).toBe(gitPath('practice-staged'));

    const [, ...args] = summary.deleted[0]!.restore.split(' ');
    await git(...args);
    expect(bytes('practice-staged')).toBe(staged);
  });

  it('refuses a malformed AGENTS.md block before moving or deleting any leaf', async () => {
    writeLeaf(sandbox, 'harnesses', 'practice-h1', { tags: ['harness'] });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-loose', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-orphan', { tags: ['nowhere-else'] });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    writeFileSync(
      join(sandbox, 'AGENTS.md'),
      '# Instructions\n<!-- >>> kenkeep:kk-index >>> -->\n'
    );
    const before = await gitStatus(sandbox);

    const res = await runCli(sandbox, ['node', 'sweep']);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('kenkeep-managed block is malformed');
    expect(existsSync(join(nodesDir(sandbox), 'practice-loose.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'practice-orphan.md'))).toBe(true);
    expect(await gitStatus(sandbox)).toBe(before);
  });

  it('refuses a symlinked root leaf before any other leaf moves', async () => {
    writeLeaf(sandbox, 'harnesses', 'practice-h1', { tags: ['harness'] });
    writeLeaf(sandbox, 'harnesses', 'practice-h2', { tags: ['harness'] });
    // Sorted after practice-loose, so a per-leaf check would come too late.
    writeLeaf(sandbox, '', 'practice-loose', { tags: ['harness'] });
    writeLeaf(sandbox, '', 'practice-zlinked', { tags: ['harness'] });
    const link = join(nodesDir(sandbox), 'practice-zlinked.md');
    const outside = join(sandbox, 'outside.md');
    writeFileSync(outside, readFileSync(link));
    rmSync(link);
    symlinkSync(outside, link);
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    const res = await runCli(sandbox, ['node', 'sweep']);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('crosses the symlink');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'practice-loose.md'))).toBe(true);
    expect(await gitStatus(sandbox)).toBe('');
  });
});
