import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import {
  copySharedHookScripts,
  sharedHarnessHooksDirForRoot,
  sharedHookScriptPath,
} from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { cursorHookSpecs } from './hook-spec.js';
import { cursorHookConfigPaths, writeCursorHooksConfig } from './hooks-config.js';

export const CURSOR_TEMPLATE_SUBDIR = 'cursor';

export interface CursorPaths extends HarnessPaths {
  hooksDir: string;
  settingsFile: string;
  /** Alias of `settingsFile`: `.cursor/hooks.json`. */
  hooksFile: string;
}

/**
 * On-disk locations the Cursor adapter owns. The one source for the
 * adapter's `paths()`, its installer and its doctor checks; the registration
 * file location comes from the writer so the two cannot drift.
 */
export function cursorPaths(root: string): CursorPaths {
  const config = cursorHookConfigPaths(root);
  return {
    dir: config.dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'cursor'),
    skillsDir: join(config.dir, 'skills'),
    settingsFile: config.settingsFile,
    hooksFile: config.settingsFile,
  };
}

/**
 * Copies the Cursor template tree into the consumer repo and registers
 * the canonical hook set in `.cursor/hooks.json`. Skills live under
 * `.cursor/skills/`. Idempotent: called from install and upgrade.
 */
export async function installCursor(opts: HarnessInstallOptions): Promise<void> {
  const paths = cursorPaths(opts.root);
  // Register first: the writer refuses a malformed user config before any
  // other file of this adapter lands.
  await writeCursorHooksConfig(
    opts.root,
    cursorHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('cursor', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
  copySharedHookScripts(opts.templatesDir, opts.paths, 'cursor');
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
