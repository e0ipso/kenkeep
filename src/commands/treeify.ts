import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { z } from 'zod';
import { resolveActiveHarness } from '../harnesses/detect.js';
import { extractJsonPayload } from '../lib/json-extract.js';
import { log } from '../lib/log.js';
import { readAllNodesFlat, type FlatLeaf } from '../lib/treeify-read.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';
import {
  AlreadyMigratedError,
  detectKbLayout,
  writeTreeifyPlacements,
  type TreeifyPlacement,
} from '../lib/treeify.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * Clustering function: given the flat leaves, return one placement per leaf
 * assigning it to a topical folder. Production execs the host harness; tests
 * inject a deterministic stub so the suite never spawns the harness or the LLM.
 */
export type ClusterFn = (leaves: FlatLeaf[]) => TreeifyPlacement[] | Promise<TreeifyPlacement[]>;

export interface TreeifyOptions {
  /**
   * Override the clustering step. Defaults to the host-harness launcher.
   * Tests inject a deterministic stub (Task 4) so the deterministic
   * detect/write/rebuild/report logic is covered without the model.
   */
  cluster?: ClusterFn;
  /** `--harness <id>` flag value, routed into harness resolution. */
  harness?: string | undefined;
}

const PlacementResponseSchema = z.object({
  placements: z.array(
    z.object({
      id: z.string().min(1),
      targetFolder: z.string(),
    })
  ),
});

/**
 * One-time supervised treeify migration, end to end. Mirrors the bootstrap
 * launcher model: it does the LLM work (clustering) and orchestration, delegates
 * all deterministic file writing to the treeify write primitive and all index
 * generation to plan 41's `index rebuild`, prints a migration report, and stops.
 * It writes files to disk only; the human reviews by `git diff` and accepts by
 * commit or rejects by `git restore`. It never stages, never commits, and never
 * invokes git.
 *
 * Flow:
 *   1. Detect the KB layout. If already a tree, refuse (AlreadyMigratedError)
 *      and make zero changes. If empty, report nothing to migrate.
 *   2. On a flat KB, read every flat leaf (ids + edges).
 *   3. Cluster the leaves into topical folders (host harness in `-p` mode with
 *      the recursion guard set; injectable for tests).
 *   4. Pass the placements to the deterministic write primitive (all-or-nothing,
 *      never overwrites, preserves ids and edges, bumps schema_version).
 *   5. Invoke plan 41's deterministic `index rebuild` to generate the index
 *      nodes, GRAPH.md, and nodes_hash.
 *   6. Print a migration report: one `id -> folder` line per leaf.
 */
export async function runTreeify(opts: TreeifyOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  const layout = detectKbLayout(paths.nodesDir);
  if (layout === 'tree') {
    log.error(new AlreadyMigratedError().message);
    return 1;
  }
  if (layout === 'empty') {
    log.plain('No flat knowledge base found under nodes/; nothing to migrate.');
    return 0;
  }

  const leaves = readAllNodesFlat(paths.nodesDir);
  if (leaves.length === 0) {
    log.plain('No flat leaves found under nodes/; nothing to migrate.');
    return 0;
  }

  const cluster = opts.cluster ?? makeHarnessCluster(opts.harness);
  const proposed = await cluster(leaves);

  // Ids are the anchor: every placement must name a known leaf, and every leaf
  // must be placed. Surface a clear error and make no writes otherwise (the
  // write primitive is all-or-nothing, but fail fast with a readable message).
  const placements = reconcilePlacements(leaves, proposed);

  const results = writeTreeifyPlacements(paths.nodesDir, placements);

  // Plan 41's deterministic rebuild generates the index nodes, GRAPH.md, and
  // nodes_hash now that the leaves are placed.
  const rebuildCode = await runIndexRebuild();
  if (rebuildCode !== 0) {
    log.error('treeify: index rebuild failed after placing leaves; review the tree with `git diff`.');
    return rebuildCode;
  }

  log.success(`Migrated ${results.length} leaf/leaves into the tree layout:`);
  for (const r of results.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const folder = r.targetFolder === '' ? '(nodes root)' : r.targetFolder;
    log.plain(`  ${r.id} -> ${folder}`);
  }
  log.plain('');
  log.plain(
    'Review the migration with `git diff` and accept it with `git commit`, ' +
      'or reject it with `git restore`. treeify did not commit anything.'
  );
  return 0;
}

/**
 * Maps proposed `{ id, targetFolder }` entries back to full placements that
 * carry each leaf's source path. Throws on an unknown id or a missing
 * placement so a bad clustering result aborts before any write.
 */
function reconcilePlacements(
  leaves: FlatLeaf[],
  proposed: TreeifyPlacement[]
): TreeifyPlacement[] {
  const byId = new Map(leaves.map(l => [l.id, l]));
  const seen = new Set<string>();
  const placements: TreeifyPlacement[] = [];
  for (const p of proposed) {
    const leaf = byId.get(p.id);
    if (!leaf) {
      throw new Error(`treeify: clustering returned an unknown leaf id "${p.id}"`);
    }
    seen.add(p.id);
    placements.push({ id: p.id, sourcePath: leaf.sourcePath, targetFolder: p.targetFolder });
  }
  const missing = leaves.filter(l => !seen.has(l.id)).map(l => l.id);
  if (missing.length > 0) {
    throw new Error(
      `treeify: clustering omitted ${missing.length} leaf/leaves: ${missing.join(', ')}`
    );
  }
  return placements;
}

const CLUSTER_INSTRUCTIONS =
  'You are clustering an existing flat kenkeep knowledge base into a nested ' +
  'topical folder tree for a one-time migration. Group related leaves into a ' +
  'small set of topical folders (lowercase, dash-separated, may be nested with ' +
  '"/"). Keep nodes that reference each other near each other. Preserve every ' +
  'id exactly; never invent, rename, or drop an id. Respond with ONLY JSON of ' +
  'the shape {"placements":[{"id":"<leaf-id>","targetFolder":"<folder>"}]} with ' +
  'one entry for every leaf.';

/**
 * Builds the production clustering function: execs the host harness in `-p`
 * mode with the recursion guard set, captures stdout, and parses the JSON
 * placement response. This is the LLM seam; it is not exercised in CI (the
 * tests inject a stub instead).
 */
function makeHarnessCluster(harnessFlag: string | undefined): ClusterFn {
  return (leaves: FlatLeaf[]): TreeifyPlacement[] => {
    const root = findRepoRoot();
    const paths = repoPaths(root);
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

/** Parses a harness clustering response into placements. */
function parsePlacements(raw: string): TreeifyPlacement[] {
  const json = extractJsonPayload(raw);
  const parsed = PlacementResponseSchema.parse(JSON.parse(json));
  // sourcePath is filled in by reconcilePlacements against the read leaves.
  return parsed.placements.map(p => ({ id: p.id, sourcePath: '', targetFolder: p.targetFolder }));
}
