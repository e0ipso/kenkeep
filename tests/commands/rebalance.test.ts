import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from '../helpers.js';
import { FOLDER_OCCUPANCY_MAX } from '../../src/lib/rebalance.js';
import { readFolderSummaries } from '../../src/lib/folder-summaries.js';
import { writeNodeFile } from '../../src/lib/nodes.js';
import { unresolvedHrefs } from '../helpers/rendered-links.js';

const exec = promisify(execFile);

function nodesDir(sandbox: string): string {
  return join(sandbox, '.ai/kenkeep/nodes');
}

function writeLeaf(
  sandbox: string,
  relDir: string,
  id: string,
  opts: {
    tags?: string[];
    body?: string;
    relates_to?: string[];
    depends_on?: string[];
    derived_from?: string[];
  } = {}
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
    kk_derived_from: opts.derived_from ?? [],
    kk_relates_to: opts.relates_to ?? [],
    kk_depends_on: opts.depends_on ?? [],
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

async function triggerActions(
  sandbox: string
): Promise<Array<{ branch: string; operation: string }>> {
  const res = await runCli(sandbox, ['rebalance', 'trigger']);
  expect(res.exitCode).toBe(0);
  return JSON.parse(res.stdout).actions;
}

async function move(
  sandbox: string,
  plan: unknown
): Promise<{ moves: Array<Record<string, unknown>> }> {
  const planPath = join(sandbox, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan));
  const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
  expect(res.exitCode).toBe(0);
  // Machine-output contract: the COMPLETE stdout is the structural-summary
  // JSON; the nested index rebuild reports on stderr.
  expect(res.stderr).toContain('Regenerated');
  return JSON.parse(res.stdout);
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
    for (let i = 0; i < 4; i += 1)
      writeLeaf(sandbox, 'topic', `practice-b${i}`, { relates_to: ['practice-b0'] });
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
            {
              subfolder: 'sub-a',
              summary: 'the first cluster of split leaves',
              ids: ids.slice(0, half),
            },
            {
              subfolder: 'sub-b',
              summary: 'the second cluster of split leaves',
              ids: ids.slice(half),
            },
          ],
        },
      ],
    };
    const summary = await move(sandbox, plan);
    expect(summary.moves.length).toBe(ids.length);

    // Bytes are identical post-move (rename, not rewrite); id preserved.
    const sampleAfter = readFileSync(
      join(nodesDir(sandbox), 'over-full', 'sub-a', 'practice-leaf-1.md')
    );
    expect(sampleAfter.equals(sampleBefore)).toBe(true);
    expect(matter(sampleAfter.toString()).data.kk_id).toBe('practice-leaf-1');

    // git records renames (R entries), no content delta on moved leaves.
    await exec('git', ['add', '-A'], { cwd: sandbox });
    const { stdout: summaryOut } = await exec('git', ['diff', '--cached', '-M', '--summary'], {
      cwd: sandbox,
    });
    expect(summaryOut).toMatch(/rename .*practice-leaf-1\.md \(100%\)/);

    // Affected index nodes regenerated.
    expect(existsSync(join(nodesDir(sandbox), 'over-full', 'sub-a', 'index.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'over-full', 'sub-b', 'index.md'))).toBe(true);

    // Success Criterion 5: each new subfolder's authored summary landed in the
    // folder-summary sidecar, and the move wrapper's rebuild self-preserved it.
    const summaries = readFolderSummaries(nodesDir(sandbox));
    expect(summaries.get('over-full/sub-a')).toBe('the first cluster of split leaves');
    expect(summaries.get('over-full/sub-b')).toBe('the second cluster of split leaves');
  });

  it('split-leaf becomes a folder of new leaves with a redirect, kept provenance and reported unassigned edges', async () => {
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs/a.md'), '# Source documentation\n');
    writeLeaf(sandbox, 'home', 'practice-x');
    writeLeaf(sandbox, 'home', 'practice-y');
    writeLeaf(sandbox, 'home', 'practice-big', {
      tags: ['a', 'b', 'c'],
      derived_from: ['docs/a.md'],
      depends_on: ['practice-x'],
      relates_to: ['practice-y'],
    });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    const summary = await move(sandbox, {
      operations: [
        {
          operation: 'split-leaf',
          leafId: 'practice-big',
          folder: 'home/practice-big',
          summary: 'the two halves',
          children: [
            {
              title: 'first half',
              summary: 'first',
              body: 'First.',
              depends_on: ['practice-x'],
              relates_to: ['practice-second-half'],
            },
            { title: 'second half', summary: 'second', body: 'Second.' },
          ],
        },
      ],
    });
    expect(summary.moves).toEqual([
      {
        operation: 'split-leaf',
        redirectFrom: 'practice-big',
        newIds: ['practice-first-half', 'practice-second-half'],
        from: 'home/practice-big.md',
        to: 'home/practice-big',
        unassignedEdges: { relates_to: ['practice-y'], depends_on: [] },
      },
    ]);
    const folder = join(nodesDir(sandbox), 'home', 'practice-big');
    expect(existsSync(join(nodesDir(sandbox), 'home', 'practice-big.md'))).toBe(false);
    expect(existsSync(join(folder, 'index.md'))).toBe(true);
    // The authored new-folder summary persisted through the rebuild.
    expect(readFolderSummaries(nodesDir(sandbox)).get('home/practice-big')).toBe('the two halves');

    const first = matter(readFileSync(join(folder, 'practice-first-half.md'), 'utf8'));
    const second = matter(readFileSync(join(folder, 'practice-second-half.md'), 'utf8'));
    // Factual provenance survives; the retired id is never cited.
    expect(first.data.kk_derived_from).toEqual(['docs/a.md']);
    expect(second.data.kk_derived_from).toEqual(['docs/a.md']);
    expect(first.data.kk_depends_on).toEqual(['practice-x']);
    expect(second.data.kk_depends_on).toEqual([]);
    expect(first.data.kk_relates_to).toEqual(['practice-second-half']);
    for (const child of [first, second]) {
      expect(JSON.stringify(child.data)).not.toContain('practice-big"');
    }
    // The sibling link renders the sibling's minted path, not a root fallback.
    expect(first.content).toContain('](practice-second-half.md)');
    expect(first.content).not.toContain('../../practice-second-half.md');
    const ledger = JSON.parse(readFileSync(join(nodesDir(sandbox), '.redirects.json'), 'utf8'));
    expect(ledger['practice-big']).toEqual(['practice-first-half', 'practice-second-half']);
    const stubBin = writeHarnessBinaryStubs(sandbox);
    const doctor = await runCli(sandbox, ['doctor', '--verbose'], {
      PATH: `${stubBin}:${process.env['PATH'] ?? ''}`,
    });
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout + doctor.stderr).toContain('derived_from references resolve: no dangling');
  });

  it('applies a multi-operation plan against the live tree (no stale snapshot)', async () => {
    // Two leaves in a sparse folder that a LATER op in the same plan relocates.
    writeLeaf(sandbox, 'sparse', 'practice-a1');
    writeLeaf(sandbox, 'sparse', 'practice-a2');
    writeLeaf(sandbox, '', 'practice-keep');
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');

    // op1 merges sparse/ into the root; op2 then pulls one of those just-moved
    // leaves into a brand-new branch. op2 resolves only if op1's relocation is
    // visible — a single up-front snapshot would carry the stale sparse/ path
    // and throw "source leaf not found", failing the whole move.
    const plan = {
      operations: [
        { operation: 'merge', branch: 'sparse', into: '' },
        {
          operation: 'create-branch',
          folder: 'regrouped',
          summary: 'leaves regrouped out of the merged sparse folder',
          ids: ['practice-a1'],
        },
      ],
    };
    const summary = await move(sandbox, plan);

    expect(summary.moves.some(m => m.operation === 'merge' && m.id === 'practice-a2')).toBe(true);
    expect(summary.moves.some(m => m.operation === 'create-branch' && m.id === 'practice-a1')).toBe(
      true
    );

    // Final placement: a1 in the new branch, a2 at the root, sparse/ removed.
    expect(existsSync(join(nodesDir(sandbox), 'regrouped', 'practice-a1.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'practice-a2.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'sparse'))).toBe(false);
    // The new branch's authored summary persisted into the sidecar.
    expect(readFolderSummaries(nodesDir(sandbox)).get('regrouped')).toBe(
      'leaves regrouped out of the merged sparse folder'
    );
  });

  it('post-move rebuild is byte-stable (a second rebuild is a no-op)', async () => {
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 2; i += 1)
      writeLeaf(sandbox, 'over-full', `practice-leaf-${i}`);
    await runCli(sandbox, ['index', 'rebuild']);
    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [
            {
              subfolder: 'sub-a',
              summary: 'a split cluster',
              ids: ['practice-leaf-1', 'practice-leaf-2'],
            },
          ],
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
            { subfolder: 'sub-a', summary: 'first balanced cluster', ids: ids.slice(0, half) },
            { subfolder: 'sub-b', summary: 'second balanced cluster', ids: ids.slice(half) },
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
    for (let i = 1; i <= FOLDER_OCCUPANCY_MAX + 2; i += 1)
      writeLeaf(sandbox, 'over-full', `practice-leaf-${i}`);
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'over-full',
          groups: [
            {
              subfolder: 'sub-a',
              summary: 'a split cluster',
              ids: ['practice-leaf-1', 'practice-leaf-2'],
            },
          ],
        },
      ],
    });
    // Working tree is dirty; nothing was staged or committed by the primitive.
    const { stdout: status } = await exec('git', ['status', '--porcelain'], { cwd: sandbox });
    expect(status.trim().length).toBeGreaterThan(0);
    const { stdout: staged } = await exec('git', ['diff', '--cached', '--name-only'], {
      cwd: sandbox,
    });
    expect(staged.trim()).toBe('');
  });

  it('on an I/O failure after earlier writes, reports the moves that landed', async () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) return; // root ignores modes
    writeLeaf(sandbox, '', 'practice-a');
    writeLeaf(sandbox, '', 'practice-b');
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    // Inject the failure: the second op's destination is a read-only directory.
    const locked = join(nodesDir(sandbox), 'locked');
    mkdirSync(locked);
    chmodSync(locked, 0o555);
    const planPath = join(sandbox, 'io-fail.json');
    writeFileSync(
      planPath,
      JSON.stringify({
        operations: [
          {
            operation: 'create-branch',
            folder: 'new-a',
            summary: 'a new home',
            ids: ['practice-a'],
          },
          {
            operation: 'create-branch',
            folder: 'locked',
            summary: 'unwritable',
            ids: ['practice-b'],
          },
        ],
      })
    );
    try {
      const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
      expect(res.exitCode).not.toBe(0);
      // The complete stdout is one JSON document describing the partial state.
      const report = JSON.parse(res.stdout) as {
        error: string;
        moves: Array<Record<string, unknown>>;
      };
      expect(report.error).toMatch(/EACCES|permission denied/i);
      expect(report.moves).toEqual([
        {
          operation: 'create-branch',
          id: 'practice-a',
          from: 'practice-a.md',
          to: 'new-a/practice-a.md',
        },
      ]);
      expect(res.stderr).toContain('index rebuild');
      // The listed moves are the real partial state on disk.
      expect(existsSync(join(nodesDir(sandbox), 'new-a', 'practice-a.md'))).toBe(true);
      expect(existsSync(join(nodesDir(sandbox), 'practice-a.md'))).toBe(false);
      expect(existsSync(join(nodesDir(sandbox), 'practice-b.md'))).toBe(true);
    } finally {
      chmodSync(locked, 0o755);
    }
  });

  it('refreshes the rendered links of moved leaves and their linkers, and nothing else', async () => {
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs/x.md'), '# x\n');
    const fm = (id: string, extra: Record<string, string[]> = {}) => ({
      kk_schema_version: 3 as const,
      kk_id: id,
      title: id,
      type: 'practice' as const,
      description: 's',
      tags: [],
      kk_derived_from: extra.derived_from ?? [],
      kk_relates_to: extra.relates_to ?? [],
      kk_depends_on: [],
      kk_confidence: 'high' as const,
    });
    const nd = nodesDir(sandbox);
    writeNodeFile({
      nodesDir: nd,
      frontmatter: fm('practice-target', { derived_from: ['docs/x.md'] }),
      body: 'T',
      relDir: 'b',
    });
    writeNodeFile({ nodesDir: nd, frontmatter: fm('practice-stay'), body: 'S', relDir: 'b' });
    const reader = writeNodeFile({
      nodesDir: nd,
      frontmatter: fm('practice-reader', { relates_to: ['practice-target'] }),
      body: 'R',
      relDir: 'a',
    });
    // A hand-staled leaf unrelated to the move: the boundary must not rewrite it.
    const bystander = writeNodeFile({
      nodesDir: nd,
      frontmatter: fm('practice-bystander', { derived_from: ['docs/x.md'] }),
      body: 'B',
      relDir: 'a',
    });
    writeFileSync(
      bystander,
      readFileSync(bystander, 'utf8').replace('../../../../docs/x.md', 'docs/x.md')
    );
    const bystanderBytes = readFileSync(bystander, 'utf8');
    await runCli(sandbox, ['index', 'rebuild']);

    await move(sandbox, {
      operations: [
        {
          operation: 'split-folder',
          branch: 'b',
          groups: [{ subfolder: 'sub', summary: 'Sub.', ids: ['practice-target'] }],
        },
      ],
    });

    const moved = join(nd, 'b/sub/practice-target.md');
    expect(readFileSync(reader, 'utf8')).toContain(
      '- Related: [practice-target](../b/sub/practice-target.md)'
    );
    expect(readFileSync(moved, 'utf8')).toContain('[1] [docs/x.md](../../../../../docs/x.md)');
    expect(unresolvedHrefs(reader)).toEqual([]);
    expect(unresolvedHrefs(moved)).toEqual([]);
    expect(readFileSync(bystander, 'utf8')).toBe(bystanderBytes);
    const lint = await runCli(sandbox, ['lint', '--verbose']);
    expect(lint.stdout + lint.stderr).toContain('stale-rendered-link: 1');
    expect(lint.stdout + lint.stderr).toContain('practice-bystander.md');
  });

  // A referrer keeps its edge to the retired id (lint: redirected-edge);
  // its rendered link must follow the ledger to the successors, not point at
  // the vacated path. A link left at the vacated path is a lint finding.
  it('split-leaf resolves a referrer link to the retired id through the ledger; lint flags a stale one', async () => {
    writeLeaf(sandbox, 'home', 'practice-big', { tags: ['a', 'b', 'c'] });
    // The referrer carries a generated Related section (the writer renders it).
    const referrer = writeNodeFile({
      nodesDir: nodesDir(sandbox),
      frontmatter: {
        kk_schema_version: 3,
        kk_id: 'practice-y',
        title: 'practice-y',
        type: 'practice',
        description: 's',
        tags: [],
        kk_derived_from: [],
        kk_relates_to: ['practice-big'],
        kk_depends_on: [],
        kk_confidence: 'high',
      },
      body: 'Y.',
      relDir: 'home',
    });
    await runCli(sandbox, ['index', 'rebuild']);
    await gitCommitAll(sandbox, 'baseline');
    expect(readFileSync(referrer, 'utf8')).toContain('](practice-big.md)');

    await move(sandbox, {
      operations: [
        {
          operation: 'split-leaf',
          leafId: 'practice-big',
          folder: 'home/practice-big',
          summary: 'the two halves',
          children: [
            { title: 'first half', summary: 'first', body: 'First.' },
            { title: 'second half', summary: 'second', body: 'Second.' },
          ],
        },
      ],
    });

    const refreshed = readFileSync(referrer, 'utf8');
    expect(refreshed).toContain(
      '- Related: [practice-big → practice-first-half](practice-big/practice-first-half.md)'
    );
    expect(refreshed).toContain(
      '- Related: [practice-big → practice-second-half](practice-big/practice-second-half.md)'
    );
    expect(refreshed).not.toContain('../practice-big.md');
    expect(matter(refreshed).data.kk_relates_to).toEqual(['practice-big']);
    expect(unresolvedHrefs(referrer)).toEqual([]);
    const clean = await runCli(sandbox, ['lint', '--verbose']);
    expect(clean.exitCode).toBe(0);
    expect(clean.stdout + clean.stderr).toContain('stale-rendered-link: 0');
    expect(clean.stdout + clean.stderr).toContain('dangling-edge: 0');
    expect(clean.stdout + clean.stderr).toContain(
      `redirected-edge ${referrer}: edge to retired node practice-big`
    );

    // The pre-fix rendering: a link to the retired leaf's vacated path.
    writeFileSync(
      referrer,
      refreshed
        .replace(
          '- Related: [practice-big → practice-first-half](practice-big/practice-first-half.md)\n',
          ''
        )
        .replace(
          '- Related: [practice-big → practice-second-half](practice-big/practice-second-half.md)',
          '- Related: [practice-big](../practice-big.md)'
        )
    );
    expect(unresolvedHrefs(referrer)).toEqual(['../practice-big.md']);
    const stale = await runCli(sandbox, ['lint', '--verbose']);
    expect(stale.stdout + stale.stderr).toContain('stale-rendered-link: 1');
    expect(stale.stdout + stale.stderr).toContain('practice-y.md');
  });

  it('rejects an out-of-tree target and makes no move', async () => {
    writeLeaf(sandbox, 'home', 'practice-x');
    await runCli(sandbox, ['index', 'rebuild']);
    const planPath = join(sandbox, 'bad.json');
    writeFileSync(
      planPath,
      JSON.stringify({
        operations: [
          {
            operation: 'create-branch',
            folder: '../escape',
            summary: 'should be rejected',
            ids: ['practice-x'],
          },
        ],
      })
    );
    const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr + res.stdout).toContain('escapes nodes/');
    // The leaf did not move.
    expect(existsSync(join(nodesDir(sandbox), 'home', 'practice-x.md'))).toBe(true);
  });
  it('refuses a malformed AGENTS.md block before moving any leaf', async () => {
    writeLeaf(sandbox, 'home', 'practice-x');
    await runCli(sandbox, ['index', 'rebuild']);
    writeFileSync(
      join(sandbox, 'AGENTS.md'),
      '# Instructions\n<!-- >>> kenkeep:kk-index >>> -->\n'
    );
    const source = join(nodesDir(sandbox), 'home', 'practice-x.md');
    const sourceBytes = readFileSync(source, 'utf8');
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(
      planPath,
      JSON.stringify({
        operations: [
          { operation: 'create-branch', folder: 'new', summary: 'New', ids: ['practice-x'] },
        ],
      })
    );

    const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('kenkeep-managed block is malformed');
    expect(readFileSync(source, 'utf8')).toBe(sourceBytes);
    expect(existsSync(join(nodesDir(sandbox), 'new'))).toBe(false);
  });

  it('refuses a symlinked source leaf before any leaf of the plan moves', async () => {
    writeLeaf(sandbox, 'home', 'practice-a');
    writeLeaf(sandbox, 'home', 'practice-linked');
    const link = join(nodesDir(sandbox), 'home', 'practice-linked.md');
    const outside = join(sandbox, 'outside.md');
    writeFileSync(outside, readFileSync(link));
    rmSync(link);
    symlinkSync(outside, link);
    await runCli(sandbox, ['index', 'rebuild']);
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(
      planPath,
      JSON.stringify({
        operations: [
          { operation: 'create-branch', folder: 'new', summary: 'New', ids: ['practice-a'] },
          {
            operation: 'create-branch',
            folder: 'other',
            summary: 'Other',
            ids: ['practice-linked'],
          },
        ],
      })
    );

    const res = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('crosses the symlink');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'home', 'practice-a.md'))).toBe(true);
    expect(existsSync(join(nodesDir(sandbox), 'new'))).toBe(false);
    expect(existsSync(join(nodesDir(sandbox), 'other'))).toBe(false);
  });

  describe('a planned folder that is a leaf file', () => {
    function treeBytes(): Record<string, string> {
      return Object.fromEntries(
        readdirRec(join(sandbox, '.ai/kenkeep')).map(file => [file, readFileSync(file, 'utf8')])
      );
    }
    async function runPlan(operations: unknown[]): Promise<{ exitCode: number; stderr: string }> {
      const planPath = join(sandbox, 'plan.json');
      writeFileSync(planPath, JSON.stringify({ operations }));
      return runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    }
    beforeEach(async () => {
      for (const id of ['practice-first', 'practice-second', 'practice-anchor']) {
        writeLeaf(sandbox, 'home', id);
      }
      await runCli(sandbox, ['index', 'rebuild']);
    });

    it('refuses a folder beneath an existing leaf before any leaf moves', async () => {
      const before = treeBytes();
      const res = await runPlan([
        { operation: 'create-branch', folder: 'new', summary: 'New', ids: ['practice-first'] },
        {
          operation: 'create-branch',
          folder: 'home/practice-anchor.md',
          summary: 'Under a leaf',
          ids: ['practice-second'],
        },
      ]);
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('needs folder home/practice-anchor.md, which is a file');
      expect(treeBytes()).toEqual(before);
    });

    it('refuses a split-leaf whose folder is the leaf it retires', async () => {
      const before = treeBytes();
      const res = await runPlan([
        {
          operation: 'split-leaf',
          leafId: 'practice-anchor',
          folder: 'home/practice-anchor.md',
          summary: 'halves',
          children: [
            { title: 'first half', summary: 'first', body: 'First.' },
            { title: 'second half', summary: 'second', body: 'Second.' },
          ],
        },
      ]);
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('which is a file');
      expect(treeBytes()).toEqual(before);
    });

    it('refuses a leaf destination that an earlier operation made a folder', async () => {
      const before = treeBytes();
      const res = await runPlan([
        {
          operation: 'create-branch',
          folder: 'new/practice-anchor.md',
          summary: 'Odd name',
          ids: ['practice-first'],
        },
        { operation: 'create-branch', folder: 'new', summary: 'New', ids: ['practice-anchor'] },
      ]);
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toContain('is a folder the plan places leaves in');
      expect(treeBytes()).toEqual(before);
    });

    it('reuses the path of a leaf an earlier operation moved away as a folder', async () => {
      await move(sandbox, {
        operations: [
          { operation: 'create-branch', folder: 'kept', summary: 'Kept', ids: ['practice-anchor'] },
          {
            operation: 'create-branch',
            folder: 'home/practice-anchor.md',
            summary: 'Reused path',
            ids: ['practice-second'],
          },
        ],
      });
      const home = join(nodesDir(sandbox), 'home');
      expect(existsSync(join(nodesDir(sandbox), 'kept', 'practice-anchor.md'))).toBe(true);
      expect(existsSync(join(home, 'practice-anchor.md', 'practice-second.md'))).toBe(true);
    });
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
