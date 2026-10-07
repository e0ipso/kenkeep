import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFolderSummaries, setFolderSummary } from '../src/lib/folder-summaries.js';
import { writeNodeFile } from '../src/lib/nodes.js';
import { cleanSandbox, makeSandbox, runCli, writeHarnessBinaryStubs } from './helpers.js';

const exec = promisify(execFile);

// Leaves live in topical folders, not kind buckets. Each leaf gets its own
// topical folder (named after its id) under nodes/.
function writeNode(sandbox: string, kind: 'practice' | 'map', id: string): void {
  writeNodeIn(sandbox, id, kind, id);
}

/** Writes a leaf into an explicit topical folder (POSIX relDir) under nodes/. */
function writeNodeIn(sandbox: string, relDir: string, kind: 'practice' | 'map', id: string): void {
  const dir = join(sandbox, '.ai/kenkeep/nodes', ...relDir.split('/'));
  mkdirSync(dir, { recursive: true });
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: kind,
    description: 's',
    tags: [],
    kk_derived_from: [],
    kk_relates_to: [],
    kk_confidence: 'high',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify('# x\nBody.', fm));
}

async function commitAll(sandbox: string, message = 'baseline'): Promise<void> {
  await exec('git', ['add', '-A'], { cwd: sandbox });
  await exec(
    'git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', message],
    { cwd: sandbox }
  );
}

/** `git diff --cached --name-status` as a path -> status-letter map. */
async function stagedStatus(sandbox: string): Promise<Map<string, string>> {
  const { stdout } = await exec('git', ['diff', '--cached', '--name-status'], { cwd: sandbox });
  const out = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const [status, file] = line.split('\t');
    out.set(file!, status!);
  }
  return out;
}

/**
 * Every owned generated artifact as sandbox-relative POSIX path -> bytes:
 * ENTRY.md, GRAPH.md, FOLDER_SUMMARIES.md (when present) and every
 * nodes/**\/index.md.
 */
function readOwnedFiles(sandbox: string): Map<string, string> {
  const kkDir = join(sandbox, '.ai/kenkeep');
  const out = new Map<string, string>();
  for (const name of ['ENTRY.md', 'GRAPH.md', 'FOLDER_SUMMARIES.md']) {
    const file = join(kkDir, name);
    if (existsSync(file)) out.set(`.ai/kenkeep/${name}`, readFileSync(file, 'utf8'));
  }
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.md') {
        out.set(relative(sandbox, full).split('\\').join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  walk(join(kkDir, 'nodes'));
  return out;
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

  it('warns naming folders that lack a summary (name fallback) and still exits zero', async () => {
    // writeNode places each leaf in its own topical folder with no summary, so
    // every such folder falls back to the Title-cased name. Warn, never block.
    writeNode(sandbox, 'practice', 'practice-foo');
    const result = await runCli(sandbox, ['index', 'rebuild']);
    expect(result.exitCode).toBe(0); // warn, never block
    const out = result.stdout + result.stderr;
    expect(out).toMatch(/folder\(s\) have no summary/);
    expect(out).toContain('practice-foo'); // the offending folder is named
    // The parent (root catalog) renders the Title-cased name fallback pointer.
    const entry = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(entry).toContain('for more information on Practice Foo.');
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

  it('--stage stages nothing new when every owned artifact already matches the commit', async () => {
    await commitAll(sandbox, 'init');
    // Bring the owned set in sync with the current (empty) nodes/ tree and
    // commit it; --allow-empty keeps the baseline commit regardless.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    await commitAll(sandbox);
    // No node changes: the regenerated owned set is byte-identical to HEAD, so
    // `git add` of the whole set stages no diff.
    const result = await runCli(sandbox, ['index', 'rebuild', '--stage']);
    expect(result.exitCode).toBe(0);
    const { stdout } = await exec('git', ['diff', '--cached', '--name-only'], { cwd: sandbox });
    expect(stdout.trim()).toBe('');
  });

  // The AGENTS.md pointer write is the rebuild's last step. A malformed
  // block is a known refusal, so it is checked before the first owned file is
  // written or removed; otherwise the catalogs land and the run still fails.
  it('refuses a malformed AGENTS.md pointer block before touching any owned file', async () => {
    writeNode(sandbox, 'practice', 'practice-a');
    await runCli(sandbox, ['index', 'rebuild']);
    // Changes the next rebuild would reconcile: a new leaf, a stale index.
    writeNode(sandbox, 'practice', 'practice-b');
    const stale = join(sandbox, '.ai/kenkeep/nodes/leafless');
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, 'index.md'), '# stale\n');
    const agents = join(sandbox, 'AGENTS.md');
    writeFileSync(agents, '# repo\n\n<!-- >>> kenkeep:kk-index >>> -->\n');
    const before = readOwnedFiles(sandbox);

    const res = await runCli(sandbox, ['index', 'rebuild']);

    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toContain('malformed');
    expect(readOwnedFiles(sandbox)).toEqual(before);
    expect(readFileSync(agents, 'utf8')).toBe('# repo\n\n<!-- >>> kenkeep:kk-index >>> -->\n');
  });
});

/**
 * The rebuild reconciles every owned generated artifact against the
 * actual leaf tree, instead of only (re)writing the folders that currently
 * hold leaves. A branch whose last leaf moved away keeps no stale index.md and
 * no stale sidecar summary, the root stops listing it, and lint flags any
 * stale owned index left behind by hand.
 */
describe('index rebuild reconciles the owned output set', () => {
  let sandbox: string;
  let nodesDir: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    nodesDir = join(sandbox, '.ai/kenkeep/nodes');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('removes the stale index.md and sidecar summary of a branch whose last leaf moved out', async () => {
    writeNodeIn(sandbox, 'old', 'practice', 'practice-foo');
    writeNodeIn(sandbox, 'kept', 'map', 'map-bar');
    setFolderSummary(nodesDir, 'old', 'Old things.');
    setFolderSummary(nodesDir, 'kept', 'Kept things.');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    expect(existsSync(join(nodesDir, 'old', 'index.md'))).toBe(true);
    expect(readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8')).toContain(
      'nodes/old/index.md'
    );
    await commitAll(sandbox);

    // Move the last leaf out of old/ and rebuild with --stage so the deletion
    // of the stale owned artifacts lands in the index too.
    renameSync(join(nodesDir, 'old', 'practice-foo.md'), join(nodesDir, 'kept', 'practice-foo.md'));
    const result = await runCli(sandbox, ['index', 'rebuild', '--stage']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('old');

    // The stale owned index is gone (and the emptied folder with it); the root
    // catalog and root index no longer point at the branch.
    expect(existsSync(join(nodesDir, 'old', 'index.md'))).toBe(false);
    expect(existsSync(join(nodesDir, 'old'))).toBe(false);
    const entry = readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8');
    expect(entry).not.toContain('nodes/old/index.md');
    expect(entry).toContain('nodes/kept/index.md');
    expect(readFileSync(join(nodesDir, 'index.md'), 'utf8')).not.toContain('old/index.md');
    // Sidecar rule: an entry lives as long as its folder is owned. The pruned
    // entry is gone; the human-authored summary of the surviving folder is
    // preserved verbatim and still rendered.
    expect([...readFolderSummaries(nodesDir)]).toEqual([['kept', 'Kept things.']]);
    expect(entry).toContain('for more information on Kept things.');
    // Deletions and sidecar changes are staged; the moved leaf itself is not
    // an owned artifact and is left for the user to stage.
    const staged = await stagedStatus(sandbox);
    expect(staged.get('.ai/kenkeep/nodes/old/index.md')).toBe('D');
    expect(staged.get('.ai/kenkeep/FOLDER_SUMMARIES.md')).toBe('M');
    expect(staged.get('.ai/kenkeep/ENTRY.md')).toBe('M');
    expect(staged.has('.ai/kenkeep/nodes/kept/practice-foo.md')).toBe(false);
    // The reconciled tree lints clean.
    const lint = await runCli(sandbox, ['lint', '--verbose']);
    expect(lint.exitCode).toBe(0);
    expect(lint.stdout + lint.stderr).not.toContain('stale-folder-index');
    expect(lint.stdout + lint.stderr).not.toContain('missing-folder-index');
  });

  it('lint flags a stale owned index.md left by hand in a leafless folder; rebuild removes it', async () => {
    writeNodeIn(sandbox, 'topic', 'practice', 'practice-foo');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    mkdirSync(join(nodesDir, 'ghost'), { recursive: true });
    writeFileSync(join(nodesDir, 'ghost', 'index.md'), '# Ghost\n\nStale by hand.\n');

    const lint = await runCli(sandbox, ['lint', '--verbose']);
    expect(lint.exitCode).toBe(1);
    const combined = lint.stdout + lint.stderr;
    expect(combined).toContain('stale-folder-index');
    expect(combined).toContain('ghost');

    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    expect(existsSync(join(nodesDir, 'ghost', 'index.md'))).toBe(false);
    expect((await runCli(sandbox, ['lint', '--verbose'])).exitCode).toBe(0);
  });

  it('never rewrites a leaf, even one with stale rendered links, and repeats byte-stably', async () => {
    const fm = (id: string, relates: string[]) => ({
      kk_schema_version: 3 as const,
      kk_id: id,
      title: id,
      type: 'practice' as const,
      description: 's',
      tags: [],
      kk_derived_from: ['docs/x.md'],
      kk_relates_to: relates,
      kk_depends_on: [],
      kk_confidence: 'high' as const,
    });
    writeNodeFile({ nodesDir, frontmatter: fm('practice-t', []), body: 'T', relDir: 'c' });
    const reader = writeNodeFile({
      nodesDir,
      frontmatter: fm('practice-r', ['practice-t']),
      body: 'R',
      relDir: 'a/b',
    });
    // Move the target by hand: the reader's rendered link is now stale.
    mkdirSync(join(nodesDir, 'd'), { recursive: true });
    renameSync(join(nodesDir, 'c', 'practice-t.md'), join(nodesDir, 'd', 'practice-t.md'));
    const leafBytes = (): Map<string, string> =>
      new Map(
        ['a/b/practice-r.md', 'd/practice-t.md'].map(rel => [
          rel,
          readFileSync(join(nodesDir, rel), 'utf8'),
        ])
      );
    const before = leafBytes();

    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    const first = readOwnedFiles(sandbox);
    expect(leafBytes()).toEqual(before);
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    expect(readOwnedFiles(sandbox)).toEqual(first);
    expect(leafBytes()).toEqual(before);
    expect(readFileSync(reader, 'utf8')).toContain('(../../c/practice-t.md)');
    const lint = await runCli(sandbox, ['lint', '--verbose']);
    expect(lint.stdout + lint.stderr).toContain('stale-rendered-link: 1');
  });
});

/**
 * `--stage` must regenerate and stage the COMPLETE owned set every time.
 * The leaf hash is not a sufficient invalidation key: sidecar-only edits,
 * deleted owned artifacts and a prior plain rebuild (hash already current,
 * files regenerated but unstaged) all leave the hash unchanged.
 */
describe('index rebuild --stage regenerates and stages the complete owned set', () => {
  let sandbox: string;
  let nodesDir: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    nodesDir = join(sandbox, '.ai/kenkeep/nodes');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    writeNodeIn(sandbox, 'topic', 'practice', 'practice-foo');
    setFolderSummary(nodesDir, 'topic', 'Topic things.');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    await commitAll(sandbox);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('after a summary-only sidecar edit (leaf hash unchanged)', async () => {
    setFolderSummary(nodesDir, 'topic', 'Topic things, revised.');
    expect((await runCli(sandbox, ['index', 'rebuild', '--stage'])).exitCode).toBe(0);
    const staged = await stagedStatus(sandbox);
    expect(staged.get('.ai/kenkeep/FOLDER_SUMMARIES.md')).toBe('M');
    // The parents that splice the summary are regenerated and staged too.
    expect(staged.get('.ai/kenkeep/ENTRY.md')).toBe('M');
    expect(staged.get('.ai/kenkeep/nodes/index.md')).toBe('M');
    expect(readFileSync(join(sandbox, '.ai/kenkeep/ENTRY.md'), 'utf8')).toContain(
      'Topic things, revised.'
    );
  });

  it('after GRAPH.md was deleted from the repo', async () => {
    await exec('git', ['rm', '-q', '.ai/kenkeep/GRAPH.md'], { cwd: sandbox });
    await commitAll(sandbox, 'drop graph');
    expect((await runCli(sandbox, ['index', 'rebuild', '--stage'])).exitCode).toBe(0);
    expect((await stagedStatus(sandbox)).get('.ai/kenkeep/GRAPH.md')).toBe('A');
    expect(readFileSync(join(sandbox, '.ai/kenkeep/GRAPH.md'), 'utf8')).toContain(
      '## practice-foo'
    );
  });

  it('after a folder index.md was deleted from the repo', async () => {
    await exec('git', ['rm', '-q', '.ai/kenkeep/nodes/topic/index.md'], { cwd: sandbox });
    await commitAll(sandbox, 'drop folder index');
    expect((await runCli(sandbox, ['index', 'rebuild', '--stage'])).exitCode).toBe(0);
    expect((await stagedStatus(sandbox)).get('.ai/kenkeep/nodes/topic/index.md')).toBe('A');
  });

  it('after a prior plain rebuild already updated the hash and regenerated the files', async () => {
    writeNodeIn(sandbox, 'topic', 'map', 'map-bar');
    // The skill's plain rebuild: files regenerated, hash current, nothing staged.
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    expect((await stagedStatus(sandbox)).size).toBe(0);
    // The pre-commit step: must still stage every regenerated owned file.
    expect((await runCli(sandbox, ['index', 'rebuild', '--stage'])).exitCode).toBe(0);
    const staged = await stagedStatus(sandbox);
    expect(staged.get('.ai/kenkeep/ENTRY.md')).toBe('M');
    expect(staged.get('.ai/kenkeep/GRAPH.md')).toBe('M');
    expect(staged.get('.ai/kenkeep/nodes/topic/index.md')).toBe('M');
    // Only owned artifacts are staged; the new leaf is the user's to stage.
    expect(staged.has('.ai/kenkeep/nodes/topic/map-bar.md')).toBe(false);
  });

  it('stages the deletion of a stale owned index that no longer exists in the tree', async () => {
    writeNodeIn(sandbox, 'gone', 'map', 'map-gone');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    await commitAll(sandbox, 'add gone');
    rmSync(join(nodesDir, 'gone', 'map-gone.md'));
    expect((await runCli(sandbox, ['index', 'rebuild', '--stage'])).exitCode).toBe(0);
    const staged = await stagedStatus(sandbox);
    expect(staged.get('.ai/kenkeep/nodes/gone/index.md')).toBe('D');
    expect(staged.get('.ai/kenkeep/ENTRY.md')).toBe('M');
  });
});

describe('doctor: stale ENTRY detection', () => {
  let sandbox: string;
  // doctor's claude adapter probes `claude --version`; a stub on PATH lets
  // the CLI check pass hermetically (CI ships no real harness binary) so the
  // asserted exit code reflects only the staleness warning.
  let env: NodeJS.ProcessEnv;
  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    const stubBin = writeHarnessBinaryStubs(sandbox);
    env = { PATH: `${stubBin}:${process.env['PATH'] ?? ''}` };
    await runCli(sandbox, ['init', '--harnesses', 'claude'], env);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('warns when nodes drift after ENTRY was written', async () => {
    writeNode(sandbox, 'practice', 'practice-foo');
    expect((await runCli(sandbox, ['index', 'rebuild'])).exitCode).toBe(0);
    // Drift: add another node without rebuilding.
    writeNode(sandbox, 'map', 'map-bar');
    const doc = await runCli(sandbox, ['doctor'], env);
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
