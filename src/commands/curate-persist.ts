import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  deriveNodeId,
  ensureUniqueId,
  findNodeById,
  readAllNodes,
  writeNodeFile,
} from '../lib/nodes.js';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { readStdin } from '../lib/stdin.js';
import {
  CuratorOutputSchema,
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  type CuratorAction,
  type NodeFrontmatter,
} from '../lib/schemas.js';

export interface CuratePersistOptions {
  /** Path to a survivors JSON file. When omitted, read from stdin. */
  input?: string | undefined;
}

type PersistStatus = 'written' | 'dropped' | 'failed';

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
  results: PersistResult[];
}

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

function mergeDerivedFrom(existing: string[], origin: string): string[] {
  return Array.from(new Set([...existing, origin]));
}

function isExistingFolder(nodesDir: string, relDir: string): boolean {
  if (relDir === '') return true;
  if (isAbsolute(relDir) || relDir.startsWith('/')) return false;
  const folder = resolve(nodesDir, ...relDir.split('/'));
  const rel = relative(nodesDir, folder);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  try {
    return statSync(folder).isDirectory();
  } catch {
    return false;
  }
}

function failure(action: CuratorAction, index: number, reason: string): PersistResult {
  return {
    index,
    action: action.action,
    candidate_origin: action.candidate_origin,
    status: 'failed',
    reason,
  };
}

/**
 * Deterministic survivor persistence primitive. It consumes the non-conflict
 * survivor array from `curate-dedup`, writes every add/modify via the shared
 * node writer helpers, skips drops, and continues after per-action failures.
 *
 * Partial-failure contract:
 *   - malformed input: exit 1, no writes, error on stderr;
 *   - valid input: attempt every action in order, emit one JSON summary on
 *     stdout, and exit 1 iff any action failed.
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

  let existingNodes;
  try {
    existingNodes = readAllNodes(paths.nodesDir);
  } catch (err) {
    log.error(`curate persist: cannot read nodes: ${(err as Error).message}`);
    return 1;
  }

  const existingIds = new Set(existingNodes.map(n => n.frontmatter.kk_id));
  const results: PersistResult[] = [];

  for (const [index, action] of validated.data.entries()) {
    try {
      if (action.action === 'drop') {
        results.push({
          index,
          action: action.action,
          candidate_origin: action.candidate_origin,
          status: 'dropped',
        });
        continue;
      }

      if (action.action === 'contradict') {
        results.push(failure(action, index, 'contradict actions must be handled by curate-dedup'));
        continue;
      }

      if (!action.proposed_node) {
        results.push(failure(action, index, `${action.action} action is missing proposed_node`));
        continue;
      }

      const node = action.proposed_node;
      let frontmatter: NodeFrontmatter;
      let relDir = '';

      if (action.action === 'add') {
        if (action.target_node_id !== null) {
          results.push(failure(action, index, 'add action must not set target_node_id'));
          continue;
        }
        const home = (action.home_folder ?? '').trim();
        if (!isExistingFolder(paths.nodesDir, home)) {
          results.push(failure(action, index, `home_folder "${home}" does not exist under nodes/`));
          continue;
        }
        const id = ensureUniqueId(existingIds, deriveNodeId(node.type, node.title));
        relDir = home;
        frontmatter = {
          type: node.type,
          title: node.title,
          description: node.description,
          tags: node.tags,
          kk_schema_version: NODE_SCHEMA_VERSION,
          kk_id: id,
          kk_derived_from: [action.candidate_origin],
          kk_relates_to: node.kk_relates_to,
          kk_depends_on: node.kk_depends_on,
          kk_confidence: node.kk_confidence,
        };
      } else {
        const targetId = action.target_node_id;
        if (targetId === null || targetId.trim() === '') {
          results.push(failure(action, index, 'modify action requires target_node_id'));
          continue;
        }
        const existing = findNodeById(paths.nodesDir, targetId);
        if (!existing) {
          results.push(failure(action, index, `target node "${targetId}" does not exist`));
          continue;
        }
        if (existing.frontmatter.type !== node.type) {
          results.push(
            failure(
              action,
              index,
              `target node "${targetId}" is ${existing.frontmatter.type}, not ${node.type}`
            )
          );
          continue;
        }
        relDir = existing.relDir;
        frontmatter = {
          type: node.type,
          title: node.title,
          description: node.description,
          tags: node.tags,
          kk_schema_version: NODE_SCHEMA_VERSION,
          kk_id: targetId,
          kk_derived_from: mergeDerivedFrom(
            existing.frontmatter.kk_derived_from,
            action.candidate_origin
          ),
          kk_relates_to: node.kk_relates_to,
          kk_depends_on: node.kk_depends_on,
          kk_confidence: node.kk_confidence,
        };
      }

      const checked = NodeFrontmatterSchema.safeParse(frontmatter);
      if (!checked.success) {
        const reason = checked.error.issues
          .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        results.push(failure(action, index, `frontmatter validation failed: ${reason}`));
        continue;
      }

      const filePath = writeNodeFile({
        nodesDir: paths.nodesDir,
        frontmatter: checked.data,
        body: node.body,
        relDir,
      });
      existingIds.add(checked.data.kk_id);
      results.push({
        index,
        action: action.action,
        candidate_origin: action.candidate_origin,
        status: 'written',
        id: checked.data.kk_id,
        path: relPath(paths.nodesDir, filePath),
        placement:
          action.action === 'modify' ? 'in place' : relDir === '' ? 'root fallback' : relDir,
      });
    } catch (err) {
      results.push(failure(action, index, (err as Error).message));
    }
  }

  const summary: PersistSummary = {
    written: results.filter(r => r.status === 'written').length,
    dropped: results.filter(r => r.status === 'dropped').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return summary.failed > 0 ? 1 : 0;
}
