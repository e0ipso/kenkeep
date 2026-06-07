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
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runNodeWriteCommand } from '../../src/commands/node-write.js';

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
    expect(parsed.data['id']).toBe('practice-use-foo');
    expect(parsed.data['kind']).toBe('practice');
    expect(parsed.data['title']).toBe('Use Foo');
    expect(parsed.data['summary']).toBe('How to use foo');
    expect(parsed.data['tags']).toEqual(['a', 'b']);
    expect(parsed.data['confidence']).toBe('high');
    expect(parsed.content).toContain('Details body.');
  });

  it('resolves slug collisions via -2 suffix', async () => {
    // Pre-seed an existing node so readAllNodes surfaces its id.
    const seedPath = join(cwd, '.ai/kenkeep/nodes/practice-foo.md');
    writeFileSync(
      seedPath,
      matter.stringify('# Existing\nbody\n', {
        schema_version: 2,
        id: 'practice-foo',
        title: 'Existing foo',
        kind: 'practice',
        tags: [],
        derived_from: [],
        relates_to: [],
        confidence: 'high',
        summary: 'seed',
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
    expect(data['id']).toBe('practice-foo-2');
    // Original untouched.
    expect(readFileSync(seedPath, 'utf8')).toContain('id: practice-foo');
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

  it('folds bootstrap-state when both --source-doc and --source-hash are passed', async () => {
    const stateFile = join(cwd, '.ai/kenkeep/.state/bootstrap-state.json');
    expect(existsSync(stateFile)).toBe(false);
    const out = capturingStdout();
    const code = await runNodeWriteCommand(
      {
        kind: 'map',
        slug: 'thing',
        flags: {
          title: 'Thing',
          summary: 'A thing',
          sourceDoc: 'docs/source.md',
          sourceHash: 'a'.repeat(64),
        },
      },
      {
        readStdin: async () => '# Thing\n\nbody',
        isTTY: () => false,
        writeStdout: out.write,
      }
    );
    expect(code).toBe(0);
    expect(out.text()).toBe('map-thing\n');
    expect(existsSync(stateFile)).toBe(true);
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {
      schema_version: number;
      docs: Record<
        string,
        { content_sha256: string; last_processed_at: string; produced_nodes: string[] }
      >;
    };
    expect(state.schema_version).toBe(1);
    expect(state.docs['docs/source.md']).toBeDefined();
    expect(state.docs['docs/source.md']!.content_sha256).toBe('a'.repeat(64));
    expect(state.docs['docs/source.md']!.produced_nodes).toEqual(['map-thing']);
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
    const stateFile = join(cwd, '.ai/kenkeep/.state/bootstrap-state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {
      docs: Record<string, { content_sha256: string; produced_nodes: string[] }>;
    };
    expect(state.docs['docs/foo.md']?.content_sha256).toBe('a'.repeat(64));
    expect(state.docs['docs/bar.md']?.content_sha256).toBe('b'.repeat(64));
    expect(state.docs['docs/foo.md']?.produced_nodes).toContain('practice-use-foo');
    expect(state.docs['docs/bar.md']?.produced_nodes).toContain('practice-use-bar');
  });
});
