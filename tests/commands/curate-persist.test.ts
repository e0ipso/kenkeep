import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

interface ProposedNodeInput {
  title: string;
  tags?: string[];
  body?: string;
  kk_relates_to?: string[];
}

function proposed(p: ProposedNodeInput) {
  return {
    title: p.title,
    type: 'practice',
    tags: p.tags ?? ['foo'],
    description: `summary of ${p.title}`,
    body: p.body ?? `${p.title} body.`,
    kk_confidence: 'high',
    kk_relates_to: p.kk_relates_to ?? [],
    kk_depends_on: [],
  };
}

function addAction(origin: string, homeFolder: string | null, p: ProposedNodeInput) {
  return {
    action: 'add',
    candidate_origin: origin,
    target_node_id: null,
    home_folder: homeFolder,
    proposed_node: proposed(p),
    rationale: 'r',
  };
}

function modifyAction(origin: string, target: string, p: ProposedNodeInput) {
  return {
    action: 'modify',
    candidate_origin: origin,
    target_node_id: target,
    proposed_node: proposed(p),
    rationale: 'r',
  };
}

/** Every file under `dir`, keyed by its path relative to `dir`, with its bytes. */
function treeBytes(dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, treeBytes(full, rel));
    else out[rel] = readFileSync(full, 'utf8');
  }
  return out;
}

function leafIds(root: string): string[] {
  return Object.keys(treeBytes(join(root, '.ai/kenkeep/nodes')))
    .filter(rel => rel.endsWith('.md') && !rel.endsWith('index.md'))
    .map(rel => matter(readFileSync(join(root, '.ai/kenkeep/nodes', rel), 'utf8')).data.kk_id)
    .sort();
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

  it('never mints an id the redirects ledger has retired', async () => {
    writeFileSync(
      join(cwd, '.ai/kenkeep/nodes/.redirects.json'),
      JSON.stringify({ 'practice-old': ['practice-existing'] })
    );
    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([addAction('s1:practice:0', null, { title: 'Old', tags: ['unshared'] })])
    );
    const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    expect(JSON.parse(stdout).results[0].id).toBe('practice-old-2');
    expect(leafIds(cwd)).not.toContain('practice-old');
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
  describe('idempotent retry', () => {
    it('replays without duplicating an add or repeating a modify, and reports failures each time', async () => {
      const input = join(cwd, 'survivors.json');
      writeFileSync(
        input,
        JSON.stringify([
          addAction('s1:practice:0', 'topic', { title: 'Use Foo' }),
          modifyAction('s2:practice:0', 'practice-existing', { title: 'Existing', tags: ['new'] }),
          addAction('s3:practice:0', 'missing', { title: 'Missing Folder' }),
        ])
      );
      const run = async () => {
        const res = await captureStdout(() => runCuratePersistCommand({ input }));
        return { code: res.code, summary: JSON.parse(res.stdout) };
      };
      const statuses = (summary: { results: Array<{ status: string }> }) =>
        summary.results.map(r => r.status);

      const first = await run();
      expect(first.code).toBe(1);
      expect(first.summary).toMatchObject({ written: 2, failed: 1, already_applied: 0 });
      expect(first.summary.results[2]).toMatchObject({
        candidate_origin: 's3:practice:0',
        status: 'failed',
      });
      expect(first.summary.results[2].reason).toMatch(/home_folder "missing" does not exist/);

      const modifiedPath = join(cwd, '.ai/kenkeep/nodes/topic/practice-existing.md');
      const addedPath = join(cwd, '.ai/kenkeep/nodes/topic/practice-use-foo.md');
      const modifiedAfterFirst = readFileSync(modifiedPath, 'utf8');
      const addedAfterFirst = readFileSync(addedPath, 'utf8');

      // Replayed before the cause is fixed: the failure is reported again,
      // and nothing that landed is written twice.
      const unfixed = await run();
      expect(unfixed.code).toBe(1);
      expect(statuses(unfixed.summary)).toEqual(['already-applied', 'already-applied', 'failed']);

      // The human fixes the cause and replays the same file.
      mkdirSync(join(cwd, '.ai/kenkeep/nodes/missing'));
      const fixed = await run();
      expect(fixed.code).toBe(0);
      expect(statuses(fixed.summary)).toEqual(['already-applied', 'already-applied', 'written']);
      expect(fixed.summary.results[0]).toMatchObject({
        id: 'practice-use-foo',
        path: 'topic/practice-use-foo.md',
      });

      expect(leafIds(cwd)).toEqual([
        'practice-existing',
        'practice-missing-folder',
        'practice-use-foo',
      ]);
      expect(readFileSync(modifiedPath, 'utf8')).toBe(modifiedAfterFirst);
      expect(readFileSync(addedPath, 'utf8')).toBe(addedAfterFirst);
    });

    it('applies a body-only modify whose origin the leaf already lists', async () => {
      // A later transcript version reuses a positional origin the leaf already
      // carries and changes only the body: every frontmatter field matches, so
      // only the body shows the modify has not landed.
      const leafPath = join(cwd, '.ai/kenkeep/nodes/topic/practice-existing.md');
      const input = join(cwd, 'survivors.json');
      writeFileSync(
        input,
        JSON.stringify([
          {
            action: 'modify',
            candidate_origin: 'old-session:practice:0',
            target_node_id: 'practice-existing',
            proposed_node: {
              title: 'Existing',
              type: 'practice',
              tags: ['old'],
              description: 'old summary',
              body: 'Newer body.',
              kk_confidence: 'medium',
              kk_relates_to: [],
              kk_depends_on: [],
            },
            rationale: 'r',
          },
        ])
      );
      const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
      expect(code).toBe(0);
      expect(JSON.parse(stdout).results[0].status).toBe('written');
      expect(matter(readFileSync(leafPath, 'utf8')).content).toContain('Newer body.');
    });

    it('fails a modify of a target whose filename is not its id and writes nothing', async () => {
      const nodes = join(cwd, '.ai/kenkeep/nodes');
      const canonical = join(nodes, 'topic/practice-existing.md');
      renameSync(canonical, join(nodes, 'topic/manual.md'));
      const before = treeBytes(nodes);
      const input = join(cwd, 'survivors.json');
      writeFileSync(
        input,
        JSON.stringify([modifyAction('s2:practice:0', 'practice-existing', { title: 'Existing' })])
      );
      const { code, stdout } = await captureStdout(() => runCuratePersistCommand({ input }));
      expect(code).toBe(1);
      expect(JSON.parse(stdout).results[0]).toMatchObject({ status: 'failed' });
      expect(treeBytes(nodes)).toEqual(before);
    });

    it('treats generated-section markers quoted in the body as authored text', async () => {
      const input = join(cwd, 'survivors.json');
      const run = async (action: unknown) => {
        writeFileSync(input, JSON.stringify([action]));
        const res = await captureStdout(() => runCuratePersistCommand({ input }));
        return { code: res.code, summary: JSON.parse(res.stdout) };
      };
      const quoted = (fact: string): string =>
        `Quoted \`<!-- kk:related:start -->\` ${fact} \`<!-- kk:related:end -->\` ending.\n\n` +
        '```md\n<!-- kk:citations:start -->\nFENCED\n<!-- kk:citations:end -->\n```\n';
      const added = await run(
        addAction('s:practice:0', 'topic', { title: 'Q', body: quoted('A') })
      );
      expect(added.summary.results[0].status).toBe('written');
      const leafPath = join(cwd, '.ai/kenkeep/nodes', added.summary.results[0].path);

      const change = modifyAction('s:practice:0', 'practice-q', { title: 'Q', body: quoted('B') });
      const modified = await run(change);
      expect(modified.code).toBe(0);
      expect(modified.summary.results[0].status).toBe('written');
      expect(readFileSync(leafPath, 'utf8')).toContain(' B `');

      const replayed = await run(change);
      expect(replayed.summary.results[0].status).toBe('already-applied');
    });
  });

  it('renders same-batch links to the real path of a leaf written later in the batch', async () => {
    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        addAction('s1:practice:0', 'topic', { title: 'Alpha', kk_relates_to: ['practice-beta'] }),
        modifyAction('s2:practice:0', 'practice-existing', {
          title: 'Existing',
          kk_relates_to: ['practice-beta'],
        }),
        addAction('s3:practice:0', 'topic', { title: 'Beta' }),
      ])
    );
    const { code } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    for (const id of ['practice-alpha', 'practice-existing']) {
      const body = readFileSync(join(cwd, `.ai/kenkeep/nodes/topic/${id}.md`), 'utf8');
      expect(body).toContain('](practice-beta.md)');
      expect(body).not.toContain('](../practice-beta.md)');
    }
  });

  it('applies repeated modifies of one target in a run on top of each other', async () => {
    const input = join(cwd, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        modifyAction('s1:practice:0', 'practice-existing', { title: 'Existing', body: 'First.' }),
        modifyAction('s2:practice:0', 'practice-existing', { title: 'Existing', body: 'Second.' }),
      ])
    );
    const { code } = await captureStdout(() => runCuratePersistCommand({ input }));
    expect(code).toBe(0);
    const leaf = matter(
      readFileSync(join(cwd, '.ai/kenkeep/nodes/topic/practice-existing.md'), 'utf8')
    );
    expect(leaf.data.kk_derived_from).toEqual([
      'old-session:practice:0',
      's1:practice:0',
      's2:practice:0',
    ]);
    expect(leaf.content).toContain('Second.');
  });
});
