import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { copySharedHookScripts, sharedHookScriptPath } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions } from '../types.js';
import { cursorHookSpecs } from './hook-spec.js';
import { writeCursorHooksConfig } from './hooks-config.js';

export const CURSOR_TEMPLATE_SUBDIR = 'cursor';

export function cursorPaths(root: string) {
  const dir = join(root, '.cursor');
  return {
    dir,
    hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'cursor'),
    skillsDir: join(dir, 'skills'),
    settingsFile: join(dir, 'hooks.json'),
    hooksFile: join(dir, 'hooks.json'),
  };
}

/**
 * Copies the Cursor template tree into the consumer repo and registers
 * the canonical hook set in `.cursor/hooks.json`. Skills live under
 * `.cursor/skills/`. Idempotent: called from install and upgrade.
 */
export async function installCursor(opts: HarnessInstallOptions): Promise<void> {
  const paths = cursorPaths(opts.root);
  copySharedHookScripts(opts.templatesDir, opts.paths, 'cursor', CURSOR_TEMPLATE_SUBDIR);
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  await writeCursorHooksConfig(
    opts.root,
    cursorHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('cursor', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
}
