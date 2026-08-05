import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { runIndexRebuild } from './index-rebuild.js';
import { readFolderSummaries, writeFolderSummaries } from '../lib/folder-summaries.js';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import { log } from '../lib/log.js';
import { PACK_KNOWLEDGE_DIRNAME, PACK_MANIFEST_FILENAME, validatePack } from '../lib/pack.js';
import {
  INDEX_FILENAME,
  InvalidNodeFrontmatterError,
  OldLayoutError,
  readAllNodes,
} from '../lib/nodes.js';
import { findKenkeepRoot, repoPaths } from '../lib/paths.js';

const exec = promisify(execFile);
const PACK_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface AcquiredPack {
  packRoot: string;
  resolvedSource: string;
}

export type PackSourceAcquirer = (source: string, tmpRoot: string) => Promise<AcquiredPack>;

export interface PackImportOptions {
  as?: string | undefined;
  acquireSource?: PackSourceAcquirer | undefined;
}

interface GraftResult {
  grafted: number;
  skipped: string[];
}

interface GitHubRepo {
  owner: string;
  repo: string;
}

export async function runPackImportCommand(
  source: string,
  opts: PackImportOptions = {}
): Promise<number> {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'kk-pack-import-'));
  try {
    const acquire = opts.acquireSource ?? acquirePackSource;
    const acquired = await acquire(source, tmpRoot);
    const validation = validatePack(acquired.packRoot);
    if (!validation.ok || !validation.manifest) {
      log.error(`pack import: ${acquired.resolvedSource} is not a valid kenkeep pack:`);
      for (const error of validation.errors) log.error(`  ${error}`);
      for (const warning of validation.warnings) log.warn(`  ${warning}`);
      return 1;
    }
    for (const warning of validation.warnings) log.warn(`pack import: ${warning}`);

    const destinationName = opts.as ?? validation.manifest.name;
    if (!PACK_NAME_PATTERN.test(destinationName)) {
      log.error(
        `pack import: destination branch "${destinationName}" must match ${PACK_NAME_PATTERN.source}`
      );
      return 1;
    }

    const root = findKenkeepRoot();
    if (!root) {
      log.error('pack import: kenkeep is not initialized in this repo.');
      return 1;
    }
    const paths = repoPaths(root);
    if (!existsSync(paths.installedVersionFile)) {
      log.error(
        'pack import: kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
      );
      return 1;
    }

    const destinationDir = join(paths.nodesDir, destinationName);
    if (existsSync(destinationDir)) {
      log.error(
        `pack import: destination nodes/${destinationName}/ already exists; use --as <name> to import under a different branch.`
      );
      return 1;
    }

    const knowledgeDir = join(acquired.packRoot, PACK_KNOWLEDGE_DIRNAME);
    let existingIds: Set<string>;
    let packNodes;
    try {
      existingIds = new Set(readAllNodes(paths.nodesDir).map(node => node.frontmatter.kk_id));
      packNodes = readAllNodes(knowledgeDir);
    } catch (err) {
      if (err instanceof InvalidNodeFrontmatterError || err instanceof OldLayoutError) {
        log.error(`pack import: ${err.message}`);
        return 1;
      }
      throw err;
    }

    const graft = graftKnowledgeTree({
      knowledgeDir,
      destinationDir,
      existingIds,
      packLeafPaths: new Set(packNodes.map(node => node.path)),
      packLeafIds: new Map(packNodes.map(node => [node.path, node.frontmatter.kk_id])),
    });

    mergePackFolderSummaries({
      knowledgeDir,
      nodesDir: paths.nodesDir,
      destinationName,
      manifestSummary: validation.manifest.summary,
    });

    const rebuildCode = await runIndexRebuild();
    if (rebuildCode !== 0) return rebuildCode;

    log.plain(`Source: ${acquired.resolvedSource}`);
    log.plain(`Destination: nodes/${destinationName}/`);
    log.plain(`Nodes grafted: ${graft.grafted}`);
    log.plain(`Nodes skipped: ${graft.skipped.length}`);
    if (graft.skipped.length > 0) {
      log.warn(`Skipped existing node id(s): ${graft.skipped.sort().join(', ')}`);
    }
    log.success('Indexes rebuilt.');
    return 0;
  } catch (err) {
    log.error(`pack import: ${(err as Error).message}`);
    return 1;
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

export async function acquirePackSource(source: string, tmpRoot: string): Promise<AcquiredPack> {
  if (source.endsWith('.tar.gz')) {
    const tarball = isAbsolute(source) ? source : resolve(process.cwd(), source);
    if (!existsSync(tarball)) throw new Error(`tarball does not exist (${tarball})`);
    const extractDir = join(tmpRoot, 'local');
    await extractTarball(tarball, extractDir);
    return {
      packRoot: locatePackRoot(extractDir),
      resolvedSource: tarball,
    };
  }

  const repo = parseGitHubSource(source);
  if (!repo) {
    throw new Error(
      `unsupported pack source "${source}"; use owner/repo, a github.com URL, or a .tar.gz path.`
    );
  }

  const tarballUrl = await resolveGitHubTarballUrl(repo);
  const tarball = await downloadTarball(tarballUrl, join(tmpRoot, `${repo.repo}.tar.gz`));
  const extractDir = join(tmpRoot, 'github');
  await extractTarball(tarball, extractDir);
  return {
    packRoot: locatePackRoot(extractDir),
    resolvedSource: `${repo.owner}/${repo.repo} (${tarballUrl})`,
  };
}

function graftKnowledgeTree(args: {
  knowledgeDir: string;
  destinationDir: string;
  existingIds: Set<string>;
  packLeafPaths: Set<string>;
  packLeafIds: Map<string, string>;
}): GraftResult {
  const skipped: string[] = [];
  let grafted = 0;

  const walk = (srcDir: string): void => {
    const entries = readdirSync(srcDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const src = join(srcDir, entry.name);
      const rel = relative(args.knowledgeDir, src).split(sep).join('/');
      const dest = join(args.destinationDir, ...rel.split('/'));
      if (entry.isDirectory()) {
        mkdirSync(dest, { recursive: true });
        walk(src);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name !== INDEX_FILENAME && !args.packLeafPaths.has(src)) continue;
      if (args.packLeafPaths.has(src)) {
        const id = args.packLeafIds.get(src);
        if (id && args.existingIds.has(id)) {
          skipped.push(id);
          continue;
        }
        grafted += 1;
      }
      atomicWriteFile(dest, readFileSync(src, 'utf8'));
    }
  };

  walk(args.knowledgeDir);
  return { grafted, skipped };
}

/**
 * Merge the pack's folder summary registry into the consumer's, re-keyed under
 * the destination branch, in a single write.
 *
 * Must run BEFORE `runIndexRebuild`: the rebuild's `harvestFolderSummaries`
 * reads the sidecar off disk (src/lib/index-gen.ts), so a merge written after
 * it would stay invisible until some later rebuild — the exact silent failure
 * this transport exists to fix.
 *
 * `readFolderSummaries` returns an empty `Map` when the file is absent, so a
 * pack published before the registry existed merges to a no-op; that is the
 * backwards-compatibility path and needs no separate existence check.
 *
 * Ordering inside the merge is load-bearing: the consumer map seeds the result,
 * the pack entries overwrite it (last-write-wins, because the on-disk registry
 * is never pruned and stale keys under `<dest>/` must not beat the incoming
 * pack), and `manifest.summary` is applied last so it stays authoritative for
 * the destination key.
 */
function mergePackFolderSummaries(args: {
  knowledgeDir: string;
  nodesDir: string;
  destinationName: string;
  manifestSummary: string;
}): void {
  const merged = readFolderSummaries(args.nodesDir);
  for (const [key, summary] of readFolderSummaries(args.knowledgeDir)) {
    merged.set(destinationKeyForPackKey(key, args.destinationName), summary);
  }
  merged.set(args.destinationName, args.manifestSummary);
  writeFolderSummaries(args.nodesDir, merged);
}

/**
 * Re-key one pack registry entry as a prefix join under the destination branch:
 * the pack root maps to `<dest>` and `a/b` to `<dest>/a/b`.
 *
 * `validatePack` has already rejected keys that escape the knowledge tree, but
 * it neither normalizes them in place nor does `readFolderSummaries` normalize
 * on read, so a surviving key may still be `''`, `.`, `/` or `foo/`. Collapsing
 * those here rather than emitting `<dest>/.` and leaving `writeFolderSummaries`
 * to clean it up afterwards is what makes `manifest.summary` unconditionally
 * authoritative: two root-equivalent pack keys would otherwise reach the map as
 * distinct entries and their post-hoc collapse would resolve by insertion
 * order, letting a pack root entry beat the manifest.
 */
function destinationKeyForPackKey(key: string, destinationName: string): string {
  const normalized = posix.normalize(key.split(sep).join(posix.sep));
  if (normalized === '.' || normalized === '/') return destinationName;
  const trimmed = normalized.replace(/\/+$/u, '');
  return trimmed === '' ? destinationName : `${destinationName}/${trimmed}`;
}

function parseGitHubSource(source: string): GitHubRepo | null {
  const shorthand = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(source);
  if (shorthand) return { owner: shorthand[1]!, repo: shorthand[2]!.replace(/\.git$/, '') };

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
  const [owner, repo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

async function resolveGitHubTarballUrl(repo: GitHubRepo): Promise<string> {
  const latest = await fetchJson(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`
  );
  if (latest.status === 200) {
    const tarball = latest.json['tarball_url'];
    if (typeof tarball !== 'string' || tarball === '') {
      throw new Error(`latest release for ${repo.owner}/${repo.repo} has no tarball_url`);
    }
    return tarball;
  }
  if (latest.status !== 404) {
    throw new Error(`GitHub latest release lookup failed with HTTP ${latest.status}`);
  }

  const info = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}`);
  if (info.status !== 200) {
    throw new Error(`GitHub repository lookup failed with HTTP ${info.status}`);
  }
  const branch = info.json['default_branch'];
  if (typeof branch !== 'string' || branch === '') {
    throw new Error(`GitHub repository ${repo.owner}/${repo.repo} has no default_branch`);
  }
  return `https://api.github.com/repos/${repo.owner}/${repo.repo}/tarball/${encodeURIComponent(branch)}`;
}

async function fetchJson(url: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return { status: response.status, json: {} };
  const parsed = (await response.json()) as unknown;
  return {
    status: response.status,
    json:
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {},
  };
}

async function downloadTarball(url: string, file: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    throw new Error(`tarball download failed with HTTP ${response.status}`);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function extractTarball(tarball: string, destination: string): Promise<void> {
  mkdirSync(destination, { recursive: true });
  await exec('tar', ['-xzf', tarball, '-C', destination]);
}

function locatePackRoot(extractedDir: string): string {
  const matches: string[] = [];
  const walk = (dir: string): void => {
    if (existsSync(join(dir, PACK_MANIFEST_FILENAME))) {
      matches.push(dir);
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
    }
  };
  walk(extractedDir);
  if (matches.length === 0) {
    throw new Error(
      `extracted pack does not contain ${PACK_MANIFEST_FILENAME} at the root or a wrapping directory`
    );
  }
  if (matches.length > 1) {
    const rel = matches.map(match => relative(extractedDir, match) || basename(match)).sort();
    throw new Error(`extracted pack contains multiple manifests: ${rel.join(', ')}`);
  }
  const [root] = matches;
  if (!root || !statSync(root).isDirectory()) {
    throw new Error(`located pack root is not a directory`);
  }
  return root;
}
