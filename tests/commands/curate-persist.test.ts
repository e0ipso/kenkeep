import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCuratePersistCommand } from '../../src/commands/curate-persist.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-curate-persist-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/nodes/topic'), { recursive: true });
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-05-23T10:00:00Z',
      harnesses: ['claude'],
    })
  );
  writeFileSync(
    join(root, '.ai/kenkeep/nodes/topic/practice-existing.md'),
    matter.stringify('Old body.\n', {
      kk_schema_version: 3,
      kk_id: 'practice-existing',
      title: 'Existing',
      type: 'practice',
      tags: ['old'],
      kk_derived_from: ['old-session:practice:0'],
      kk_relates_to: [],
      kk_depends_on: [],
      kk_confidence: 'medium',
      description: 'old summary',
    })
  );
  return root;
}

function writeLeaf(root: string, relDir: string, id: string, tags: string[]): void {
  const dir = join(root, '.ai/kenkeep/nodes', relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.md`),
    matter.stringify(`Body of ${id}.\n`, {
      kk_schema_version: 3,
      kk_id: id,
      title: id,
      type: 'practice',
      tags,
      kk_derived_from: ['seed:practice:0'],
      kk_relates_to: [],
      kk_depends_on: [],
      kk_confidence: 'medium',
      description: `summary for ${id}`,
    })
  );
}

async function captureStdout(fn: () => Promise<number>): Promise<{ code: number; stdout: string }> {
  let stdout = '';
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  });
  try {
    const code = await fn();
    return { code, stdout };
  } finally {
    spy.mockRestore();
  }
}

describe('curate-persist primitive', () => {
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

  it('persists add and modify survivors, skips drops, and reports partial failures', async () => {
    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'add',
          candidate_origin: 's1:practice:0',
          target_node_id: null,
          home_folder: 'topic',
          proposed_node: {
            title: 'Use Foo',
            type: 'practice',
            tags: ['foo'],
            description: 'how to use foo',
            body: 'Foo body.',
            kk_confidence: 'high',
            kk_relates_to: [],
          },
          rationale: 'new durable practice',
        },
        {
          action: 'modify',
          candidate_origin: 's2:practice:0',
          target_node_id: 'practice-existing',
          proposed_node: {
            title: 'Existing',
            type: 'practice',
            tags: ['new'],
            description: 'new summary',
            body: 'New body.',
            kk_confidence: 'high',
            kk_relates_to: ['practice-use-foo'],
            kk_depends_on: [],
          },
          rationale: 'refines existing node',
        },
        {
          action: 'drop',
          candidate_origin: 's3:practice:0',
          target_node_id: null,
          proposed_node: null,
          rationale: 'near duplicate',
        },
        {
          action: 'add',
          candidate_origin: 's4:practice:0',
          target_node_id: null,
          home_folder: 'missing',
          proposed_node: {
            title: 'Missing Folder',
            type: 'practice',
            tags: ['foo'],
            description: 'should fail',
            body: 'No write.',
            kk_confidence: 'medium',
            kk_relates_to: [],
          },
          rationale: 'bad placement',
        },
      ])
    );

    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(1);
    const summary = JSON.parse(stdout);
    expect(summary.written).toBe(2);
    expect(summary.dropped).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results.map((r: { status: string }) => r.status)).toEqual([
      'written',
      'written',
      'dropped',
      'failed',
    ]);
    expect(summary.results[0].placement).toBe('topic');
    expect(summary.results[1].placement).toBe('in place');

    const added = matter(
      readFileSync(join(cwd, '.ai/kenkeep/nodes/topic/practice-use-foo.md'), 'utf8')
    );
    expect(added.data.kk_id).toBe('practice-use-foo');
    expect(added.data.kk_derived_from).toEqual(['s1:practice:0']);
    expect(added.content).toContain('Foo body.');

    const modified = matter(
      readFileSync(join(cwd, '.ai/kenkeep/nodes/topic/practice-existing.md'), 'utf8')
    );
    expect(modified.data.kk_id).toBe('practice-existing');
    expect(modified.data.tags).toEqual(['new']);
    expect(modified.data.kk_derived_from).toEqual(['old-session:practice:0', 's2:practice:0']);
    expect(modified.content).toContain('New body.');

    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/missing/practice-missing-folder.md'))).toBe(
      false
    );
  });

  it('rejects malformed survivor JSON before writing', async () => {
    const input = join(cwd, 'bad.json');
    writeFileSync(input, JSON.stringify([{ action: 'add', candidate_origin: 's1' }]));
    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-untitled.md'))).toBe(false);
  });

  it('rejects contradict actions and unsafe home_folder placements', async () => {
    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'contradict',
          candidate_origin: 's1:practice:0',
          target_node_id: 'practice-existing',
          home_folder: 'topic',
          proposed_node: {
            title: 'Conflicting',
            type: 'practice',
            tags: ['foo'],
            description: 'conflicts with existing',
            body: 'Conflict body.',
            kk_confidence: 'high',
            kk_relates_to: [],
          },
          rationale: 'conflicts with existing node',
        },
        {
          action: 'add',
          candidate_origin: 's2:practice:0',
          target_node_id: null,
          home_folder: '../escape',
          proposed_node: {
            title: 'Traversal',
            type: 'practice',
            tags: ['foo'],
            description: 'traversal attempt',
            body: 'No write.',
            kk_confidence: 'medium',
            kk_relates_to: [],
          },
          rationale: 'unsafe relative placement',
        },
        {
          action: 'add',
          candidate_origin: 's3:practice:0',
          target_node_id: null,
          home_folder: '/etc',
          proposed_node: {
            title: 'Absolute',
            type: 'practice',
            tags: ['foo'],
            description: 'absolute attempt',
            body: 'No write.',
            kk_confidence: 'medium',
            kk_relates_to: [],
          },
          rationale: 'unsafe absolute placement',
        },
      ])
    );

    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(1);
    const summary = JSON.parse(stdout);
    expect(summary.written).toBe(0);
    expect(summary.failed).toBe(3);
    expect(summary.results.map((r: { status: string }) => r.status)).toEqual([
      'failed',
      'failed',
      'failed',
    ]);
    expect(summary.results[0].reason).toMatch(/contradict/);
    // Path-safety failures surface as a missing destination folder under nodes/.
    expect(summary.results[1].reason).toMatch(/does not exist/);
    expect(summary.results[2].reason).toMatch(/does not exist/);
    // No traversal write landed outside nodes/.
    expect(existsSync(join(cwd, '.ai/kenkeep/escape/practice-traversal.md'))).toBe(false);
  });

  it('derives the home folder for an add the curator left unplaced', async () => {
    writeLeaf(cwd, 'harnesses', 'practice-claude-adapter', ['harness']);
    writeLeaf(cwd, 'harnesses', 'practice-hook-registration', ['harness']);

    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'add',
          candidate_origin: 's1:practice:0',
          target_node_id: null,
          home_folder: '',
          proposed_node: {
            title: 'Edge Placed',
            type: 'practice',
            tags: ['unshared'],
            description: 'placed by its edges',
            body: 'Edge body.',
            kk_confidence: 'high',
            kk_relates_to: ['practice-claude-adapter'],
          },
          rationale: 'curator left the folder empty',
        },
        {
          action: 'add',
          candidate_origin: 's2:practice:0',
          target_node_id: null,
          home_folder: null,
          proposed_node: {
            title: 'Tag Placed',
            type: 'practice',
            tags: ['harness'],
            description: 'placed by its tags',
            body: 'Tag body.',
            kk_confidence: 'high',
            kk_relates_to: [],
          },
          rationale: 'curator left the folder null',
        },
      ])
    );

    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary.written).toBe(2);
    expect(summary.results.map((r: { path: string }) => r.path)).toEqual([
      'harnesses/practice-edge-placed.md',
      'harnesses/practice-tag-placed.md',
    ]);
    expect(summary.results.map((r: { placement: string }) => r.placement)).toEqual([
      'derived: harnesses',
      'derived: harnesses',
    ]);
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/harnesses/practice-edge-placed.md'))).toBe(true);
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-edge-placed.md'))).toBe(false);
  });

  it('writes an unplaceable add at the root and removes nothing', async () => {
    const existing = join(cwd, '.ai/kenkeep/nodes/topic/practice-existing.md');
    const before = readFileSync(existing, 'utf8');

    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'add',
          candidate_origin: 's1:practice:0',
          target_node_id: null,
          proposed_node: {
            title: 'No Neighbours',
            type: 'practice',
            tags: ['unshared'],
            description: 'matches no folder',
            body: 'Lonely body.',
            kk_confidence: 'high',
            kk_relates_to: [],
          },
          rationale: 'genuinely novel topic',
        },
      ])
    );

    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary.written).toBe(1);
    expect(summary.results[0].path).toBe('practice-no-neighbours.md');
    expect(summary.results[0].placement).toBe('root fallback');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-no-neighbours.md'))).toBe(true);
    expect(readFileSync(existing, 'utf8')).toBe(before);
  });

  it('writes at the root when the tree has no folders', async () => {
    rmSync(join(cwd, '.ai/kenkeep/nodes/topic'), { recursive: true, force: true });
    writeLeaf(cwd, '', 'practice-root-resident', ['harness']);

    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'add',
          candidate_origin: 's1:practice:0',
          target_node_id: null,
          home_folder: '',
          proposed_node: {
            title: 'Fresh Tree',
            type: 'practice',
            tags: ['harness'],
            description: 'nothing to file into yet',
            body: 'Fresh body.',
            kk_confidence: 'high',
            kk_relates_to: ['practice-root-resident'],
          },
          rationale: 'no folder exists yet',
        },
      ])
    );

    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary.results[0].path).toBe('practice-fresh-tree.md');
    expect(summary.results[0].placement).toBe('root fallback');
    expect(existsSync(join(cwd, '.ai/kenkeep/nodes/practice-root-resident.md'))).toBe(true);
  });
});
