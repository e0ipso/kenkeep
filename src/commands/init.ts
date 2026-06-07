import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { refreshClaudeTemplates } from '../harnesses/claude/install.js';
import { getHarness, hasHarness, listHarnessIds } from '../harnesses/registry.js';
import { copyTree } from '../lib/fs-atomic.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { ensureKbignore } from '../lib/kkignore-stub.js';
import { KK_NAVIGATION_DIRECTIVE } from '../lib/session-start.js';
import { defaultProjectConfigBody } from '../lib/settings.js';
import { packageVersion } from '../lib/version.js';

export interface InitOptions {
  harnesses: string[];
  upgrade?: boolean;
}

interface InstalledVersion {
  schema_version: 1;
  package: string;
  version: string;
  installed_at: string;
  harnesses: string[];
}

const AGENTS_BLOCK_START = '<!-- >>> kenkeep:kk-index >>> -->';
const AGENTS_BLOCK_END = '<!-- <<< kenkeep:kk-index <<< -->';
// The static kk-index pointer block. It enters the knowledge base at the entry
// catalog and then reuses the exact descent wording shipped by the
// SessionStart hook, so the always-on file surface and the hook surface share
// one source of truth and cannot drift. The descent body itself is never
// re-typed here; it comes from KK_NAVIGATION_DIRECTIVE.
const AGENTS_POINTER = [
  'Curated project knowledge lives in [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the entry catalog of the knowledge base. Enter there and descend before designing a non-trivial change:',
  '',
  KK_NAVIGATION_DIRECTIVE,
].join('\n');

const KENKEEP_GITIGNORE_LINES = [
  '_sessions/',
  '_logs/',
  '.state/',
  '!.state/installed-version',
];

export async function runInit(opts: InitOptions): Promise<void> {
  validateHarnesses(opts.harnesses);

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const templatesDir = packageTemplatesDir();
  if (!existsSync(templatesDir)) {
    throw new Error(
      `Templates directory not found at ${templatesDir}. Run \`npm run build\` if developing locally.`
    );
  }

  if (opts.upgrade) {
    await runUpgrade(opts, root, paths, templatesDir);
    return;
  }

  log.info(`Initializing in ${root}`);

  // Already initialized?
  if (existsSync(paths.installedVersionFile)) {
    const existing = JSON.parse(
      readFileSync(paths.installedVersionFile, 'utf8')
    ) as InstalledVersion;
    log.warn(
      `Already initialized (version ${existing.version}). Use \`init --upgrade\` to refresh templates while preserving local prompt overrides and \`config.yaml\`.`
    );
    return;
  }

  // 1. Kenkeep skeleton.
  copyTree(join(templatesDir, 'kenkeep'), paths.kkDir);

  // 2. Per-harness files (templates + hook registration). Each adapter in
  //    src/harnesses/<id>/ knows where its own files live.
  for (const id of opts.harnesses) {
    const adapter = getHarness(id);
    await adapter.install({ root, paths, templatesDir, upgrade: false });
  }

  // 3. Prompts under .ai/kenkeep/.config/prompts (for local override).
  const promptsSrc = join(templatesDir, 'prompts');
  if (existsSync(promptsSrc)) {
    copyTree(promptsSrc, paths.promptsDir);
  }

  // 4. Write .ai/kenkeep/.gitignore and update AGENTS.md. The project's
  //    root .gitignore is intentionally untouched.
  ensureKbGitignore(paths.kkGitignoreFile);
  updateAgentsMd(join(root, 'AGENTS.md'));

  // 4b. Emit `.kkignore` stub. Never overwrites: user-edited scope is sacred.
  const kkignore = ensureKbignore(root);
  if (kkignore.written) {
    log.info(`Wrote default .kkignore at ${kkignore.path}`);
  }

  // 5. Write default settings file unless one is already present. Users edit
  // config.yaml; init never overwrites it.
  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kkDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  }

  // 6. Write installed-version marker.
  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.harnesses);

  log.success('Initialized.');
  log.plain('');
  log.plain('Next steps:');
  const harnessDirs = opts.harnesses
    .map(id => {
      const adapter = getHarness(id);
      const dir = adapter.paths(root).dir;
      const rel = dir.startsWith(root) ? dir.slice(root.length).replace(/^\//, '') : dir;
      if (id === 'codex') {
        return `\`${rel}/\` and \`.agents/skills/\``;
      }
      return `\`${rel}/\``;
    })
    .join(', ');
  log.plain(`  1. Review and commit \`.ai/kenkeep/\` and ${harnessDirs}.`);
  log.plain('  2. Run `npx kenkeep doctor` to verify the setup.');
}

function validateHarnesses(harnesses: string[]): void {
  if (harnesses.length === 0) {
    throw new Error(
      `--harnesses requires at least one entry. Supported: ${listHarnessIds().join(', ')}.`
    );
  }
  for (const h of harnesses) {
    if (!hasHarness(h)) {
      throw new Error(`Unsupported harness '${h}'. Supported: ${listHarnessIds().join(', ')}.`);
    }
  }
}

async function runUpgrade(
  opts: InitOptions,
  root: string,
  paths: ReturnType<typeof repoPaths>,
  templatesDir: string
): Promise<void> {
  if (!existsSync(paths.installedVersionFile)) {
    throw new Error(
      'Not initialized. Run `npx kenkeep init --harnesses claude` for a first-time install.'
    );
  }
  const current = packageVersion();
  log.info(`Upgrading in ${root} to ${current}`);

  // Force-refresh shipped templates for the Claude adapter before re-running
  // its installer. Other adapters that need a similar pre-step can expose it
  // through their own modules.
  refreshClaudeTemplates({ root, paths, templatesDir, upgrade: true });

  for (const id of opts.harnesses) {
    const adapter = getHarness(id);
    await adapter.upgrade({ root, paths, templatesDir, upgrade: true });
  }

  copyPromptsPreservingLocal(join(templatesDir, 'prompts'), paths.promptsDir);

  ensureKbGitignore(paths.kkGitignoreFile);
  updateAgentsMd(join(root, 'AGENTS.md'));

  const kkignore = ensureKbignore(root);
  if (kkignore.written) {
    log.info(`Wrote default .kkignore at ${kkignore.path}`);
  }

  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kkDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  }

  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.harnesses);

  log.success(`Upgraded to ${current}.`);
  log.plain('Run `npx kenkeep doctor` to verify.');
}

function copyPromptsPreservingLocal(src: string, dst: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const srcPath = join(src, name);
    const dstPath = join(dst, name);
    if (existsSync(dstPath)) {
      // Preserve any existing prompt (treat as local override).
      continue;
    }
    cpSync(srcPath, dstPath);
  }
}

function writeInstalledVersion(file: string, stateDir: string, harnesses: string[]): void {
  const installed: InstalledVersion = {
    schema_version: 1,
    package: 'kenkeep',
    version: packageVersion(),
    installed_at: new Date().toISOString(),
    harnesses,
  };
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(installed, null, 2)}\n`);
}


/**
 * Writes `.ai/kenkeep/.gitignore` with the canonical entries if it
 * doesn't already exist. Once written, the file is treated as user-owned;
 * upgrades will not overwrite local edits.
 */
function ensureKbGitignore(file: string): void {
  if (existsSync(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${KENKEEP_GITIGNORE_LINES.join('\n')}\n`);
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

function updateAgentsMd(file: string): void {
  const block = `${AGENTS_BLOCK_START}\n${AGENTS_POINTER}\n${AGENTS_BLOCK_END}`;
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';

  if (existing.includes(AGENTS_BLOCK_START)) {
    const before = existing.slice(0, existing.indexOf(AGENTS_BLOCK_START));
    const afterStart = existing.indexOf(AGENTS_BLOCK_END);
    const afterRaw =
      afterStart >= 0 ? existing.slice(afterStart + AGENTS_BLOCK_END.length) : '';
    const after = afterRaw.startsWith('\n') ? afterRaw.slice(1) : afterRaw;
    writeFileSync(file, ensureTrailingNewline(`${before}${block}\n${after}`));
    return;
  }

  if (existing.length === 0) {
    writeFileSync(file, `${block}\n`);
    return;
  }
  const sep = existing.endsWith('\n') ? '' : '\n';
  writeFileSync(file, `${existing}${sep}\n${block}\n`);
}
