import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { assertAgentsKkBlockWritable, ensureAgentsKkBlock } from '../lib/agents-block.js';
import { folderSummariesFileForNodesDir, renderFolderSummaries } from '../lib/folder-summaries.js';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import {
  findStaleFolderIndexes,
  generateGraph,
  generateIndex,
  snapshotTree,
  type TreeSnapshot,
} from '../lib/index-gen.js';
import { log as humanLog, type Logger } from '../lib/log.js';
import {
  formatIssue,
  INDEX_FILENAME,
  InvalidNodeFrontmatterError,
  OldLayoutError,
} from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export interface IndexRebuildOptions {
  /** When true, `git add` every owned generated file (and stage every removal) after writing. */
  stage?: boolean;
  /**
   * Where status lines go. Defaults to the human logger (stdout). A
   * machine-output command that drives a rebuild passes `stderrLog` so the
   * rebuild's report cannot corrupt its JSON stdout.
   */
  logger?: Logger;
}

/** One owned generated artifact: where it lives and the bytes it must hold. */
interface OwnedFile {
  file: string;
  content: string;
}

/**
 * Deterministic reconciliation of the complete owned output set against the
 * actual leaf tree. The owned set is: one `index.md` per owned folder under
 * `nodes/` (the bundle root plus every folder with a leaf beneath it), the
 * entry catalog `.ai/kenkeep/ENTRY.md` (the SessionStart-injected launchpad),
 * `.ai/kenkeep/GRAPH.md` (the cross-tree DAG overlay) and the
 * `FOLDER_SUMMARIES.md` sidecar registry. Every run:
 *
 *   1. reads the tree once (parse + hash) and generates every owned file;
 *   2. writes the ones whose bytes changed;
 *   3. removes owned files the tree no longer justifies — an `index.md` in a
 *      branch whose last leaf left (the emptied folder goes with it), a sidecar
 *      entry for such a branch, the pre-rename `INDEX.md`;
 *   4. with `--stage`, stages the WHOLE owned set plus every removal, so the
 *      pre-commit step (lint-staged runs `index rebuild --stage`) lands exactly
 *      the generated state in the commit — including sidecar-only edits,
 *      recreated artifacts and files an earlier plain rebuild already
 *      regenerated. The leaf hash is deliberately not used as a short-circuit:
 *      it does not cover any of those cases.
 *
 * The curator, `node add`, rebalance and sweep also run this.
 */
export async function runIndexRebuild(opts: IndexRebuildOptions = {}): Promise<number> {
  const log = opts.logger ?? humanLog;
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  mkdirSync(paths.kkDir, { recursive: true });
  preflightIndexRebuild(root);

  const indexFile = join(paths.kkDir, 'ENTRY.md');
  const legacyIndexFile = join(paths.kkDir, 'INDEX.md');
  const graphFile = join(paths.kkDir, 'GRAPH.md');
  const sidecarFile = folderSummariesFileForNodesDir(paths.nodesDir);

  // One tree snapshot per run: the leaves are parsed and hashed exactly once,
  // and both generators consume that snapshot. This is also the strict
  // validation gate — a malformed leaf (or the old flat layout) aborts here,
  // before any owned file is touched, so a broken tree never produces an
  // empty-looking catalog.
  let snapshot: TreeSnapshot;
  try {
    snapshot = snapshotTree(paths.nodesDir);
  } catch (err) {
    if (err instanceof InvalidNodeFrontmatterError) {
      reportInvalidFrontmatter(err, log);
      return 1;
    }
    if (err instanceof OldLayoutError) {
      log.error(err.message);
      return 1;
    }
    throw err;
  }

  // Pass the entry-catalog path so generateIndex can harvest and self-preserve
  // the root summary (it lives in ENTRY.md frontmatter, outside nodes/).
  const index = generateIndex(paths.nodesDir, indexFile, snapshot);
  const graph = generateGraph(paths.nodesDir, snapshot);

  // The complete owned output set for this tree.
  const owned: OwnedFile[] = [];
  for (const folder of index.folders.values()) {
    owned.push({ file: folderIndexFile(paths.nodesDir, folder.relDir), content: folder.content });
  }
  // ENTRY.md carries the GLOBAL nodes_hash (the per-folder nodes/index.md is
  // frontmatter-free), which doctor/session-start compare for staleness.
  owned.push({ file: indexFile, content: index.rootCatalog });
  owned.push({ file: graphFile, content: graph.content });
  // The sidecar is owned too, but never conjured: a repo with no sidecar and
  // nothing to record stays without one.
  if (existsSync(sidecarFile) || index.folderSummaries.size > 0) {
    owned.push({ file: sidecarFile, content: renderFolderSummaries(index.folderSummaries) });
  }

  // Owned files the tree no longer justifies.
  const staleIndexes = findStaleFolderIndexes(paths.nodesDir, new Set(index.folders.keys()));
  const removals = [...staleIndexes];
  // Repos seeded before the rename carried the combined catalog at INDEX.md;
  // the tree carries exactly one entry catalog.
  if (existsSync(legacyIndexFile)) removals.push(legacyIndexFile);

  let changed = 0;
  for (const { file, content } of owned) {
    if (writeIfChanged(file, content)) changed += 1;
  }
  for (const file of removals) rmSync(file, { force: true });
  pruneEmptiedFolders(paths.nodesDir, staleIndexes);

  // Keep the AGENTS.md pointer block tracking the current directive wording;
  // a no-op when the bytes already match, so it stages only on real change.
  // AGENTS.md is user-owned, not a generated artifact, so it is never staged
  // wholesale. A malformed block was refused by the preflight above, before
  // any owned file was touched.
  const agentsFile = join(root, 'AGENTS.md');
  const toStage = owned.map(o => o.file);
  if (ensureAgentsKkBlock(agentsFile)) {
    toStage.push(agentsFile);
  }

  log.success(
    `Regenerated ${index.folders.size} index.md file(s) and GRAPH.md from ${index.nodeCount} node(s).`
  );
  if (staleIndexes.length > 0) {
    const names = staleIndexes.map(f => posixRelative(paths.nodesDir, dirname(f)));
    log.plain(
      `Removed ${staleIndexes.length} stale index.md file(s) from leafless folder(s): ${names.join(', ')}.`
    );
  }
  if (index.prunedSummaries.length > 0) {
    log.plain(
      `Pruned ${index.prunedSummaries.length} folder summary(ies) for leafless folder(s) from ` +
        `FOLDER_SUMMARIES.md: ${index.prunedSummaries.join(', ')}.`
    );
  }

  // Warn, never block: list folders that fell back to the Title-cased name
  // because they carry no self-preserved summary. The rebuild still exits zero;
  // summaries are authored only at the migrate/rebalance clustering moments (or
  // by hand), and the parent index renders the name fallback meanwhile.
  if (index.foldersMissingSummary.length > 0) {
    log.warn(
      `${index.foldersMissingSummary.length} folder(s) have no summary (rendering the ` +
        `Title-cased name fallback): ${index.foldersMissingSummary.join(', ')}.`
    );
  }

  if (opts.stage) {
    stageOwnedSet(root, toStage, removals, changed, log);
  }

  return 0;
}

/**
 * The rebuild refusals known before any owned file is touched: a malformed
 * project config (throws from `resolveSettings`) and a malformed AGENTS.md
 * pointer block (`MalformedManagedBlockError`). `runIndexRebuild` runs this
 * first; pack import runs it before its own writes, so the refusal never
 * arrives after a graft it should have prevented.
 */
export function preflightIndexRebuild(root: string): void {
  const paths = repoPaths(root);
  resolveSettings({ projectFile: paths.projectConfigFile });
  assertAgentsKkBlockWritable(join(root, 'AGENTS.md'));
}

function folderIndexFile(nodesDir: string, relDir: string): string {
  const dir = relDir === '' ? nodesDir : join(nodesDir, ...relDir.split('/'));
  return join(dir, INDEX_FILENAME);
}

/**
 * Write an owned artifact only when its bytes differ from what is on disk
 * (tmp+rename, so an interrupted rebuild never leaves a truncated catalog).
 * Returns whether a write happened.
 */
function writeIfChanged(file: string, content: string): boolean {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  atomicWriteFile(file, content);
  return true;
}

/**
 * After a stale index.md is removed, drop the folder (and any ancestor) it
 * left empty, stopping at `nodes/`. Git tracks no directories, so a leafless,
 * fileless folder is clutter that would only invite the next stale index. A
 * folder that still holds anything else (a `log.md`, a `.gitkeep`) is kept.
 */
function pruneEmptiedFolders(nodesDir: string, removedIndexes: string[]): void {
  for (const file of removedIndexes) {
    let dir = dirname(file);
    while (dir !== nodesDir && existsSync(dir) && readdirSync(dir).length === 0) {
      rmdirSync(dir);
      dir = dirname(dir);
    }
  }
}

function posixRelative(from: string, to: string): string {
  return relative(from, to).split('\\').join('/') || '.';
}

/**
 * Stage the complete owned set: `git add` every owned file (a no-op for the
 * ones whose bytes already match the index) and `git rm --cached` every
 * removal. `--ignore-unmatch` tolerates a removed file that was never
 * tracked; plain `git add` would reject that pathspec.
 */
function stageOwnedSet(
  root: string,
  files: string[],
  removals: string[],
  changed: number,
  log: Logger
): void {
  if (!isInsideGitRepo(root)) {
    log.plain('--stage: not inside a git repo, skipping `git add`.');
    return;
  }
  try {
    if (files.length > 0) {
      execFileSync('git', ['add', '--', ...files], { cwd: root, stdio: 'pipe' });
    }
    if (removals.length > 0) {
      execFileSync('git', ['rm', '--cached', '--ignore-unmatch', '--quiet', '--', ...removals], {
        cwd: root,
        stdio: 'pipe',
      });
    }
    log.plain(
      `--stage: staged ${files.length} owned file(s) (${changed} rewritten) and ` +
        `${removals.length} removal(s).`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`--stage: staging the owned set failed: ${message}`);
  }
}

function reportInvalidFrontmatter(err: InvalidNodeFrontmatterError, log: Logger): void {
  log.error('Refusing to rebuild index/graph, invalid node frontmatter:');
  for (const failure of err.failures) {
    log.error(`  ${failure.file}: ${failure.reason}`);
    for (const issue of failure.issues) {
      log.error(`    - ${formatIssue(issue)}`);
    }
  }
  log.error('Fix the offending files and rerun.');
}

function isInsideGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
