import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
import type { HarnessInstallOptions } from '../types.js';
import { cursorHookSpecs } from './hook-spec.js';
import { writeCursorHooksConfig } from './hooks-config.js';

export const CURSOR_TEMPLATE_SUBDIR = 'cursor';

export function cursorPaths(root: string) {
  const dir = join(root, '.cursor');
  return {
    dir,
    hooksDir: join(dir, 'hooks'),
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
  const templateDir = join(opts.templatesDir, CURSOR_TEMPLATE_SUBDIR);
  const paths = cursorPaths(opts.root);
  if (existsSync(join(templateDir, 'hooks'))) {
    copyTree(join(templateDir, 'hooks'), paths.hooksDir);
  }
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  await writeCursorHooksConfig(
    opts.root,
    cursorHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: `.cursor/hooks/${spec.scriptPath}`,
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
}
