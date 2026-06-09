import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrate } from '../../src/commands/migrate.js';
import { detectSchemaVersion } from '../../src/lib/migrate.js';
import {
  writePlacements,
  TargetExistsError,
  type Placement,
} from '../../src/lib/migrate-flat-to-tree.js';
import { collectDanglingDerivedFrom } from '../../src/commands/doctor.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';
import { makeSandbox, cleanSandbox, cliPath } from '../helpers.js';

const exec = promisify(execFile);

const NODES_REL = '.ai/kenkeep/nodes';

interface FlatLeafSpec {
  id: string;
  kind: 'practice' | 'map';
  relates_to?: string[];
  depends_on?: string[];
  derived_from?: string[];
}

/**
 * Write a flat-KB leaf at the old `nodes/<kind>/<id>.md` location carrying
 * `schema_version: 1` so the detector classifies the KB as the older,
 * step-eligible layout. Edges (`relates_to`, `depends_on`, `derived_from`) are
 * preserved so the step can be asserted to keep them intact.
 */
function writeFlatLeaf(nodesDir: string, spec: FlatLeafSpec): string {
  const dir = join(nodesDir, spec.kind);
  mkdirSync(dir, { recursive: true });
  const fm: Record<string, unknown> = {
    schema_version: 1,
    id: spec.id,
    title: spec.id,
    kind: spec.kind,
    tags: ['t'],
    derived_from: spec.derived_from ?? [],
    relates_to: spec.relates_to ?? [],
    depends_on: spec.depends_on ?? [],
    confidence: 'high',
    summary: `summary for ${spec.id}`,
  };
  const path = join(dir, `${spec.id}.md`);
  writeFileSync(path, matter.stringify(`# ${spec.id}\n\nBody of ${spec.id}.`, fm));
  return path;
}

/** Recursively collect every leaf `.md` path (excluding generated index.md). */
function collectLeaves(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectLeaves(full));
    } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      out.push(full);
    }
  }
  return out;
}

function parseFm(path: string): Record<string, unknown> {
  return matter(readFileSync(path, 'utf8')).data as Record<string, unknown>;
}

/**
 * Builds an older-layout KB fixture under a freshly `init`-ed sandbox: removes
 * the template's empty tree index node and writes a handful of
 * cross-referencing flat leaves. Returns the absolute nodes dir.
 */
async function makeFlatKb(sandbox: string): Promise<string> {
  await exec('git', ['init', '-q'], { cwd: sandbox });
  await exec('node', [cliPath, 'init', '--harnesses', 'claude'], {
    cwd: sandbox,
    env: { ...process.env, NO_COLOR: '1' },
  });
  const nodesDir = join(sandbox, NODES_REL);
  // Drop the template's empty tree index so only the flat fixture remains.
  const templateIndex = join(nodesDir, 'index.md');
  if (existsSync(templateIndex)) rmSync(templateIndex);

  writeFlatLeaf(nodesDir, {
    id: 'practice-alpha',
    kind: 'practice',
    relates_to: ['map-beta'],
    depends_on: ['practice-gamma'],
  });
  writeFlatLeaf(nodesDir, {
    id: 'map-beta',
    kind: 'map',
    relates_to: ['practice-alpha'],
  });
  writeFlatLeaf(nodesDir, {
    id: 'practice-gamma',
    kind: 'practice',
    relates_to: [],
    depends_on: [],
  });
  return nodesDir;
}

/**
 * Deterministic clustering stub injected in place of the host-harness LLM call.
 * Places each leaf into a fixed topical folder and authors one summary per
 * distinct folder, so the suite never spawns the harness or the model while
 * still exercising the summary-authoring path.
 */
function stubCluster(folderById: Record<string, string>) {
  return (
    leaves: { id: string; sourcePath: string }[]
  ): {
    placements: Placement[];
    folderSummaries: Record<string, string>;
  } => {
    const placements = leaves.map(l => ({
      id: l.id,
      sourcePath: l.sourcePath,
      targetFolder: folderById[l.id] ?? 'misc',
    }));
    const folderSummaries: Record<string, string> = {};
    for (const folder of new Set(placements.map(p => p.targetFolder))) {
      if (folder !== '') folderSummaries[folder] = `things related to ${folder}`;
    }
    return { placements, folderSummaries };
  };
}

describe('migrate (deterministic primitives)', () => {
  let sandbox: string;
  let original: string;
  beforeEach(() => {
    original = process.cwd();
    sandbox = makeSandbox('kk-migrate-');
  });
  afterEach(() => {
    process.chdir(original);
    cleanSandbox(sandbox);
  });

  it('migrates an older-schema KB: places every leaf, preserves ids and edges, bumps only schema_version, reports placements', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    expect(detectSchemaVersion(nodesDir)).toBe(1);

    // Capture pre-migration frontmatter keyed by id.
    const before = new Map<string, Record<string, unknown>>();
    for (const leaf of collectLeaves(nodesDir)) {
      const fm = parseFm(leaf);
      before.set(fm.id as string, fm);
    }

    process.chdir(sandbox);
    const folders = {
      'practice-alpha': 'workflow',
      'map-beta': 'workflow',
      'practice-gamma': 'storage',
    };
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => logs.push(a.join(' '));
    let code: number;
    try {
      code = await runMigrate({ cluster: stubCluster(folders) });
    } finally {
      console.log = origLog;
    }
    expect(code).toBe(0);

    // Every leaf landed in its assigned topical folder; none remain at their
    // old flat `nodes/<kind>/<id>.md` location (the source files were removed).
    expect(existsSync(join(nodesDir, 'practice', 'practice-alpha.md'))).toBe(false);
    expect(existsSync(join(nodesDir, 'practice', 'practice-gamma.md'))).toBe(false);
    expect(existsSync(join(nodesDir, 'map', 'map-beta.md'))).toBe(false);
    const expectedPaths = {
      'practice-alpha': join(nodesDir, 'workflow', 'practice-alpha.md'),
      'map-beta': join(nodesDir, 'workflow', 'map-beta.md'),
      'practice-gamma': join(nodesDir, 'storage', 'practice-gamma.md'),
    };
    for (const [id, p] of Object.entries(expectedPaths)) {
      expect(existsSync(p), `${id} placed at ${p}`).toBe(true);
      const after = parseFm(p);
      const prior = before.get(id)!;
      // Id unchanged.
      expect(after.id).toBe(id);
      // schema_version bumped to the new value.
      expect(after.schema_version).toBe(NODE_SCHEMA_VERSION);
      // Edges unchanged.
      expect(after.relates_to).toEqual(prior.relates_to);
      expect(after.depends_on).toEqual(prior.depends_on);
      expect(after.derived_from).toEqual(prior.derived_from);
      // Nothing else changed: every other key is byte-equal to the original.
      for (const key of Object.keys(prior)) {
        if (key === 'schema_version') continue;
        expect(after[key], `field ${key} preserved for ${id}`).toEqual(prior[key]);
      }
      // No new frontmatter keys were introduced beyond the originals.
      expect(new Set(Object.keys(after))).toEqual(new Set(Object.keys(prior)));
    }

    // The run report lists every leaf id and its assigned folder.
    const report = logs.join('\n');
    expect(report).toContain('practice-alpha -> workflow');
    expect(report).toContain('map-beta -> workflow');
    expect(report).toContain('practice-gamma -> storage');

    // Success Criterion 4: every created folder's index.md frontmatter carries
    // the authored, non-empty summary, and the post-step rebuild self-preserved
    // it (the stamp survives the deterministic regeneration).
    for (const folder of ['workflow', 'storage']) {
      const indexPath = join(nodesDir, folder, 'index.md');
      expect(existsSync(indexPath), `${folder}/index.md exists`).toBe(true);
      const fm = parseFm(indexPath);
      expect(typeof fm.summary).toBe('string');
      expect((fm.summary as string).length).toBeGreaterThan(0);
      expect(fm.summary).toBe(`things related to ${folder}`);
    }
  });

  it('refuses an LLM-backed migration when no --harness is passed, and changes nothing', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    expect(detectSchemaVersion(nodesDir)).toBe(1);

    // Snapshot the flat tree to prove the guard fires before any write.
    const snapshot = new Map<string, string>();
    for (const leaf of collectLeaves(nodesDir)) {
      snapshot.set(relative(nodesDir, leaf), readFileSync(leaf, 'utf8'));
    }

    process.chdir(sandbox);
    const errs: string[] = [];
    const origErr = console.error;
    console.error = (...a: unknown[]) => errs.push(a.join(' '));
    let code: number;
    try {
      // No `cluster` override (so the step is LLM-backed) and no harness flag:
      // the dispatcher must refuse before spawning the harness.
      code = await runMigrate({});
    } finally {
      console.error = origErr;
    }

    expect(code).toBe(1);
    expect(errs.join('\n')).toContain('--harness');
    // The flat KB is untouched: still version 1, nothing moved into a folder.
    expect(detectSchemaVersion(nodesDir)).toBe(1);
    for (const [rel, content] of snapshot) {
      expect(readFileSync(join(nodesDir, rel), 'utf8')).toBe(content);
    }
  });

  it('refuses to overwrite an existing target and leaves the KB unchanged (all-or-nothing)', async () => {
    const nodesDir = await makeFlatKb(sandbox);

    // Snapshot the flat tree before attempting a colliding placement.
    const snapshot = new Map<string, string>();
    for (const leaf of collectLeaves(nodesDir)) {
      snapshot.set(relative(nodesDir, leaf), readFileSync(leaf, 'utf8'));
    }

    // Pre-create a file at one of the target paths so the write primitive aborts.
    const occupiedFolder = join(nodesDir, 'workflow');
    mkdirSync(occupiedFolder, { recursive: true });
    const occupiedPath = join(occupiedFolder, 'map-beta.md');
    writeFileSync(occupiedPath, 'pre-existing content; must not be clobbered');

    const placements: Placement[] = [
      {
        id: 'practice-alpha',
        sourcePath: join(nodesDir, 'practice', 'practice-alpha.md'),
        targetFolder: 'workflow',
      },
      {
        id: 'map-beta',
        sourcePath: join(nodesDir, 'map', 'map-beta.md'),
        targetFolder: 'workflow',
      },
      {
        id: 'practice-gamma',
        sourcePath: join(nodesDir, 'practice', 'practice-gamma.md'),
        targetFolder: 'storage',
      },
    ];

    expect(() => writePlacements(nodesDir, placements)).toThrow(TargetExistsError);

    // No partial writes: every source leaf is still at its flat location and
    // the occupied file is untouched. No source was moved into a new folder.
    for (const [rel, content] of snapshot) {
      const p = join(nodesDir, rel);
      expect(existsSync(p), `${rel} still present`).toBe(true);
      expect(readFileSync(p, 'utf8')).toBe(content);
    }
    expect(readFileSync(occupiedPath, 'utf8')).toBe('pre-existing content; must not be clobbered');
    expect(existsSync(join(nodesDir, 'storage', 'practice-gamma.md'))).toBe(false);
  });

  it('is a no-op when the KB is already at the current schema and makes zero filesystem changes', async () => {
    // A fresh init yields a tree-layout KB at the current schema_version.
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await exec('node', [cliPath, 'init', '--harnesses', 'claude'], {
      cwd: sandbox,
      env: { ...process.env, NO_COLOR: '1' },
    });
    const nodesDir = join(sandbox, NODES_REL);
    // Add a leaf at the current schema so there is a tree-shaped leaf present.
    const folder = join(nodesDir, 'topic');
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, 'practice-x.md'),
      matter.stringify('# x\nbody', {
        schema_version: NODE_SCHEMA_VERSION,
        id: 'practice-x',
        title: 'x',
        kind: 'practice',
        tags: [],
        derived_from: [],
        relates_to: [],
        confidence: 'high',
        summary: 's',
      })
    );
    expect(detectSchemaVersion(nodesDir)).toBe(NODE_SCHEMA_VERSION);

    // Snapshot the whole nodes tree.
    const snapshot = new Map<string, string>();
    for (const leaf of collectLeaves(nodesDir)) {
      snapshot.set(relative(nodesDir, leaf), readFileSync(leaf, 'utf8'));
    }
    const dirBefore = JSON.stringify(collectLeaves(nodesDir).sort());

    process.chdir(sandbox);
    let cluster_called = false;
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => logs.push(a.join(' '));
    let code: number;
    try {
      code = await runMigrate({
        cluster: () => {
          cluster_called = true;
          return { placements: [], folderSummaries: {} };
        },
      });
    } finally {
      console.log = origLog;
    }

    // No-op: clean exit, never reached the clustering step, no FS change.
    expect(code).toBe(0);
    expect(cluster_called).toBe(false);
    expect(logs.join('\n').toLowerCase()).toContain('already at schema_version');
    expect(JSON.stringify(collectLeaves(nodesDir).sort())).toBe(dirBefore);
    for (const [rel, content] of snapshot) {
      expect(readFileSync(join(nodesDir, rel), 'utf8')).toBe(content);
    }
  });

  it('after migration no edge dangles (doctor dangling-ref detection finds nothing)', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    // derived_from references must resolve on disk; point one leaf at a real
    // session file and a real doc so a dangling reference would be caught.
    const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, 'session-a.md'), 'x');
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs', 'auth.md'), 'x');
    // Re-stamp practice-alpha with resolving derived_from refs.
    const alphaFlat = join(nodesDir, 'practice', 'practice-alpha.md');
    const parsed = matter(readFileSync(alphaFlat, 'utf8'));
    writeFileSync(
      alphaFlat,
      matter.stringify(parsed.content, {
        ...parsed.data,
        derived_from: ['session-a.md', 'docs/auth.md'],
      })
    );

    process.chdir(sandbox);
    const code = await runMigrate({
      cluster: stubCluster({
        'practice-alpha': 'workflow',
        'map-beta': 'workflow',
        'practice-gamma': 'storage',
      }),
    });
    expect(code).toBe(0);

    const dangling = collectDanglingDerivedFrom(sandbox, nodesDir, sessionsDir);
    expect(dangling).toEqual([]);
  });

  it('rejects a clustering result that summarizes a folder no leaf was placed into', async () => {
    const nodesDir = await makeFlatKb(sandbox);

    // Snapshot the flat tree to prove the guard fires before any write.
    const snapshot = new Map<string, string>();
    for (const leaf of collectLeaves(nodesDir)) {
      snapshot.set(relative(nodesDir, leaf), readFileSync(leaf, 'utf8'));
    }

    process.chdir(sandbox);
    // Every leaf lands in `workflow`, but the clustering also authors a summary
    // for an unrelated `ghost` folder no placement ever targets.
    const orphanCluster = (leaves: { id: string; sourcePath: string }[]) => ({
      placements: leaves.map(l => ({
        id: l.id,
        sourcePath: l.sourcePath,
        targetFolder: 'workflow',
      })),
      folderSummaries: { workflow: 'real folder', ghost: 'orphaned summary' },
    });

    await expect(runMigrate({ cluster: orphanCluster })).rejects.toThrow(/ghost/);

    // No write happened: the flat KB is byte-for-byte intact and still v1.
    expect(detectSchemaVersion(nodesDir)).toBe(1);
    for (const [rel, content] of snapshot) {
      expect(readFileSync(join(nodesDir, rel), 'utf8')).toBe(content);
    }
  });
});
