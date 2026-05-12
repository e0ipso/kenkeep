import { writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { computeNodesHash, readAllNodes, type NodeFile } from './nodes.js';
import { GraphFrontmatterSchema, IndexFrontmatterSchema } from './schemas.js';

const CHARS_PER_TOKEN = 4;

export interface GeneratedIndex {
  content: string;
  nodesHash: string;
  nodeCount: number;
}

export interface GeneratedGraph {
  content: string;
  nodesHash: string;
  nodeCount: number;
}

function relPathFromKb(node: NodeFile): string {
  const marker = '/nodes/';
  const idx = node.path.lastIndexOf(marker);
  if (idx < 0) return node.path;
  return `nodes/${node.path.slice(idx + marker.length)}`;
}

/**
 * Count incoming `relates_to` + `depends_on` edges per node id.
 */
export function computeInDegree(nodes: NodeFile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of nodes) m.set(n.frontmatter.id, 0);
  for (const n of nodes) {
    const edges = [...n.frontmatter.relates_to, ...n.frontmatter.depends_on];
    for (const targetId of edges) {
      m.set(targetId, (m.get(targetId) ?? 0) + 1);
    }
  }
  return m;
}

function renderBullet(n: NodeFile): string {
  const tagPart = n.frontmatter.tags.map(t => ` #${t}`).join('');
  return `- **${n.frontmatter.title}** [\`${relPathFromKb(n)}\`]${tagPart}`;
}

function makeCatalogComparator(inDegree: Map<string, number>) {
  return (a: NodeFile, b: NodeFile): number => {
    const d = (inDegree.get(b.frontmatter.id) ?? 0) - (inDegree.get(a.frontmatter.id) ?? 0);
    if (d !== 0) return d;
    return a.frontmatter.title.localeCompare(b.frontmatter.title);
  };
}

/**
 * Render the `## By topic` block. Tag buckets are sorted by bucket size DESC
 * then alpha; titles within a bucket by in-degree DESC then alpha.
 */
export function renderTagIndex(
  nodes: NodeFile[],
  inDegree: Map<string, number>
): string {
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
 * Render INDEX.md from the current state of `nodesDir`. Deterministic, no LLM.
 * INDEX is a catalog: every node appears, sorted by graph in-degree
 * within each section. See IMPLEMENTATION.md §8.
 */
export function generateIndex(nodesDir: string): GeneratedIndex {
  const nodes = readAllNodes(nodesDir);
  const inDegree = computeInDegree(nodes);

  const byKind: Record<'practice' | 'map', NodeFile[]> = { practice: [], map: [] };
  for (const n of nodes) byKind[n.frontmatter.kind].push(n);
  const cmp = makeCatalogComparator(inDegree);
  byKind.practice.sort(cmp);
  byKind.map.sort(cmp);

  const hash = computeNodesHash(nodesDir);
  const nodeCount = nodes.length;
  const estimatedTokens = estimateTokens(nodes);

  const sections: Array<{ heading: string; bullets: NodeFile[] }> = [
    { heading: '## Conventions (how we build)', bullets: byKind.practice },
    { heading: '## Components (what exists)', bullets: byKind.map },
  ];

  const tagBlock = renderTagIndex(nodes, inDegree);

  const header = `# KB Index\n\n_${nodeCount} nodes • ~${estimatedTokens} estimated tokens_\n`;
  const body = renderBody(header, sections, tagBlock);

  const fm = IndexFrontmatterSchema.parse({
    schema_version: 1,
    nodes_hash: `sha256:${hash}`,
    node_count: nodeCount,
  });
  const content = matter.stringify(body, fm);
  return { content, nodesHash: hash, nodeCount };
}

function renderBody(
  header: string,
  sections: Array<{ heading: string; bullets: NodeFile[] }>,
  tagBlock: string
): string {
  const parts: string[] = [header];
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
  parts.push(tagBlock);
  return parts.join('\n');
}

/**
 * Render GRAPH.md, the full unfiltered edge listing. Deterministic.
 */
export function generateGraph(nodesDir: string): GeneratedGraph {
  const nodes = readAllNodes(nodesDir);
  nodes.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
  const hash = computeNodesHash(nodesDir);

  const lines: string[] = [`# KB Graph`, ''];
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
      if (fm.tags.length > 0) lines.push(`- **tags:** ${fm.tags.join(', ')}`);
      if (fm.relates_to.length > 0) lines.push(`- **relates_to:** ${fm.relates_to.join(', ')}`);
      if (fm.depends_on.length > 0) lines.push(`- **depends_on:** ${fm.depends_on.join(', ')}`);
      if (fm.derived_from.length > 0)
        lines.push(`- **derived_from:** ${fm.derived_from.join(', ')}`);
      lines.push('');
    }
  }

  const fm = GraphFrontmatterSchema.parse({
    schema_version: 1,
    nodes_hash: `sha256:${hash}`,
    node_count: nodes.length,
  });
  const content = matter.stringify(lines.join('\n'), fm);
  return { content, nodesHash: hash, nodeCount: nodes.length };
}

export function writeIndex(file: string, generated: GeneratedIndex): void {
  writeFileSync(file, generated.content);
}

export function writeGraph(file: string, generated: GeneratedGraph): void {
  writeFileSync(file, generated.content);
}
