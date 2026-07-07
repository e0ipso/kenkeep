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
 * could be derived (not a git work tree, a git error, or an empty knowledge
 * base); callers treat that as "unknown / no signal" and never as an error.
 */
export interface FreshnessReport {
  available: boolean;
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
}

/** Label used for leaves that sit at the `nodes/` root (no branch folder). */
export const ROOT_BRANCH_LABEL = '(root)';

const KK_PATH_PREFIX = '.ai/kenkeep/';

const EMPTY_REPORT: FreshnessReport = {
  available: false,
  consideredNodes: 0,
  flaggedCount: 0,
  flagged: [],
  perBranch: [],
};

/**
 * Determines which leaf nodes may describe source code that changed since the
 * node was last curated. Deterministic, read-only, no LLM.
 *
 * Baseline per node is derived entirely from git history: the most recent
 * commit that touched the node's own file (curation writes the node, the human
 * commits it). A node is flagged when any source path it references changed in
 * `<baseline>..HEAD`. Nothing is stamped and no state is persisted.
 *
 * Bounded to a small constant number of git invocations regardless of node
 * count. Fails open: any git failure, a non-git tree, a shallow-history gap, or
 * an empty/unreadable `nodes/` tree yields an unavailable, empty report and
 * never throws.
 */
export function computeFreshness(opts: FreshnessOptions): FreshnessReport {
  try {
    let nodes: NodeFile[];
    try {
      nodes = readAllNodes(opts.nodesDir);
    } catch {
      // Malformed/old-layout tree: doctor surfaces the details; freshness is a
      // best-effort advisory, so degrade to no signal rather than throwing.
      return EMPTY_REPORT;
    }
    if (nodes.length === 0) return EMPTY_REPORT;

    if (!isGitWorkTree(opts.root)) return EMPTY_REPORT;

    const tracked = trackedFiles(opts.root);
    const pathToRecency = pathRecencyIndex(opts.root, opts.maxCommits);
    if (pathToRecency.size === 0) return EMPTY_REPORT;

    const flagged: FlaggedNode[] = [];
    for (const node of nodes) {
      const nodeRel = toPosixRel(opts.root, node.path);
      const baseline = pathToRecency.get(nodeRel);
      // No commit for this node's file (brand-new / uncommitted, or outside the
      // budgeted window): no baseline, so nothing to compare against.
      if (baseline === undefined) continue;

      const referenced = referencedSourcePaths(node, tracked, nodeRel);
      const changed: string[] = [];
      for (const ref of referenced) {
        const changeIndex = pathToRecency.get(ref);
        // Strictly newer than the node's baseline => changed after curation.
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
  } catch {
    return EMPTY_REPORT;
  }
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
 * The set of git-tracked source paths a node references: the union of body path
 * tokens (Markdown link targets + inline-code spans) that resolve to a tracked
 * file, and `kk_derived_from` entries that resolve to a tracked file. Paths
 * under `.ai/kenkeep/` (other knowledge-base files) and the node's own file are
 * excluded — the signal is about the surrounding source code, not the KB.
 */
function referencedSourcePaths(node: NodeFile, tracked: Set<string>, nodeRel: string): Set<string> {
  const out = new Set<string>();
  const add = (candidate: string | null): void => {
    if (candidate === null) return;
    if (candidate === nodeRel) return;
    if (candidate.startsWith(KK_PATH_PREFIX)) return;
    if (tracked.has(candidate)) out.add(candidate);
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
 * node's own directory (for `../`-style cross references). Tracked-membership is
 * checked by the caller.
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

function isGitWorkTree(root: string): boolean {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    return out === 'true';
  } catch {
    return false;
  }
}

function trackedFiles(root: string): Set<string> {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, stdio: 'pipe' }).toString();
  const set = new Set<string>();
  for (const p of out.split('\0')) {
    if (p.length > 0) set.add(p);
  }
  return set;
}

const COMMIT_MARK = 'commit';

/**
 * Single `git log` pass yielding, per path, the recency index of the most
 * recent commit that touched it (0 = HEAD, larger = older). One git call; the
 * first time a path appears (newest-first order) is its most recent change.
 */
function pathRecencyIndex(root: string, maxCommits?: number): Map<string, number> {
  const args = ['log', `--format=${COMMIT_MARK}%H`, '--name-only', '--no-renames'];
  if (maxCommits !== undefined && maxCommits > 0) args.push('-n', String(maxCommits));
  args.push('HEAD');
  const out = execFileSync('git', args, {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  }).toString();

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
