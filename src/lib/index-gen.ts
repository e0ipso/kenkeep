import { writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { computeNodesHash, readAllNodes, type NodeFile } from './nodes.js';
import { GraphFrontmatterSchema, IndexFrontmatterSchema, type NodeFrontmatter } from './schemas.js';

export const DEFAULT_BUDGET_TOKENS = 2000;
export const MIN_PER_KIND = 5;
export const RECENT_SUPERSEDED_LIMIT = 5;
const CHARS_PER_TOKEN = 4;

export interface GenerateOptions {
  budgetTokens?: number;
  now?: Date;
}

export interface GeneratedIndex {
  content: string;
  nodesHash: string;
  nodeCount: number;
  hiddenByBudget: number;
}

export interface GeneratedGraph {
  content: string;
  nodesHash: string;
  nodeCount: number;
}

/**
 * Rough token estimate. We currently use the documented 4-chars-per-token
 * fallback from IMPLEMENTATION.md §9; @anthropic-ai/tokenizer can be wired
 * in later without a schema change.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function isValid(fm: NodeFrontmatter): boolean {
  return fm.valid_until === null;
}

function partition(nodes: NodeFile[]): { valid: NodeFile[]; superseded: NodeFile[] } {
  const valid: NodeFile[] = [];
  const superseded: NodeFile[] = [];
  for (const n of nodes) {
    if (isValid(n.frontmatter)) valid.push(n);
    else superseded.push(n);
  }
  return { valid, superseded };
}

function sortByUpdatedDesc(a: NodeFile, b: NodeFile): number {
  if (a.frontmatter.updated === b.frontmatter.updated) {
    return a.frontmatter.id.localeCompare(b.frontmatter.id);
  }
  return a.frontmatter.updated < b.frontmatter.updated ? 1 : -1;
}

function relPathFromKb(node: NodeFile): string {
  // node.path looks like .../knowledge-base/nodes/<kind>/<slug>.md.
  const marker = '/nodes/';
  const idx = node.path.lastIndexOf(marker);
  if (idx < 0) return node.path;
  return `nodes/${node.path.slice(idx + marker.length)}`;
}

function renderBullet(n: NodeFile): string {
  const tags = n.frontmatter.tags.length > 0 ? ` (tags: ${n.frontmatter.tags.join(', ')})` : '';
  return `- **${n.frontmatter.title}** — ${n.frontmatter.summary} [\`${relPathFromKb(n)}\`]${tags}`;
}

/**
 * Render INDEX.md from the current state of `nodesDir`. Deterministic, no LLM.
 * Implements the token-budgeted layout in IMPLEMENTATION.md §8.
 */
export function generateIndex(nodesDir: string, opts: GenerateOptions = {}): GeneratedIndex {
  const budget = opts.budgetTokens ?? DEFAULT_BUDGET_TOKENS;
  const now = opts.now ?? new Date();
  const nodes = readAllNodes(nodesDir);
  const { valid, superseded } = partition(nodes);
  const validByKind: Record<'practice' | 'map', NodeFile[]> = { practice: [], map: [] };
  for (const n of valid) validByKind[n.frontmatter.kind].push(n);
  validByKind.practice.sort(sortByUpdatedDesc);
  validByKind.map.sort(sortByUpdatedDesc);
  superseded.sort(sortByUpdatedDesc);

  const hash = computeNodesHash(nodesDir);
  const nodeCount = nodes.length;
  const validCount = valid.length;
  const supersededCount = superseded.length;

  const header = `# KB Index\n\n_${nodeCount} nodes • ${validCount} currently valid • ${supersededCount} superseded • last updated ${now.toISOString()}_\n`;

  // Greedy budgeting: render all bullets, then trim oldest within each kind
  // (preserving at least MIN_PER_KIND) until we fit the budget. Hidden count
  // becomes a footer line.
  const sections: Array<{ heading: string; bullets: NodeFile[] }> = [
    { heading: '## Practice (how we build)', bullets: validByKind.practice.slice() },
    { heading: '## Map (what exists)', bullets: validByKind.map.slice() },
  ];

  const recentSuperseded = superseded.slice(0, RECENT_SUPERSEDED_LIMIT);
  let hidden = 0;
  let body = renderBody(header, sections, recentSuperseded, hidden);
  while (estimateTokens(body) > budget) {
    const trimmed = trimOldest(sections);
    if (!trimmed) break;
    hidden += 1;
    body = renderBody(header, sections, recentSuperseded, hidden);
  }

  const fm = IndexFrontmatterSchema.parse({
    schema_version: 1,
    generated_at: now.toISOString(),
    nodes_hash: `sha256:${hash}`,
    node_count: nodeCount,
    budget_tokens: budget,
  });
  const content = matter.stringify(body, fm);
  return { content, nodesHash: hash, nodeCount, hiddenByBudget: hidden };
}

function trimOldest(sections: Array<{ heading: string; bullets: NodeFile[] }>): boolean {
  // Pick the section with the largest bullet count above MIN_PER_KIND and
  // drop its oldest entry (the tail after sort-desc).
  let target: { heading: string; bullets: NodeFile[] } | null = null;
  for (const s of sections) {
    if (s.bullets.length <= MIN_PER_KIND) continue;
    if (!target || s.bullets.length > target.bullets.length) target = s;
  }
  if (!target) return false;
  target.bullets.pop();
  return true;
}

function renderBody(
  header: string,
  sections: Array<{ heading: string; bullets: NodeFile[] }>,
  recentSuperseded: NodeFile[],
  hidden: number,
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
  if (recentSuperseded.length > 0) {
    parts.push('');
    parts.push('## Recently superseded');
    for (const n of recentSuperseded) {
      const successor = n.frontmatter.superseded_by
        ? ` (superseded by ${n.frontmatter.superseded_by})`
        : '';
      parts.push(`- **${n.frontmatter.title}**${successor} [\`${relPathFromKb(n)}\`]`);
    }
  }
  if (hidden > 0) {
    parts.push('');
    parts.push(`_${hidden} additional nodes hidden by token budget — see GRAPH.md_`);
  }
  return parts.join('\n');
}

/**
 * Render GRAPH.md — full unfiltered edge listing. Deterministic.
 */
export function generateGraph(nodesDir: string, opts: GenerateOptions = {}): GeneratedGraph {
  const now = opts.now ?? new Date();
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
      const status = fm.valid_until === null ? 'valid' : 'superseded';
      lines.push(`## ${fm.id}`);
      lines.push('');
      lines.push(`- **kind:** ${fm.kind}`);
      lines.push(`- **status:** ${status}`);
      lines.push(`- **title:** ${fm.title}`);
      if (fm.tags.length > 0) lines.push(`- **tags:** ${fm.tags.join(', ')}`);
      if (fm.relates_to.length > 0) lines.push(`- **relates_to:** ${fm.relates_to.join(', ')}`);
      if (fm.depends_on.length > 0) lines.push(`- **depends_on:** ${fm.depends_on.join(', ')}`);
      if (fm.supersedes) lines.push(`- **supersedes:** ${fm.supersedes}`);
      if (fm.superseded_by) lines.push(`- **superseded_by:** ${fm.superseded_by}`);
      if (fm.derived_from.length > 0)
        lines.push(`- **derived_from:** ${fm.derived_from.join(', ')}`);
      lines.push('');
    }
  }

  const fm = GraphFrontmatterSchema.parse({
    schema_version: 1,
    generated_at: now.toISOString(),
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
