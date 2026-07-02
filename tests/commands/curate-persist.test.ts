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
});
