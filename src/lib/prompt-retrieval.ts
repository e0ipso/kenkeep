/**
 * Deterministic prompt-time knowledge retrieval.
 *
 * Ranks the current on-disk leaf nodes under `nodes/` against a user prompt and
 * renders a small, bounded summaries-plus-links context block. This is the
 * shared core called by the prompt-time hooks (Claude / Codex `UserPromptSubmit`);
 * it is pure, one-shot, and local:
 *
 *   - no LLM call, no embeddings, no external service, no database;
 *   - no persistent store, no long-lived cache, no background worker;
 *   - the user prompt is never logged or persisted by this module.
 *
 * Retrieval reads the live `.ai/kenkeep/nodes/` tree through `readAllNodes`
 * (which already skips generated `index.md` files) and does NOT attempt to
 * distinguish committed accepted nodes from uncommitted curation drafts — that
 * matches every existing consume path.
 */
import { posix, sep } from 'node:path';
import { computeInDegree } from './index-gen.js';
import { readAllNodes, type NodeFile } from './nodes.js';
import { readRedirectsLedger, resolveRedirect } from './redirects.js';

/**
 * Field weights. Lexical relevance is primary: a prompt term matched in the
 * title/tags/summary outweighs the same term buried in the body. The graph
 * boost below is deliberately a fraction of the smallest field weight so edges
 * only nudge ordering, never override lexical relevance.
 */
export const TITLE_WEIGHT = 6;
export const TAG_WEIGHT = 5;
export const SUMMARY_WEIGHT = 3;
export const BODY_WEIGHT = 1;

/**
 * Small per-edge boost added to a node for each live graph neighbor
 * (`relates_to`/`depends_on`, resolved through redirects) that itself matched
 * the prompt lexically. Fractional so a node never out-ranks a directly matched
 * node on graph influence alone, but a cluster of matched neighbors can promote
 * a closely related node (neighbor expansion).
 */
export const GRAPH_NEIGHBOR_BOOST = 0.5;

/** Default cap on the number of nodes rendered into the prompt-time block. */
export const DEFAULT_MAX_NODES = 5;

/**
 * Default rendered-character budget for the whole block. The renderer keeps
 * adding whole entries until the next one would exceed this bound, so the
 * injected context stays small regardless of knowledge-base size.
 */
export const DEFAULT_MAX_CHARS = 1800;

/**
 * Minimal, fixed English stopword set. Dropping these from the prompt and node
 * fields keeps high-frequency function words from inflating every node's score.
 * Intentionally small and static so ranking stays deterministic and explainable;
 * no stemming (the repo has no stemmer helper).
 */
const STOPWORDS = new Set<string>([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'which',
  'with',
  'you',
  'your',
]);

/** One ranked retrieval match. `score` combines lexical weight and graph boost. */
export interface PromptMatch {
  node: NodeFile;
  score: number;
}

export interface RetrievalOptions {
  /** Maximum number of matches to return. Defaults to {@link DEFAULT_MAX_NODES}. */
  maxNodes?: number;
}

export interface RenderOptions {
  /** Rendered-character budget for the whole block. Defaults to {@link DEFAULT_MAX_CHARS}. */
  maxChars?: number;
}

export type PromptKnowledgeOptions = RetrievalOptions & RenderOptions;

/**
 * Lowercase, split on non-alphanumeric boundaries, drop terms shorter than two
 * characters, and drop stopwords. Deterministic and stem-free.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function tagTokenSet(tags: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const tag of tags) for (const t of tokenize(tag)) set.add(t);
  return set;
}

/** Per-field lexical score of one node against the distinct prompt terms. */
function lexicalScore(node: NodeFile, promptTerms: Set<string>): number {
  if (promptTerms.size === 0) return 0;
  const fm = node.frontmatter;
  const titleTokens = tokenSet(fm.title);
  const tagTokens = tagTokenSet(fm.tags);
  const summaryTokens = tokenSet(fm.description);
  const bodyTokens = tokenSet(node.body);
  let score = 0;
  for (const term of promptTerms) {
    if (titleTokens.has(term)) score += TITLE_WEIGHT;
    if (tagTokens.has(term)) score += TAG_WEIGHT;
    if (summaryTokens.has(term)) score += SUMMARY_WEIGHT;
    if (bodyTokens.has(term)) score += BODY_WEIGHT;
  }
  return score;
}

/**
 * Rank leaf nodes against `prompt`. Lexical scoring is primary; a small
 * undirected graph boost expands toward neighbors of matched nodes. Returns
 * matches with a positive combined score, sorted by score DESC, then global
 * `relates_to` in-degree (centrality) DESC, then id ASC — a stable order for the
 * same prompt and node tree.
 *
 * `nodes` reads the live tree; this may throw `InvalidNodeFrontmatterError` or
 * `OldLayoutError` from `readAllNodes`. Callers on the hook hot path catch and
 * fail open; tests assert the pure-function behavior directly.
 */
export function rankNodes(
  nodes: NodeFile[],
  prompt: string,
  options: RetrievalOptions = {}
): PromptMatch[] {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const promptTerms = tokenSet(prompt);
  if (promptTerms.size === 0 || nodes.length === 0) return [];

  const lexical = new Map<string, number>();
  for (const node of nodes) lexical.set(node.frontmatter.kk_id, lexicalScore(node, promptTerms));

  // Live id set plus the redirects ledger so a graph edge pointing at a retired
  // id still resolves to its live successor(s) for the boost.
  const live = new Set(nodes.map(n => n.frontmatter.kk_id));
  const ledger = readRedirectsLedger(nodesDirOf(nodes));

  // Undirected adjacency over relates_to ∪ depends_on, edges resolved to live
  // ids. Symmetric so an incoming edge from a matched node also boosts its
  // target (relevance is mutual for routing).
  const neighbors = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string): void => {
    if (from === to) return;
    (neighbors.get(from) ?? neighbors.set(from, new Set()).get(from)!).add(to);
    (neighbors.get(to) ?? neighbors.set(to, new Set()).get(to)!).add(from);
  };
  for (const node of nodes) {
    const fm = node.frontmatter;
    for (const ref of [...fm.kk_relates_to, ...fm.kk_depends_on]) {
      for (const target of resolveRedirect(ledger, live, ref)) addEdge(fm.kk_id, target);
    }
  }

  const inDegree = computeInDegree(nodes);
  const matches: PromptMatch[] = [];
  for (const node of nodes) {
    const id = node.frontmatter.kk_id;
    let score = lexical.get(id) ?? 0;
    for (const neighborId of neighbors.get(id) ?? []) {
      if ((lexical.get(neighborId) ?? 0) > 0) score += GRAPH_NEIGHBOR_BOOST;
    }
    if (score > 0) matches.push({ node, score });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dIn =
      (inDegree.get(b.node.frontmatter.kk_id) ?? 0) - (inDegree.get(a.node.frontmatter.kk_id) ?? 0);
    if (dIn !== 0) return dIn;
    return a.node.frontmatter.kk_id.localeCompare(b.node.frontmatter.kk_id);
  });
  return matches.slice(0, maxNodes);
}

/**
 * `readAllNodes` returns absolute `path`s; the redirects ledger lives at the
 * `nodes/` root. Derive that root from any leaf's absolute path and relPath.
 * Returns the empty string when there are no nodes (the ledger read then no-ops).
 */
function nodesDirOf(nodes: NodeFile[]): string {
  const first = nodes[0];
  if (!first) return '';
  // first.path ends with `<sep><relPath>` (platform-joined); strip the relPath
  // suffix to recover the nodes/ root directory.
  const suffix = first.relPath.split('/').join(sep);
  if (first.path.endsWith(suffix))
    return first.path.slice(0, first.path.length - suffix.length - 1);
  return '';
}

/** Repo-relative path rendered for a leaf, e.g. `.ai/kenkeep/nodes/topic/practice-foo.md`. */
function renderPath(node: NodeFile): string {
  return posix.join('.ai/kenkeep/nodes', node.relPath);
}

/** Collapse whitespace and neutralize inline-markdown break characters in spliced text. */
function inline(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\`[\]])/g, '\\$1');
}

const HEADER =
  '> kenkeep prompt-time knowledge: nodes likely relevant to this request. These are routing hints — open the linked node before relying on details, and verify any named file/function/flag against the live tree.';

/**
 * Render a compact summaries-plus-links block from ranked matches, bounded by
 * `maxChars`. Each entry carries the node title, id, repo-relative markdown
 * link, summary, and tags — never the full leaf body. Always renders at least
 * the top match when any exist (a single over-budget entry is not silently
 * dropped); subsequent entries are added only while the running total stays
 * within budget. Returns the empty string for no matches.
 */
export function renderPromptKnowledgeContext(
  matches: PromptMatch[],
  options: RenderOptions = {}
): string {
  if (matches.length === 0) return '';
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const lines = [HEADER, ''];
  let total = lines.join('\n').length;
  let rendered = 0;
  for (const { node } of matches) {
    const fm = node.frontmatter;
    const tagPart = fm.tags.length > 0 ? ` ${fm.tags.map(t => `#${t}`).join(' ')}` : '';
    const summary = inline(fm.description);
    const summaryPart = summary ? ` — ${summary}` : '';
    const entry = `- [**${inline(fm.title)}**](${renderPath(node)}) (\`${fm.kk_id}\`)${summaryPart}${tagPart}`;
    // Always keep the first entry; gate the rest on the char budget.
    if (rendered > 0 && total + entry.length + 1 > maxChars) break;
    lines.push(entry);
    total += entry.length + 1;
    rendered += 1;
  }
  return lines.join('\n') + '\n';
}

/**
 * One-shot convenience for the prompt-time hooks: read the live node tree, rank
 * it against the prompt, and render the bounded block. Returns the empty string
 * when the prompt is empty, the knowledge base is missing/empty, or nothing is
 * relevant. May throw from `readAllNodes` (malformed/legacy KB); the hook layer
 * catches and fails open.
 */
export function buildPromptKnowledgeContext(
  nodesDir: string,
  prompt: string,
  options: PromptKnowledgeOptions = {}
): string {
  if (prompt.trim().length === 0) return '';
  const nodes = readAllNodes(nodesDir);
  const matches = rankNodes(nodes, prompt, options);
  return renderPromptKnowledgeContext(matches, options);
}
