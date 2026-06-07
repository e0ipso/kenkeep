import { writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import matter from 'gray-matter';
import {
  computeNodesHash,
  hashLeaves,
  readAllNodes,
  type NodeFile,
} from './nodes.js';
import { GraphFrontmatterSchema, IndexFrontmatterSchema, NODE_SCHEMA_VERSION } from './schemas.js';

const CHARS_PER_TOKEN = 4;

/**
 * Deterministic per-folder metrics computed during index generation. This plan
 * computes and exposes them; acting on them (rebalance) is a later plan.
 */
export interface FolderMetrics {
  /** Number of leaf nodes directly in this folder (not its subfolders). */
  occupancy: number;
  /** Distinct tags across this folder's direct leaves. */
  tagDiversity: number;
  /** Estimated tokens across this folder's direct leaves. */
  leafSize: number;
}

/** One generated `index.md` body plus the folder's metrics. */
export interface FolderIndex {
  /** POSIX-style directory relative to `nodes/` (empty string = root). */
  relDir: string;
  content: string;
  metrics: FolderMetrics;
}

export interface GeneratedIndex {
  /**
   * One generated `index.md` body per directory under `nodes/` (root included),
   * keyed by POSIX-style directory relative to `nodes/` (empty string = root).
   * Each folder index node records a PER-FOLDER `nodes_hash` (over that folder's
   * direct leaves) so a leaf edit only churns its own folder's index.
   */
  folders: Map<string, FolderIndex>;
  /**
   * The root catalog body for `.ai/kenkeep/INDEX.md`: identical layout to the
   * `nodes/` root index node, but its frontmatter records the GLOBAL
   * `nodes_hash` (over the whole leaf set). The SessionStart hook and `doctor`
   * compare this global hash to detect staleness, so the catalog must carry it.
   */
  rootCatalog: string;
  /** Global hash over the whole leaf set (excludes generated index.md). */
  nodesHash: string;
  nodeCount: number;
}

export interface GeneratedGraph {
  content: string;
  nodesHash: string;
  nodeCount: number;
}

/**
 * Count incoming `relates_to` edges per node id, globally across the whole leaf
 * set so ordering inside any folder reflects the full graph, not just local
 * edges.
 */
export function computeInDegree(nodes: NodeFile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of nodes) m.set(n.frontmatter.id, 0);
  for (const n of nodes) {
    for (const targetId of n.frontmatter.relates_to) {
      m.set(targetId, (m.get(targetId) ?? 0) + 1);
    }
  }
  return m;
}

function renderBullet(n: NodeFile): string {
  const tagPart = n.frontmatter.tags.map(t => ` #${t}`).join('');
  const summary = n.frontmatter.summary.trim();
  const summaryPart = summary ? ` ${summary}` : '';
  return `- **${n.frontmatter.title}** [\`${n.relPath}\`]${summaryPart}${tagPart}`;
}

function makeCatalogComparator(inDegree: Map<string, number>) {
  return (a: NodeFile, b: NodeFile): number => {
    const d = (inDegree.get(b.frontmatter.id) ?? 0) - (inDegree.get(a.frontmatter.id) ?? 0);
    if (d !== 0) return d;
    return a.frontmatter.title.localeCompare(b.frontmatter.title);
  };
}

/**
 * Render the `## By topic` block for a set of leaves. Tag buckets are sorted by
 * bucket size DESC then alpha; titles within a bucket by in-degree DESC then
 * alpha.
 */
export function renderTagIndex(nodes: NodeFile[], inDegree: Map<string, number>): string {
  const buckets = new Map<string, NodeFile[]>();
  for (const n of nodes) {
    for (const t of n.frontmatter.tags) {
      let bucket = buckets.get(t);
      if (!bucket) {
        bucket = [];
        buckets.set(t, bucket);
      }
      bucket.push(n);
    }
  }
  const tags = [...buckets.keys()].sort((a, b) => {
    const da = buckets.get(a)!.length;
    const db = buckets.get(b)!.length;
    if (db !== da) return db - da;
    return a.localeCompare(b);
  });
  const lines: string[] = ['## By topic', ''];
  if (tags.length === 0) {
    lines.push('_No tags yet._');
    return lines.join('\n');
  }
  const titleCmp = makeCatalogComparator(inDegree);
  for (const tag of tags) {
    const titles = buckets
      .get(tag)!
      .slice()
      .sort(titleCmp)
      .map(n => n.frontmatter.title);
    lines.push(`- **#${tag} (${titles.length}):** ${titles.join(', ')}`);
  }
  return lines.join('\n');
}

function estimateTokens(nodes: NodeFile[]): number {
  let chars = 0;
  for (const n of nodes) {
    chars += n.frontmatter.title.length;
    chars += n.frontmatter.summary.length;
    chars += n.body.length;
  }
  return Math.max(0, Math.ceil(chars / CHARS_PER_TOKEN));
}

/**
 * Deterministic intent line for a subfolder. Derived purely from the folder
 * name (its leaf segment, de-slugified). No curated "folder intent" line yet;
 * that arrives with the rebalance work.
 */
function deterministicIntent(relDir: string): string {
  const leaf = relDir.split('/').pop() ?? relDir;
  const words = leaf
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(' ') : leaf;
}

/**
 * Generate one deterministic `index.md` body per directory under `nodesDir`,
 * recursively, as a pure function of the leaf set. Each
 * body rolls up its own directory only: child leaf nodes (title, summary, tags)
 * and child subfolders (a deterministic intent line plus rollup stats), ordered
 * by global graph in-degree then title.
 *
 * "Path is presentation, id is identity": every leaf renders its current path
 * (resolved by id), so later relocation never breaks a reference.
 */
export function generateIndex(nodesDir: string): GeneratedIndex {
  const nodes = readAllNodes(nodesDir);
  const inDegree = computeInDegree(nodes);
  const cmp = makeCatalogComparator(inDegree);

  const hash = computeNodesHash(nodesDir);
  const nodeCount = nodes.length;

  // Every directory that must carry an index.md: the root, every leaf's
  // directory, and every ancestor directory between them.
  const dirs = new Set<string>(['']);
  for (const n of nodes) {
    const segments = n.relDir === '' ? [] : n.relDir.split('/');
    let acc = '';
    for (const seg of segments) {
      acc = acc === '' ? seg : `${acc}/${seg}`;
      dirs.add(acc);
    }
  }

  const leavesByDir = new Map<string, NodeFile[]>();
  for (const dir of dirs) leavesByDir.set(dir, []);
  for (const n of nodes) leavesByDir.get(n.relDir)!.push(n);

  const folders = new Map<string, FolderIndex>();
  const sortedDirs = [...dirs].sort((a, b) => a.localeCompare(b));
  for (const dir of sortedDirs) {
    const leaves = (leavesByDir.get(dir) ?? []).slice().sort(cmp);
    const subDirs = [...dirs]
      .filter(d => {
        // Immediate children of `dir` only.
        const rest = dir === '' ? d : d.startsWith(`${dir}/`) ? d.slice(dir.length + 1) : '';
        return rest !== '' && !rest.includes('/');
      })
      .sort((a, b) => a.localeCompare(b));

    const content = renderFolderIndex({
      relDir: dir,
      leaves,
      subDirs,
      leavesByDir,
      inDegree,
      // Per-folder hash: a leaf edit only perturbs the hash recorded in that
      // leaf's own folder index, leaving unrelated folder indexes byte-stable.
      nodesHash: hashLeaves(leaves),
    });
    const metrics: FolderMetrics = {
      occupancy: leaves.length,
      tagDiversity: distinctTagCount(leaves),
      leafSize: estimateTokens(leaves),
    };
    folders.set(dir, { relDir: dir, content, metrics });
  }

  // Root catalog for .ai/kenkeep/INDEX.md: same layout as the nodes/ root index
  // node, but stamped with the GLOBAL hash so SessionStart/doctor staleness
  // checks compare against the whole leaf set.
  const rootLeaves = (leavesByDir.get('') ?? []).slice().sort(cmp);
  const rootSubDirs = [...dirs]
    .filter(d => d !== '' && !d.includes('/'))
    .sort((a, b) => a.localeCompare(b));
  const rootCatalog = renderFolderIndex({
    relDir: '',
    leaves: rootLeaves,
    subDirs: rootSubDirs,
    leavesByDir,
    inDegree,
    nodesHash: hash,
  });

  return { folders, rootCatalog, nodesHash: hash, nodeCount };
}

function distinctTagCount(leaves: NodeFile[]): number {
  const tags = new Set<string>();
  for (const n of leaves) for (const t of n.frontmatter.tags) tags.add(t);
  return tags.size;
}

interface RenderFolderArgs {
  relDir: string;
  leaves: NodeFile[];
  subDirs: string[];
  leavesByDir: Map<string, NodeFile[]>;
  inDegree: Map<string, number>;
  nodesHash: string;
}

function renderFolderIndex(args: RenderFolderArgs): string {
  const { relDir, leaves, subDirs, leavesByDir, inDegree } = args;
  const cmp = makeCatalogComparator(inDegree);

  const byKind: Record<'practice' | 'map', NodeFile[]> = { practice: [], map: [] };
  for (const n of leaves) byKind[n.frontmatter.kind].push(n);
  byKind.practice.sort(cmp);
  byKind.map.sort(cmp);

  const title = relDir === '' ? 'kenkeep Index' : `kenkeep Index: ${relDir.split('/').join(' / ')}`;
  const estimatedTokens = estimateTokens(leaves);
  const parts: string[] = [];
  parts.push(`# ${title}`);
  parts.push('');
  parts.push(`_${leaves.length} node(s) in this folder • ~${estimatedTokens} estimated tokens_`);

  // Subfolders section: deterministic intent line plus rollup stats.
  parts.push('');
  parts.push('## Subfolders');
  if (subDirs.length === 0) {
    parts.push('_None._');
  } else {
    for (const sub of subDirs) {
      const stats = rollupStats(sub, leavesByDir);
      const name = sub.split('/').pop() ?? sub;
      parts.push(
        `- **${name}/** [\`${posix.join('nodes', sub, 'index.md')}\`] ${deterministicIntent(
          sub
        )} (${stats.directLeaves} node(s) here, ${stats.totalLeaves} in subtree)`
      );
    }
  }

  // Leaf sections, split by kind facet.
  const sections: Array<{ heading: string; bullets: NodeFile[] }> = [
    { heading: '## Conventions (how we build)', bullets: byKind.practice },
    { heading: '## Components (what exists)', bullets: byKind.map },
  ];
  for (const s of sections) {
    parts.push('');
    parts.push(s.heading);
    if (s.bullets.length === 0) {
      parts.push('_None yet._');
    } else {
      for (const b of s.bullets) parts.push(renderBullet(b));
    }
  }

  parts.push('');
  parts.push(renderTagIndex(leaves, inDegree));

  const body = parts.join('\n');
  const fm = IndexFrontmatterSchema.parse({
    schema_version: NODE_SCHEMA_VERSION,
    nodes_hash: `sha256:${args.nodesHash}`,
    node_count: leaves.length,
  });
  return matter.stringify(body, fm);
}

interface RollupStats {
  /** Leaves directly in the subfolder. */
  directLeaves: number;
  /** Leaves anywhere in the subfolder's subtree. */
  totalLeaves: number;
}

function rollupStats(subDir: string, leavesByDir: Map<string, NodeFile[]>): RollupStats {
  let directLeaves = 0;
  let totalLeaves = 0;
  const prefix = `${subDir}/`;
  for (const [dir, leaves] of leavesByDir) {
    if (dir === subDir) {
      directLeaves = leaves.length;
      totalLeaves += leaves.length;
    } else if (dir.startsWith(prefix)) {
      totalLeaves += leaves.length;
    }
  }
  return { directLeaves, totalLeaves };
}

/**
 * Render GRAPH.md, the full unfiltered edge listing by id. Deterministic.
 * References are by id; the listing is the cross-tree DAG overlay.
 */
export function generateGraph(nodesDir: string): GeneratedGraph {
  const nodes = readAllNodes(nodesDir);
  nodes.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  const hash = computeNodesHash(nodesDir);

  const lines: string[] = [`# kenkeep Graph`, ''];
  if (nodes.length === 0) {
    lines.push('_No nodes yet._');
  } else {
    lines.push(`Total nodes: ${nodes.length}`);
    lines.push('');
    for (const n of nodes) {
      const fm = n.frontmatter;
      lines.push(`## ${fm.id}`);
      lines.push('');
      lines.push(`- **kind:** ${fm.kind}`);
      lines.push(`- **title:** ${fm.title}`);
      lines.push(`- **path:** ${n.relPath}`);
      if (fm.tags.length > 0) lines.push(`- **tags:** ${fm.tags.join(', ')}`);
      if (fm.relates_to.length > 0) lines.push(`- **relates_to:** ${fm.relates_to.join(', ')}`);
      if (fm.derived_from.length > 0)
        lines.push(`- **derived_from:** ${fm.derived_from.join(', ')}`);
      lines.push('');
    }
  }

  const fm = GraphFrontmatterSchema.parse({
    schema_version: NODE_SCHEMA_VERSION,
    nodes_hash: `sha256:${hash}`,
    node_count: nodes.length,
  });
  const content = matter.stringify(lines.join('\n'), fm);
  return { content, nodesHash: hash, nodeCount: nodes.length };
}

export function writeIndex(file: string, content: string): void {
  writeFileSync(file, content);
}

export function writeGraph(file: string, generated: GeneratedGraph): void {
  writeFileSync(file, generated.content);
}
