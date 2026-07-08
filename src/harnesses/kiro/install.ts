import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { sharedHarnessHooksDirForRoot } from '../../lib/shared-hooks.js';

/**
 * On-disk locations the Kiro adapter owns.
 *
 * `dir` (`.kiro/`) is the Kiro project configuration directory.
 *
 * `skillsDir` (`.kiro/skills/`) is where Kiro reads project skills from —
 * each skill is a subdirectory with a `SKILL.md` file.
 *
 * `hooksDir` points at the shared `.ai/kenkeep/hooks/kiro/` script directory.
 * In v1 no hook scripts are installed here (Kiro has no session lifecycle
 * events), but the path is declared for adapter symmetry and to allow future
 * hook installation without structural changes.
 *
 * `settingsFile` is not used by the Kiro adapter (no hook config JSON to
 * write in v1), so it is left undefined.
 */
export function kiroPaths(root: string): HarnessPaths {
  const dir = join(root, '.kiro');
  return {
    dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'kiro'),
    skillsDir: join(dir, 'skills'),
  };
}

/**
 * Copies shared skills to `.kiro/skills/`. No hook scripts are installed in
 * v1 — Kiro has no session lifecycle events to hook into.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 * Writes nothing outside the repository.
 */
export async function installKiro(opts: HarnessInstallOptions): Promise<void> {
  const p = kiroPaths(opts.root);
  installSharedSkills(opts.templatesDir, p.skillsDir);
  // No hook scripts to install in v1 — Kiro has no session lifecycle events.
}

/**
 * Idempotently refreshes the Kiro adapter installation. Delegates to
 * `installKiro` — the logic is identical for first-time install and upgrade.
 */
export async function upgradeKiro(opts: HarnessInstallOptions): Promise<void> {
  return installKiro(opts);
}
