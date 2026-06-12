import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFile, copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
import { log } from '../../lib/log.js';
import type { HarnessInstallOptions } from '../types.js';

/**
 * Where the OpenCode adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/opencode/` plus compiled plugin and kk-hooks
 * scripts under `dist/plugins/opencode/` and `dist/hooks/opencode/`).
 */
export const OPENCODE_TEMPLATE_SUBDIR = 'opencode';

export function openCodePaths(root: string) {
  const dir = join(root, '.opencode');
  return {
    dir,
    pluginsDir: join(dir, 'plugins'),
    kkHooksDir: join(dir, 'kk-hooks'),
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
 * Merge semantics mirror `ensureAgentsKkBlock`: creates the file when
 * absent, replaces an existing block in place (so the entries track upgrades),
 * appends when no block exists, and preserves all user content outside the
 * markers.
 */
export function ensureOpenCodeGitignore(gitignoreFile: string): void {
  const block = `${OPENCODE_GITIGNORE_START}\n${OPENCODE_GITIGNORE_BODY}\n${OPENCODE_GITIGNORE_END}`;
  const existing = existsSync(gitignoreFile) ? readFileSync(gitignoreFile, 'utf8') : '';

  let next: string;
  if (existing.includes(OPENCODE_GITIGNORE_START)) {
    const before = existing.slice(0, existing.indexOf(OPENCODE_GITIGNORE_START));
    const afterStart = existing.indexOf(OPENCODE_GITIGNORE_END);
    const afterRaw =
      afterStart >= 0 ? existing.slice(afterStart + OPENCODE_GITIGNORE_END.length) : '';
    const after = afterRaw.startsWith('\n') ? afterRaw.slice(1) : afterRaw;
    next = ensureTrailingNewline(`${before}${block}\n${after}`);
  } else if (existing.length === 0) {
    next = `${block}\n`;
  } else {
    const sep = existing.endsWith('\n') ? '' : '\n';
    next = `${existing}${sep}\n${block}\n`;
  }

  if (next === existing) return;
  atomicWriteFile(gitignoreFile, next);
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

/**
 * Copies the OpenCode-specific template tree into the consumer repo and
 * registers the plugin in `.opencode/opencode.json` (OpenCode does not
 * auto-discover plugin files by location).
 *
 * Skill installation is delegated to the shared installer (Plan 23
 * Task 8) so the same SKILL.md bytes land in every configured
 * harness's native skills dir.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 */
export async function installOpenCode(opts: HarnessInstallOptions): Promise<void> {
  const templateDir = join(opts.templatesDir, OPENCODE_TEMPLATE_SUBDIR);
  const paths = openCodePaths(opts.root);

  const pluginSrc = join(templateDir, 'plugins');
  if (existsSync(pluginSrc)) {
    copyTree(pluginSrc, paths.pluginsDir);
  }

  const kkHooksSrc = join(templateDir, 'kk-hooks');
  if (existsSync(kkHooksSrc)) {
    copyTree(kkHooksSrc, paths.kkHooksDir);
  }

  registerOpenCodePlugin(paths.configFile);
  ensureOpenCodeGitignore(paths.gitignoreFile);

  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
