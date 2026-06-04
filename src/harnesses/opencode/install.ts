import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
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
  };
}

/**
 * Copies the OpenCode-specific template tree into the consumer repo.
 * The plugin file (`.opencode/plugins/kk.mjs`) is self-registering by
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

  const kkHooksSrc = join(templateDir, 'kk-hooks');
  if (existsSync(kkHooksSrc)) {
    copyTree(kkHooksSrc, paths.kkHooksDir);
  }

  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
