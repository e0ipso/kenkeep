import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

const NODES_REL = '.ai/kenkeep/nodes';

function nodesDir(sandbox: string): string {
  return join(sandbox, NODES_REL);
}

/** A v3 leaf under nodes/<relDir>/<id>.md (relDir '' for the root). */
function writeLeaf(
  sandbox: string,
  relDir: string,
  id: string,
  overrides: Record<string, unknown> = {}
): string {
  const dir = relDir === '' ? nodesDir(sandbox) : join(nodesDir(sandbox), relDir);
  mkdirSync(dir, { recursive: true });
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    description: 's',
    tags: ['t'],
    kk_derived_from: [],
    kk_relates_to: [],
    kk_depends_on: [],
    kk_confidence: 'high',
    ...overrides,
  };
  const file = join(dir, `${id}.md`);
  writeFileSync(file, matter.stringify('Body.\n', fm));
  return file;
}

/** A legacy flat leaf (schema_version 1) under nodes/<kind>/<id>.md. */
function writeFlatLeaf(sandbox: string, kind: 'practice' | 'map', id: string): string {
  const dir = join(nodesDir(sandbox), kind);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${id}.md`);
  writeFileSync(
    file,
    matter.stringify(`# ${id}\n\nBody of ${id}.`, {
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
    })
  );
  return file;
}

/** relPath -> sha256 for every regular file under `dir` (symlinks listed by name). */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (cur: string): void => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isSymbolicLink()) {
        out.set(relative(dir, full), 'symlink');
      } else if (entry.isDirectory()) {
        walk(full);
      } else {
        out.set(relative(dir, full), createHash('sha256').update(readFileSync(full)).digest('hex'));
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

function proposedNode(title: string): Record<string, unknown> {
  return {
    title,
    type: 'practice',
    tags: ['t'],
    description: 'd',
    body: 'Body.',
    kk_confidence: 'high',
    kk_relates_to: [],
    kk_depends_on: [],
  };
}

describe('path-safety boundary through the built CLI', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox('ai-kk-path-safety-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    const init = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(init.exitCode).toBe(0);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('diagnoses a stored leaf whose id carries ../ before curate modify can build a path from it', async () => {
    // The filename is harmless; the id is the attack. Pre-fix, `findNodeById`
    // accepted it and `writeNodeFile` joined it into <root>/.ai/escape.md.
    const evilId = 'practice-../../../../escape';
    const evil = writeLeaf(sandbox, 'topic', 'practice-evil', { kk_id: evilId });
    const outside = join(sandbox, '.ai', 'escape.md');
    const aiBefore = snapshot(join(sandbox, '.ai'));

    const input = join(sandbox, 'survivors.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'modify',
          candidate_origin: 'sess:practice:0',
          target_node_id: evilId,
          proposed_node: proposedNode('Rewritten'),
          rationale: 'r',
        },
      ])
    );
    const res = await runCli(sandbox, ['curate-persist', '--input', input]);
    expect(res.exitCode).toBe(1);
    const combined = res.stdout + res.stderr;
    expect(combined).toContain('practice-evil.md');
    expect(combined).toMatch(/kk_id: .*not canonical/);
    expect(existsSync(outside)).toBe(false);
    // The tree is byte-identical: nothing was written anywhere under .ai/.
    expect(snapshot(join(sandbox, '.ai'))).toEqual(aiBefore);
    expect(existsSync(evil)).toBe(true);
  });

  it('place apply rejects a ../../../escape placement folder and keeps every source leaf', async () => {
    rmSync(join(nodesDir(sandbox), 'index.md'), { force: true });
    const alpha = writeFlatLeaf(sandbox, 'practice', 'practice-alpha');
    const beta = writeFlatLeaf(sandbox, 'map', 'map-beta');
    const outside = join(sandbox, 'escape');
    const before = snapshot(nodesDir(sandbox));

    const plan = join(sandbox, 'plan.json');
    writeFileSync(
      plan,
      JSON.stringify({
        placements: [
          { id: 'practice-alpha', targetFolder: '../../../escape' },
          { id: 'map-beta', targetFolder: 'safe' },
        ],
      })
    );
    const res = await runCli(sandbox, ['place', 'apply', '--input', plan]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('escapes');
    expect(existsSync(outside)).toBe(false);
    expect(existsSync(alpha)).toBe(true);
    expect(existsSync(beta)).toBe(true);
    // Zero writes: not even the "safe" sibling placement landed.
    expect(existsSync(join(nodesDir(sandbox), 'safe'))).toBe(false);
    expect(snapshot(nodesDir(sandbox))).toEqual(before);
  });

  it('node write and rebalance move refuse a directory symlink inside nodes/ that points outside', async () => {
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(nodesDir(sandbox), 'linked'));
    writeLeaf(sandbox, 'home', 'practice-x');
    writeLeaf(sandbox, 'home', 'practice-y', { kk_relates_to: ['practice-x'] });
    const body = join(sandbox, 'body.md');
    writeFileSync(body, '# Body\n');

    const write = await runCli(sandbox, [
      'node',
      'write',
      'practice',
      'via-link',
      '--title',
      'Via link',
      '--summary',
      's',
      '--folder',
      'linked',
      '--from',
      body,
    ]);
    expect(write.exitCode).toBe(1);
    expect(write.stderr).toContain('symlink');
    expect(readdirSync(outside)).toEqual([]);

    const plan = join(sandbox, 'plan.json');
    writeFileSync(
      plan,
      JSON.stringify({
        operations: [
          { operation: 'create-branch', folder: 'linked', summary: 'nope', ids: ['practice-x'] },
        ],
      })
    );
    const move = await runCli(sandbox, ['rebalance', 'move', '--input', plan]);
    expect(move.exitCode).not.toBe(0);
    expect(move.stderr + move.stdout).toContain('symlink');
    expect(readdirSync(outside)).toEqual([]);
    expect(existsSync(join(nodesDir(sandbox), 'home', 'practice-x.md'))).toBe(true);
  });

  it('curate dedup rejects --run-id ../../x and creates no conflict file outside conflicts/', async () => {
    const input = join(sandbox, 'proposals.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'contradict',
          candidate_origin: 'sess:practice:0',
          target_node_id: 'practice-anything',
          proposed_node: proposedNode('Contradiction'),
          rationale: 'r',
        },
      ])
    );
    const output = join(sandbox, 'survivors.json');
    const outside = join(sandbox, '.ai', 'x-1.md');
    const aiBefore = snapshot(join(sandbox, '.ai'));

    const res = await runCli(sandbox, [
      'curate-dedup',
      '--input',
      input,
      '--output',
      output,
      '--run-id',
      '../../x',
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('run id');
    expect(existsSync(outside)).toBe(false);
    expect(existsSync(output)).toBe(false);
    expect(snapshot(join(sandbox, '.ai/kenkeep/conflicts'))).toEqual(new Map());
    expect(snapshot(join(sandbox, '.ai'))).toEqual(aiBefore);
  });
});
