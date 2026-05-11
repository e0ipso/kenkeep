import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { ClaudeAdapter } from '../adapters/claude.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { defaultProjectConfigBody } from '../lib/settings.js';
import { packageVersion } from '../lib/version.js';

export interface InitOptions {
  assistants: string[];
  force?: boolean;
  upgrade?: boolean;
  dryRun?: boolean;
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
  validateAssistants(opts.assistants);

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const templatesDir = packageTemplatesDir();
  if (!existsSync(templatesDir)) {
    throw new Error(
      `Templates directory not found at ${templatesDir}. Run \`npm run build\` if developing locally.`,
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
      readFileSync(paths.installedVersionFile, 'utf8'),
    ) as InstalledVersion;
    log.warn(
      `Already initialized (version ${existing.version}). Re-run with --force to overwrite templates, or use \`init --upgrade\` to refresh templates while preserving local prompt overrides and \`.config.json\`.`,
    );
    return;
  }

  // 1. Knowledge-base skeleton.
  copyTree(join(templatesDir, 'knowledge-base'), paths.kbDir);

  // 2. Claude-specific files (commands + settings + hooks).
  await installClaude(opts.assistants, templatesDir, paths.claudeDir, root);

  // 3. Prompts under .ai/.kb-builder/prompts (for local override).
  const promptsSrc = join(templatesDir, 'prompts');
  if (existsSync(promptsSrc)) {
    copyTree(promptsSrc, join(paths.builderDir, 'prompts'));
  }

  // 4. Pre-commit secret-scan config (only if not already present).
  installPreCommitConfig(paths.preCommitConfigFile, templatesDir);

  // 5. Update .gitignore.
  updateGitignore(paths.gitignoreFile);

  // 6. Write default settings file unless one is already present. `--force`
  // intentionally does not overwrite an existing .config.json — users edit it.
  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  } else if (opts.force) {
    log.warn(
      `.ai/knowledge-base/.config.json already exists; not overwriting (use \`init --upgrade\` to refresh templates without touching settings).`,
    );
  }

  // 7. Write installed-version marker.
  writeInstalledVersion(paths.installedVersionFile, paths.builderDir, opts.assistants);

  log.success('Initialized.');
  log.plain('');
  log.plain('Next steps:');
  log.plain('  1. Review and commit `.ai/knowledge-base/`, `.claude/`, `.pre-commit-config.yaml`,');
  log.plain('     and the updated `.gitignore`.');
  log.plain('  2. Install pre-commit (https://pre-commit.com) and run `pre-commit install`.');
  log.plain('  3. Run `ai-knowledge-base doctor` to verify the setup.');
}

function validateAssistants(assistants: string[]): void {
  for (const a of assistants) {
    if (!SUPPORTED_ASSISTANTS.has(a)) {
      throw new Error(
        `Unsupported assistant '${a}'. v1 only supports: ${[...SUPPORTED_ASSISTANTS].join(', ')}.`,
      );
    }
  }
  if (!assistants.includes('claude')) {
    throw new Error('Assistant list must include "claude" (the only assistant supported in v1).');
  }
}

interface UpgradeChange {
  kind:
    | 'hook-script'
    | 'skill'
    | 'legacy-command-cleanup'
    | 'prompt-new'
    | 'prompt-preserved'
    | 'hook-registration'
    | 'gitignore'
    | 'config-json'
    | 'pre-commit-config'
    | 'installed-version';
  detail: string;
}

const LEGACY_KB_COMMAND_FILES = [
  'kb-add.md',
  'kb-bootstrap.md',
  'kb-curate.md',
];

/**
 * Removes legacy `.claude/commands/kb-{add,bootstrap,curate}.md` files left
 * behind by older installs. Skills replaced the slash-command markdown layout
 * in v0.2; older repos may still carry these files alongside the new
 * `.claude/skills/` tree. Other files in `.claude/commands/` (user-authored
 * slash commands) are preserved.
 */
function removeLegacyKbCommands(commandsDir: string): string[] {
  if (!existsSync(commandsDir)) return [];
  const removed: string[] = [];
  for (const name of LEGACY_KB_COMMAND_FILES) {
    const file = join(commandsDir, name);
    if (existsSync(file)) {
      rmSync(file, { force: true });
      removed.push(name);
    }
  }
  return removed;
}

async function runUpgrade(
  opts: InitOptions,
  root: string,
  paths: ReturnType<typeof repoPaths>,
  templatesDir: string,
): Promise<void> {
  if (!existsSync(paths.installedVersionFile)) {
    throw new Error(
      'Not initialized. Run `ai-knowledge-base init --assistants claude` for a first-time install.',
    );
  }
  const installed = JSON.parse(
    readFileSync(paths.installedVersionFile, 'utf8'),
  ) as InstalledVersion;
  const current = packageVersion();

  log.info(`Upgrade preflight in ${root}`);
  log.plain(`  installed: ${installed.version}`);
  log.plain(`  package:   ${current}`);

  const changes = collectUpgradeChanges({
    installed,
    current,
    root,
    paths,
    templatesDir,
    assistants: opts.assistants,
  });

  if (changes.length === 0 && installed.version === current) {
    log.success(`Already at ${current}. Nothing to do.`);
    return;
  }

  log.plain('');
  log.plain('Planned changes:');
  for (const c of changes) {
    log.plain(`  • [${c.kind}] ${c.detail}`);
  }

  if (opts.dryRun) {
    log.plain('');
    log.success(`--dry-run: ${changes.length} change(s) listed; nothing written.`);
    return;
  }

  // Apply phase. Each function is idempotent so re-running is safe.
  log.plain('');
  log.info('Applying…');

  // Hook scripts + skills: overwrite from templates.
  copyTree(join(templatesDir, 'claude', 'hooks'), paths.claudeHooksDir);
  copyTree(join(templatesDir, 'claude', 'skills'), paths.claudeSkillsDir);

  // Clean up legacy slash-command markdown files left over from pre-skills installs.
  removeLegacyKbCommands(paths.claudeCommandsDir);

  // Refresh hook registrations in .claude/settings.json (preserves user-defined hooks).
  await installClaude(opts.assistants, templatesDir, paths.claudeDir, root);

  // Prompts: copy only those missing locally, preserve customized ones.
  copyPromptsPreservingLocal(join(templatesDir, 'prompts'), join(paths.builderDir, 'prompts'));

  // Gitignore: idempotent block update covers new lines.
  updateGitignore(paths.gitignoreFile);

  // Pre-commit config: only write if missing (init's existing behavior).
  installPreCommitConfig(paths.preCommitConfigFile, templatesDir);

  // Settings: only create if missing; never overwrite existing.
  if (!existsSync(paths.projectConfigFile)) {
    mkdirSync(paths.kbDir, { recursive: true });
    writeFileSync(paths.projectConfigFile, defaultProjectConfigBody());
  }

  // Stamp the new installed-version.
  writeInstalledVersion(paths.installedVersionFile, paths.builderDir, opts.assistants);

  log.success(`Upgraded to ${current}.`);
  log.plain('Run `ai-knowledge-base doctor` to verify.');
}

interface UpgradeContext {
  installed: InstalledVersion;
  current: string;
  root: string;
  paths: ReturnType<typeof repoPaths>;
  templatesDir: string;
  assistants: string[];
}

function collectUpgradeChanges(ctx: UpgradeContext): UpgradeChange[] {
  const out: UpgradeChange[] = [];

  // Hook scripts.
  const hookSrc = join(ctx.templatesDir, 'claude', 'hooks');
  if (existsSync(hookSrc)) {
    for (const name of readdirSync(hookSrc)) {
      const src = join(hookSrc, name);
      const dst = join(ctx.paths.claudeHooksDir, name);
      if (!existsSync(dst) || !filesEqual(src, dst)) {
        out.push({ kind: 'hook-script', detail: `refresh .claude/hooks/${name}` });
      }
    }
  }

  // Skills (one directory per skill containing SKILL.md + supporting files).
  const skillSrc = join(ctx.templatesDir, 'claude', 'skills');
  if (existsSync(skillSrc)) {
    for (const skillName of readdirSync(skillSrc)) {
      const srcDir = join(skillSrc, skillName);
      if (!statSync(srcDir).isDirectory()) continue;
      const dstDir = join(ctx.paths.claudeSkillsDir, skillName);
      if (!existsSync(dstDir) || !skillDirsEqual(srcDir, dstDir)) {
        out.push({ kind: 'skill', detail: `refresh .claude/skills/${skillName}/` });
      }
    }
  }

  // Legacy slash-command markdown left over from pre-skills installs.
  if (existsSync(ctx.paths.claudeCommandsDir)) {
    const lingering = LEGACY_KB_COMMAND_FILES.filter((n) =>
      existsSync(join(ctx.paths.claudeCommandsDir, n)),
    );
    if (lingering.length > 0) {
      out.push({
        kind: 'legacy-command-cleanup',
        detail: `remove legacy .claude/commands/${lingering.join(', .claude/commands/')}`,
      });
    }
  }

  // Prompts (preserve existing local overrides).
  const promptSrc = join(ctx.templatesDir, 'prompts');
  if (existsSync(promptSrc)) {
    for (const name of readdirSync(promptSrc)) {
      const dst = join(ctx.paths.builderDir, 'prompts', name);
      if (!existsSync(dst)) {
        out.push({ kind: 'prompt-new', detail: `copy new prompt .ai/.kb-builder/prompts/${name}` });
      } else if (!filesEqual(join(promptSrc, name), dst)) {
        out.push({
          kind: 'prompt-preserved',
          detail: `local override preserved: .ai/.kb-builder/prompts/${name}`,
        });
      }
    }
  }

  // Hook registrations: only report if any expected entry is missing.
  if (hookRegistrationsNeedRefresh(ctx.paths.claudeSettingsFile)) {
    out.push({
      kind: 'hook-registration',
      detail: 'refresh ai-knowledge-base hook entries in .claude/settings.json',
    });
  }

  // Gitignore: report only if the block is missing lines.
  const gitignoreState = inspectGitignore(ctx.paths.gitignoreFile);
  if (!gitignoreState.blockPresent) {
    out.push({ kind: 'gitignore', detail: `add ai-knowledge-base block to .gitignore` });
  } else if (gitignoreState.missingLines.length > 0) {
    out.push({
      kind: 'gitignore',
      detail: `add missing .gitignore lines: ${gitignoreState.missingLines.join(', ')}`,
    });
  }

  // .config.json: create only if absent.
  if (!existsSync(ctx.paths.projectConfigFile)) {
    out.push({
      kind: 'config-json',
      detail: 'create default .ai/knowledge-base/.config.json',
    });
  }

  // pre-commit config (only if missing — init never overwrites).
  if (!existsSync(ctx.paths.preCommitConfigFile)) {
    out.push({ kind: 'pre-commit-config', detail: 'create .pre-commit-config.yaml' });
  }

  // installed-version stamp.
  if (ctx.installed.version !== ctx.current) {
    out.push({
      kind: 'installed-version',
      detail: `stamp installed-version: ${ctx.installed.version} → ${ctx.current}`,
    });
  }

  return out;
}

interface GitignoreState {
  blockPresent: boolean;
  missingLines: string[];
}

const EXPECTED_HOOK_COMMANDS: Array<{ event: string; command: string; async?: boolean }> = [
  { event: 'Stop', command: 'KB_BUILDER_HOOK=Stop node .claude/hooks/kb-capture.mjs' },
  { event: 'SessionEnd', command: 'KB_BUILDER_HOOK=SessionEnd node .claude/hooks/kb-capture.mjs' },
  { event: 'PreCompact', command: 'KB_BUILDER_HOOK=PreCompact node .claude/hooks/kb-capture.mjs' },
  {
    event: 'SessionStart',
    command: 'KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-stage2-drain.mjs',
    async: true,
  },
  {
    event: 'SessionStart',
    command: 'KB_BUILDER_HOOK=SessionStart node .claude/hooks/kb-session-start.mjs',
  },
];

function hookRegistrationsNeedRefresh(settingsFile: string): boolean {
  if (!existsSync(settingsFile)) return true;
  let parsed: {
    hooks?: Record<string, Array<{ hooks?: Array<{ command?: string; async?: boolean }> }>>;
  };
  try {
    parsed = JSON.parse(readFileSync(settingsFile, 'utf8')) as typeof parsed;
  } catch {
    return true;
  }
  const hooks = parsed.hooks ?? {};
  for (const expected of EXPECTED_HOOK_COMMANDS) {
    const entries = hooks[expected.event] ?? [];
    const flat = entries.flatMap((e) => e.hooks ?? []);
    const match = flat.find((h) => h.command === expected.command);
    if (!match) return true;
    if (expected.async === true && match.async !== true) return true;
  }
  return false;
}

function inspectGitignore(file: string): GitignoreState {
  if (!existsSync(file)) return { blockPresent: false, missingLines: GITIGNORE_LINES.slice() };
  const body = readFileSync(file, 'utf8');
  const blockPresent = body.includes(GITIGNORE_BLOCK_START);
  const missing = GITIGNORE_LINES.filter((line) => !body.includes(line));
  return { blockPresent, missingLines: missing };
}

function skillDirsEqual(src: string, dst: string): boolean {
  const srcEntries = readdirSync(src).sort();
  const dstEntries = readdirSync(dst).sort();
  if (srcEntries.length !== dstEntries.length) return false;
  for (let i = 0; i < srcEntries.length; i++) {
    if (srcEntries[i] !== dstEntries[i]) return false;
    const srcPath = join(src, srcEntries[i]!);
    const dstPath = join(dst, dstEntries[i]!);
    const srcStat = statSync(srcPath);
    const dstStat = statSync(dstPath);
    if (srcStat.isDirectory() !== dstStat.isDirectory()) return false;
    if (srcStat.isDirectory()) {
      if (!skillDirsEqual(srcPath, dstPath)) return false;
    } else if (!filesEqual(srcPath, dstPath)) {
      return false;
    }
  }
  return true;
}

function filesEqual(a: string, b: string): boolean {
  try {
    const sa = statSync(a);
    const sb = statSync(b);
    if (sa.size !== sb.size) return false;
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
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
  root: string,
): Promise<void> {
  if (!assistants.includes('claude')) return;
  const adapter = new ClaudeAdapter();
  const claudeTemplateDir = join(templatesDir, 'claude');
  if (existsSync(claudeTemplateDir)) {
    copyTree(claudeTemplateDir, claudeDir);
  }
  // Sweep out legacy slash-command files from pre-skills installs.
  removeLegacyKbCommands(join(claudeDir, 'commands'));
  await adapter.writeHookConfig(root, [
    { event: 'Stop', scriptPath: '.claude/hooks/kb-capture.mjs' },
    { event: 'SessionEnd', scriptPath: '.claude/hooks/kb-capture.mjs' },
    { event: 'PreCompact', scriptPath: '.claude/hooks/kb-capture.mjs' },
    {
      event: 'SessionStart',
      scriptPath: '.claude/hooks/kb-stage2-drain.mjs',
      async: true,
    },
    { event: 'SessionStart', scriptPath: '.claude/hooks/kb-session-start.mjs' },
  ]);
}

function writeInstalledVersion(file: string, builderDir: string, assistants: string[]): void {
  const installed: InstalledVersion = {
    schema_version: 1,
    package: '@e0ipso/ai-knowledge-base',
    version: packageVersion(),
    installed_at: new Date().toISOString(),
    assistants,
  };
  mkdirSync(builderDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(installed, null, 2)}\n`);
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
