import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  deriveNodeId,
  ensureUniqueId,
  reservedNodeIds,
  nodeFilename,
  readAllNodes,
  writeNodeFile,
  type NodeFile,
} from '../lib/nodes.js';
import { placeLeaf } from '../lib/leaf-placement.js';
import { stderrLog as log, writeJsonDocument } from '../lib/log.js';
import { modifyNodeInPlace } from '../lib/node-modify.js';
import { stripGeneratedSections } from '../lib/node-sections.js';
import { resolveContainedDir, tryNormalizeFolderKey } from '../lib/path-safety.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { readStdin } from '../lib/stdin.js';
import {
  CuratorOutputSchema,
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  type CuratorAction,
  type CuratorAddAction,
  type CuratorModifyAction,
  type CuratorProposedNode,
  type NodeFrontmatter,
} from '../lib/schemas.js';

export interface CuratePersistOptions {
  /** Path to a survivors JSON file. When omitted, read from stdin. */
  input?: string | undefined;
}

type PersistStatus = 'written' | 'dropped' | 'failed' | 'already-applied';

interface PersistResult {
  index: number;
  action: CuratorAction['action'];
  candidate_origin: string;
  status: PersistStatus;
  id?: string;
  path?: string;
  placement?: string;
  reason?: string;
}

interface PersistSummary {
  written: number;
  dropped: number;
  failed: number;
  already_applied: number;
  results: PersistResult[];
}

/** An add whose id and folder were minted before any write. */
interface PlannedAdd {
  kind: 'add';
  index: number;
  action: CuratorAddAction;
  frontmatter: NodeFrontmatter;
  relDir: string;
  derived: boolean;
}

interface PlannedModify {
  kind: 'modify';
  index: number;
  action: CuratorModifyAction;
}

type Planned = PlannedAdd | PlannedModify;

async function readInput(input: string | undefined): Promise<string> {
  if (input !== undefined && input !== '') {
    const abs = isAbsolute(input) ? input : resolve(process.cwd(), input);
    if (!existsSync(abs)) {
      throw new Error(`--input ${input}: file does not exist (${abs}).`);
    }
    return readFileSync(abs, 'utf8');
  }
  return readStdin();
}

function relPath(from: string, to: string): string {
  return relative(from, to).split(sep).join('/');
}

/**
 * The normalized key of an existing folder under `nodes/`, or `null` when the
 * key escapes `nodes/`, crosses a symlink, or names no directory.
 */
function existingFolderKey(nodesDir: string, folder: string): string | null {
  const key = tryNormalizeFolderKey(folder);
  if (key === null) return null;
  try {
    return statSync(resolveContainedDir(nodesDir, key)).isDirectory() ? key : null;
  } catch {
    return null;
  }
}

/**
 * How a written leaf's folder was chosen, for the run summary. A `modify`
 * rewrites the target at its current path. An `add` reports the folder the
 * curator chose, the folder derived from the leaf's edges and tags, or the
 * root fallback when neither produced one.
 */
function describePlacement(
  action: CuratorAction['action'],
  relDir: string,
  derived: boolean
): string {
  if (action === 'modify') return 'in place';
  if (relDir === '') return 'root fallback';
  return derived ? `derived: ${relDir}` : relDir;
}

function leafRelPath(relDir: string, id: string): string {
  return relDir === '' ? nodeFilename(id) : `${relDir}/${nodeFilename(id)}`;
}

/**
 * Mints an add's id and folder against the pre-write snapshot. An add lands
 * in the curator's `home_folder`, or, when the curator left it empty, in a
 * folder derived from the candidate's own edges and tags; at the `nodes/`
 * root only when neither found one. Returns a failure reason instead when
 * the add cannot be written.
 */
function planAdd(
  nodesDir: string,
  existingNodes: NodeFile[],
  usedIds: Set<string>,
  action: CuratorAddAction
): Omit<PlannedAdd, 'kind' | 'index' | 'action'> | string {
  const node = action.proposed_node;
  let relDir = '';
  let derived = false;
  const home = (action.home_folder ?? '').trim();
  if (home !== '') {
    // A folder the curator named must already exist. A wrong one stays a
    // failed action; placement does not rescue it.
    const key = existingFolderKey(nodesDir, home);
    if (key === null) return `home_folder "${home}" does not exist under nodes/`;
    relDir = key;
  } else {
    // The curator declined to choose, so derive the folder from the leaf's
    // own edges and tags against the pre-write snapshot. An unplaceable leaf,
    // or a tree with no folders, keeps the root fallback: a novel note whose
    // topic has no neighbours yet is still knowledge, and dropping it would
    // lose it with no diff to review. Deletion belongs to the sweep.
    const placement = placeLeaf(
      { tags: node.tags, kk_relates_to: node.kk_relates_to, kk_depends_on: node.kk_depends_on },
      existingNodes
    );
    if (placement.kind === 'placed') {
      const key = existingFolderKey(nodesDir, placement.folder);
      if (key !== null) {
        relDir = key;
        derived = true;
      }
    }
  }
  const frontmatter: NodeFrontmatter = {
    type: node.type,
    title: node.title,
    description: node.description,
    tags: node.tags,
    kk_schema_version: NODE_SCHEMA_VERSION,
    kk_id: ensureUniqueId(usedIds, deriveNodeId(node.type, node.title)),
    kk_derived_from: [action.candidate_origin],
    kk_relates_to: node.kk_relates_to,
    kk_depends_on: node.kk_depends_on,
    kk_confidence: node.kk_confidence,
  };
  const checked = NodeFrontmatterSchema.safeParse(frontmatter);
  if (!checked.success) {
    const reason = checked.error.issues
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return `frontmatter validation failed: ${reason}`;
  }
  usedIds.add(checked.data.kk_id);
  return { frontmatter: checked.data, relDir, derived };
}

/**
 * The part of a leaf body only the proposal determines. The node writer
 * appends generated Related and Citations sections derived from the
 * frontmatter and the tree, so they are dropped before bodies are compared,
 * with the writer's own scanner: markers quoted in prose are authored text.
 */
function authoredBody(body: string): string {
  return stripGeneratedSections(body).trim();
}

/**
 * True when `leaf` already holds what an action from `origin` proposing
 * `node` would write: the origin in `kk_derived_from`, every proposed field
 * and the proposed body. Leaf writes are atomic renames, so a leaf carries a
 * whole earlier write or none of it. The body counts because a modify whose
 * origin the leaf already lists (a positional origin reused by a later
 * transcript version) may differ from the leaf in nothing else.
 */
function carriesProposal(leaf: NodeFile, origin: string, node: CuratorProposedNode): boolean {
  const fm = leaf.frontmatter;
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  return (
    fm.kk_derived_from.includes(origin) &&
    fm.type === node.type &&
    fm.title === node.title &&
    fm.description === node.description &&
    fm.kk_confidence === node.kk_confidence &&
    same(fm.tags, node.tags) &&
    same(fm.kk_relates_to, node.kk_relates_to) &&
    same(fm.kk_depends_on, node.kk_depends_on) &&
    authoredBody(leaf.body) === authoredBody(node.body)
  );
}

type WriteOutcome =
  | { ok: true; id: string; path: string; placement: string }
  | { ok: false; reason: string };

/**
 * Writes one planned action and keeps `snapshot` current, so a later modify
 * of the same leaf (or of an add from this batch) merges on top of it.
 */
function applyPlanned(
  nodesDir: string,
  p: Planned,
  snapshot: Map<string, NodeFile>,
  pendingPaths: ReadonlyMap<string, string>
): WriteOutcome {
  if (p.kind === 'modify') {
    // The shared in-place modify path (also what `conflict resolve
    // --decision accept` applies): same id, same folder, never a new node.
    const outcome = modifyNodeInPlace(
      nodesDir,
      p.action.target_node_id,
      p.action.candidate_origin,
      p.action.proposed_node,
      { snapshot, pendingPaths }
    );
    if (!outcome.ok) return outcome;
    const previous = snapshot.get(outcome.id);
    if (previous !== undefined) {
      snapshot.set(outcome.id, {
        ...previous,
        frontmatter: outcome.frontmatter,
        body: p.action.proposed_node.body,
      });
    }
    return {
      ok: true,
      id: outcome.id,
      path: relPath(nodesDir, outcome.filePath),
      placement: describePlacement('modify', outcome.relDir, false),
    };
  }
  const id = p.frontmatter.kk_id;
  const filePath = writeNodeFile({
    nodesDir,
    frontmatter: p.frontmatter,
    body: p.action.proposed_node.body,
    relDir: p.relDir,
    pendingPaths,
  });
  const path = relPath(nodesDir, filePath);
  snapshot.set(id, {
    path: filePath,
    filename: nodeFilename(id),
    relPath: path,
    relDir: p.relDir,
    frontmatter: p.frontmatter,
    body: p.action.proposed_node.body,
  });
  return { ok: true, id, path, placement: describePlacement('add', p.relDir, p.derived) };
}

/**
 * Deterministic survivor persistence primitive. It consumes the non-conflict
 * survivor array from `curate-dedup`, writes every add/modify via the shared
 * node writer helpers, skips drops, and continues after per-action failures.
 *
 * Idempotent retry: an action that already landed is not written again.
 * Before each add, the tree is searched for a leaf that carries the action's
 * `candidate_origin` in `kk_derived_from` and the proposal's fields and
 * body; a modify whose target already holds exactly that is a no-op. Both
 * are reported as `already-applied`, so replaying the same survivors after
 * fixing a failure writes only the failed actions and no successful add gets
 * a `-2` copy.
 *
 * The tree is parsed once per run: placement and modify targets come from
 * that snapshot, and every add's id and path are minted before the first
 * write, so a leaf linking to a sibling written later in the same batch
 * renders the sibling's real path. (The node writer still reads the tree once
 * per write to render links.)
 *
 * Partial-failure contract:
 *   - malformed input or an unreadable tree: exit 1, no writes, error on
 *     stderr;
 *   - valid input: attempt every not-yet-applied action in order, emit one
 *     JSON summary on stdout, and exit 1 iff any action failed.
 */
export async function runCuratePersistCommand(opts: CuratePersistOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  let raw: string;
  try {
    raw = await readInput(opts.input);
  } catch (err) {
    log.error(`curate persist: ${(err as Error).message}`);
    return 1;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    log.error(`curate persist: input is not valid JSON: ${(err as Error).message}`);
    return 1;
  }

  const validated = CuratorOutputSchema.safeParse(parsedJson);
  if (!validated.success) {
    log.error(
      `curate persist: input does not match CuratorOutputSchema: ${validated.error.issues
        .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`
    );
    return 1;
  }

  let existingNodes: NodeFile[];
  try {
    existingNodes = readAllNodes(paths.nodesDir);
  } catch (err) {
    log.error(`curate persist: ${(err as Error).message}`);
    return 1;
  }

  const snapshot = new Map(existingNodes.map(n => [n.frontmatter.kk_id, n]));
  const results: PersistResult[] = [];
  const plan: Planned[] = [];
  const usedIds = reservedNodeIds(paths.nodesDir, existingNodes);
  const fail = (action: CuratorAction, index: number, reason: string): void => {
    results[index] = {
      index,
      action: action.action,
      candidate_origin: action.candidate_origin,
      status: 'failed',
      reason,
    };
  };

  // Plan: classify every action and mint every add's id and folder before
  // the first write.
  for (const [index, action] of validated.data.entries()) {
    const base = { index, action: action.action, candidate_origin: action.candidate_origin };
    if (action.action === 'drop') {
      results[index] = { ...base, status: 'dropped' };
      continue;
    }
    if (action.action === 'contradict') {
      fail(action, index, 'contradict actions must be handled by curate-dedup');
      continue;
    }
    if (action.action === 'modify') {
      plan.push({ kind: 'modify', index, action });
      continue;
    }
    const landed = existingNodes.find(n =>
      carriesProposal(n, action.candidate_origin, action.proposed_node)
    );
    if (landed !== undefined) {
      results[index] = {
        ...base,
        status: 'already-applied',
        id: landed.frontmatter.kk_id,
        path: landed.relPath,
      };
      continue;
    }
    const minted = planAdd(paths.nodesDir, existingNodes, usedIds, action);
    if (typeof minted === 'string') {
      fail(action, index, minted);
      continue;
    }
    plan.push({ kind: 'add', index, action, ...minted });
  }

  const pendingPaths = new Map<string, string>();
  for (const p of plan) {
    if (p.kind === 'add') {
      pendingPaths.set(p.frontmatter.kk_id, leafRelPath(p.relDir, p.frontmatter.kk_id));
    }
  }

  // Apply in input order against the running snapshot, so a modify sees the
  // writes made before it in this run.
  for (const p of plan) {
    const base = {
      index: p.index,
      action: p.action.action,
      candidate_origin: p.action.candidate_origin,
    };
    if (p.kind === 'modify') {
      const target = snapshot.get(p.action.target_node_id);
      if (
        target !== undefined &&
        carriesProposal(target, p.action.candidate_origin, p.action.proposed_node)
      ) {
        results[p.index] = {
          ...base,
          status: 'already-applied',
          id: target.frontmatter.kk_id,
          path: target.relPath,
          placement: 'in place',
        };
        continue;
      }
    }
    let outcome: WriteOutcome;
    try {
      outcome = applyPlanned(paths.nodesDir, p, snapshot, pendingPaths);
    } catch (err) {
      outcome = { ok: false, reason: (err as Error).message };
    }
    if (!outcome.ok) {
      fail(p.action, p.index, outcome.reason);
      continue;
    }
    results[p.index] = {
      ...base,
      status: 'written',
      id: outcome.id,
      path: outcome.path,
      placement: outcome.placement,
    };
  }

  const count = (status: PersistStatus): number => results.filter(r => r.status === status).length;
  const summary: PersistSummary = {
    written: count('written'),
    dropped: count('dropped'),
    failed: count('failed'),
    already_applied: count('already-applied'),
    results,
  };
  writeJsonDocument(summary);
  return summary.failed > 0 ? 1 : 0;
}
