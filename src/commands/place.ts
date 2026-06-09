import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { writePlacements, type Placement } from '../lib/migrate-flat-to-tree.js';
import { reconcileFolderSummaries, reconcilePlacements } from '../lib/migrate-place.js';
import { readAllNodesFlat } from '../lib/migrate-read.js';
import { stampFolderSummary } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { NODE_SCHEMA_VERSION } from '../lib/schemas.js';
import { readStdin } from '../lib/stdin.js';

/**
 * Deterministic, LLM-free inventory primitive for the v1->v2 migration. Detects
 * the on-disk schema version and, when a migration is due, emits the flat leaves
 * as a single JSON document on stdout for the in-host `kk-migrate` skill to
 * cluster:
 *
 *   {"leaves":[{"id","title","kind","tags","summary","relates_to","sourcePath"}, ...]}
 *
 * When the knowledge base is already current (or absent) it reports "nothing to
 * do" and exits 0. The leaf facets are read by `readAllNodesFlat` (validated
 * frontmatter) so the skill never parses leaf files itself. Output is the JSON
 * payload only — written with `process.stdout` (not `log`) so no prefix/color
 * corrupts it — mirroring `rebalance trigger`'s machine-readable contract.
 */
export async function runPlaceInventory(): Promise<number> {
  const paths = repoPaths(findRepoRoot());

  const current = detectSchemaVersion(paths.nodesDir);
  if (current === null) {
    log.plain('No knowledge base found under nodes/; nothing to do.');
    return 0;
  }
  if (current >= NODE_SCHEMA_VERSION) {
    log.plain(`Knowledge base is already at schema_version ${current}; nothing to do.`);
    return 0;
  }

  // Migration is due: emit the flat leaves as JSON for the skill to cluster.
  const leaves = readAllNodesFlat(paths.nodesDir);
  // Machine-readable contract: exactly the JSON document on stdout, nothing
  // else. Use process.stdout (not `log`) so no prefix/color corrupts the JSON.
  process.stdout.write(`${JSON.stringify({ leaves })}\n`);
  return 0;
}

export interface PlaceApplyOptions {
  /** Path to the placement-and-folders JSON; reads stdin when omitted. */
  input?: string;
}

/**
 * The placement-and-folders document the in-host skill produces after
 * clustering. Same shape the clustering has always emitted: one placement per
 * leaf, plus an optional one-line authored `summary` per created folder. The
 * `folders` channel is validated against the folders the placements create
 * (see `reconcileFolderSummaries`) before any write.
 */
const PlacementInputSchema = z.object({
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
 * Deterministic, LLM-free apply primitive for the v1->v2 migration. Reads a
 * caller-supplied placement-and-folders JSON document (from `--input` or stdin),
 * validates every proposed id against the leaves actually on disk and every
 * authored folder summary against the folders the placements create — both
 * BEFORE any write — then relocates each leaf with its id and bytes preserved
 * and stamps the authored folder summaries. A bad plan (unknown/omitted id, or a
 * summary keyed to an uncreated folder) aborts with a clear message and makes
 * zero filesystem changes. It performs no clustering judgment, no LLM call, and
 * never stages, commits, or invokes git. The index rebuild is the skill's
 * subsequent step (`npx kenkeep index rebuild`), not this primitive's — matching
 * how curate drives `rebalance move` and then a separate rebuild.
 *
 * Emits a per-leaf `{"placed":[{"id","targetFolder"}, ...]}` summary on stdout
 * so the skill can surface it.
 */
export async function runPlaceApply(opts: PlaceApplyOptions = {}): Promise<number> {
  const paths = repoPaths(findRepoRoot());

  const raw = opts.input ? readFileSync(opts.input, 'utf8') : await readStdin();
  if (raw.trim() === '') {
    log.error('place apply: no placement document provided (pass --input <file> or pipe JSON).');
    return 1;
  }

  let parsed;
  try {
    parsed = PlacementInputSchema.parse(JSON.parse(raw));
  } catch (err) {
    log.error(`place apply: invalid placement document: ${(err as Error).message}`);
    return 1;
  }

  // sourcePath is filled in by reconcilePlacements against the read leaves.
  const proposed: Placement[] = parsed.placements.map(p => ({
    id: p.id,
    sourcePath: '',
    targetFolder: p.targetFolder,
  }));
  const folderSummaries: Record<string, string> = {};
  for (const f of parsed.folders ?? []) {
    if (f.summary.trim() !== '') folderSummaries[f.folder] = f.summary.trim();
  }

  let placed: { id: string; targetFolder: string }[];
  try {
    const leaves = readAllNodesFlat(paths.nodesDir);
    // Validate both channels BEFORE any write (abort-before-write guarantee):
    // reconcilePlacements throws on an unknown/omitted id; reconcileFolderSummaries
    // throws on a summary keyed to a folder no leaf is placed into.
    const placements = reconcilePlacements(leaves, proposed);
    reconcileFolderSummaries(folderSummaries, placements);
    // First write: relocate every leaf (all-or-nothing; ids and bytes preserved).
    const results = writePlacements(paths.nodesDir, placements);
    // Author the folder summaries: stamp each into its new folder's index.md so
    // the rebuild the skill runs next self-preserves it.
    for (const [folder, summary] of Object.entries(folderSummaries)) {
      if (folder.trim() === '') continue; // the nodes/ root carries ENTRY.md, not a folder index
      stampFolderSummary(paths.nodesDir, folder, summary);
    }
    placed = results.map(r => ({ id: r.id, targetFolder: r.targetFolder }));
  } catch (err) {
    log.error(`place apply: ${(err as Error).message}`);
    return 1;
  }

  // Structural summary: the legend the human reads alongside the diff.
  process.stdout.write(`${JSON.stringify({ placed })}\n`);
  return 0;
}
