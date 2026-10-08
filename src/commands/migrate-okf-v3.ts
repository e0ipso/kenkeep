import { existsSync, mkdirSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { basename, dirname, join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import {
  folderSummariesFileForNodesDir,
  readFolderSummaries,
  renderFolderSummaries,
} from '../lib/folder-summaries.js';
import { computeOwnedFolderDirs, generateGraph, generateIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { linkTargetResolver, renderGeneratedNodeSections } from '../lib/node-sections.js';
import { INDEX_FILENAME } from '../lib/nodes.js';
import { assertContained } from '../lib/path-safety.js';
import { assertDefaultNodesRoot, findRepoRoot, repoPaths } from '../lib/paths.js';
import { readRedirectsLedger } from '../lib/redirects.js';
import {
  ConfidenceSchema,
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  NodeKindSchema,
  type NodeFrontmatter,
} from '../lib/schemas.js';

export const LEGACY_NODE_SCHEMA_VERSION = 2;

const V2NodeFrontmatterSchema = z.object({
  schema_version: z.literal(LEGACY_NODE_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string(),
  kind: NodeKindSchema,
  summary: z.string(),
  tags: z.array(z.string()).default([]),
  derived_from: z.array(z.string()).default([]),
  relates_to: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
});

/**
 * One leaf of the tree being migrated, with its v3 frontmatter resolved in
 * memory. `pending` leaves are still v2 on disk; `converted` leaves already
 * carry the v3 shape (a previous run was interrupted after writing them) and
 * are left byte-for-byte alone, but still take part in id uniqueness and
 * link resolution for the leaves that reference them.
 */
interface MigrationLeaf {
  path: string;
  relPath: string;
  frontmatter: NodeFrontmatter;
  body: string;
  state: 'pending' | 'converted';
}

interface MigrationSummary {
  converted: number;
  /** Leaves found already in the v3 shape and left untouched (a resumed run). */
  already_converted: number;
  folder_summaries: number;
  collisions: Array<{ id: string; path: string; headings: string[] }>;
}

/**
 * Convert one v2 node tree in place to v3, regenerating every folder index.
 *
 * Split out of `runMigrateOkfV3` so a knowledge pack's `knowledge/` tree can go
 * through the identical conversion: a v2 pack is otherwise unimportable, since
 * `validatePack` requires the manifest's schema_version to equal the installed
 * node schema exactly.
 *
 * `entryFile` and `graphFile` are the repo's kenkeep-owned artifacts. A pack
 * has neither, so both are optional: with no `entryFile` the root catalog is
 * not written, and with no `graphFile` no graph is emitted. `root` is the
 * directory the caller authorizes for the writes outside the tree: the
 * folder-summary sidecar, `entryFile` and `graphFile` must lie under it. It
 * defaults to the tree's parent, where the sidecar lives.
 *
 * Preflight, then write. Every leaf is parsed and its v3 frontmatter and body
 * are rendered in memory first, the id set is checked for duplicates, and
 * every path the run writes goes through the shared containment check, so an
 * unreadable leaf, an invalid id, two leaves sharing an id or a symlinked
 * output (dangling or not) abort before any file changes.
 *
 * Resumable: a run interrupted after rewriting some leaves leaves a mixed
 * tree the normal readers refuse. Re-running this primitive recognizes the
 * leaves already in the v3 shape, skips them and converts the rest, so ids,
 * edges and `kk_derived_from` survive the interruption. A run that failed
 * after its final leaf conversion leaves an all-v3 tree, and nothing on disk
 * proves its outputs were finished, so `runMigrateOkfV3` also runs on an
 * all-v3 tree: it converts nothing and regenerates every output. This is the
 * only place that recognition lives; `readAllNodes` stays strict.
 *
 * Mutates `nodesDir`. Callers that do not own the tree must copy it first.
 */
export function migrateNodesTreeToV3(
  nodesDir: string,
  artifacts: { root?: string; entryFile?: string; graphFile?: string } = {}
): MigrationSummary {
  // Preflight: resolve the complete intended output in memory.
  const leaves = readMigrationLeaves(nodesDir);
  refuseUnsafeOutputs(nodesDir, leaves, artifacts);
  const idToRelPath = new Map(leaves.map(leaf => [leaf.frontmatter.kk_id, leaf.relPath]));
  const resolveTargets = linkTargetResolver(idToRelPath, readRedirectsLedger(nodesDir));
  const collisions: MigrationSummary['collisions'] = [];
  const outputs: Array<{ path: string; content: string }> = [];
  for (const leaf of leaves) {
    if (leaf.state === 'converted') continue;
    const headings = collidingHeadings(leaf.body);
    if (headings.length > 0) {
      collisions.push({ id: leaf.frontmatter.kk_id, path: leaf.relPath, headings });
    }
    const body = renderGeneratedNodeSections(leaf.body, leaf.frontmatter, {
      leafRelPath: leaf.relPath,
      resolveTargets,
    });
    outputs.push({
      path: leaf.path,
      content: matter.stringify(body.trimEnd() + '\n', leaf.frontmatter),
    });
  }

  const folderSummaries = migrateFolderSummaries(nodesDir);
  for (const output of outputs) atomicWriteFile(output.path, output.content);

  const index = generateIndex(nodesDir, artifacts.entryFile);
  for (const folder of index.folders.values()) {
    const dir = folder.relDir === '' ? nodesDir : join(nodesDir, ...folder.relDir.split('/'));
    mkdirSync(dir, { recursive: true });
    atomicWriteFile(join(dir, INDEX_FILENAME), folder.content);
  }
  if (artifacts.graphFile !== undefined) {
    atomicWriteFile(artifacts.graphFile, generateGraph(nodesDir).content);
  }
  if (artifacts.entryFile !== undefined) atomicWriteFile(artifacts.entryFile, index.rootCatalog);

  return {
    converted: outputs.length,
    already_converted: leaves.length - outputs.length,
    folder_summaries: folderSummaries,
    collisions,
  };
}

export async function runMigrateOkfV3(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const entryFile = join(paths.kkDir, 'ENTRY.md');
  const current = detectSchemaVersion(paths.nodesDir);
  // An all-v3 tree is accepted too: an earlier run may have converted every
  // leaf and then failed before its outputs were written. Re-running it
  // converts nothing and regenerates the outputs.
  if (current !== LEGACY_NODE_SCHEMA_VERSION && current !== NODE_SCHEMA_VERSION) {
    log.error(
      `migrate okf-v3: refusing to run: expected schema_version ${LEGACY_NODE_SCHEMA_VERSION} ` +
        `(or ${NODE_SCHEMA_VERSION} to finish an interrupted run), detected ` +
        `${current === null ? 'none' : current}. Run \`kenkeep migrate status\` for the pending chain.`
    );
    return 1;
  }

  let summary: MigrationSummary;
  try {
    assertDefaultNodesRoot(paths);
    summary = migrateNodesTreeToV3(paths.nodesDir, {
      root: paths.kkDir,
      entryFile,
      graphFile: join(paths.kkDir, 'GRAPH.md'),
    });
  } catch (err) {
    log.error(`migrate okf-v3: ${(err as Error).message}`);
    log.error(
      'migrate okf-v3: fix the cause and re-run; leaves already converted to v3 are skipped.'
    );
    return 1;
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}

/**
 * Reads every leaf of the tree for the migration: a v2 leaf has its v3
 * frontmatter resolved in memory (`pending`), a leaf already in the current
 * v3 shape is kept as is (`converted`), and anything else is a failure. All
 * failures (unreadable frontmatter, an id the v3 schema rejects, two leaves
 * sharing an id, a symlinked v2 leaf the run would replace) are aggregated
 * and thrown before any write.
 */
function readMigrationLeaves(nodesDir: string): MigrationLeaf[] {
  if (!existsSync(nodesDir)) return [];
  const leaves: MigrationLeaf[] = [];
  const failures: string[] = [];
  const issuesOf = (error: z.ZodError): string =>
    error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  const walk = (dir: string): void => {
    for (const entry of readdirSyncSorted(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md') || entry.name === INDEX_FILENAME) continue;
      const relPath = relative(nodesDir, full).split(sep).join(posix.sep);
      const parsed = matter(readFileSync(full, 'utf8'));
      const v2 = V2NodeFrontmatterSchema.safeParse(parsed.data);
      if (v2.success) {
        const unsafe = uncontainedReason(nodesDir, full);
        if (unsafe !== null) {
          failures.push(unsafe);
          continue;
        }
        const v3 = v2ToV3Frontmatter(v2.data);
        if (!v3.success) {
          failures.push(`${full}: cannot convert to v3: ${issuesOf(v3.error)}`);
          continue;
        }
        leaves.push({
          path: full,
          relPath,
          frontmatter: v3.data,
          body: parsed.content,
          state: 'pending',
        });
        continue;
      }
      // Resume recognition: a leaf a previous, interrupted run already wrote.
      const v3 = NodeFrontmatterSchema.safeParse(parsed.data);
      if (v3.success) {
        leaves.push({
          path: full,
          relPath,
          frontmatter: v3.data,
          body: parsed.content,
          state: 'converted',
        });
        continue;
      }
      failures.push(
        `${full}: neither v2 frontmatter (${issuesOf(v2.error)}) nor already-converted v3 ` +
          `frontmatter (${issuesOf(v3.error)})`
      );
    }
  };
  walk(nodesDir);
  leaves.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const pathsById = new Map<string, string[]>();
  for (const leaf of leaves) {
    const id = leaf.frontmatter.kk_id;
    pathsById.set(id, [...(pathsById.get(id) ?? []), leaf.relPath]);
  }
  for (const [id, paths] of pathsById) {
    if (paths.length > 1) {
      failures.push(`more than one leaf carries id "${id}": ${paths.join(', ')}`);
    }
  }
  refuseIfFailed(failures);
  return leaves;
}

/**
 * Runs every output path the migration writes besides the v2 leaves through
 * the containment boundary before any write: each owned folder's `index.md`
 * under `nodesDir`, and the folder-summary sidecar, entry catalog and graph
 * under the caller's `root`. A symlink at any of them, dangling or not, would
 * be replaced, so all refusals are aggregated and thrown.
 */
function refuseUnsafeOutputs(
  nodesDir: string,
  leaves: readonly MigrationLeaf[],
  artifacts: { root?: string; entryFile?: string; graphFile?: string }
): void {
  const failures: string[] = [];
  const check = (root: string, path: string, label: string): void => {
    const unsafe = uncontainedReason(root, path, label);
    if (unsafe !== null) failures.push(unsafe);
  };
  const ownedDirs = computeOwnedFolderDirs(
    leaves.map(leaf => ({ relDir: posix.dirname(leaf.relPath).replace(/^\.$/u, '') }))
  );
  for (const dir of [...ownedDirs].sort((a, b) => a.localeCompare(b))) {
    check(nodesDir, join(nodesDir, ...dir.split('/').filter(Boolean), INDEX_FILENAME), 'nodes/');
  }
  const root = artifacts.root ?? dirname(nodesDir);
  const files = [
    folderSummariesFileForNodesDir(nodesDir),
    artifacts.entryFile,
    artifacts.graphFile,
  ];
  for (const file of files) {
    if (file !== undefined) check(root, file, `${basename(root)}/`);
  }
  refuseIfFailed(failures);
}

function refuseIfFailed(failures: readonly string[]): void {
  if (failures.length > 0) {
    throw new Error(`refusing to migrate; fix these before re-running:\n${failures.join('\n')}`);
  }
}

/** The containment boundary's refusal for a path the run will rewrite, or null. */
function uncontainedReason(root: string, path: string, label = 'nodes/'): string | null {
  try {
    assertContained(root, path, label);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

function readdirSyncSorted(dir: string): Dirent[] {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function v2ToV3Frontmatter(
  v2: z.infer<typeof V2NodeFrontmatterSchema>
): z.SafeParseReturnType<unknown, NodeFrontmatter> {
  return NodeFrontmatterSchema.safeParse({
    type: v2.kind,
    title: v2.title,
    description: v2.summary,
    tags: v2.tags,
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: v2.id,
    kk_derived_from: v2.derived_from,
    kk_relates_to: v2.relates_to,
    kk_depends_on: v2.depends_on,
    kk_confidence: v2.confidence,
  });
}

/**
 * Harvests the v2 folder summaries (kept in `index.md` frontmatter) into the
 * v3 sidecar registry, merged over whatever the sidecar already holds, so a
 * resumed run re-harvests the same values and the write is idempotent.
 */
function migrateFolderSummaries(nodesDir: string): number {
  const summaries = readFolderSummaries(nodesDir);
  const walk = (dir: string): void => {
    for (const entry of readdirSyncSorted(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== INDEX_FILENAME) continue;
      const parsed = matter(readFileSync(full, 'utf8'));
      const summary = typeof parsed.data.summary === 'string' ? parsed.data.summary.trim() : '';
      if (summary === '') continue;
      const folder = relative(nodesDir, dir).split(sep).join(posix.sep);
      summaries.set(folder === '.' ? '' : folder, summary);
    }
  };
  if (existsSync(nodesDir)) walk(nodesDir);
  atomicWriteFile(folderSummariesFileForNodesDir(nodesDir), renderFolderSummaries(summaries));
  return summaries.size;
}

function collidingHeadings(body: string): string[] {
  const headings: string[] = [];
  if (/^# Related\s*$/im.test(body) && !body.includes('<!-- kk:related:start -->')) {
    headings.push('Related');
  }
  if (/^# Citations\s*$/im.test(body) && !body.includes('<!-- kk:citations:start -->')) {
    headings.push('Citations');
  }
  return headings;
}
