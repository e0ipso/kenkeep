import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeSandbox, cleanSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

const NODES_REL = '.ai/kenkeep/nodes';

/**
 * Write a flat-KB leaf at the old `nodes/<kind>/<id>.md` location carrying
 * `schema_version: 1` and no index.md, so the detector classifies the KB as
 * the older, migration-eligible layout.
 */
function writeFlatLeaf(nodesDir: string, id: string, kind: 'practice' | 'map'): void {
  const dir = join(nodesDir, kind);
  mkdirSync(dir, { recursive: true });
  const fm: Record<string, unknown> = {
    schema_version: 1,
    id,
    title: id,
    kind,
    tags: ['t'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: `summary for ${id}`,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n\nBody of ${id}.`, fm));
}

/** Write a nested-tree leaf carrying the current `schema_version: 2`. */
function writeTreeLeaf(nodesDir: string, folder: string, id: string): void {
  const dir = join(nodesDir, folder);
  mkdirSync(dir, { recursive: true });
  const fm: Record<string, unknown> = {
    schema_version: 2,
    id,
    title: id,
    kind: 'practice',
    tags: ['t'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: `summary for ${id}`,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n\nBody of ${id}.`, fm));
}

describe('migrate status (dispatch primitive)', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox('kk-migrate-status-');
    // Anchor findRepoRoot at the sandbox regardless of what lies above /tmp.
    await exec('git', ['init', '-q'], { cwd: sandbox });
  });
  afterEach(() => {
    cleanSandbox(sandbox);
  });

  it('on a v1 flat KB emits exactly one JSON line with the single flat-to-tree step', async () => {
    const nodesDir = join(sandbox, NODES_REL);
    writeFlatLeaf(nodesDir, 'practice-alpha', 'practice');
    writeFlatLeaf(nodesDir, 'map-beta', 'map');

    const res = await runCli(sandbox, ['migrate', 'status']);
    expect(res.exitCode).toBe(0);
    // Contract purity: exactly one line on stdout, parseable as-is. Any
    // prefix, color, or extra line would corrupt the skill's dispatch parse.
    const lines = res.stdout.split('\n').filter(l => l !== '');
    expect(lines).toHaveLength(1);
    const payload = JSON.parse(lines[0]!);
    expect(payload).toEqual({
      current: 1,
      target: 2,
      steps: [
        { id: 'flat-to-tree', from: 1, to: 2, primitives: ['place inventory', 'place apply'] },
      ],
    });
  });

  it('on a current v2 nested KB reports nothing to do and exits 0', async () => {
    const nodesDir = join(sandbox, NODES_REL);
    writeTreeLeaf(nodesDir, 'workflow', 'practice-alpha');

    const res = await runCli(sandbox, ['migrate', 'status']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('already at schema_version 2; nothing to do.');
  });

  it('with no knowledge base reports nothing to do and exits 0', async () => {
    const res = await runCli(sandbox, ['migrate', 'status']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('No knowledge base found under nodes/; nothing to do.');
  });
});
