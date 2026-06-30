import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { copyTree } from '../lib/fs-atomic.js';
import { runLint, type LintEntry } from '../lib/lint.js';
import { log } from '../lib/log.js';
import { PACK_KNOWLEDGE_DIRNAME, PACK_MANIFEST_FILENAME } from '../lib/pack.js';
import { InvalidNodeFrontmatterError, OldLayoutError, readAllNodes } from '../lib/nodes.js';
import { findKenkeepRoot, repoPaths } from '../lib/paths.js';
import { NODE_SCHEMA_VERSION, PackManifestSchema, type PackManifest } from '../lib/schemas.js';

const PACK_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

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
    mkdirSync(dirname(resolved.outDir), { recursive: true });
    const tmpOut = mkdtempSync(
      join(dirname(resolved.outDir), `.${basename(resolved.outDir)}-tmp-`)
    );
    try {
      const knowledgeOut = join(tmpOut, PACK_KNOWLEDGE_DIRNAME);
      copyTree(paths.nodesDir, knowledgeOut);
      writeManifest(tmpOut, resolved.manifest);
      writeReadme(tmpOut, resolved.manifest);

      const lint = runLint({ nodesDir: knowledgeOut });
      reportLint(lint.errors, lint.findings);
      if (lint.errors.length > 0) {
        rmSync(tmpOut, { recursive: true, force: true });
        log.error('pack export: lint errors blocked export; output was not written.');
        return 1;
      }

      rmSync(resolved.outDir, { recursive: true, force: true });
      renameSync(tmpOut, resolved.outDir);

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
