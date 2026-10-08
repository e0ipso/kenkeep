import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCuratePersistCommand } from '../../src/commands/curate-persist.js';
import { runIndexRebuild } from '../../src/commands/index-rebuild.js';
import { runNodeRefreshLinks } from '../../src/commands/node-refresh-links.js';
import { runNodeWriteCommand } from '../../src/commands/node-write.js';
import { runRebalanceMove } from '../../src/commands/rebalance.js';
import { assertDefaultNodesRoot, repoPaths } from '../../src/lib/paths.js';

// The CLI derives `.ai/kenkeep/nodes/` from the repository root. Those three
// segments are repository content, so a link at any of them must stop a write
// before it lands outside the repository.

const LINKED_SEGMENTS = ['.ai', '.ai/kenkeep', '.ai/kenkeep/nodes'] as const;

function leaf(id: string, body: string): string {
  return matter.stringify(`${body}\n`, {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    tags: ['topic'],
    kk_derived_from: ['seed:practice:0'],
    kk_relates_to: [],
    kk_depends_on: [],
    kk_confidence: 'medium',
    description: `summary for ${id}`,
  });
}

function sandbox(parent: string): string {
  const root = join(parent, 'repo');
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
    leaf('practice-existing', 'Old body.')
  );
  return root;
}

/** Moves `segment` outside the repository and leaves a directory link behind. */
function linkOutside(root: string, parent: string, segment: string): string {
  const outside = join(parent, 'outside');
  renameSync(join(root, segment), outside);
  symlinkSync(outside, join(root, segment), 'dir');
  return outside;
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[relative(dir, full)] = readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return out;
}

describe('default nodes root route', () => {
  let parent: string;
  let root: string;
  let original: string;

  beforeEach(() => {
    original = process.cwd();
    parent = mkdtempSync(join(tmpdir(), 'kk-default-root-'));
    root = sandbox(parent);
    process.chdir(root);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(original);
    rmSync(parent, { recursive: true, force: true });
  });

  it.each(LINKED_SEGMENTS)('node write refuses a linked %s', async segment => {
    const outside = linkOutside(root, parent, segment);
    const before = snapshot(outside);
    const code = await runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'outside',
        flags: { title: 'Outside', summary: 'A durable rule.', tags: 'topic', folder: 'topic' },
      },
      {
        readStdin: async () => 'UNAUTHORIZED EXTERNAL WRITE\n',
        isTTY: () => false,
        writeStdout: () => undefined,
      }
    );
    expect(code).toBe(1);
    expect(snapshot(outside)).toEqual(before);
  });

  it.each(LINKED_SEGMENTS)(
    'curate persist writes no action of a plan under a linked %s',
    async segment => {
      const input = join(parent, 'plan.json');
      const proposed = (title: string) => ({
        title,
        type: 'practice',
        tags: ['topic'],
        description: 'A durable rule.',
        body: 'UNAUTHORIZED EXTERNAL WRITE',
        kk_confidence: 'medium',
        kk_relates_to: [],
      });
      writeFileSync(
        input,
        JSON.stringify([
          {
            action: 'add',
            candidate_origin: 's1:practice:0',
            target_node_id: null,
            home_folder: 'topic',
            proposed_node: proposed('First'),
            rationale: 'new',
          },
          {
            action: 'modify',
            candidate_origin: 's2:practice:0',
            target_node_id: 'practice-existing',
            proposed_node: proposed('Existing'),
            rationale: 'update',
          },
        ])
      );
      const outside = linkOutside(root, parent, segment);
      const before = snapshot(outside);
      expect(await runCuratePersistCommand({ input })).toBe(1);
      expect(snapshot(outside)).toEqual(before);
    }
  );

  it.each(LINKED_SEGMENTS)('index rebuild refuses a linked %s', async segment => {
    const outside = linkOutside(root, parent, segment);
    const before = snapshot(outside);
    await expect(runIndexRebuild()).rejects.toThrow(/crosses the symlink/);
    expect(snapshot(outside)).toEqual(before);
  });

  it.each(LINKED_SEGMENTS)('refresh-links refuses a linked %s', async segment => {
    const outside = linkOutside(root, parent, segment);
    const before = snapshot(outside);
    expect(await runNodeRefreshLinks()).toBe(1);
    expect(snapshot(outside)).toEqual(before);
  });

  it.each(LINKED_SEGMENTS)(
    'rebalance move applies no operation under a linked %s',
    async segment => {
      const input = join(parent, 'plan.json');
      writeFileSync(
        input,
        JSON.stringify({
          operations: [
            {
              operation: 'create-branch',
              folder: 'moved',
              summary: 'Moved.',
              ids: ['practice-existing'],
            },
            { operation: 'merge', branch: 'moved', into: 'topic' },
          ],
        })
      );
      const outside = linkOutside(root, parent, segment);
      const before = snapshot(outside);
      expect(await runRebalanceMove({ input })).toBe(1);
      expect(snapshot(outside)).toEqual(before);
    }
  );

  it('trusts a linked repository root itself', () => {
    const alias = join(parent, 'alias');
    symlinkSync(root, alias, 'dir');
    const paths = repoPaths(alias);
    expect(assertDefaultNodesRoot(paths)).toBe(paths.nodesDir);
    expect(realpathSync(paths.nodesDir)).toBe(realpathSync(join(root, '.ai/kenkeep/nodes')));
  });
});
