import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { refreshClaudeTemplates } from '../harnesses/claude/install.js';
import { getHarness, hasHarness, listHarnessIds } from '../harnesses/registry.js';
import { ensureAgentsKkBlock } from '../lib/agents-block.js';
import { copyTree } from '../lib/fs-atomic.js';
import { log } from '../lib/log.js';
import { detectSchemaVersion } from '../lib/migrate.js';
import { MIGRATE_COMMAND_HINT } from '../lib/migrate-guidance.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { ensureKbignore } from '../lib/kkignore-stub.js';
import { NODE_SCHEMA_VERSION } from '../lib/schemas.js';
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

const KENKEEP_GITIGNORE_LINES = [
  '/_sessions/',
  '/_logs/',
  '/hooks/',
  '.state/*',
  '!.state/installed-version',
];

// Unanchored variants kenkeep shipped before the directory patterns were
// anchored to the bundle root. An unanchored `hooks/` also matches the
// `nodes/hooks/` knowledge branch (and likewise for `_sessions/`/`_logs/`), so
// upgrades must drop these legacy lines rather than leave both forms in place.
const LEGACY_UNANCHORED_GITIGNORE_LINES = new Set(['_sessions/', '_logs/', 'hooks/']);

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
    reportSchemaMismatch(paths.nodesDir);
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
  ensureAgentsKkBlock(join(root, 'AGENTS.md'));

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

  reportSchemaMismatch(paths.nodesDir);
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

/**
 * Surfaces an out-of-date node store at init/upgrade time. `init` and
 * `init --upgrade` refresh templates and hooks but never touch `nodes/`, so a
 * knowledge base written by an older kenkeep stays stale and every command that
 * reads it would fail. We detect the on-disk schema and point the user at the
 * `kk-migrate` skill that fixes it, matching the error the node reader raises.
 * Loud but non-fatal: init did its own job; migration is a deliberate,
 * in-session follow-up the user runs next.
 */
function reportSchemaMismatch(nodesDir: string): void {
  const onDisk = detectSchemaVersion(nodesDir);
  if (onDisk === null || onDisk >= NODE_SCHEMA_VERSION) return;
  log.error(
    `Knowledge base on disk is at schema_version ${onDisk}, but this kenkeep reads ` +
      `schema_version ${NODE_SCHEMA_VERSION}. nodes/ was left untouched and commands that ` +
      `read it will fail until you migrate it: use ${MIGRATE_COMMAND_HINT}.`
  );
}

async function runUpgrade(
  opts: InitOptions,
  root: string,
  paths: ReturnType<typeof repoPaths>,
  templatesDir: string
): Promise<void> {
  if (!existsSync(paths.installedVersionFile)) {
    throw new Error(
      'Not initialized. Run `npx kenkeep init --harnesses <id[,id,...]>` for a first-time install.'
    );
  }
  const current = packageVersion();
  log.info(`Upgrading in ${root} to ${current}`);

  // Force-refresh shipped templates for the Claude adapter before re-running
  // its installer — only when Claude is actually selected; a codex-only repo
  // must not grow a .claude/ directory on upgrade. Other adapters that need a
  // similar pre-step can expose it through their own modules.
  if (opts.harnesses.includes('claude')) {
    refreshClaudeTemplates({ root, paths, templatesDir, upgrade: true });
  }

  for (const id of opts.harnesses) {
    const adapter = getHarness(id);
    await adapter.upgrade({ root, paths, templatesDir, upgrade: true });
  }

  copyPromptsPreservingLocal(join(templatesDir, 'prompts'), paths.promptsDir);

  // Ship skeleton scripts (e.g. the shared kk-detect-harness helper the kk
  // skills invoke) into existing repos. Upgrade does not re-copy the whole
  // skeleton, so copy any missing script without clobbering user-owned files.
  ensureKkScripts(join(templatesDir, 'kenkeep', 'scripts'), join(paths.kkDir, 'scripts'));
  ensureKkAssets(join(templatesDir, 'kenkeep', 'assets'), join(paths.kkDir, 'assets'));

  ensureKbGitignore(paths.kkGitignoreFile);
  ensureAgentsKkBlock(join(root, 'AGENTS.md'));

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

  reportSchemaMismatch(paths.nodesDir);
}

/**
 * Copies skeleton script files into `.ai/kenkeep/scripts/` for an existing
 * install. First-time `init` already lands the whole `templates/kenkeep`
 * skeleton; upgrade only fills in scripts that are missing and never
 * overwrites a file the user may have edited.
 */
function ensureKkScripts(src: string, dst: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const dstPath = join(dst, name);
    if (existsSync(dstPath)) continue;
    cpSync(join(src, name), dstPath);
  }
}

function ensureKkAssets(src: string, dst: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const dstPath = join(dst, name);
    if (existsSync(dstPath)) continue;
    cpSync(join(src, name), dstPath);
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
 * Ensures `.ai/kenkeep/.gitignore` carries every canonical generated-state
 * entry, anchored to the bundle root. User-owned content is preserved; the
 * canonical lines are re-emitted in order and the legacy unanchored variants
 * (the `hooks/` footgun that also ignored `nodes/hooks/`) are dropped, so an
 * upgrade converts an existing gitignore rather than leaving both forms.
 */
function ensureKbGitignore(file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (existing.trim().length === 0) {
    writeFileSync(file, `${KENKEEP_GITIGNORE_LINES.join('\n')}\n`);
    return;
  }
  const canonical = new Set(KENKEEP_GITIGNORE_LINES);
  // Keep only user-owned lines: canonical lines are re-emitted in order below,
  // and the legacy unanchored variants are pruned so the footgun is removed.
  const userLines = existing
    .replace(/\n+$/, '')
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();
      return !canonical.has(trimmed) && !LEGACY_UNANCHORED_GITIGNORE_LINES.has(trimmed);
    });
  const next = `${[...KENKEEP_GITIGNORE_LINES, ...userLines].join('\n')}\n`;
  if (next === existing) return;
  writeFileSync(file, next);
}
