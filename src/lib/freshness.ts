import { execFileSync } from 'node:child_process';
import { posix, relative, sep } from 'node:path';
import { readAllNodes, type NodeFile } from './nodes.js';

/**
 * A leaf node that references source code changed since the node was last
 * curated. `branch` is the top-level folder under `nodes/` (or the root label);
 * `changedPaths` are the repo-relative source paths that moved after the node's
 * baseline commit.
 */
export interface FlaggedNode {
  id: string;
  branch: string;
  changedPaths: string[];
}

export interface BranchRollup {
  branch: string;
  flagged: number;
}

/**
 * Result of a freshness computation. `available` is false when no git signal
 * could be derived; `reason` then says why (no nodes, unreadable nodes, or the
 * failing git command and its first stderr line). Callers treat an unavailable
 * report as "unknown / no signal" and never as an error.
 */
export interface FreshnessReport {
  available: boolean;
  /** Present exactly when `available` is false. */
  reason?: string;
  consideredNodes: number;
  flaggedCount: number;
  flagged: FlaggedNode[];
  perBranch: BranchRollup[];
}

export interface FreshnessOptions {
  root: string;
  nodesDir: string;
  /**
   * Hot-path budget: cap the git history scan to the most recent N commits.
   * Bounds the synchronous cost for callers like SessionStart. When a node's
   * baseline or a referenced path's last change falls outside the window it is
   * simply not counted (conservative under-report), never an error. Omitted =
   * full history.
   */
  maxCommits?: number;
  /** Epoch-ms instant after which the node walk gives up and no signal is reported. */
  deadlineAt?: number | undefined;
}

/** Label used for leaves that sit at the `nodes/` root (no branch folder). */
export const ROOT_BRANCH_LABEL = '(root)';

const KK_PATH_PREFIX = '.ai/kenkeep/';

/** Cap on `git log` output; past it the query fails with ENOBUFS and says so. */
const GIT_LOG_MAX_BUFFER = 64 * 1024 * 1024;

function unavailableReport(reason: string): FreshnessReport {
  return {
    available: false,
    reason,
    consideredNodes: 0,
    flaggedCount: 0,
    flagged: [],
    perBranch: [],
  };
}

/**
 * Determines which leaf nodes may describe source code that changed since the
 * node was last curated. Deterministic, read-only, no LLM.
 *
 * Baseline per node is derived entirely from git history: the most recent
 * commit that touched the node's own file (curation writes the node, the human
 * commits it). A node is flagged when any source path it references changed in
 * `<baseline>..HEAD`, including being deleted or renamed away, because
 * membership is historical (any path the log ever recorded), not the current
 * tracked-file list. Nothing is stamped and no state is persisted.
 *
 * One git invocation regardless of node count. Never throws: an
 * empty/unreadable `nodes/` tree or any git failure (no repository, no
 * commits, output past the buffer) yields an unavailable report with a reason.
 */
export function computeFreshness(opts: FreshnessOptions): FreshnessReport {
  let nodes: NodeFile[];
  try {
    nodes = readAllNodes(opts.nodesDir, { deadlineAt: opts.deadlineAt });
  } catch (err) {
    // Malformed/old-layout tree: doctor surfaces the details; freshness is a
    // best-effort advisory, so degrade to no signal rather than throwing.
    return unavailableReport(`could not read nodes: ${errorMessage(err)}`);
  }
  if (nodes.length === 0) return unavailableReport('the knowledge base has no nodes');

  let pathToRecency: Map<string, number>;
  try {
    pathToRecency = pathRecencyIndex(opts.root, opts.maxCommits);
  } catch (err) {
    return unavailableReport(`git log failed: ${gitFailure(err)}`);
  }
  return flagNodes(nodes, pathToRecency, opts.root);
}

function flagNodes(
  nodes: NodeFile[],
  pathToRecency: Map<string, number>,
  root: string
): FreshnessReport {
  const flagged: FlaggedNode[] = [];
  for (const node of nodes) {
    const nodeRel = toPosixRel(root, node.path);
    const baseline = pathToRecency.get(nodeRel);
    // No commit for this node's file (brand-new / uncommitted, or outside the
    // budgeted window): no baseline, so nothing to compare against.
    if (baseline === undefined) continue;

    const changed: string[] = [];
    for (const ref of referencedSourcePaths(node, pathToRecency, nodeRel)) {
      // Strictly newer than the node's baseline => changed after curation.
      // A deletion or rename-away is a change recorded against the old path.
      const changeIndex = pathToRecency.get(ref);
      if (changeIndex !== undefined && changeIndex < baseline) changed.push(ref);
    }
    if (changed.length > 0) {
      flagged.push({
        id: node.frontmatter.kk_id,
        branch: branchOf(node),
        changedPaths: changed.sort((a, b) => a.localeCompare(b)),
      });
    }
  }

  flagged.sort((a, b) => a.id.localeCompare(b.id));
  return {
    available: true,
    consideredNodes: nodes.length,
    flaggedCount: flagged.length,
    flagged,
    perBranch: rollupByBranch(flagged),
  };
}

function branchOf(node: NodeFile): string {
  if (node.relDir === '') return ROOT_BRANCH_LABEL;
  const top = node.relDir.split('/')[0];
  return top && top.length > 0 ? top : ROOT_BRANCH_LABEL;
}

function rollupByBranch(flagged: FlaggedNode[]): BranchRollup[] {
  const counts = new Map<string, number>();
  for (const f of flagged) counts.set(f.branch, (counts.get(f.branch) ?? 0) + 1);
  return [...counts.entries()]
    .map(([branch, count]) => ({ branch, flagged: count }))
    .sort((a, b) => b.flagged - a.flagged || a.branch.localeCompare(b.branch));
}

/**
 * The set of source paths a node references that appear in the scanned git
 * history: the union of body path tokens (Markdown link targets + inline-code
 * spans) and `kk_derived_from` entries. Historical membership means a path that
 * has since been deleted or renamed still counts. Paths under `.ai/kenkeep/`
 * (other knowledge-base files) and the node's own file are excluded — the
 * signal is about the surrounding source code, not the KB.
 */
function referencedSourcePaths(
  node: NodeFile,
  history: Map<string, number>,
  nodeRel: string
): Set<string> {
  const out = new Set<string>();
  const add = (candidate: string | null): void => {
    if (candidate === null) return;
    if (candidate === nodeRel) return;
    if (candidate.startsWith(KK_PATH_PREFIX)) return;
    if (history.has(candidate)) out.add(candidate);
  };

  for (const token of extractBodyPathTokens(node.body)) {
    add(resolveToRepoRel(token, node.relDir));
  }
  for (const ref of node.frontmatter.kk_derived_from) {
    add(resolveToRepoRel(ref, node.relDir));
  }
  return out;
}

const MD_LINK_RE = /\]\(([^)\s]+)\)/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;

/** Candidate path strings from Markdown link targets and inline-code spans. */
function extractBodyPathTokens(body: string): string[] {
  const tokens: string[] = [];
  for (const m of body.matchAll(MD_LINK_RE)) {
    if (m[1] !== undefined) tokens.push(m[1]);
  }
  for (const m of body.matchAll(INLINE_CODE_RE)) {
    if (m[1] !== undefined) tokens.push(m[1]);
  }
  return tokens;
}

/**
 * Normalizes a raw token to a repo-root-relative POSIX path, or null if it is
 * not a plausible in-repo path (URL, anchor-only, absolute-outside, no slash).
 * Resolution tries the token as repo-root-relative first, then relative to the
 * node's own directory (for `../`-style cross references). History membership
 * is checked by the caller.
 */
function resolveToRepoRel(raw: string, nodeRelDir: string): string | null {
  let token = raw.trim();
  if (token.length === 0) return null;
  // Strip a Markdown anchor / query suffix.
  const hash = token.indexOf('#');
  if (hash >= 0) token = token.slice(0, hash);
  if (token.length === 0) return null;
  // URLs and protocol-relative references are never in-repo paths.
  if (/^[a-z][a-z0-9+.-]*:/i.test(token) || token.startsWith('//')) return null;
  if (token.startsWith('./')) token = token.slice(2);

  const candidates: string[] = [];
  if (token.startsWith('/')) {
    // Treat a leading slash as repo-root-relative (docs often write it so).
    candidates.push(posix.normalize(token.slice(1)));
  } else {
    candidates.push(posix.normalize(token));
    if (nodeRelDir.length > 0) {
      candidates.push(posix.normalize(posix.join('.ai/kenkeep/nodes', nodeRelDir, token)));
    }
  }
  for (const c of candidates) {
    if (c.length === 0 || c === '.' || c.startsWith('..')) continue;
    if (!c.includes('/')) continue; // require a path, not a bare word
    return c;
  }
  return null;
}

function toPosixRel(root: string, absPath: string): string {
  return relative(root, absPath).split(sep).join(posix.sep);
}

/** Marker prefix for commit lines; control bytes cannot start a path line. */
const COMMIT_MARK = '\u0001commit\u0001';

/**
 * Single `git log` pass yielding, per path, the recency index of the most
 * recent commit that touched it (0 = HEAD, larger = older). The first time a
 * path appears (newest-first order) is its most recent change. `--no-renames`
 * records a rename as a deletion of the old path, so the old path stays in
 * history.
 */
function pathRecencyIndex(root: string, maxCommits?: number): Map<string, number> {
  const args = ['log', `--format=${COMMIT_MARK}%H`, '--name-only', '--no-renames'];
  if (maxCommits !== undefined && maxCommits > 0) args.push('-n', String(maxCommits));
  args.push('HEAD');
  const out = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: GIT_LOG_MAX_BUFFER,
  });

  const map = new Map<string, number>();
  let index = -1;
  for (const line of out.split('\n')) {
    if (line.startsWith(COMMIT_MARK)) {
      index += 1;
      continue;
    }
    if (line.length === 0 || index < 0) continue;
    if (!map.has(line)) map.set(line, index);
  }
  return map;
}

/** The first stderr line of a failed git call, else the spawn error (`ENOBUFS`, `ENOENT`). */
function gitFailure(err: unknown): string {
  const stderr = (err as { stderr?: unknown }).stderr;
  const firstLine = typeof stderr === 'string' ? (stderr.trim().split('\n')[0] ?? '') : '';
  return (firstLine.length > 0 ? firstLine : errorMessage(err)).replace(/\.$/, '');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
