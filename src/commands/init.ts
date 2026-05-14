import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { HOOK_SPECS } from '../lib/hook-spec.js';
import { writeClaudeHookConfig } from '../lib/hooks-config.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { defaultProjectConfigBody } from '../lib/settings.js';
import { packageVersion } from '../lib/version.js';

export interface InitOptions {
  assistants: string[];
  force?: boolean;
  upgrade?: boolean;
}

interface InstalledVersion {
  schema_version: 1;
  package: string;
  version: string;
  installed_at: string;
  assistants: string[];
}

const GITIGNORE_BLOCK_START = '# >>> @e0ipso/ai-knowledge-base >>>';
const GITIGNORE_BLOCK_END = '# <<< @e0ipso/ai-knowledge-base <<<';

const GITIGNORE_LINES = [
  '.ai/knowledge-base/_sessions/',
  '.ai/knowledge-base/_logs/',
  '.ai/knowledge-base/.state/state.json',
  '.ai/knowledge-base/.state/bootstrap-state.json',
];

const SUPPORTED_ASSISTANTS = new Set(['claude']);

export async function runInit(opts: InitOptions): Promise<void> {
  validateAssistants(opts.assistants);

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
  if (existsSync(paths.installedVersionFile) && !opts.force) {
    const existing = JSON.parse(
      readFileSync(paths.installedVersionFile, 'utf8')
    ) as InstalledVersion;
    log.warn(
      `Already initialized (version ${existing.version}). Re-run with --force to overwrite templates, or use \`init --upgrade\` to refresh templates while preserving local prompt overrides and \`config.yaml\`.`
    );
    return;
  }

  // 1. Knowledge-base skeleton.
  copyTree(join(templatesDir, 'knowledge-base'), paths.kbDir);

  // 2. Claude-specific files (commands + settings + hooks).
  await installClaude(opts.assistants, templatesDir, paths.claudeDir, root);

  // 3. Prompts under .ai/knowledge-base/.config/prompts (for local override).
  const promptsSrc = join(templatesDir, 'prompts');
  if (existsSync(promptsSrc)) {
    copyTree(promptsSrc, paths.promptsDir);
  }

  // 4. Update .gitignore.
  updateGitignore(paths.gitignoreFile);

  // 5. Write default settings file unless one is already present. `--force`
  // intentionally does not overwrite an existing config.yaml; users edit it.
  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  } else if (opts.force) {
    log.warn(
      `.ai/knowledge-base/config.yaml already exists; not overwriting (use \`init --upgrade\` to refresh templates without touching settings).`
    );
  }

  // 6. Write installed-version marker.
  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.assistants);

  log.success('Initialized.');
  log.plain('');
  log.plain('Next steps:');
  log.plain('  1. Review and commit `.ai/knowledge-base/`, `.claude/`, and the updated `.gitignore`.');
  log.plain('  2. Run `npx @e0ipso/ai-knowledge-base doctor` to verify the setup.');
}

function validateAssistants(assistants: string[]): void {
  for (const a of assistants) {
    if (!SUPPORTED_ASSISTANTS.has(a)) {
      throw new Error(
        `Unsupported assistant '${a}'. v1 only supports: ${[...SUPPORTED_ASSISTANTS].join(', ')}.`
      );
    }
  }
  if (!assistants.includes('claude')) {
    throw new Error('Assistant list must include "claude" (the only assistant supported in v1).');
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
      'Not initialized. Run `npx @e0ipso/ai-knowledge-base init --assistants claude` for a first-time install.'
    );
  }
  const current = packageVersion();
  log.info(`Upgrading in ${root} to ${current}`);

  copyTree(join(templatesDir, 'claude', 'hooks'), paths.claudeHooksDir);
  copyTree(join(templatesDir, 'claude', 'skills'), paths.claudeSkillsDir);

  await installClaude(opts.assistants, templatesDir, paths.claudeDir, root);

  copyPromptsPreservingLocal(join(templatesDir, 'prompts'), paths.promptsDir);

  updateGitignore(paths.gitignoreFile);

  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  }

  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.assistants);

  log.success(`Upgraded to ${current}.`);
  log.plain('Run `npx @e0ipso/ai-knowledge-base doctor` to verify.');
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

async function installClaude(
  assistants: string[],
  templatesDir: string,
  claudeDir: string,
  root: string
): Promise<void> {
  if (!assistants.includes('claude')) return;
  const claudeTemplateDir = join(templatesDir, 'claude');
  if (existsSync(claudeTemplateDir)) {
    copyTree(claudeTemplateDir, claudeDir);
  }
  await writeClaudeHookConfig(
    root,
    HOOK_SPECS.map(spec => ({
      event: spec.event,
      scriptPath: `.claude/hooks/${spec.scriptPath}`,
      ...(spec.async ? { async: true } : {}),
    }))
  );
}

function writeInstalledVersion(file: string, stateDir: string, assistants: string[]): void {
  const installed: InstalledVersion = {
    schema_version: 1,
    package: '@e0ipso/ai-knowledge-base',
    version: packageVersion(),
    installed_at: new Date().toISOString(),
    assistants,
  };
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(installed, null, 2)}\n`);
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

function updateGitignore(file: string): void {
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (existing.includes(GITIGNORE_BLOCK_START)) {
    // Update in place: replace the managed block entirely.
    const before = existing.slice(0, existing.indexOf(GITIGNORE_BLOCK_START));
    const afterStart = existing.indexOf(GITIGNORE_BLOCK_END);
    const after = afterStart >= 0 ? existing.slice(afterStart + GITIGNORE_BLOCK_END.length) : '';
    const next = `${before}${buildBlock()}${after}`;
    writeFileSync(file, ensureTrailingNewline(next));
    return;
  }
  const sep = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  writeFileSync(file, `${existing}${sep}${buildBlock()}\n`);
}

function buildBlock(): string {
  return `${GITIGNORE_BLOCK_START}\n${GITIGNORE_LINES.join('\n')}\n${GITIGNORE_BLOCK_END}\n`;
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}
