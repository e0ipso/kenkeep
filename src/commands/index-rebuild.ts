import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import {
  generateGraph,
  generateIndex,
  writeGraph,
  writeIndex,
  type GeneratedIndex,
} from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import {
  computeNodesHash,
  formatIssue,
  INDEX_FILENAME,
  InvalidNodeFrontmatterError,
  OldLayoutError,
  readAllNodes,
} from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { IndexFrontmatterSchema } from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';

export interface IndexRebuildOptions {
  /** When true, `git add` every generated file after writing it. */
  stage?: boolean;
}

/**
 * Deterministic regeneration of the per-folder index-node tree plus the root
 * catalog and GRAPH.md. Writes one `index.md` per folder under `nodes/` (the
 * recursive table-of-contents), the top-level catalog at `.ai/kenkeep/INDEX.md`
 * (the SessionStart-injected root index node), and `.ai/kenkeep/GRAPH.md`
 * (the cross-tree DAG overlay). The curator and `node add` also regenerate
 * these; this command exists for hand-edits and for the lint-staged pre-commit
 * step, which runs `index rebuild --stage` so generated files land in the same
 * commit as any `nodes/` change.
 */
export async function runIndexRebuild(opts: IndexRebuildOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses claude`.'
    );
    return 1;
  }

  mkdirSync(paths.kkDir, { recursive: true });
  // Validate the project config (throws on malformed YAML or schema violations).
  resolveSettings({ projectFile: paths.projectConfigFile });

  const indexFile = join(paths.kkDir, 'INDEX.md');
  const graphFile = join(paths.kkDir, 'GRAPH.md');

  // Strict validation up front: surface any malformed node files (or the old
  // flat layout) before the short-circuit below so a stale-but-broken tree
  // cannot silently pass.
  try {
    readAllNodes(paths.nodesDir);
  } catch (err) {
    if (err instanceof InvalidNodeFrontmatterError) {
      reportInvalidFrontmatter(err);
      return 1;
    }
    if (err instanceof OldLayoutError) {
      log.error(err.message);
      return 1;
    }
    throw err;
  }

  if (opts.stage && !nodesHashChanged(indexFile, paths.nodesDir)) {
    log.success('Generated index/graph already match nodes/, nothing to do.');
    return 0;
  }

  const index = generateIndex(paths.nodesDir);
  const graph = generateGraph(paths.nodesDir);

  const written = writeFolderIndexes(paths.nodesDir, index);
  // Root catalog at .ai/kenkeep/INDEX.md mirrors the nodes/ root index node so
  // the SessionStart hook keeps injecting the top-level table of contents. It
  // carries the GLOBAL nodes_hash (the per-folder nodes/index.md carries a
  // per-folder hash), which doctor/session-start compare for staleness.
  writeIndex(indexFile, index.rootCatalog);
  written.push(indexFile);
  writeGraph(graphFile, graph);
  written.push(graphFile);

  log.success(
    `Regenerated ${index.folders.size} index.md file(s) and GRAPH.md from ${index.nodeCount} node(s).`
  );

  if (opts.stage) {
    stageIfInGitRepo(root, written);
  }

  return 0;
}

/**
 * Writes one `index.md` per folder under `nodes/` from the generator output.
 * Returns the list of absolute paths written.
 */
function writeFolderIndexes(nodesDir: string, index: GeneratedIndex): string[] {
  const written: string[] = [];
  for (const folder of index.folders.values()) {
    const dir = folder.relDir === '' ? nodesDir : join(nodesDir, ...folder.relDir.split('/'));
    mkdirSync(dir, { recursive: true });
    const file = join(dir, INDEX_FILENAME);
    writeIndex(file, folder.content);
    written.push(file);
  }
  return written;
}

/**
 * Returns true if the recorded `nodes_hash` in INDEX.md doesn't match the
 * live hash of `nodes/`. Returns true if INDEX.md is missing or unreadable
 * (force a regenerate). Used to short-circuit `--stage` when nothing changed.
 */
function nodesHashChanged(indexFile: string, nodesDir: string): boolean {
  if (!existsSync(indexFile)) return true;
  try {
    const parsed = matter(readFileSync(indexFile, 'utf8'));
    const fm = IndexFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) return true;
    const recorded = fm.data.nodes_hash.startsWith('sha256:')
      ? fm.data.nodes_hash.slice(7)
      : fm.data.nodes_hash;
    return recorded !== computeNodesHash(nodesDir);
  } catch {
    return true;
  }
}

function stageIfInGitRepo(root: string, files: string[]): void {
  if (!isInsideGitRepo(root)) {
    log.plain('--stage: not inside a git repo, skipping `git add`.');
    return;
  }
  if (files.length === 0) return;
  try {
    execFileSync('git', ['add', '--', ...files], { cwd: root, stdio: 'pipe' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`--stage: \`git add\` failed: ${message}`);
  }
}

function reportInvalidFrontmatter(err: InvalidNodeFrontmatterError): void {
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
