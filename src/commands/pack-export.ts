import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  folderSummariesFileForNodesDir,
  readFolderSummaries,
  writeFolderSummaries,
} from '../lib/folder-summaries.js';
import { copyTree } from '../lib/fs-atomic.js';
import { runLint, type LintEntry } from '../lib/lint.js';
import { log } from '../lib/log.js';
import { PACK_KNOWLEDGE_DIRNAME, PACK_MANIFEST_FILENAME } from '../lib/pack.js';
import { InvalidNodeFrontmatterError, OldLayoutError, readAllNodes } from '../lib/nodes.js';
import { findKenkeepRoot, repoPaths, type RepoPaths } from '../lib/paths.js';
import { isWithin, PACK_NAME_PATTERN } from '../lib/path-safety.js';
import { NODE_SCHEMA_VERSION, PackManifestSchema, type PackManifest } from '../lib/schemas.js';

export type PromptFn = (label: string) => Promise<string>;

export interface PackExportOptions {
  name?: string | undefined;
  version?: string | undefined;
  summary?: string | undefined;
  homepage?: string | undefined;
  out?: string | undefined;
  prompt?: PromptFn | undefined;
}

interface ResolvedExport {
  manifest: PackManifest;
  outDir: string;
}

export async function runPackExportCommand(opts: PackExportOptions = {}): Promise<number> {
  try {
    const root = findKenkeepRoot();
    if (!root) {
      log.error('pack export: kenkeep is not initialized in this repo.');
      return 1;
    }
    const paths = repoPaths(root);
    if (!existsSync(paths.nodesDir) || !isDirectory(paths.nodesDir)) {
      log.error(
        `pack export: knowledge base nodes/ directory does not exist at ${paths.nodesDir}.`
      );
      return 1;
    }

    const nodes = readAllNodes(paths.nodesDir);
    const resolved = await resolveExportOptions(opts);
    assertWritableOutput(resolved.outDir, paths);
    mkdirSync(dirname(resolved.outDir), { recursive: true });
    const tmpOut = mkdtempSync(
      join(dirname(resolved.outDir), `.${basename(resolved.outDir)}-tmp-`)
    );
    try {
      const knowledgeOut = join(tmpOut, PACK_KNOWLEDGE_DIRNAME);
      copyTree(paths.nodesDir, knowledgeOut);
      const unsummarized = writePackFolderSummaries(paths.nodesDir, knowledgeOut);
      writeManifest(tmpOut, resolved.manifest);
      writeReadme(tmpOut, resolved.manifest);

      const lint = runLint({ nodesDir: knowledgeOut });
      reportLint(lint.errors, lint.findings);
      reportMissingFolderSummaries(unsummarized);
      if (lint.errors.length > 0) {
        rmSync(tmpOut, { recursive: true, force: true });
        log.error('pack export: lint errors blocked export; output was not written.');
        return 1;
      }

      publishOwnedEntries(tmpOut, resolved.outDir);
      rmSync(tmpOut, { recursive: true, force: true });

      log.plain('Manifest:');
      log.plain(
        yaml
          .dump(resolved.manifest, { indent: 2, lineWidth: 0, noRefs: true, sortKeys: true })
          .trimEnd()
      );
      log.plain(`Output: ${resolved.outDir}`);
      log.plain(`Nodes exported: ${nodes.length}`);
      log.success(`Lint passed with ${lint.findings.length} finding(s).`);
      log.plain('');
      log.plain('Next steps:');
      log.plain(`  1. Review ${resolved.outDir}/.`);
      log.plain('  2. Publish that directory as a pack repository.');
      log.plain(`  3. Consumers can run: npx kenkeep pack import <this-repo>`);
      return 0;
    } catch (err) {
      rmSync(tmpOut, { recursive: true, force: true });
      throw err;
    }
  } catch (err) {
    if (err instanceof InvalidNodeFrontmatterError || err instanceof OldLayoutError) {
      log.error(`pack export: ${err.message}`);
      return 1;
    }
    log.error(`pack export: ${(err as Error).message}`);
    return 1;
  }
}

/**
 * The paths export owns inside an output directory, manifest last. Export
 * replaces exactly these and never touches anything else there, so a pack
 * repository's `.git`, license or CI files survive a re-export.
 */
function ownedEntries(dir: string): string[] {
  const knowledge = join(dir, PACK_KNOWLEDGE_DIRNAME);
  return [
    knowledge,
    folderSummariesFileForNodesDir(knowledge),
    join(dir, 'README.md'),
    join(dir, PACK_MANIFEST_FILENAME),
  ];
}

/**
 * Export writes to a missing or empty directory, or to one that already holds
 * a pack. It refuses a symlink, a file, any other non-empty directory, and an
 * output whose entries would land inside or over the kenkeep directory.
 */
function assertWritableOutput(outDir: string, paths: RepoPaths): void {
  const refuse = (why: string): never => {
    throw new Error(`refusing to write to ${outDir}: ${why}`);
  };
  const outStat = lstatOrNull(outDir);
  if (outStat?.isSymbolicLink()) refuse('it is a symlink; point --out at a real directory.');
  if (outStat && !outStat.isDirectory()) refuse('it is not a directory.');

  const kkDir = canonicalPath(paths.kkDir);
  for (const entry of ownedEntries(canonicalPath(outDir))) {
    if (isWithin(kkDir, entry) || isWithin(entry, kkDir)) {
      refuse('the pack would be written inside or over the kenkeep directory.');
    }
  }

  if (outStat && readdirSync(outDir).length > 0 && !isPackOutput(outDir)) {
    refuse(
      `it is not empty and holds no kenkeep pack (${PACK_MANIFEST_FILENAME}). Use a new or empty directory, or a previous pack export.`
    );
  }
}

/**
 * Moves the staged entries into the output. A file rename replaces its target
 * in one step; a directory cannot be renamed over, so the old one goes first.
 */
function publishOwnedEntries(stagedDir: string, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const targets = ownedEntries(outDir);
  ownedEntries(stagedDir).forEach((source, i) => {
    const target = targets[i]!;
    const existing = lstatOrNull(target);
    if (existing && (existing.isDirectory() || lstatSync(source).isDirectory())) {
      rmSync(target, { recursive: true, force: true });
    }
    renameSync(source, target);
  });
}

/**
 * Any positive `schema_version`, so a pack exported before a node-schema bump
 * still counts as one.
 */
const PriorPackManifestSchema = PackManifestSchema.extend({
  schema_version: z.number().int().positive(),
});

/** A directory holds a pack when its `kenkeep-pack.yaml` is a regular file that parses as a manifest. */
function isPackOutput(dir: string): boolean {
  const manifestFile = join(dir, PACK_MANIFEST_FILENAME);
  if (!lstatOrNull(manifestFile)?.isFile()) return false;
  try {
    return PriorPackManifestSchema.safeParse(yaml.load(readFileSync(manifestFile, 'utf8'))).success;
  } catch {
    return false;
  }
}

/**
 * `path` with its deepest existing ancestor resolved through `realpath`, so
 * `.`/`..`, symlinked parents and tmpdir aliases compare by real location.
 */
function canonicalPath(path: string): string {
  const abs = resolve(path);
  const missing: string[] = [];
  let cursor = abs;
  while (true) {
    try {
      return join(realpathSync(cursor), ...missing.reverse());
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) return abs;
      missing.push(basename(cursor));
      cursor = parent;
    }
  }
}

function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

async function resolveExportOptions(opts: PackExportOptions): Promise<ResolvedExport> {
  const prompt = opts.prompt ?? promptUser;
  const name = await requiredField('name', opts.name, prompt, validatePackName);
  const version = await requiredField('version', opts.version, prompt);
  const summary = await requiredField('summary', opts.summary, prompt);
  const manifestInput = {
    name,
    version,
    schema_version: NODE_SCHEMA_VERSION,
    summary,
    ...(opts.homepage !== undefined && opts.homepage !== '' ? { homepage: opts.homepage } : {}),
  };
  const parsed = PackManifestSchema.safeParse(manifestInput);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`manifest is invalid: ${issues}`);
  }
  const outDir = opts.out && opts.out !== '' ? opts.out : 'dist';
  return {
    manifest: parsed.data,
    outDir: isAbsolute(outDir) ? outDir : resolve(process.cwd(), outDir),
  };
}

async function requiredField(
  label: string,
  value: string | undefined,
  prompt: PromptFn,
  validate?: (value: string) => string | null
): Promise<string> {
  let current = value?.trim() ?? '';
  while (current === '') {
    current = (await prompt(label)).trim();
  }
  while (validate) {
    const error = validate(current);
    if (!error) break;
    if (value !== undefined) throw new Error(error);
    log.error(error);
    current = (await prompt(label)).trim();
  }
  return current;
}

function validatePackName(value: string): string | null {
  if (PACK_NAME_PATTERN.test(value)) return null;
  return `name "${value}" must match ${PACK_NAME_PATTERN.source}`;
}

async function promptUser(label: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(`${label}: `);
  } finally {
    rl.close();
  }
}

function writeManifest(outDir: string, manifest: PackManifest): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, PACK_MANIFEST_FILENAME),
    yaml.dump(manifest, { indent: 2, lineWidth: 0, noRefs: true, sortKeys: true })
  );
}

function writeReadme(outDir: string, manifest: PackManifest): void {
  const lines = [
    `# ${manifest.name}`,
    '',
    manifest.summary,
    '',
    `Version: ${manifest.version}`,
    '',
    '## Import',
    '',
    '```sh',
    'npx kenkeep pack import <this-repo>',
    '```',
    '',
  ];
  writeFileSync(join(outDir, 'README.md'), lines.join('\n'));
}

/**
 * Ship the knowledge base's folder summary registry with the pack, pruned to
 * the folders the exported tree actually contains, reusing the same notion of
 * "which folders count" that `harvestFolderSummaries` applies in memory.
 *
 * The staged tree is `<tmp>/knowledge`, so `writeFolderSummaries` resolves the
 * sibling file `<tmp>/knowledge.FOLDER_SUMMARIES.md` at the pack root; the
 * later rename carries it into the published directory. Returns the exported
 * folders that carry no summary, for warn-level reporting by the caller.
 */
function writePackFolderSummaries(nodesDir: string, knowledgeOut: string): string[] {
  const registry = readFolderSummaries(nodesDir);
  const pruned = new Map<string, string>();
  const missing: string[] = [];
  for (const folder of collectExportedFolders(knowledgeOut)) {
    const summary = registry.get(folder);
    if (summary !== undefined) pruned.set(folder, summary);
    // The root folder's summary lives in ENTRY.md, not the registry, so its
    // absence here is the normal state rather than a gap worth warning about.
    else if (folder !== '') missing.push(folder);
  }
  writeFolderSummaries(knowledgeOut, pruned);
  return missing;
}

/** Every folder in the exported tree as a POSIX path relative to its root, root included as `''`. */
function collectExportedFolders(knowledgeOut: string): string[] {
  const folders = [''];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      folders.push(relative(knowledgeOut, fullPath).split(sep).join(posix.sep));
      walk(fullPath);
    }
  };
  walk(knowledgeOut);
  return folders;
}

/**
 * An exported folder with no summary leaves consumers without routing text for
 * that branch. The author is told before publishing, but an incomplete registry
 * never blocks an export.
 */
function reportMissingFolderSummaries(folders: string[]): void {
  for (const folder of folders) {
    log.warn(
      `folder-summary: ${folder === '' ? '.' : folder}: exported folder has no summary; consumers will get no routing text for it.`
    );
  }
}

function reportLint(errors: LintEntry[], findings: LintEntry[]): void {
  for (const error of errors) {
    log.error(`${error.rule}: ${error.file}: ${error.message}`);
  }
  for (const finding of findings) {
    log.warn(`${finding.rule}: ${finding.file}: ${finding.message}`);
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
