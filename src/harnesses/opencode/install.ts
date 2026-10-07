import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFile, copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
import { log } from '../../lib/log.js';
import { upsertManagedBlock } from '../../lib/managed-block.js';
import { copySharedHookScripts, sharedHarnessHooksDirForRoot } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';

/**
 * Where the OpenCode adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/opencode/` plus compiled plugin and kk-hooks
 * scripts under `dist/plugins/opencode/` and `dist/hooks/opencode/`).
 */
export const OPENCODE_TEMPLATE_SUBDIR = 'opencode';

export interface OpenCodePaths extends HarnessPaths {
  pluginsDir: string;
  hooksDir: string;
  pluginFile: string;
  /** `.opencode/opencode.json`, where the plugin and instructions entries are registered. */
  configFile: string;
  gitignoreFile: string;
}

/**
 * On-disk locations the OpenCode adapter owns. The one source for the
 * adapter's `paths()`, its installer and its doctor checks. OpenCode's
 * registration is a plugin entry in `configFile`, not a per-event hook file,
 * so the harness-neutral `settingsFile` stays unset.
 */
export function openCodePaths(root: string): OpenCodePaths {
  const dir = join(root, '.opencode');
  return {
    dir,
    pluginsDir: join(dir, 'plugins'),
    hooksDir: sharedHarnessHooksDirForRoot(root, 'opencode'),
    skillsDir: join(dir, 'skills'),
    pluginFile: join(dir, 'plugins', 'kk.mjs'),
    configFile: join(dir, 'opencode.json'),
    gitignoreFile: join(dir, '.gitignore'),
  };
}

/**
 * Sentinel markers around the kenkeep-managed block in
 * `.opencode/.gitignore`, mirroring the AGENTS.md pointer block
 * (`agents-block.ts`). `.opencode/.gitignore` is frequently a user/host-owned
 * file (OpenCode and bun write one), so we delimit our lines instead of
 * appending bare entries: the block can be replaced in place on upgrade and
 * lifted cleanly on uninstall, and a reader can see the lines are ours.
 */
export const OPENCODE_GITIGNORE_START = '# >>> kenkeep:opencode-generated >>>';
export const OPENCODE_GITIGNORE_END = '# <<< kenkeep:opencode-generated <<<';

/**
 * The managed ignore entries. `/AGENTS.md` is anchored with a leading slash
 * so it matches only `.opencode/AGENTS.md` and not an `AGENTS.md` a consumer
 * might keep elsewhere under `.opencode/` (e.g. inside a skill).
 */
export const OPENCODE_GITIGNORE_BODY = '/AGENTS.md';

/**
 * The plugin reference registered in the project config, resolved by
 * OpenCode relative to the config file's directory (`.opencode/`).
 */
export const OPENCODE_PLUGIN_ENTRY = './plugins/kk.mjs';

/**
 * The instructions entry registered in the project config, resolved by
 * OpenCode relative to the PROJECT ROOT (unlike `plugin` entries). Routes
 * the session-start hook's output (entry catalog + queue nudges) into the
 * model's context natively — without it, `.opencode/AGENTS.md` is written
 * but never read (verified on 1.17.3 with an in-session content probe).
 */
export const OPENCODE_INSTRUCTIONS_ENTRY = '.opencode/AGENTS.md';

/**
 * Registers the kenkeep plugin and instructions file in the project's
 * `.opencode/opencode.json`. OpenCode (verified on 1.17.3) loads plugins
 * ONLY when they are declared in a config `plugin` array — a file sitting
 * under `.opencode/plugins/` is never discovered on its own — and reads
 * extra context files only from the `instructions` array. Without this
 * registration every kenkeep hook is inert and the injected context is
 * invisible in live sessions.
 *
 * Merge semantics: creates the file when absent; appends to existing
 * arrays (or adds the keys) while preserving every other key; no-ops when
 * both entries are already present. An unparseable config is left
 * untouched — destroying a user's config to register ourselves is worse
 * than asking them to add two lines.
 */
export function registerOpenCodePlugin(configFile: string): void {
  let config: Record<string, unknown> = {};
  if (existsSync(configFile)) {
    try {
      config = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
    } catch {
      log.warn(
        `could not parse ${configFile}; add "${OPENCODE_PLUGIN_ENTRY}" to its "plugin" array ` +
          `and "${OPENCODE_INSTRUCTIONS_ENTRY}" to its "instructions" array manually.`
      );
      return;
    }
  }
  const plugins = Array.isArray(config['plugin']) ? (config['plugin'] as unknown[]) : [];
  const instructions = Array.isArray(config['instructions'])
    ? (config['instructions'] as unknown[])
    : [];
  const hasPlugin = plugins.includes(OPENCODE_PLUGIN_ENTRY);
  const hasInstructions = instructions.includes(OPENCODE_INSTRUCTIONS_ENTRY);
  if (hasPlugin && hasInstructions) return;
  if (!hasPlugin) config['plugin'] = [...plugins, OPENCODE_PLUGIN_ENTRY];
  if (!hasInstructions) {
    config['instructions'] = [...instructions, OPENCODE_INSTRUCTIONS_ENTRY];
  }
  atomicWriteFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Idempotently writes the kenkeep-managed ignore block into
 * `.opencode/.gitignore`, keeping the generated `AGENTS.md` out of commits.
 * That file is rewritten by the session-start hook on every run, so
 * committing it produces churn and leaks one machine's session context into
 * the repo. We scope the rule to `.opencode/.gitignore` rather than touching
 * the project's root `.gitignore`, consistent with init's "root .gitignore
 * is never touched" policy.
 *
 * Merge semantics are the shared `upsertManagedBlock` ones also used by
 * `ensureAgentsKkBlock`: creates the file when absent, replaces an existing
 * block in place (so the entries track upgrades), appends when no block
 * exists, and preserves all user content outside the markers. Orphaned,
 * duplicated or reversed markers throw a `MalformedManagedBlockError` naming
 * the file and leave it untouched.
 */
export function ensureOpenCodeGitignore(gitignoreFile: string): void {
  const existing = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, 'utf8') : '';
  const next = upsertManagedBlock(
    existing,
    { start: OPENCODE_GITIGNORE_START, end: OPENCODE_GITIGNORE_END },
    OPENCODE_GITIGNORE_BODY,
    gitignoreFile
  );
  if (next === existing) return;
  atomicWriteFile(gitignoreFile, next);
}

/**
 * Copies the OpenCode-specific template tree into the consumer repo and
 * registers the plugin in `.opencode/opencode.json` (OpenCode does not
 * auto-discover plugin files by location).
 *
 * Skill installation is delegated to the shared installer so the same
 * SKILL.md bytes land in every configured harness's native skills dir.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 */
export async function installOpenCode(opts: HarnessInstallOptions): Promise<void> {
  const templateDir = join(opts.templatesDir, OPENCODE_TEMPLATE_SUBDIR);
  const paths = openCodePaths(opts.root);
  // The managed .gitignore block goes first: a malformed one is refused before
  // any other file of this adapter lands.
  ensureOpenCodeGitignore(paths.gitignoreFile);

  const pluginSrc = join(templateDir, 'plugins');
  if (existsSync(pluginSrc)) {
    copyTree(pluginSrc, paths.pluginsDir);
  }
  copySharedHookScripts(opts.templatesDir, opts.paths, 'opencode');
  registerOpenCodePlugin(paths.configFile);
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
