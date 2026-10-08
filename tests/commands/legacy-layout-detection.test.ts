import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';

const exec = promisify(execFile);
const NODES_REL = '.ai/kenkeep/nodes';

// Legacy (v1 flat) status must come from node schema evidence, not from a
// valid v3 topical folder that happens to be named after a kind (`map`,
// `practice`) and has no generated index.md yet. `kind` is a facet, so those
// names are legitimate topical folders.

/** Writes a v3 leaf straight to `nodes/<folder>/<id>.md` with no index.md. */
function writeV3Leaf(nodesDir: string, folder: string, id: string, kind: 'practice' | 'map'): void {
  const dir = join(nodesDir, folder);
  mkdirSync(dir, { recursive: true });
  const fm = {
    type: kind,
    title: id,
    description: `summary for ${id}`,
    tags: ['t'],
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: id,
    kk_derived_from: [],
    kk_relates_to: [],
    kk_confidence: 'high',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n\nBody of ${id}.`, fm));
}

describe('legacy layout detection', () => {
  let sandbox: string;
  let nodesDir: string;
  beforeEach(async () => {
    sandbox = makeSandbox('kk-legacy-layout-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    const init = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(init.exitCode).toBe(0);
    nodesDir = join(sandbox, NODES_REL);
  });
  afterEach(() => cleanSandbox(sandbox));

  for (const kind of ['map', 'practice'] as const) {
    it(`node write --folder ${kind} then index rebuild generates nodes/${kind}/index.md and stays at v3`, async () => {
      mkdirSync(join(nodesDir, kind), { recursive: true });
      const bodyPath = join(sandbox, 'body.md');
      writeFileSync(bodyPath, '# Topical\n\nA leaf in a kind-named topical folder.\n');
      const write = await runCli(sandbox, [
        'node',
        'write',
        kind,
        'topical-leaf',
        '--title',
        'Topical leaf',
        '--summary',
        'A leaf in a kind-named topical folder',
        '--tags',
        'a',
        '--folder',
        kind,
        '--from',
        bodyPath,
      ]);
      expect(write.exitCode, write.stderr).toBe(0);
      expect(write.stdout).toBe(`${kind}-topical-leaf\n`);
      expect(existsSync(join(nodesDir, kind, `${kind}-topical-leaf.md`))).toBe(true);
      expect(existsSync(join(nodesDir, kind, 'index.md'))).toBe(false);

      const status = await runCli(sandbox, ['migrate', 'status']);
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toBe(
        `Knowledge base is already at schema_version ${NODE_SCHEMA_VERSION}; nothing to do.\n`
      );

      const rebuild = await runCli(sandbox, ['index', 'rebuild']);
      expect(rebuild.exitCode, rebuild.stdout + rebuild.stderr).toBe(0);
      expect(rebuild.stdout + rebuild.stderr).not.toMatch(/legacy|kk-migrate/);
      const index = readFileSync(join(nodesDir, kind, 'index.md'), 'utf8');
      expect(index).toContain(`${kind}-topical-leaf`);
    });
  }

  it('a rebalance create-branch into a new top-level map/ folder rebuilds cleanly before its index exists', async () => {
    writeV3Leaf(nodesDir, 'workflow', 'map-alpha', 'map');
    writeV3Leaf(nodesDir, 'workflow', 'practice-beta', 'practice');
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(
      planPath,
      JSON.stringify({
        operations: [
          {
            operation: 'create-branch',
            folder: 'map',
            summary: 'Maps of the system.',
            ids: ['map-alpha'],
          },
        ],
      })
    );

    // The move writes map/map-alpha.md with no index.md, then drives the
    // index rebuild itself: the exact window the old folder-name check broke.
    const move = await runCli(sandbox, ['rebalance', 'move', '--input', planPath]);
    expect(move.exitCode, move.stdout + move.stderr).toBe(0);
    expect(move.stderr).not.toMatch(/legacy|kk-migrate/);
    const index = readFileSync(join(nodesDir, 'map', 'index.md'), 'utf8');
    expect(index).toContain('map-alpha');

    const status = await runCli(sandbox, ['migrate', 'status']);
    expect(status.stdout).toContain(`already at schema_version ${NODE_SCHEMA_VERSION}`);
  });
});
