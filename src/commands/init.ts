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

  // 4. Commit-time secret-scan scaffold (husky + lint-staged + secretlint).
  installCommitScan(paths, templatesDir);

  // 5. Update .gitignore.
  updateGitignore(paths.gitignoreFile);

  // 6. Write default settings file unless one is already present. `--force`
  // intentionally does not overwrite an existing config.yaml — users edit it.
  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  } else if (opts.force) {
    log.warn(
      `.ai/knowledge-base/config.yaml already exists; not overwriting (use \`init --upgrade\` to refresh templates without touching settings).`
    );
  }

  // 7. Write installed-version marker.
  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.assistants);

  log.success('Initialized.');
  log.plain('');
  log.plain('Next steps:');
  log.plain('  1. Review and commit `.ai/knowledge-base/`, `.claude/`, `.secretlintrc.json`,');
  log.plain('     `.husky/`, the package.json changes, and the updated `.gitignore`.');
  log.plain('  2. Run `npm install` so husky activates the pre-commit hook in your local clone.');
  log.plain('  3. Run `ai-knowledge-base doctor` to verify the setup.');
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
      'Not initialized. Run `ai-knowledge-base init --assistants claude` for a first-time install.'
    );
  }
  const current = packageVersion();
  log.info(`Upgrading in ${root} to ${current}`);

  copyTree(join(templatesDir, 'claude', 'hooks'), paths.claudeHooksDir);
  copyTree(join(templatesDir, 'claude', 'skills'), paths.claudeSkillsDir);

  await installClaude(opts.assistants, templatesDir, paths.claudeDir, root);

  copyPromptsPreservingLocal(join(templatesDir, 'prompts'), paths.promptsDir);

  updateGitignore(paths.gitignoreFile);

  installCommitScan(paths, templatesDir);

  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  }

  writeInstalledVersion(paths.installedVersionFile, paths.stateDir, opts.assistants);

  log.success(`Upgraded to ${current}.`);
  log.plain('Run `ai-knowledge-base doctor` to verify.');
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

interface CommitScanPathsForInit {
  secretlintrcFile: string;
  huskyDir: string;
  huskyPreCommitFile: string;
  packageJsonFile: string;
  lintstagedrcFile: string;
}

const SECRET_SCAN_DEV_DEPS: Record<string, string> = {
  husky: '^9.1.7',
  'lint-staged': '^17.0.4',
  secretlint: '^13.0.0',
  '@secretlint/secretlint-rule-preset-recommend': '^13.0.0',
};

/**
 * `.lintstagedrc.cjs` content. Serial execution is enforced by the
 * `--concurrent false` flag in `.husky/pre-commit`, so secretlint runs
 * before `index rebuild`. The function form on the nodes glob ignores
 * filenames so `index rebuild --stage` runs once per commit, not once
 * per staged node.
 */
const LINT_STAGED_RC = `module.exports = {
  '*': ['secretlint'],
  '.ai/knowledge-base/nodes/**/*.md': () => ['ai-knowledge-base index rebuild --stage'],
};
`;

function installCommitScan(paths: CommitScanPathsForInit, templatesDir: string): void {
  if (!existsSync(paths.packageJsonFile)) {
    throw new Error(
      'No package.json at repo root. The commit-time secret scan now runs via husky + ' +
        'lint-staged + secretlint, which requires a Node project. Initialize npm in this ' +
        'repo (e.g. `npm init -y`) or open an issue if you need non-Node support.'
    );
  }

  // .secretlintrc.json — write only if missing.
  const secretlintTemplate = join(templatesDir, 'secret-scan', 'secretlintrc.json');
  if (!existsSync(paths.secretlintrcFile) && existsSync(secretlintTemplate)) {
    writeFileSync(paths.secretlintrcFile, readFileSync(secretlintTemplate, 'utf8'));
  }

  // .husky/pre-commit — write only if missing. If present with different content, skip and warn.
  const huskyTemplate = join(templatesDir, 'husky', 'pre-commit');
  if (existsSync(huskyTemplate)) {
    mkdirSync(paths.huskyDir, { recursive: true });
    if (!existsSync(paths.huskyPreCommitFile)) {
      writeFileSync(paths.huskyPreCommitFile, readFileSync(huskyTemplate, 'utf8'), { mode: 0o755 });
    } else {
      const existing = readFileSync(paths.huskyPreCommitFile, 'utf8');
      if (!existing.includes('lint-staged')) {
        log.warn(
          '.husky/pre-commit exists but does not invoke lint-staged. Add `npx lint-staged` to it ' +
            'so secret scanning runs on every commit.'
        );
      }
    }
  }

  // .lintstagedrc.cjs — write only if missing (preserves user customizations).
  if (!existsSync(paths.lintstagedrcFile)) {
    writeFileSync(paths.lintstagedrcFile, LINT_STAGED_RC);
  }

  // package.json — patch devDeps + prepare script. Lint-staged config lives
  // in `.lintstagedrc.cjs` (above); we no longer add a `lint-staged` block to
  // package.json.
  patchPackageJsonForScan(paths.packageJsonFile);
}

function patchPackageJsonForScan(file: string): void {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    log.warn(`package.json unparseable (${(err as Error).message}); skipping scan-deps patch.`);
    return;
  }
  let changed = false;

  const devDeps = (pkg['devDependencies'] as Record<string, string> | undefined) ?? {};
  for (const [name, version] of Object.entries(SECRET_SCAN_DEV_DEPS)) {
    if (devDeps[name] === undefined) {
      devDeps[name] = version;
      changed = true;
    }
  }
  if (changed) pkg['devDependencies'] = devDeps;

  const scripts = (pkg['scripts'] as Record<string, string> | undefined) ?? {};
  if (scripts['prepare'] === undefined) {
    scripts['prepare'] = 'husky';
    pkg['scripts'] = scripts;
    changed = true;
  }

  if (changed) {
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
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
