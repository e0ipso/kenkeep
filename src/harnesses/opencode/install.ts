import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import type { HarnessInstallOptions } from '../types.js';

/**
 * Where the OpenCode adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/opencode/` plus compiled plugin and kb-hooks
 * scripts under `dist/plugins/opencode/` and `dist/hooks/opencode/`).
 */
export const OPENCODE_TEMPLATE_SUBDIR = 'opencode';

function openCodePaths(root: string) {
  const dir = join(root, '.opencode');
  return {
    dir,
    pluginsDir: join(dir, 'plugins'),
    kbHooksDir: join(dir, 'kb-hooks'),
    skillsDir: join(dir, 'skills'),
  };
}

/**
 * Copies the OpenCode-specific template tree into the consumer repo.
 * The plugin file (`.opencode/plugins/kb.mjs`) is self-registering by
 * virtue of its location; no JSON or TOML config writing is needed.
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

  const kbHooksSrc = join(templateDir, 'kb-hooks');
  if (existsSync(kbHooksSrc)) {
    copyTree(kbHooksSrc, paths.kbHooksDir);
  }

  installSharedSkills(opts.templatesDir, paths.skillsDir);
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}
