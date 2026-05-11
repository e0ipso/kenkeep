import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeAdapter } from '../adapters/claude.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { packageVersion } from '../lib/version.js';

export interface InitOptions {
  assistants: string[];
  force?: boolean;
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
  '.ai/.kb-builder/state.json',
  '.ai/.kb-builder/bootstrap-state.json',
];

const SUPPORTED_ASSISTANTS = new Set(['claude']);

export async function runInit(opts: InitOptions): Promise<void> {
  for (const a of opts.assistants) {
    if (!SUPPORTED_ASSISTANTS.has(a)) {
      throw new Error(
        `Unsupported assistant '${a}'. v1 only supports: ${[...SUPPORTED_ASSISTANTS].join(', ')}.`,
      );
    }
  }
  if (!opts.assistants.includes('claude')) {
    throw new Error('Assistant list must include "claude" (the only assistant supported in v1).');
  }

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const templatesDir = packageTemplatesDir();
  if (!existsSync(templatesDir)) {
    throw new Error(
      `Templates directory not found at ${templatesDir}. Run \`npm run build\` if developing locally.`,
    );
  }

  log.info(`Initializing in ${root}`);

  // Already initialized?
  if (existsSync(paths.installedVersionFile) && !opts.force) {
    const existing = JSON.parse(
      readFileSync(paths.installedVersionFile, 'utf8'),
    ) as InstalledVersion;
    log.warn(
      `Already initialized (version ${existing.version}). Re-run with --force to overwrite templates.`,
    );
    return;
  }

  // 1. Knowledge-base skeleton.
  copyTree(join(templatesDir, 'knowledge-base'), paths.kbDir);

  // 2. Claude-specific files (commands + settings + hooks).
  if (opts.assistants.includes('claude')) {
    const claudeAdapter = new ClaudeAdapter();
    const claudeTemplateDir = join(templatesDir, 'claude');
    if (existsSync(claudeTemplateDir)) {
      copyTree(claudeTemplateDir, paths.claudeDir);
    }
    await claudeAdapter.writeHookConfig(root, [
      { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.mjs' },
      { event: 'SessionEnd', scriptPath: '.claude/hooks/kb-capture.mjs' },
      { event: 'PreCompact', scriptPath: '.claude/hooks/kb-capture.mjs' },
      {
        event: 'SessionStart',
        scriptPath: '.claude/hooks/kb-stage2-drain.mjs',
        async: true,
      },
    ]);
  }

  // 3. Prompts under .ai/.kb-builder/prompts (for local override).
  const promptsSrc = join(templatesDir, 'prompts');
  if (existsSync(promptsSrc)) {
    copyTree(promptsSrc, join(paths.builderDir, 'prompts'));
  }

  // 4. Pre-commit secret-scan config (only if not already present).
  installPreCommitConfig(paths.preCommitConfigFile, templatesDir);

  // 5. Update .gitignore.
  updateGitignore(paths.gitignoreFile);

  // 6. Write installed-version marker.
  const installed: InstalledVersion = {
    schema_version: 1,
    package: '@e0ipso/ai-knowledge-base',
    version: packageVersion(),
    installed_at: new Date().toISOString(),
    assistants: opts.assistants,
  };
  mkdirSync(paths.builderDir, { recursive: true });
  writeFileSync(paths.installedVersionFile, `${JSON.stringify(installed, null, 2)}\n`);

  log.success('Initialized.');
  log.plain('');
  log.plain('Next steps:');
  log.plain('  1. Review and commit `.ai/knowledge-base/`, `.claude/`, `.pre-commit-config.yaml`,');
  log.plain('     and the updated `.gitignore`.');
  log.plain('  2. Install pre-commit (https://pre-commit.com) and run `pre-commit install`.');
  log.plain('  3. Run `ai-knowledge-base doctor` to verify the setup.');
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

function installPreCommitConfig(target: string, templatesDir: string): void {
  const src = join(templatesDir, 'precommit', 'pre-commit-config.yaml');
  if (!existsSync(src)) return;
  if (existsSync(target)) {
    log.warn(
      'A .pre-commit-config.yaml already exists; not overwriting. ' +
        'Add the gitleaks repo entry manually if needed (see docs).',
    );
    return;
  }
  writeFileSync(target, readFileSync(src, 'utf8'));
}

function updateGitignore(file: string): void {
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (existing.includes(GITIGNORE_BLOCK_START)) {
    // Update in place.
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
