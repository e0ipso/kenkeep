import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectSchemaVersion } from '../../src/lib/migrate.js';
import { collectDanglingDerivedFrom } from '../../src/commands/doctor.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';
import { makeSandbox, cleanSandbox, cliPath, runCli } from '../helpers.js';

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
 * migration-eligible layout. Edges are preserved so the apply path can be
 * asserted to keep them intact.
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

/** A byte-snapshot of the whole nodes tree: relPath -> sha256 of contents. */
function snapshotTree(nodesDir: string): Map<string, string> {
  const snap = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
        snap.set(relative(nodesDir, full), hash);
      }
    }
  };
  if (existsSync(nodesDir)) walk(nodesDir);
  return snap;
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
 * Builds a nested-tree KB fixture whose leaf carries `schema_version: 0`:
 * `detectSchemaVersion` reads the minimum leaf version, so the tree reads as 0
 * — a migration is pending (< NODE_SCHEMA_VERSION) but not the flat-to-tree
 * step (≠ 1), hitting the step-gate refusal in both place modes.
 */
async function makeNestedKbAtVersionZero(sandbox: string): Promise<string> {
  await exec('git', ['init', '-q'], { cwd: sandbox });
  await exec('node', [cliPath, 'init', '--harnesses', 'claude'], {
    cwd: sandbox,
    env: { ...process.env, NO_COLOR: '1' },
  });
  const nodesDir = join(sandbox, NODES_REL);
  const templateIndex = join(nodesDir, 'index.md');
  if (existsSync(templateIndex)) rmSync(templateIndex);

  mkdirSync(join(nodesDir, 'topic'), { recursive: true });
  writeFileSync(
    join(nodesDir, 'topic', 'note-zero.md'),
    matter.stringify('# note-zero\n\nBody of note-zero.', {
      schema_version: 0,
      id: 'note-zero',
      title: 'note-zero',
      kind: 'practice',
      tags: ['t'],
      derived_from: [],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
      summary: 'summary for note-zero',
    })
  );
  return nodesDir;
}

describe('place (deterministic migration primitive)', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = makeSandbox('kk-place-');
  });
  afterEach(() => {
    cleanSandbox(sandbox);
  });

  it('apply places every leaf, preserves ids/edges/bytes, bumps only schema_version, and stamps folder summaries', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    expect(detectSchemaVersion(nodesDir)).toBe(1);

    // Capture pre-migration frontmatter and body bytes keyed by id.
    const beforeFm = new Map<string, Record<string, unknown>>();
    const beforeBody = new Map<string, string>();
    for (const leaf of collectLeaves(nodesDir)) {
      const parsed = matter(readFileSync(leaf, 'utf8'));
      const id = (parsed.data as Record<string, unknown>).id as string;
      beforeFm.set(id, parsed.data as Record<string, unknown>);
      beforeBody.set(id, parsed.content);
    }

    // Feed the placement-and-folders JSON directly to the apply mode (no cluster
    // stub): alpha+beta -> workflow, gamma -> storage, each folder summarized.
    const plan = {
      placements: [
        { id: 'practice-alpha', targetFolder: 'workflow' },
        { id: 'map-beta', targetFolder: 'workflow' },
        { id: 'practice-gamma', targetFolder: 'storage' },
      ],
      folders: [
        { folder: 'workflow', summary: 'things related to workflow' },
        { folder: 'storage', summary: 'things related to storage' },
      ],
    };
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    const res = await runCli(sandbox, ['place', 'apply', '--input', planPath]);
    expect(res.exitCode).toBe(0);
    // The primitive prints a machine-readable placement summary.
    const summary = JSON.parse(res.stdout.trim());
    expect(summary.placed).toEqual(
      expect.arrayContaining([
        { id: 'practice-alpha', targetFolder: 'workflow' },
        { id: 'map-beta', targetFolder: 'workflow' },
        { id: 'practice-gamma', targetFolder: 'storage' },
      ])
    );

    // Every leaf moved to its topical folder; none remain at the flat location.
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
      const parsed = matter(readFileSync(p, 'utf8'));
      const after = parsed.data as Record<string, unknown>;
      const priorFm = beforeFm.get(id)!;
      // Id unchanged; schema_version bumped; every edge and other field byte-equal.
      expect(after.id).toBe(id);
      expect(after.schema_version).toBe(NODE_SCHEMA_VERSION);
      expect(after.relates_to).toEqual(priorFm.relates_to);
      expect(after.depends_on).toEqual(priorFm.depends_on);
      expect(after.derived_from).toEqual(priorFm.derived_from);
      for (const key of Object.keys(priorFm)) {
        if (key === 'schema_version') continue;
        expect(after[key], `field ${key} preserved for ${id}`).toEqual(priorFm[key]);
      }
      expect(new Set(Object.keys(after))).toEqual(new Set(Object.keys(priorFm)));
      // Body bytes are identical (the move never rewrites prose).
      expect(parsed.content).toBe(beforeBody.get(id));
    }

    // Each created folder's index.md carries its authored, non-empty summary
    // (stamped by the primitive; the leaf relocation is not yet rebuilt).
    for (const folder of ['workflow', 'storage']) {
      const indexPath = join(nodesDir, folder, 'index.md');
      expect(existsSync(indexPath), `${folder}/index.md exists`).toBe(true);
      const fm = parseFm(indexPath);
      expect(fm.summary).toBe(`things related to ${folder}`);
    }

    // No git was invoked: the working tree is left dirty for the human to review.
    const status = await exec('git', ['status', '--porcelain'], { cwd: sandbox });
    expect(status.stdout.trim().length).toBeGreaterThan(0);
    const head = await exec('git', ['rev-list', '--count', 'HEAD'], { cwd: sandbox }).catch(() => ({
      stdout: '0',
    }));
    expect(head.stdout.trim()).toBe('0'); // primitive never commits
  });

  it('apply aborts before any write on an orphan folder summary AND an unknown id, leaving zero filesystem changes', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    const before = snapshotTree(nodesDir);

    // (a) Unknown leaf id -> reconcilePlacements throws.
    const unknownPlan = {
      placements: [
        { id: 'practice-alpha', targetFolder: 'workflow' },
        { id: 'map-beta', targetFolder: 'workflow' },
        { id: 'practice-gamma', targetFolder: 'workflow' },
        { id: 'practice-ghost', targetFolder: 'workflow' },
      ],
      folders: [{ folder: 'workflow', summary: 'real' }],
    };
    const unknownPath = join(sandbox, 'unknown.json');
    writeFileSync(unknownPath, JSON.stringify(unknownPlan));
    const unknownRes = await runCli(sandbox, ['place', 'apply', '--input', unknownPath]);
    expect(unknownRes.exitCode).not.toBe(0);
    expect(unknownRes.stderr).toMatch(/unknown leaf id/);

    // (b) A folder summary keyed to a folder no leaf is placed into -> orphan guard throws.
    const orphanPlan = {
      placements: [
        { id: 'practice-alpha', targetFolder: 'workflow' },
        { id: 'map-beta', targetFolder: 'workflow' },
        { id: 'practice-gamma', targetFolder: 'workflow' },
      ],
      folders: [
        { folder: 'workflow', summary: 'real folder' },
        { folder: 'ghost', summary: 'orphaned summary' },
      ],
    };
    const orphanPath = join(sandbox, 'orphan.json');
    writeFileSync(orphanPath, JSON.stringify(orphanPlan));
    const orphanRes = await runCli(sandbox, ['place', 'apply', '--input', orphanPath]);
    expect(orphanRes.exitCode).not.toBe(0);
    expect(orphanRes.stderr).toMatch(/ghost/);

    // After both failing applies: the KB is byte-for-byte intact and still v1.
    expect(detectSchemaVersion(nodesDir)).toBe(1);
    const after = snapshotTree(nodesDir);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    // No topical folder was ever created.
    expect(existsSync(join(nodesDir, 'workflow'))).toBe(false);
    expect(existsSync(join(nodesDir, 'ghost'))).toBe(false);
  });

  it('apply refuses on a current v2 tree before reading the placement document, leaving zero filesystem changes', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    // Bring the KB to the current schema version via the normal flow.
    const plan = {
      placements: [
        { id: 'practice-alpha', targetFolder: 'core' },
        { id: 'map-beta', targetFolder: 'core' },
        { id: 'practice-gamma', targetFolder: 'core' },
      ],
      folders: [{ folder: 'core', summary: 'core notes' }],
    };
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    expect((await runCli(sandbox, ['place', 'apply', '--input', planPath])).exitCode).toBe(0);
    expect(detectSchemaVersion(nodesDir)).toBe(NODE_SCHEMA_VERSION);

    // The step gate fires before the input is even read: /dev/null is never a
    // factor, and the refusal points the caller at the dispatch primitive.
    const before = snapshotTree(nodesDir);
    const res = await runCli(sandbox, ['place', 'apply', '--input', '/dev/null']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toMatch(new RegExp(`already at schema_version ${NODE_SCHEMA_VERSION}`));
    expect(res.stderr).toMatch(/kenkeep migrate status/);

    // Zero filesystem changes: every file under nodes/ is byte-identical.
    const after = snapshotTree(nodesDir);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    expect(detectSchemaVersion(nodesDir)).toBe(NODE_SCHEMA_VERSION);
  });

  it('inventory and apply both refuse when the pending migration starts from a version other than 1', async () => {
    const nodesDir = await makeNestedKbAtVersionZero(sandbox);
    expect(detectSchemaVersion(nodesDir)).toBe(0);
    const before = snapshotTree(nodesDir);

    // Inventory: pending (0 < NODE_SCHEMA_VERSION) but not this primitive's
    // step — refuse, naming what the registry knows about the detected version.
    const inv = await runCli(sandbox, ['place', 'inventory']);
    expect(inv.exitCode).toBe(1);
    expect(inv.stderr).toMatch(/no migration step is registered from schema_version 0/);
    expect(inv.stderr).toMatch(/flat-to-tree \(1 -> 2\)/);
    expect(inv.stderr).toMatch(/kenkeep migrate status/);

    // Apply: same gate, even with a syntactically valid placement document.
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(
      planPath,
      JSON.stringify({ placements: [{ id: 'note-zero', targetFolder: 'elsewhere' }] })
    );
    const ap = await runCli(sandbox, ['place', 'apply', '--input', planPath]);
    expect(ap.exitCode).toBe(1);
    expect(ap.stderr).toMatch(/no migration step is registered from schema_version 0/);
    expect(ap.stderr).toMatch(/kenkeep migrate status/);

    // Neither refusal touched the tree.
    const after = snapshotTree(nodesDir);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    expect(detectSchemaVersion(nodesDir)).toBe(0);
  });

  it('inventory emits the flat leaves as JSON when a migration is due, and reports nothing to do when current', async () => {
    const nodesDir = await makeFlatKb(sandbox);

    // v1 KB: inventory emits a JSON document with every leaf id present.
    const due = await runCli(sandbox, ['place', 'inventory']);
    expect(due.exitCode).toBe(0);
    const parsed = JSON.parse(due.stdout.trim());
    const ids = (parsed.leaves as Array<{ id: string }>).map(l => l.id).sort();
    expect(ids).toEqual(['map-beta', 'practice-alpha', 'practice-gamma']);
    // The emitted facets are the validated read fields — never raw frontmatter
    // the skill would have to parse itself.
    for (const leaf of parsed.leaves as Array<Record<string, unknown>>) {
      expect(leaf).toHaveProperty('title');
      expect(leaf).toHaveProperty('relates_to');
      expect(leaf).toHaveProperty('sourcePath');
    }

    // Migrate the KB (apply everything to one folder), then inventory reports
    // "nothing to do" and exits 0 — the mode wiring, not the detector itself.
    const plan = {
      placements: ids.map(id => ({ id, targetFolder: 'core' })),
      folders: [{ folder: 'core', summary: 'core notes' }],
    };
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    expect((await runCli(sandbox, ['place', 'apply', '--input', planPath])).exitCode).toBe(0);
    expect(detectSchemaVersion(nodesDir)).toBe(NODE_SCHEMA_VERSION);

    const done = await runCli(sandbox, ['place', 'inventory']);
    expect(done.exitCode).toBe(0);
    expect(done.stdout.toLowerCase()).toContain('already at schema_version');
    // Not a JSON payload: there is nothing to cluster.
    expect(() => JSON.parse(done.stdout.trim())).toThrow();
  });

  it('bare migrate surfaces the dispatch group help (reports only; never executes)', async () => {
    const res = await runCli(sandbox, ['migrate']);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).not.toMatch(/unknown command/i);
    expect(res.stderr).toMatch(/status/);
    expect(res.stderr).toMatch(/never executes/i);
  });

  it('after a place-apply migration no edge dangles (doctor dangling-ref detection finds nothing)', async () => {
    const nodesDir = await makeFlatKb(sandbox);
    // derived_from references must resolve on disk; point one leaf at a real
    // session file and a real doc so a dangling reference would be caught.
    const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(sessionsDir, 'session-a.md'), 'x');
    mkdirSync(join(sandbox, 'docs'), { recursive: true });
    writeFileSync(join(sandbox, 'docs', 'auth.md'), 'x');
    const alphaFlat = join(nodesDir, 'practice', 'practice-alpha.md');
    const parsed = matter(readFileSync(alphaFlat, 'utf8'));
    writeFileSync(
      alphaFlat,
      matter.stringify(parsed.content, {
        ...parsed.data,
        derived_from: ['session-a.md', 'docs/auth.md'],
      })
    );

    const plan = {
      placements: [
        { id: 'practice-alpha', targetFolder: 'workflow' },
        { id: 'map-beta', targetFolder: 'workflow' },
        { id: 'practice-gamma', targetFolder: 'storage' },
      ],
      folders: [
        { folder: 'workflow', summary: 'workflow notes' },
        { folder: 'storage', summary: 'storage notes' },
      ],
    };
    const planPath = join(sandbox, 'plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    expect((await runCli(sandbox, ['place', 'apply', '--input', planPath])).exitCode).toBe(0);

    const dangling = collectDanglingDerivedFrom(sandbox, nodesDir, sessionsDir);
    expect(dangling).toEqual([]);
  });
});
