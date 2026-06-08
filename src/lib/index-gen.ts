import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import matter from 'gray-matter';
import {
  computeNodesHash,
  hashLeaves,
  INDEX_FILENAME,
  readAllNodes,
  type NodeFile,
} from './nodes.js';
import { GraphFrontmatterSchema, IndexFrontmatterSchema, NODE_SCHEMA_VERSION } from './schemas.js';
import { KK_NAVIGATION_DIRECTIVE } from './session-start.js';

const CHARS_PER_TOKEN = 4;

/**
 * The single embedded descent directive rendered into every generated body
 * (per-folder `index.md` and the root `ENTRY.md`). Derived deterministically
 * from the one source of truth `KK_NAVIGATION_DIRECTIVE`: it is already a single
 * `> `-prefixed line, so it is embedded verbatim rather than duplicated as a
 * second literal. The SessionStart hook stops appending it once a body carries
 * it (Task 3), keeping the injected catalog at exactly one occurrence.
 */
const EMBEDDED_DESCENT_DIRECTIVE = KK_NAVIGATION_DIRECTIVE;

/**
 * The cap on nodes listed per tag in the reworked `## By topic`: a bounded,
 * followable "most relevant nodes for this topic" surface rather than a
 * link-less histogram.
 */
const BY_TOPIC_MAX_PER_TAG = 3;

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
   * The purpose-built entry catalog body for `.ai/kenkeep/ENTRY.md`: the
   * always-injected launchpad. Unlike a per-folder `index.md` (which rolls up
   * only its own direct leaves, leaving three empty sections at the root where
   * no leaves live directly), it carries whole-tree totals and the branch list,
   * and nothing more. Its frontmatter records the GLOBAL `nodes_hash` (over the
   * whole leaf set); the SessionStart hook and `doctor` compare this global hash
   * to detect staleness, so the catalog must carry it.
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

/**
 * Imperative leaf pointer: a verb-first invitation to open a terminal leaf,
 * splicing in the leaf's own summary so the reader knows what they will get
 * before following the link. Uses valid `[label](path)` Markdown so the link is
 * followable (the work order's `(label)[path]` sketch renders as literal text).
 */
function renderLeafPointer(n: NodeFile): string {
  const tagPart = n.frontmatter.tags.map(t => ` #${t}`).join('');
  const summary = n.frontmatter.summary.trim();
  const learn = summary ? ` to learn about: ${summary}` : '';
  return `- Open [**${n.frontmatter.title}**](${n.relPath})${learn}${tagPart}`;
}

/**
 * Imperative descent pointer: a verb-first invitation to descend into a child
 * folder, splicing in that child folder's self-preserved summary (or the
 * Title-cased name fallback when absent). The sentence ends with a single
 * period; an authored summary that already ends in terminal punctuation is not
 * double-punctuated.
 */
function renderDescentPointer(sub: string, childSummary: string | undefined): string {
  const href = posix.join('nodes', sub, 'index.md');
  const name = sub.split('/').pop() ?? sub;
  const phrase = childSummary?.trim() || deterministicIntent(sub);
  const tail = /[.!?]$/.test(phrase) ? '' : '.';
  return `- Load [\`${name}/\`](${href}) for more information on ${phrase}${tail}`;
}

/**
 * Jaccard overlap of two tag sets: `|A∩B| / |A∪B|`. The proximity metric for
 * the reworked `## By topic` ranking. Two nodes with no tags (empty ∪) have
 * zero proximity.
 */
function tagJaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function makeCatalogComparator(inDegree: Map<string, number>) {
  return (a: NodeFile, b: NodeFile): number => {
    const d = (inDegree.get(b.frontmatter.id) ?? 0) - (inDegree.get(a.frontmatter.id) ?? 0);
    if (d !== 0) return d;
    return a.frontmatter.title.localeCompare(b.frontmatter.title);
  };
}

/**
 * Render the reworked `## By topic` block: a followable, bounded "most relevant
 * nodes for this topic" surface, NOT a link-less histogram.
 *
 * The bucket set is the tags present among the FOLDER'S DIRECT leaves (`leaves`)
 * — unchanged bucket selection and order (bucket size DESC over the direct
 * leaves, then alpha). For each such tag, candidates are drawn from the WHOLE
 * tree (`allNodes`): every node carrying the tag. Each candidate is scored by
 * its centrality within that tag's whole-tree cohort — the summed tag-Jaccard
 * against the other cohort members — so the most topically representative nodes
 * rise. The top `BY_TOPIC_MAX_PER_TAG` are rendered as followable
 * `Open [**title**](path) — <summary>` entries. Ties break by global in-degree
 * DESC then title, keeping the output deterministic and total.
 *
 * The whole-tree candidate pull means a distant tag change can reorder this
 * block; that is intentional. The block's bytes are NOT fed into the per-folder
 * `hashLeaves`, so cross-tree churn never perturbs this folder's stability hash
 * (paired with the Task 1 hash boundary).
 */
export function renderTagIndex(
  leaves: NodeFile[],
  allNodes: NodeFile[],
  inDegree: Map<string, number>
): string {
  // Bucket selection/order: the folder's own direct leaves (unchanged).
  const directBuckets = new Map<string, number>();
  for (const n of leaves) {
    for (const t of n.frontmatter.tags) {
      directBuckets.set(t, (directBuckets.get(t) ?? 0) + 1);
    }
  }
  const tags = [...directBuckets.keys()].sort((a, b) => {
    const da = directBuckets.get(a)!;
    const db = directBuckets.get(b)!;
    if (db !== da) return db - da;
    return a.localeCompare(b);
  });

  const lines: string[] = ['## By topic', ''];
  if (tags.length === 0) {
    lines.push('_No tags yet._');
    return lines.join('\n');
  }

  // Whole-tree cohorts: every node carrying a given tag.
  const cohorts = new Map<string, NodeFile[]>();
  for (const n of allNodes) {
    for (const t of n.frontmatter.tags) {
      let cohort = cohorts.get(t);
      if (!cohort) {
        cohort = [];
        cohorts.set(t, cohort);
      }
      cohort.push(n);
    }
  }

  for (const tag of tags) {
    const cohort = cohorts.get(tag) ?? [];
    // Centrality: summed tag-Jaccard against the other cohort members.
    const scored = cohort.map(node => {
      let score = 0;
      for (const other of cohort) {
        if (other === node) continue;
        score += tagJaccard(node.frontmatter.tags, other.frontmatter.tags);
      }
      return { node, score };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dIn =
        (inDegree.get(b.node.frontmatter.id) ?? 0) - (inDegree.get(a.node.frontmatter.id) ?? 0);
      if (dIn !== 0) return dIn;
      return a.node.frontmatter.title.localeCompare(b.node.frontmatter.title);
    });
    lines.push(`### #${tag}`);
    for (const { node } of scored.slice(0, BY_TOPIC_MAX_PER_TAG)) {
      const summary = node.frontmatter.summary.trim();
      const summaryPart = summary ? ` — ${summary}` : '';
      lines.push(`- Open [**${node.frontmatter.title}**](${node.relPath})${summaryPart}`);
    }
  }
  return lines.join('\n');
}

interface RenderRootCatalogArgs {
  /** Every leaf in the tree (drives whole-tree totals and the topic index). */
  allNodes: NodeFile[];
  /** Leaves directly at the root (rare); rendered only when non-empty. */
  rootLeaves: NodeFile[];
  /** Top-level branch directories, sorted. */
  rootSubDirs: string[];
  inDegree: Map<string, number>;
  /** GLOBAL hash over the whole leaf set, stamped into the frontmatter. */
  nodesHash: string;
  /** Self-preserved root summary, carried verbatim from the prior ENTRY.md. */
  summary?: string | undefined;
  /**
   * Self-preserved summaries for every folder (keyed by POSIX relDir), so a
   * branch pointer can splice in that branch's own one-line description.
   */
  folderSummaries: Map<string, string>;
}

/**
 * Render the purpose-built entry catalog body for `.ai/kenkeep/ENTRY.md`.
 *
 * This is deliberately NOT the per-folder `index.md` template. A folder index
 * rolls up only its own direct leaves, so at the root (where no leaves live
 * directly) it renders a misleading `0 node(s)` header and three empty sections.
 * The entry catalog instead gives the always-injected launchpad what it needs,
 * and nothing more:
 *   - accurate WHOLE-TREE totals (nodes, branches, estimated tokens), and
 *   - the branch list with compact rollup counts (the next descent step).
 *
 * It deliberately carries NO topic index: cross-cutting topic recall is left to
 * descent (each branch `index.md` rolls up its own tags), keeping the
 * always-injected payload bounded by branch count rather than tag cardinality.
 * The frontmatter still records the GLOBAL `nodes_hash` so the
 * SessionStart/doctor staleness checks keep working unchanged.
 */
function renderRootCatalog(args: RenderRootCatalogArgs): string {
  const { allNodes, rootLeaves, rootSubDirs, inDegree, nodesHash, summary, folderSummaries } = args;
  const cmp = makeCatalogComparator(inDegree);

  const parts: string[] = [];
  parts.push('# kenkeep');
  parts.push('');
  // Embedded descent directive: self-describing even when this catalog is read
  // in isolation. No body statistics (counts/token estimates are doctor/curation
  // diagnostics, not navigation aids); the GLOBAL nodes_hash and node_count stay
  // in frontmatter for the staleness check.
  parts.push(EMBEDDED_DESCENT_DIRECTIVE);

  // Branches: the next descent step, as imperative Load pointers splicing each
  // branch's self-preserved summary (name fallback when absent).
  parts.push('');
  parts.push('## Branches');
  if (rootSubDirs.length === 0) {
    parts.push('_None._');
  } else {
    for (const sub of rootSubDirs) {
      parts.push(renderDescentPointer(sub, folderSummaries.get(sub)));
    }
  }

  // Root-level leaves render only when present; the empty headings the
  // per-folder template would emit at the root are dropped here.
  const byKind: Record<'practice' | 'map', NodeFile[]> = { practice: [], map: [] };
  for (const n of rootLeaves) byKind[n.frontmatter.kind].push(n);
  byKind.practice.sort(cmp);
  byKind.map.sort(cmp);
  if (byKind.practice.length > 0) {
    parts.push('');
    parts.push('## Conventions (how we build)');
    for (const b of byKind.practice) parts.push(renderLeafPointer(b));
  }
  if (byKind.map.length > 0) {
    parts.push('');
    parts.push('## Components (what exists)');
    for (const b of byKind.map) parts.push(renderLeafPointer(b));
  }

  const body = parts.join('\n');
  // The summary is the only non-deterministic field; emit no key when absent so
  // an un-summarized root never stamps `summary: ""`.
  const fm = IndexFrontmatterSchema.parse({
    schema_version: NODE_SCHEMA_VERSION,
    nodes_hash: `sha256:${nodesHash}`,
    node_count: allNodes.length,
    ...(summary ? { summary } : {}),
  });
  return matter.stringify(body, fm);
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
 * Read a single self-preserved folder `summary` from an on-disk index file.
 * Returns the trimmed non-empty summary, or `undefined` when the file is
 * missing, unparseable, fails `IndexFrontmatterSchema`, or carries no/empty
 * summary. Tolerant by design: a missing summary is the normal brand-new-folder
 * case, not an error.
 */
function harvestSummary(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
  const fm = IndexFrontmatterSchema.safeParse(parsed.data);
  if (!fm.success) return undefined;
  const summary = fm.data.summary?.trim();
  return summary ? summary : undefined;
}

/**
 * Snapshot every folder's existing `index.md` summary (keyed by POSIX relDir)
 * plus the root entry-catalog summary, BEFORE any file is regenerated. Because
 * `index rebuild` (and the curator/`node add`/rebalance rebuilds) call
 * `generateIndex` and only write the returned bodies afterwards, reading here
 * sees the pre-rebuild on-disk state — the snapshot the self-preserve contract
 * requires (Risk: "self-preserve ordering during a single rebuild").
 *
 * The root summary lives in `ENTRY.md` frontmatter, which sits OUTSIDE
 * `nodesDir` at `<kkDir>/ENTRY.md`; the caller threads its path as `entryFile`.
 * The root folder (`relDir === ''`) maps to that file; every other folder maps
 * to `nodes/<dir>/index.md`.
 */
function harvestFolderSummaries(
  nodesDir: string,
  dirs: Iterable<string>,
  entryFile?: string
): Map<string, string> {
  const summaries = new Map<string, string>();
  for (const dir of dirs) {
    const file = dir === '' ? entryFile : join(nodesDir, ...dir.split('/'), INDEX_FILENAME);
    if (!file) continue;
    const summary = harvestSummary(file);
    if (summary !== undefined) summaries.set(dir, summary);
  }
  return summaries;
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
 *
 * The single non-deterministic input is each folder's self-preserved `summary`:
 * harvested from the pre-rebuild on-disk files (`entryFile` for the root,
 * `nodes/<dir>/index.md` for every other folder) and re-stamped verbatim into
 * the regenerated frontmatter. `generateIndex` never invents or mutates a
 * summary; absent it emits no `summary` key.
 */
export function generateIndex(nodesDir: string, entryFile?: string): GeneratedIndex {
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

  // Self-preserve: harvest every folder's existing summary (and the root
  // catalog's) from the pre-rebuild on-disk files before any body is rendered,
  // so a folder's one-line description survives the otherwise-total rebuild.
  const harvestedSummaries = harvestFolderSummaries(nodesDir, dirs, entryFile);

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
      allNodes: nodes,
      inDegree,
      // Per-folder hash: a leaf edit only perturbs the hash recorded in that
      // leaf's own folder index, leaving unrelated folder indexes byte-stable.
      // The whole-tree `## By topic` block is rendered into the body but is NOT
      // fed into hashLeaves, so cross-tree churn never moves this hash.
      nodesHash: hashLeaves(leaves),
      summary: harvestedSummaries.get(dir),
      folderSummaries: harvestedSummaries,
    });
    const metrics: FolderMetrics = {
      occupancy: leaves.length,
      tagDiversity: distinctTagCount(leaves),
      leafSize: estimateTokens(leaves),
    };
    folders.set(dir, { relDir: dir, content, metrics });
  }

  // Entry catalog for .ai/kenkeep/ENTRY.md: a purpose-built launchpad (NOT the
  // per-folder template), stamped with the GLOBAL hash so SessionStart/doctor
  // staleness checks compare against the whole leaf set.
  const rootLeaves = (leavesByDir.get('') ?? []).slice().sort(cmp);
  const rootSubDirs = [...dirs]
    .filter(d => d !== '' && !d.includes('/'))
    .sort((a, b) => a.localeCompare(b));
  const rootCatalog = renderRootCatalog({
    allNodes: nodes,
    rootLeaves,
    rootSubDirs,
    inDegree,
    nodesHash: hash,
    summary: harvestedSummaries.get(''),
    folderSummaries: harvestedSummaries,
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
  /** Every leaf in the tree, for the whole-tree `## By topic` ranking. */
  allNodes: NodeFile[];
  inDegree: Map<string, number>;
  nodesHash: string;
  /** Self-preserved folder summary, carried verbatim from the prior index.md. */
  summary?: string | undefined;
  /** Self-preserved summaries for every folder (keyed by POSIX relDir). */
  folderSummaries: Map<string, string>;
}

function renderFolderIndex(args: RenderFolderArgs): string {
  const { relDir, leaves, subDirs, allNodes, inDegree, folderSummaries } = args;
  const cmp = makeCatalogComparator(inDegree);

  const byKind: Record<'practice' | 'map', NodeFile[]> = { practice: [], map: [] };
  for (const n of leaves) byKind[n.frontmatter.kind].push(n);
  byKind.practice.sort(cmp);
  byKind.map.sort(cmp);

  const isRoot = relDir === '';
  const title = isRoot ? 'kenkeep Index' : `kenkeep Index: ${relDir.split('/').join(' / ')}`;
  const parts: string[] = [];
  parts.push(`# ${title}`);
  // Parent breadcrumb: bidirectional navigation for an agent that lands deep via
  // grep. The parent index is always `../index.md` relative to this folder; the
  // root index node carries none.
  if (!isRoot) {
    const segments = relDir.split('/');
    const parentName = segments.length > 1 ? (segments[segments.length - 2] as string) : 'kenkeep';
    parts.push('');
    parts.push(`↑ Parent: [${parentName}](../index.md)`);
  }
  parts.push('');
  // Embedded descent directive: a file dumped into context (sub-agent, mid-
  // session re-read, deep descent) must be self-describing. No body statistics.
  parts.push(EMBEDDED_DESCENT_DIRECTIVE);

  // Subfolders section: imperative Load pointers splicing each child's
  // self-preserved summary (name fallback when absent).
  parts.push('');
  parts.push('## Subfolders');
  if (subDirs.length === 0) {
    parts.push('_None._');
  } else {
    for (const sub of subDirs) {
      parts.push(renderDescentPointer(sub, folderSummaries.get(sub)));
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
      for (const b of s.bullets) parts.push(renderLeafPointer(b));
    }
  }

  parts.push('');
  parts.push(renderTagIndex(leaves, allNodes, inDegree));

  const body = parts.join('\n');
  // The summary is the only non-deterministic field; emit no key when absent so
  // an un-summarized folder never stamps `summary: ""`.
  const fm = IndexFrontmatterSchema.parse({
    schema_version: NODE_SCHEMA_VERSION,
    nodes_hash: `sha256:${args.nodesHash}`,
    node_count: leaves.length,
    ...(args.summary ? { summary: args.summary } : {}),
  });
  return matter.stringify(body, fm);
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
      if (fm.depends_on.length > 0) lines.push(`- **depends_on:** ${fm.depends_on.join(', ')}`);
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
