import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBootstrapCompleteDocCommand } from '../../src/commands/bootstrap-complete-doc.js';
import { collectDanglingDerivedFrom } from '../../src/commands/doctor.js';
import { runFindDocsCommand } from '../../src/commands/finddocs.js';
import { runNodeWriteCommand } from '../../src/commands/node-write.js';
import { readBootstrapState, sha256Hex } from '../../src/lib/bootstrap.js';
import type { BootstrapState } from '../../src/lib/schemas.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-nodewrite-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-05-23T10:00:00Z',
      assistants: ['claude'],
    })
  );
  // Topical tree: leaves live directly under nodes/ (placement is topical,
  // independent of kind). The node-write primitive defaults to the nodes/ root.
  mkdirSync(join(root, '.ai/kenkeep/nodes'), { recursive: true });
  return root;
}

function capturingStdout(): { write: (s: string) => void; text: () => string } {
  let buf = '';
  return { write: (s: string) => (buf += s), text: () => buf };
}

describe('node write primitive', () => {
  let cwd: string;
  let original: string;
  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });
  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('happy path: stdin body + flags writes node and prints resolved id', async () => {
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'use-foo',
        flags: {
          title: 'Use Foo',
          summary: 'How to use foo',
          tags: 'a, b',
          confidence: 'high',
        },
      },
      {
        readStdin: async () => '# Use Foo\n\nDetails body.',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(0);
    expect(out.text()).toBe('practice-use-foo\n');
    const file = join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md');
    expect(existsSync(file)).toBe(true);
    const parsed = matter(readFileSync(file, 'utf8'));
    expect(parsed.data['kk_id']).toBe('practice-use-foo');
    expect(parsed.data['type']).toBe('practice');
    expect(parsed.data['title']).toBe('Use Foo');
    expect(parsed.data['description']).toBe('How to use foo');
    expect(parsed.data['tags']).toEqual(['a', 'b']);
    expect(parsed.data['kk_confidence']).toBe('high');
    expect(parsed.content).toContain('Details body.');
  });

  it('resolves slug collisions via -2 suffix', async () => {
    // Pre-seed an existing node so readAllNodes surfaces its id.
    const seedPath = join(cwd, '.ai/kenkeep/nodes/practice-foo.md');
    writeFileSync(
      seedPath,
      matter.stringify('# Existing\nbody\n', {
        kk_schema_version: 3,
        kk_id: 'practice-foo',
        title: 'Existing foo',
        type: 'practice',
        description: 'seed',
        tags: [],
        kk_derived_from: [],
        kk_relates_to: [],
        kk_confidence: 'high',
      })
    );
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'foo',
        flags: { title: 'Foo two', summary: 'collision resolves' },
      },
      {
        readStdin: async () => '# Foo two\n\nNew body.',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(0);
    expect(out.text()).toBe('practice-foo-2\n');
    const collidedFile = join(cwd, '.ai/kenkeep/nodes/practice-foo-2.md');
    expect(existsSync(collidedFile)).toBe(true);
    const data = matter(readFileSync(collidedFile, 'utf8')).data as Record<string, unknown>;
    expect(data['kk_id']).toBe('practice-foo-2');
    // Original untouched.
    expect(readFileSync(seedPath, 'utf8')).toContain('kk_id: practice-foo');
  });

  it('never reuses an id the redirects ledger has retired', async () => {
    writeFileSync(
      join(cwd, '.ai/kenkeep/nodes/.redirects.json'),
      JSON.stringify({ 'practice-old': ['practice-live'] })
    );
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      { kind: 'practice', slug: 'old', flags: { title: 'Old', summary: 'retired slug' } },
      { readStdin: async () => '# Old\n\nBody.', isTTY: () => false, writeStdout: out.write }
    );
    expect(code).toBe(0);
    expect(out.text()).toBe('practice-old-2\n');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-old.md'))).toBe(false);
  });

  it('rejects invalid --confidence with nonzero exit and no partial file', async () => {
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'bad-conf',
        flags: { title: 'Bad', summary: 'Bad', confidence: 'bogus' },
      },
      {
        readStdin: async () => '# Bad\n\nbody',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(1);
    expect(out.text()).toBe('');
    expect(readdirSync(join(cwd, '.ai/kenkeep/nodes'))).toEqual([]);
  });

  it('skips bootstrap-state update when neither source flag is passed', async () => {
    const stateFile = join(cwd, '.ai/kenkeep/.state/bootstrap-state.json');
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'no-source',
        flags: { title: 'No source', summary: 'no fold' },
      },
      {
        readStdin: async () => '# x\n\nbody',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(0);
    expect(existsSync(stateFile)).toBe(false);
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-no-source.md'))).toBe(true);
  });

  it('errors when only --source-doc is passed (no --source-hash); no writes', async () => {
    const stateFile = join(cwd, '.ai/kenkeep/.state/bootstrap-state.json');
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'half-fold',
        flags: { title: 'Half', summary: 'half', sourceDoc: 'docs/x.md' },
      },
      {
        readStdin: async () => '# x\n\nbody',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(1);
    expect(out.text()).toBe('');
    expect(existsSync(stateFile)).toBe(false);
    expect(readdirSync(join(cwd, '.ai/kenkeep/nodes'))).toEqual([]);
  });

  it('places a leaf into --folder and keeps the id folder-independent', async () => {
    // First write: into an existing topical folder under nodes/.
    const out1 = capturingStdout();
    const code1 = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'placed-leaf',
        flags: { title: 'Placed Leaf', summary: 'lives in a folder', folder: 'tooling/sub' },
      },
      { readStdin: async () => '# Placed\n\nbody', isTTY: () => false, writeStdout: out1.write }
    );
    expect(code1).toBe(0);
    expect(out1.text()).toBe('practice-placed-leaf\n');
    const placedPath = join(cwd, '.ai/kenkeep/nodes/tooling/sub/practice-placed-leaf.md');
    expect(existsSync(placedPath)).toBe(true);
    // The leaf is NOT at the root; placement routed it into the folder.
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-placed-leaf.md'))).toBe(false);

    // Second write of the SAME kind+title with no folder: same derived id,
    // different path. Identity is folder-independent.
    const out2 = capturingStdout();
    const code2 = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'placed-leaf',
        flags: { title: 'Placed Leaf', summary: 'same id at root' },
      },
      { readStdin: async () => '# Placed\n\nbody', isTTY: () => false, writeStdout: out2.write }
    );
    expect(code2).toBe(0);
    // ensureUniqueId sees the folder-placed leaf already on disk (whole-tree
    // scan), so the second write collides and resolves to -2. The id stays
    // derived from kind+title and is independent of the folder.
    expect(out2.text()).toBe('practice-placed-leaf-2\n');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-placed-leaf-2.md'))).toBe(true);
  });

  it('root fallback: empty --folder writes the leaf at the nodes/ root (exit 0)', async () => {
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'root-leaf',
        flags: { title: 'Root Leaf', summary: 'no folder given', folder: '' },
      },
      { readStdin: async () => '# Root\n\nbody', isTTY: () => false, writeStdout: out.write }
    );
    expect(code).toBe(0);
    expect(out.text()).toBe('practice-root-leaf\n');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-root-leaf.md'))).toBe(true);
  });

  it('rejects a --folder that escapes nodes/ (traversal and absolute) with no write', async () => {
    const before = readdirSync(join(cwd, '.ai/kenkeep/nodes'));

    const out1 = capturingStdout();
    const code1 = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'escape-rel',
        flags: { title: 'Escape Rel', summary: 'traversal', folder: '../escape' },
      },
      { readStdin: async () => '# x\n\nbody', isTTY: () => false, writeStdout: out1.write }
    );
    expect(code1).toBe(1);
    expect(out1.text()).toBe('');

    const out2 = capturingStdout();
    const code2 = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'escape-abs',
        flags: { title: 'Escape Abs', summary: 'absolute', folder: '/etc/evil' },
      },
      { readStdin: async () => '# x\n\nbody', isTTY: () => false, writeStdout: out2.write }
    );
    expect(code2).toBe(1);
    expect(out2.text()).toBe('');

    // No file landed anywhere under nodes/, and nothing escaped it either.
    expect(readdirSync(join(cwd, '.ai/kenkeep/nodes'))).toEqual(before);
    expect(existsSync(join(cwd, '.ai/kenkeep/escape'))).toBe(false);
  });

  it('serialises concurrent --source-doc writers via proper-lockfile', async () => {
    writeDoc(cwd, 'docs/foo.md', '# Foo\n');
    writeDoc(cwd, 'docs/bar.md', '# Bar\n');
    const out1 = capturingStdout();
    const out2 = capturingStdout();
    const [code1, code2] = await Promise.all([
      runNodeWriteCommand(
        {
          kind: 'practice',
          slug: 'use-foo',
          flags: {
            title: 'Use Foo',
            summary: 'sum1',
            tags: 'a',
            confidence: 'high',
            sourceDoc: 'docs/foo.md',
            sourceHash: 'a'.repeat(64),
          },
        },
        { readStdin: async () => 'body 1', isTTY: () => false, writeStdout: out1.write }
      ),
      runNodeWriteCommand(
        {
          kind: 'practice',
          slug: 'use-bar',
          flags: {
            title: 'Use Bar',
            summary: 'sum2',
            tags: 'b',
            confidence: 'high',
            sourceDoc: 'docs/bar.md',
            sourceHash: 'b'.repeat(64),
          },
        },
        { readStdin: async () => 'body 2', isTTY: () => false, writeStdout: out2.write }
      ),
    ]);
    expect(code1).toBe(0);
    expect(code2).toBe(0);
    const state = readState(cwd);
    expect(state.in_progress?.['docs/foo.md']).toMatchObject({
      content_sha256: 'a'.repeat(64),
      written: { 'practice-use-foo': 'practice-use-foo' },
    });
    expect(state.in_progress?.['docs/bar.md']).toMatchObject({
      content_sha256: 'b'.repeat(64),
      written: { 'practice-use-bar': 'practice-use-bar' },
    });
  });
});

// ---------------------------------------------------------------------------
// Bootstrap source provenance and resumable document completion.
//
// `node write --source-doc` records per-node production only; a document is
// finalized solely by `bootstrap complete-doc`. "Discovery" below is the exact
// kk-bootstrap Step 1+2 contract: `finddocs --with-hashes`, minus every doc
// whose `bootstrap-state.json` `docs[<relpath>].content_sha256` matches.
// ---------------------------------------------------------------------------

function writeDoc(root: string, rel: string, content: string): string {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return sha256Hex(content);
}

function readState(root: string): BootstrapState {
  return JSON.parse(
    readFileSync(join(root, '.ai/kenkeep/.state/bootstrap-state.json'), 'utf8')
  ) as BootstrapState;
}

async function pendingDiscovery(root: string): Promise<string[]> {
  let stdout = '';
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  });
  let code: number;
  try {
    code = await runFindDocsCommand({ withHashes: true });
  } finally {
    spy.mockRestore();
  }
  expect(code).toBe(0);
  const state = readBootstrapState(join(root, '.ai/kenkeep/.state/bootstrap-state.json'));
  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [rel, sha] = line.replace(/^\+ /, '').split('\t');
      return { rel: rel!, sha: sha! };
    })
    .filter(({ rel, sha }) => state.docs[rel]?.content_sha256 !== sha)
    .map(({ rel }) => rel);
}

async function writeFromDoc(
  slug: string,
  doc: string,
  hash: string
): Promise<{ code: number; stdout: string }> {
  const out = capturingStdout();
  const code = await runNodeWriteCommand(
    {
      kind: 'practice',
      slug,
      flags: {
        title: `Title ${slug}`,
        summary: `Summary ${slug}`,
        sourceDoc: doc,
        sourceHash: hash,
      },
    },
    { readStdin: async () => `Body of ${slug}.`, isTTY: () => false, writeStdout: out.write }
  );
  return { code, stdout: out.text() };
}

async function completeDoc(doc: string, hash: string): Promise<{ code: number; stdout: string }> {
  const out = capturingStdout();
  const code = await runBootstrapCompleteDocCommand({ doc, hash }, { writeStdout: out.write });
  return { code, stdout: out.text() };
}

function leafFiles(root: string): string[] {
  return readdirSync(join(root, '.ai/kenkeep/nodes'))
    .filter(f => f.endsWith('.md'))
    .sort();
}

describe('bootstrap provenance and resumable document completion', () => {
  let cwd: string;
  let original: string;
  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });
  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('records the source document in kk_derived_from without completing the document', async () => {
    const hash = writeDoc(cwd, 'docs/a.md', '# A\n\nUse foo.\n');
    const res = await writeFromDoc('use-foo', 'docs/a.md', hash);
    expect(res).toEqual({ code: 0, stdout: 'practice-use-foo\n' });

    const leaf = matter(readFileSync(join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md'), 'utf8'));
    expect(leaf.data['kk_derived_from']).toEqual(['docs/a.md']);
    // The repo-relative reference resolves on disk, so doctor's
    // "derived_from references resolve" check stays green.
    expect(collectDanglingDerivedFrom(cwd, join(cwd, '.ai/kenkeep/nodes'), cwd)).toEqual([]);

    const state = readState(cwd);
    expect(state.docs['docs/a.md']).toBeUndefined();
    expect(state.in_progress?.['docs/a.md']).toMatchObject({
      content_sha256: hash,
      written: { 'practice-use-foo': 'practice-use-foo' },
    });
  });

  it('resumes an interrupted multi-node document without duplicates, then finalizes it', async () => {
    const hash = writeDoc(cwd, 'docs/a.md', '# A\n\nUse foo. Avoid bar.\n');
    writeDoc(cwd, 'docs/b.md', '# B\n');
    expect(await pendingDiscovery(cwd)).toEqual(['docs/a.md', 'docs/b.md']);

    // First run: the first of two nodes lands, then the run is interrupted
    // before the document is finalized.
    expect(await writeFromDoc('use-foo', 'docs/a.md', hash)).toEqual({
      code: 0,
      stdout: 'practice-use-foo\n',
    });
    expect(await pendingDiscovery(cwd)).toEqual(['docs/a.md', 'docs/b.md']);

    // Retry: the skill re-drafts the whole document. The already-written
    // node is not duplicated (no `-2` sibling); its existing id is reported.
    const firstBytes = readFileSync(join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md'), 'utf8');
    expect(await writeFromDoc('use-foo', 'docs/a.md', hash)).toEqual({
      code: 0,
      stdout: 'practice-use-foo\n',
    });
    expect(readFileSync(join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md'), 'utf8')).toBe(
      firstBytes
    );
    expect(await writeFromDoc('avoid-bar', 'docs/a.md', hash)).toEqual({
      code: 0,
      stdout: 'practice-avoid-bar\n',
    });
    expect(leafFiles(cwd)).toEqual(['practice-avoid-bar.md', 'practice-use-foo.md']);

    const done = await completeDoc('docs/a.md', hash);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout)).toEqual({
      doc: 'docs/a.md',
      content_sha256: hash,
      produced_nodes: ['practice-use-foo', 'practice-avoid-bar'],
    });
    const state = readState(cwd);
    expect(state.docs['docs/a.md']).toMatchObject({
      content_sha256: hash,
      produced_nodes: ['practice-use-foo', 'practice-avoid-bar'],
    });
    expect(state.in_progress?.['docs/a.md']).toBeUndefined();
    expect(await pendingDiscovery(cwd)).toEqual(['docs/b.md']);

    // Normal collision behaviour is untouched outside a same-document retry:
    // a different document deriving the same slug still gets a `-2` sibling.
    const bHash = sha256Hex('# B\n');
    expect(await writeFromDoc('use-foo', 'docs/b.md', bHash)).toEqual({
      code: 0,
      stdout: 'practice-use-foo-2\n',
    });
  });

  it('writes a recorded draft again when its leaf was removed before the retry', async () => {
    const hash = writeDoc(cwd, 'docs/a.md', '# A\n\nUse foo.\n');
    const leaf = join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md');
    expect(await writeFromDoc('use-foo', 'docs/a.md', hash)).toEqual({
      code: 0,
      stdout: 'practice-use-foo\n',
    });
    rmSync(leaf);

    // The attempt record alone does not prove the node exists: the retry
    // writes it again instead of reporting an id that is not in the tree.
    expect(await writeFromDoc('use-foo', 'docs/a.md', hash)).toEqual({
      code: 0,
      stdout: 'practice-use-foo\n',
    });
    expect(matter(readFileSync(leaf, 'utf8')).data['kk_derived_from']).toEqual(['docs/a.md']);
    expect(readState(cwd).in_progress?.['docs/a.md']?.written).toEqual({
      'practice-use-foo': 'practice-use-foo',
    });

    const done = await completeDoc('docs/a.md', hash);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout)).toMatchObject({ produced_nodes: ['practice-use-foo'] });
  });

  it('completes a document without listing a node removed after it was written', async () => {
    const hash = writeDoc(cwd, 'docs/a.md', '# A\n\nUse foo. Avoid bar.\n');
    await writeFromDoc('use-foo', 'docs/a.md', hash);
    await writeFromDoc('avoid-bar', 'docs/a.md', hash);
    rmSync(join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md'));

    const done = await completeDoc('docs/a.md', hash);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout)).toEqual({
      doc: 'docs/a.md',
      content_sha256: hash,
      produced_nodes: ['practice-avoid-bar'],
    });
    expect(readState(cwd).docs['docs/a.md']?.produced_nodes).toEqual(['practice-avoid-bar']);
    expect(leafFiles(cwd)).toEqual(['practice-avoid-bar.md']);
  });

  it('keeps ids from an earlier completion after their leaves are removed', async () => {
    const first = writeDoc(cwd, 'docs/a.md', '# A\n\nUse foo.\n');
    await writeFromDoc('use-foo', 'docs/a.md', first);
    expect((await completeDoc('docs/a.md', first)).code).toBe(0);
    rmSync(join(cwd, '.ai/kenkeep/nodes/practice-use-foo.md'));

    // The document changes and is processed again. Only the current attempt
    // is checked against the tree; the earlier completion's history stays.
    const second = writeDoc(cwd, 'docs/a.md', '# A\n\nUse bar.\n');
    await writeFromDoc('use-bar', 'docs/a.md', second);
    const done = await completeDoc('docs/a.md', second);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout)).toEqual({
      doc: 'docs/a.md',
      content_sha256: second,
      produced_nodes: ['practice-use-foo', 'practice-use-bar'],
    });
    expect(leafFiles(cwd)).toEqual(['practice-use-bar.md']);
  });

  it('finalizes a zero-node document so it is not re-listed', async () => {
    const hash = writeDoc(cwd, 'docs/empty.md', '# Nothing durable here\n');
    expect(await pendingDiscovery(cwd)).toEqual(['docs/empty.md']);

    const done = await completeDoc('docs/empty.md', hash);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout)).toEqual({
      doc: 'docs/empty.md',
      content_sha256: hash,
      produced_nodes: [],
    });
    expect(await pendingDiscovery(cwd)).toEqual([]);
    expect(leafFiles(cwd)).toEqual([]);

    // A content change re-lists it (the completion is bound to the hash).
    writeDoc(cwd, 'docs/empty.md', '# Now with a rule\n\nAlways use foo.\n');
    expect(await pendingDiscovery(cwd)).toEqual(['docs/empty.md']);
  });

  it('rejects unsafe or mismatched completion and source-doc inputs without writing', async () => {
    const hash = writeDoc(cwd, 'docs/a.md', '# A\n');
    expect((await writeFromDoc('use-foo', 'docs/a.md', hash)).code).toBe(0);
    const stateBefore = readFileSync(join(cwd, '.ai/kenkeep/.state/bootstrap-state.json'), 'utf8');

    // Finalizing with a hash other than the in-progress attempt's: the doc
    // changed mid-run, so completion would skip unseen content.
    expect(await completeDoc('docs/a.md', 'f'.repeat(64))).toEqual({ code: 1, stdout: '' });
    // Malformed hash, traversal, absolute and missing documents.
    expect(await completeDoc('docs/a.md', 'not-a-hash')).toEqual({ code: 1, stdout: '' });
    expect(await completeDoc('../outside.md', hash)).toEqual({ code: 1, stdout: '' });
    expect(await completeDoc(join(cwd, 'docs/a.md'), hash)).toEqual({ code: 1, stdout: '' });
    expect(await completeDoc('docs/missing.md', hash)).toEqual({ code: 1, stdout: '' });
    expect(readFileSync(join(cwd, '.ai/kenkeep/.state/bootstrap-state.json'), 'utf8')).toBe(
      stateBefore
    );

    expect(await writeFromDoc('escape', '../outside.md', hash)).toEqual({ code: 1, stdout: '' });
    expect(await writeFromDoc('missing', 'docs/missing.md', hash)).toEqual({
      code: 1,
      stdout: '',
    });
    expect(leafFiles(cwd)).toEqual(['practice-use-foo.md']);
  });
});
