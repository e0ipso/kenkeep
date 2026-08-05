import { existsSync, mkdirSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import { readFolderSummaries, writeFolderSummaries } from '../lib/folder-summaries.js';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { renderGeneratedNodeSections } from '../lib/node-sections.js';
import { INDEX_FILENAME } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
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

interface V2Leaf {
  path: string;
  relPath: string;
  frontmatter: z.infer<typeof V2NodeFrontmatterSchema>;
  body: string;
}

interface MigrationSummary {
  converted: number;
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
 * Mutates `nodesDir`. Callers that do not own the tree must copy it first.
 * Throws on unreadable v2 frontmatter or a failed regeneration.
 */
export function migrateNodesTreeToV3(
  nodesDir: string,
  artifacts: { entryFile?: string; graphFile?: string } = {}
): MigrationSummary {
  const leaves = readV2Leaves(nodesDir);
  const folderSummaries = migrateFolderSummaries(nodesDir);
  const idToRelPath = new Map(leaves.map(leaf => [leaf.frontmatter.id, leaf.relPath]));
  const collisions: MigrationSummary['collisions'] = [];

  for (const leaf of leaves) {
    const frontmatter = v2ToV3Frontmatter(leaf.frontmatter);
    const headings = collidingHeadings(leaf.body);
    if (headings.length > 0) {
      collisions.push({ id: frontmatter.kk_id, path: leaf.relPath, headings });
    }
    const body = renderGeneratedNodeSections(
      leaf.body,
      frontmatter,
      id => idToRelPath.get(id) ?? null
    );
    atomicWriteFile(leaf.path, matter.stringify(body.trimEnd() + '\n', frontmatter));
  }

  const index = generateIndex(nodesDir, artifacts.entryFile);
  for (const folder of index.folders.values()) {
    const dir = folder.relDir === '' ? nodesDir : join(nodesDir, ...folder.relDir.split('/'));
    mkdirSync(dir, { recursive: true });
    writeIndex(join(dir, INDEX_FILENAME), folder.content);
  }
  if (artifacts.entryFile !== undefined) writeIndex(artifacts.entryFile, index.rootCatalog);
  if (artifacts.graphFile !== undefined) writeGraph(artifacts.graphFile, generateGraph(nodesDir));

  return { converted: leaves.length, folder_summaries: folderSummaries, collisions };
}

export async function runMigrateOkfV3(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const current = detectSchemaVersion(paths.nodesDir);
  if (current !== LEGACY_NODE_SCHEMA_VERSION) {
    log.error(
      `migrate okf-v3: refusing to run: expected schema_version ${LEGACY_NODE_SCHEMA_VERSION}, ` +
        `detected ${current === null ? 'none' : current}. Run \`kenkeep migrate status\` for the pending chain.`
    );
    return 1;
  }

  let summary: MigrationSummary;
  try {
    summary = migrateNodesTreeToV3(paths.nodesDir, {
      entryFile: join(paths.kkDir, 'ENTRY.md'),
      graphFile: join(paths.kkDir, 'GRAPH.md'),
    });
  } catch (err) {
    log.error(`migrate okf-v3: ${(err as Error).message}`);
    return 1;
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}

function readV2Leaves(nodesDir: string): V2Leaf[] {
  if (!existsSync(nodesDir)) return [];
  const leaves: V2Leaf[] = [];
  const failures: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSyncSorted(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md') || entry.name === INDEX_FILENAME) continue;
      const parsed = matter(readFileSync(full, 'utf8'));
      const result = V2NodeFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        failures.push(
          `${full}: ${result.error.issues
            .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ')}`
        );
        continue;
      }
      leaves.push({
        path: full,
        relPath: relative(nodesDir, full).split(sep).join(posix.sep),
        frontmatter: result.data,
        body: parsed.content,
      });
    }
  };
  walk(nodesDir);
  if (failures.length > 0) {
    throw new Error(`invalid v2 node frontmatter:\n${failures.join('\n')}`);
  }
  leaves.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return leaves;
}

function readdirSyncSorted(dir: string): Dirent[] {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
}

function v2ToV3Frontmatter(v2: z.infer<typeof V2NodeFrontmatterSchema>): NodeFrontmatter {
  return NodeFrontmatterSchema.parse({
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
  writeFolderSummaries(nodesDir, summaries);
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
