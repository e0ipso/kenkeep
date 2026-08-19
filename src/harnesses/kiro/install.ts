import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { copySharedHookScripts } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { sharedHarnessHooksDirForRoot } from '../../lib/shared-hooks.js';
import { writeKiroHookConfig } from './hooks-config.js';

/** Template subdirectory name for the Kiro adapter. */
export const KIRO_TEMPLATE_SUBDIR = 'kiro';

/**
 * On-disk locations the Kiro adapter owns.
 *
 * `dir` (`.kiro/`) is the Kiro project configuration directory.
 *
 * `skillsDir` (`.kiro/skills/`) is where Kiro reads project skills from —
 * each skill is a subdirectory with a `SKILL.md` file.
 *
 * `hooksDir` points at the shared `.ai/kenkeep/hooks/kiro/` script directory.
 * Hook scripts are compiled `.cjs` files installed here; the `.kiro/agents/
 * kk-hooks.json` config references them via a walk-up shell command.
 *
 * `settingsFile` is the `.kiro/agents/kk-hooks.json` agent config file that
 * Kiro reads on startup to register the kenkeep lifecycle hooks.
 */
export function kiroPaths(root: string): HarnessPaths {
  const dir = join(root, '.kiro');
  return {
    dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'kiro'),
    skillsDir: join(dir, 'skills'),
    settingsFile: join(dir, 'agents', 'kk-hooks.json'),
  };
}

/**
 * Copies shared skills to `.kiro/skills/`, installs compiled hook scripts
 * to `.ai/kenkeep/hooks/kiro/`, and writes the `.kiro/agents/kk-hooks.json`
 * agent config that registers the kenkeep lifecycle hooks.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 * Writes nothing outside the repository.
 */
export async function installKiro(opts: HarnessInstallOptions): Promise<void> {
  const p = kiroPaths(opts.root);
  installSharedSkills(opts.templatesDir, p.skillsDir);
  copySharedHookScripts(opts.templatesDir, opts.paths, 'kiro', KIRO_TEMPLATE_SUBDIR);
  writeKiroHookConfig(opts.root);
}

/**
 * Idempotently refreshes the Kiro adapter installation. Delegates to
 * `installKiro` — the logic is identical for first-time install and upgrade.
 */
export async function upgradeKiro(opts: HarnessInstallOptions): Promise<void> {
  return installKiro(opts);
}
