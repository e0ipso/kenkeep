import { existsSync, mkdirSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import {
  folderSummariesFileForNodesDir,
  readFolderSummaries,
  renderFolderSummaries,
} from '../lib/folder-summaries.js';
import { generateGraph, generateIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { linkTargetResolver, renderGeneratedNodeSections } from '../lib/node-sections.js';
import { INDEX_FILENAME } from '../lib/nodes.js';
import { assertContained } from '../lib/path-safety.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
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
 * not written, and with no `graphFile` no graph is emitted.
 *
 * Preflight, then write. Every leaf is parsed and its v3 frontmatter and body
 * are rendered in memory first, and the id set is checked for duplicates, so
 * an unreadable leaf, an invalid id or two leaves sharing an id abort before
 * any file changes.
 *
 * Resumable: a run interrupted after rewriting some leaves leaves a mixed
 * tree the normal readers refuse. Re-running this primitive recognizes the
 * leaves already in the v3 shape, skips them and converts the rest, so ids,
 * edges and `kk_derived_from` survive the interruption. A run that failed
 * after its final leaf conversion is resumed the same way: `runMigrateOkfV3`
 * accepts the all-v3 tree while a v2 folder index remains or the entry
 * catalog, written last, is not yet v3. This
 * is the only place that recognition lives; `readAllNodes` stays strict.
 *
 * Mutates `nodesDir`. Callers that do not own the tree must copy it first.
 */
export function migrateNodesTreeToV3(
  nodesDir: string,
  artifacts: { entryFile?: string; graphFile?: string } = {}
): MigrationSummary {
  // Preflight: resolve the complete intended output in memory.
  const leaves = readMigrationLeaves(nodesDir);
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
  // Last write: a v3 entry catalog marks the run finished (see `runMigrateOkfV3`).
  if (artifacts.entryFile !== undefined) atomicWriteFile(artifacts.entryFile, index.rootCatalog);

  return {
    converted: outputs.length,
    already_converted: leaves.length - outputs.length,
    folder_summaries: folderSummaries,
    collisions,
  };
}

/**
 * True when every leaf is already v3 but the run that converted them never
 * finished its outputs: an earlier run converted the final leaf and then
 * failed writing the indexes, GRAPH.md or ENTRY.md. The evidence is a folder
 * index still in the v2 shape (v3 folder indexes carry no `schema_version`),
 * or an entry catalog, the migration's last write, that is missing or older
 * than v3. Re-running completes those outputs and leaves the converted leaf
 * bytes alone.
 */
function isUnfinishedMigration(
  current: number | null,
  nodesDir: string,
  entryFile: string
): boolean {
  if (current !== NODE_SCHEMA_VERSION) return false;
  const schemaVersionOf = (file: string): unknown =>
    (matter(readFileSync(file, 'utf8')).data as Record<string, unknown>).schema_version;
  if (!existsSync(entryFile) || schemaVersionOf(entryFile) !== NODE_SCHEMA_VERSION) return true;
  const hasV2Index = (dir: string): boolean =>
    readdirSyncSorted(dir).some(entry => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return hasV2Index(full);
      return entry.name === INDEX_FILENAME && schemaVersionOf(full) !== undefined;
    });
  return hasV2Index(nodesDir);
}

export async function runMigrateOkfV3(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const entryFile = join(paths.kkDir, 'ENTRY.md');
  const current = detectSchemaVersion(paths.nodesDir);
  if (
    current !== LEGACY_NODE_SCHEMA_VERSION &&
    !isUnfinishedMigration(current, paths.nodesDir, entryFile)
  ) {
    log.error(
      `migrate okf-v3: refusing to run: expected schema_version ${LEGACY_NODE_SCHEMA_VERSION}, ` +
        `detected ${current === null ? 'none' : current}. Run \`kenkeep migrate status\` for the pending chain.`
    );
    return 1;
  }

  let summary: MigrationSummary;
  try {
    summary = migrateNodesTreeToV3(paths.nodesDir, {
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
 * sharing an id, a symlinked leaf or index.md the run would replace) are
 * aggregated and thrown before any write.
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
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name === INDEX_FILENAME) {
        // Every folder index is regenerated; a symlink there would be replaced.
        const unsafe = uncontainedReason(nodesDir, full);
        if (unsafe !== null) failures.push(unsafe);
        continue;
      }
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
  if (failures.length > 0) {
    throw new Error(`refusing to migrate; fix these before re-running:\n${failures.join('\n')}`);
  }
  return leaves;
}

/** The containment boundary's refusal for a path the run will rewrite, or null. */
function uncontainedReason(nodesDir: string, path: string): string | null {
  try {
    assertContained(nodesDir, path);
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
