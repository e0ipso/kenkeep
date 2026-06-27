import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { log } from '../lib/log.js';
import { findNodeById } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export interface ConflictPrepareOptions {
  /** Override the conflicts directory. Defaults to repoPaths(...).conflictsDir. */
  conflictsDir?: string | undefined;
  /** Override the nodes directory. Defaults to repoPaths(...).nodesDir. */
  nodesDir?: string | undefined;
}

interface ConflictFrontmatter {
  id: string;
  status: string;
  detected_at: string;
  run_id: string;
  candidate_origin: string;
  target_node_id: string | null;
  proposed_kind: string;
  proposed_title: string;
  proposed_confidence: string;
}

interface PendingConflict extends ConflictFrontmatter {
  rationale: string;
  proposed_body: string;
}

interface RenderedExisting {
  id: string;
  path: string;
  title: string;
  summary: string;
  body: string;
}

interface PreparedConflict extends PendingConflict {
  group_id: number;
  first_in_group: boolean;
  existing: RenderedExisting | null;
  lines_changed: number;
  total_lines: number;
  ratio: number;
  default: 'y' | 'n' | 's';
}

/**
 * Splits a conflict-file body into its `## Rationale` and `## Proposed node`
 * sections. Mirrors the producer shape in `curate-dedup.ts`
 * (`## Rationale\n\n<rationale>\n\n## Proposed node\n\n<body>\n`); a missing
 * section yields an empty string rather than throwing.
 */
function splitConflictBody(content: string): { rationale: string; proposedBody: string } {
  const proposedMarker = '## Proposed node';
  const rationaleMarker = '## Rationale';
  const proposedIdx = content.indexOf(proposedMarker);
  let rationale = '';
  let proposedBody = '';
  if (proposedIdx >= 0) {
    proposedBody = content.slice(proposedIdx + proposedMarker.length).replace(/^\s+/, '').trimEnd();
    const head = content.slice(0, proposedIdx);
    const rIdx = head.indexOf(rationaleMarker);
    if (rIdx >= 0) {
      rationale = head.slice(rIdx + rationaleMarker.length).replace(/^\s+/, '').trimEnd();
    }
  } else {
    const rIdx = content.indexOf(rationaleMarker);
    if (rIdx >= 0) {
      rationale = content.slice(rIdx + rationaleMarker.length).replace(/^\s+/, '').trimEnd();
    }
  }
  return { rationale, proposedBody };
}

function bodyLines(body: string): string[] {
  const trimmed = body.replace(/\n+$/, '');
  if (trimmed === '') return [];
  return trimmed.split('\n');
}

/**
 * Counts lines that differ between two bodies at line granularity using an LCS
 * (longest common subsequence) diff: `lines_changed = (a − lcs) + (b − lcs)`,
 * i.e. deletions plus insertions. Deterministic and dependency-free. Identical
 * bodies yield 0; a one-line edit in an otherwise-shared body yields 2.
 */
function lineDiffCount(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  // Rolling two-row LCS. Typed-array indexing returns `number` (not
  // `number | undefined`), which keeps this clean under noUncheckedIndexedAccess.
  let prev = new Array<number>(m + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const curr = new Array<number>(m + 1).fill(0);
    const ai = a[i];
    for (let j = m - 1; j >= 0; j--) {
      curr[j] =
        ai === b[j] ? (prev[j + 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, curr[j + 1] ?? 0);
    }
    prev = curr;
  }
  const lcs = prev[0] ?? 0;
  return n - lcs + (m - lcs);
}

/** Stable string comparison (code-point) returning -1/0/1. */
function cmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort comparator for pending conflicts: `target_node_id` alphabetic with
 * `null` grouped last, then `proposed_kind`, then `detected_at`. Ports the
 * `kk-curate` Step 7a ordering verbatim.
 */
function conflictOrder(a: PendingConflict, b: PendingConflict): number {
  const at = a.target_node_id;
  const bt = b.target_node_id;
  if (at === null && bt !== null) return 1;
  if (at !== null && bt === null) return -1;
  if (at !== null && bt !== null) {
    const c = cmp(at, bt);
    if (c !== 0) return c;
  }
  const k = cmp(a.proposed_kind, b.proposed_kind);
  if (k !== 0) return k;
  return cmp(a.detected_at, b.detected_at);
}

/**
 * Computes the default reply for a conflict. Ports `kk-curate` Step 7c rules in
 * order, first match wins; a missing existing body (no target, or target node
 * absent on disk) defaults to `s`.
 */
function computeDefault(
  existing: { body: string } | null,
  proposedBody: string,
  proposedConfidence: string
): { lines_changed: number; total_lines: number; ratio: number; default: 'y' | 'n' | 's' } {
  if (existing === null) {
    return { lines_changed: 0, total_lines: 0, ratio: 0, default: 's' };
  }
  const proposed = bodyLines(proposedBody);
  const current = bodyLines(existing.body);
  const linesChanged = lineDiffCount(proposed, current);
  const totalLines = Math.max(proposed.length, current.length);
  const ratio = totalLines === 0 ? 0 : linesChanged / totalLines;
  let def: 'y' | 'n' | 's';
  if (linesChanged < 5 && proposedConfidence === 'high') def = 'y';
  else if (ratio > 0.5) def = 'n';
  else def = 's';
  return { lines_changed: linesChanged, total_lines: totalLines, ratio, default: def };
}

/**
 * Deterministic conflict-preparation primitive. Reads pending conflict files,
 * computes each conflict's default reply (the diff-ratio rules) and the
 * sort/group order, and emits JSON the kk-curate skill renders before asking
 * the user. Read-only: it never mutates conflict files or asks the user; the
 * skill still owns the y/n/s/k interaction and the existing resolve flow.
 */
export async function runConflictPrepareCommand(
  opts: ConflictPrepareOptions = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const conflictsDir = opts.conflictsDir ?? paths.conflictsDir;
  const nodesDir = opts.nodesDir ?? paths.nodesDir;

  const pending: PendingConflict[] = [];
  if (existsSync(conflictsDir)) {
    let names: string[];
    try {
      names = readdirSync(conflictsDir).filter(n => n.endsWith('.md'));
    } catch (err) {
      log.error(`conflict prepare: cannot read conflicts directory: ${(err as Error).message}`);
      return 1;
    }
    for (const name of names) {
      const filePath = join(conflictsDir, name);
      let parsed;
      try {
        parsed = matter(readFileSync(filePath, 'utf8'));
      } catch (err) {
        log.error(`conflict prepare: cannot parse ${name}: ${(err as Error).message}`);
        return 1;
      }
      const fm = parsed.data as Partial<ConflictFrontmatter>;
      if (fm.status !== 'pending') continue;
      const { rationale, proposedBody } = splitConflictBody(parsed.content);
      pending.push({
        id: String(fm.id ?? name.replace(/\.md$/, '')),
        status: 'pending',
        detected_at: String(fm.detected_at ?? ''),
        run_id: String(fm.run_id ?? ''),
        candidate_origin: String(fm.candidate_origin ?? ''),
        target_node_id: fm.target_node_id ?? null,
        proposed_kind: String(fm.proposed_kind ?? ''),
        proposed_title: String(fm.proposed_title ?? ''),
        proposed_confidence: String(fm.proposed_confidence ?? ''),
        rationale,
        proposed_body: proposedBody,
      });
    }
  }

  pending.sort(conflictOrder);

  const prepared: PreparedConflict[] = [];
  let groupId = 0;
  let prevTarget: string | null = null;
  let started = false;

  for (const c of pending) {
    const target = c.target_node_id;
    let firstInGroup: boolean;
    if (target === null) {
      firstInGroup = true;
      groupId += 1;
    } else if (!started || target !== prevTarget) {
      firstInGroup = true;
      groupId += 1;
    } else {
      firstInGroup = false;
    }
    prevTarget = target;
    started = true;

    // Resolve the existing node body for the diff (shared across a group).
    let existing: RenderedExisting | null = null;
    if (target !== null) {
      const node = findNodeById(nodesDir, target);
      if (node) {
        existing = {
          id: node.frontmatter.id,
          path: `nodes/${node.relPath}`,
          title: node.frontmatter.title,
          summary: node.frontmatter.summary,
          body: node.body,
        };
      }
    }

    const def = computeDefault(
      existing ? { body: existing.body } : null,
      c.proposed_body,
      c.proposed_confidence
    );

    prepared.push({
      ...c,
      group_id: groupId,
      first_in_group: firstInGroup,
      // Render the existing node only once per group (the first conflict).
      existing: firstInGroup ? existing : null,
      lines_changed: def.lines_changed,
      total_lines: def.total_lines,
      ratio: def.ratio,
      default: def.default,
    });
  }

  process.stdout.write(`${JSON.stringify({ count: prepared.length, conflicts: prepared })}\n`);
  return 0;
}
