import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { z } from 'zod';
import { resolveActiveHarness } from '../harnesses/detect.js';
import { listHarnessIds } from '../harnesses/registry.js';
import { extractJsonPayload } from '../lib/json-extract.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion, planMigration, type MigrationStep } from '../lib/migrate.js';
import { writePlacements, type Placement } from '../lib/migrate-flat-to-tree.js';
import { readAllNodesFlat, type FlatLeaf } from '../lib/migrate-read.js';
import { stampFolderSummary } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { NODE_SCHEMA_VERSION } from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * The result of the clustering step: where each leaf goes, plus a one-line
 * `summary` for each topical folder the clustering creates. The summary is the
 * semantic, LLM-authored field; the deterministic write primitive only stamps it
 * into the folder's `index.md` so the subsequent rebuild self-preserves it.
 * Folders without an entry render the Title-cased name fallback (warn, never
 * block).
 */
export interface ClusterResult {
  placements: Placement[];
  /** folder (POSIX-style, under nodes/) -> authored one-line summary. */
  folderSummaries: Record<string, string>;
}

/**
 * Maps flat leaves to topical folders for the v1->v2 step and authors a summary
 * per created folder. Production execs the host harness; tests inject a
 * deterministic stub so the suite never spawns the harness or the LLM.
 */
export type ClusterFn = (leaves: FlatLeaf[]) => ClusterResult | Promise<ClusterResult>;

export interface MigrateOptions {
  /** Override the clustering step. Tests inject a deterministic stub. */
  cluster?: ClusterFn;
  /** `--harness <id>` value, routed into harness resolution. */
  harness?: string | undefined;
}

/**
 * Brings the on-disk knowledge base up to the code's storage schema. Reads the
 * version on disk, resolves the chain of steps up to NODE_SCHEMA_VERSION, runs
 * each, then regenerates the indexes once. Writes files only: review with
 * `git diff`, accept by commit, reject by `git restore`. Never invokes git.
 */
export async function runMigrate(opts: MigrateOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  const current = detectSchemaVersion(paths.nodesDir);
  if (current === null) {
    log.plain('No knowledge base found under nodes/; nothing to do.');
    return 0;
  }
  if (current >= NODE_SCHEMA_VERSION) {
    log.plain(`Knowledge base is already at schema_version ${current}; nothing to do.`);
    return 0;
  }

  const plan = planMigration(buildSteps(opts), current, NODE_SCHEMA_VERSION);

  // An LLM-backed step must not silently pick a harness from the env or config:
  // fail fast unless the caller named one explicitly with `--harness`.
  const harnessProvided = typeof opts.harness === 'string' && opts.harness.trim() !== '';
  if (!harnessProvided && plan.some(step => step.requiresHarness)) {
    log.error(
      'This migration clusters nodes with an LLM in your coding agent and needs an ' +
        'explicit harness. Re-run as `kenkeep --harness <id> migrate` (one of: ' +
        `${listHarnessIds().join(', ')}).`
    );
    return 1;
  }

  const report: string[] = [];
  for (const step of plan) {
    report.push(...(await step.run()));
  }

  const rebuildCode = await runIndexRebuild();
  if (rebuildCode !== 0) {
    log.error('index rebuild failed; review the tree with `git diff`.');
    return rebuildCode;
  }

  log.success(`Updated ${report.length} leaf/leaves to schema_version ${NODE_SCHEMA_VERSION}:`);
  for (const line of report.slice().sort((a, b) => a.localeCompare(b))) {
    log.plain(`  ${line}`);
  }
  log.plain('');
  log.plain('Review with `git diff` and accept with `git commit`, or reject with `git restore`.');
  return 0;
}

/** The ordered step registry. A future schema bump appends one entry here. */
function buildSteps(opts: MigrateOptions): MigrationStep[] {
  return [flatToTreeStep(opts)];
}

/**
 * v1 -> v2: cluster the flat leaves into a topical folder tree, then place each
 * leaf with its id and edges preserved. Returns one `id -> folder` line per leaf.
 */
function flatToTreeStep(opts: MigrateOptions): MigrationStep {
  return {
    from: 1,
    to: 2,
    // The clustering step shells out to the host harness, except when a
    // deterministic `cluster` override is injected (the test path).
    requiresHarness: opts.cluster === undefined,
    async run(): Promise<string[]> {
      const paths = repoPaths(findRepoRoot());
      const leaves = readAllNodesFlat(paths.nodesDir);
      if (leaves.length === 0) return [];

      const cluster = opts.cluster ?? makeHarnessCluster(opts.harness);
      const { placements: proposed, folderSummaries } = await cluster(leaves);
      const placements = reconcilePlacements(leaves, proposed);
      // Cross-check the parallel folder-summary channel against the folders the
      // placements actually create, BEFORE any write, so a stray summary cannot
      // orphan an index.md (see reconcileFolderSummaries).
      reconcileFolderSummaries(folderSummaries, placements);
      const results = writePlacements(paths.nodesDir, placements);
      // Author the folder summaries: stamp each into its new folder's index.md
      // so the rebuild that follows this step self-preserves it. The LLM invents
      // the summary; deterministic code only persists it.
      for (const [folder, summary] of Object.entries(folderSummaries)) {
        if (folder.trim() === '') continue; // the nodes/ root carries ENTRY.md, not a folder index
        stampFolderSummary(paths.nodesDir, folder, summary);
      }
      return results.map(
        r => `${r.id} -> ${r.targetFolder === '' ? '(nodes root)' : r.targetFolder}`
      );
    },
  };
}

/**
 * Maps proposed `{ id, targetFolder }` back to full placements carrying each
 * leaf's source path. Throws on an unknown id or a missing placement so a bad
 * clustering result aborts before any write.
 */
function reconcilePlacements(leaves: FlatLeaf[], proposed: Placement[]): Placement[] {
  const byId = new Map(leaves.map(l => [l.id, l]));
  const seen = new Set<string>();
  const placements: Placement[] = [];
  for (const p of proposed) {
    const leaf = byId.get(p.id);
    if (!leaf) {
      throw new Error(`clustering returned an unknown leaf id "${p.id}"`);
    }
    seen.add(p.id);
    placements.push({ id: p.id, sourcePath: leaf.sourcePath, targetFolder: p.targetFolder });
  }
  const missing = leaves.filter(l => !seen.has(l.id)).map(l => l.id);
  if (missing.length > 0) {
    throw new Error(`clustering omitted ${missing.length} leaf/leaves: ${missing.join(', ')}`);
  }
  return placements;
}

/**
 * Cross-check the LLM-authored folder-summary keys against the folders the
 * placements will actually create — each placement's `targetFolder` and every
 * ancestor of it (the rebuild stamps an `index.md` at each). `reconcilePlacements`
 * validates the leaf-id channel; this guards the parallel `folders` channel. A
 * summary keyed to a folder no leaf is placed into (nor an ancestor of one)
 * would `mkdirSync` + stamp an `index.md` into a directory the subsequent
 * rebuild never regenerates, orphaning it on disk. Throw before any write,
 * mirroring `reconcilePlacements`' abort-on-bad-clustering. Folder keys are
 * normalized (slash-split, blanks dropped) so a trailing/duplicate slash never
 * triggers a false orphan; the empty root key is skipped (it stamps no folder).
 */
function reconcileFolderSummaries(
  folderSummaries: Record<string, string>,
  placements: Placement[]
): void {
  const created = new Set<string>();
  for (const p of placements) {
    let acc = '';
    for (const seg of p.targetFolder.split('/').filter(Boolean)) {
      acc = acc === '' ? seg : `${acc}/${seg}`;
      created.add(acc);
    }
  }
  const orphaned = Object.keys(folderSummaries).filter(folder => {
    const norm = folder.split('/').filter(Boolean).join('/');
    return norm !== '' && !created.has(norm);
  });
  if (orphaned.length > 0) {
    throw new Error(
      `clustering authored a folder summary for ${orphaned.length} folder(s) no leaf was ` +
        `placed into: ${orphaned.join(', ')}`
    );
  }
}

const CLUSTER_INSTRUCTIONS =
  'You are clustering a flat kenkeep knowledge base into a nested topical folder ' +
  'tree. Group related leaves into a small set of topical folders (lowercase, ' +
  'dash-separated, may be nested with "/"). Keep nodes that reference each other ' +
  'near each other. Preserve every id exactly; never invent, rename, or drop an ' +
  'id. For EACH folder you create, also write a one-line `summary`: a noun ' +
  'phrase / sentence fragment that completes "for more information on <summary>" ' +
  '(lowercase start, no trailing period, <= ~140 chars), describing what lives ' +
  'in that folder. Respond with ONLY JSON of the shape ' +
  '{"placements":[{"id":"<leaf-id>","targetFolder":"<folder>"}],' +
  '"folders":[{"folder":"<folder>","summary":"<fragment>"}]} with one placement ' +
  'for every leaf and one folder entry for every distinct folder you use.';

const PlacementResponseSchema = z.object({
  placements: z.array(
    z.object({
      id: z.string().min(1),
      targetFolder: z.string(),
    })
  ),
  folders: z
    .array(
      z.object({
        folder: z.string().min(1),
        summary: z.string(),
      })
    )
    .optional(),
});

/**
 * Production clustering: execs the host harness in `-p` mode with the recursion
 * guard set, captures stdout, and parses the JSON placement response. Not
 * exercised in CI (tests inject a stub instead).
 */
function makeHarnessCluster(harnessFlag: string | undefined): ClusterFn {
  return (leaves: FlatLeaf[]): ClusterResult => {
    const paths = repoPaths(findRepoRoot());
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const harness = resolveActiveHarness({
      ...(harnessFlag !== undefined ? { flag: harnessFlag } : {}),
      ...(settings.cliDefaultHarness !== undefined
        ? { cliDefault: settings.cliDefaultHarness }
        : {}),
    });

    const promptLeaves = leaves.map(l => ({
      id: l.id,
      title: l.title,
      kind: l.kind,
      tags: l.tags,
      summary: l.summary,
      relates_to: l.relates_to,
    }));
    const prompt = `${CLUSTER_INSTRUCTIONS}\n\nLeaves:\n${JSON.stringify(promptLeaves, null, 2)}`;

    const execOpts: ExecFileSyncOptions = {
      encoding: 'utf8',
      env: { ...process.env, KENKEEP_BUILDER_INTERNAL: '1' },
      maxBuffer: 64 * 1024 * 1024,
    };
    const raw = execFileSync(harness.launchBinary, ['-p', prompt], execOpts).toString();
    return parsePlacements(raw);
  };
}

function parsePlacements(raw: string): ClusterResult {
  const json = extractJsonPayload(raw);
  const parsed = PlacementResponseSchema.parse(JSON.parse(json));
  // sourcePath is filled in by reconcilePlacements against the read leaves.
  const placements = parsed.placements.map(p => ({
    id: p.id,
    sourcePath: '',
    targetFolder: p.targetFolder,
  }));
  const folderSummaries: Record<string, string> = {};
  for (const f of parsed.folders ?? []) {
    if (f.summary.trim() !== '') folderSummaries[f.folder] = f.summary.trim();
  }
  return { placements, folderSummaries };
}
