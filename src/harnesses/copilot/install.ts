import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { copySharedHookScripts, sharedHarnessHooksDirForRoot } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { writeCopilotHookConfig, writeCopilotInstructionsSentinel } from './hooks-config.js';

/**
 * Where the Copilot adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/copilot/` plus compiled hook scripts under
 * `dist/hooks/copilot/`, copied to `templates/copilot/kk-hooks/`).
 */
export const COPILOT_TEMPLATE_SUBDIR = 'copilot';

export interface CopilotPaths extends HarnessPaths {
  hooksDir: string;
  settingsFile: string;
  /** `.github/copilot-instructions.md`, which carries the managed catalog block. */
  instructionsFile: string;
}

/**
 * On-disk locations the Copilot adapter owns. Everything Copilot reads
 * lives under `.github/`, so that is the adapter's `dir` (the root
 * `init` tells users to review and commit):
 *
 * - `settingsFile` (`.github/hooks/kk.json`) is the **repo-level** hook
 *   config Copilot CLI loads before user-level `~/.copilot/hooks/`, so the
 *   committed file is the canonical, team-shared registration with no write
 *   into the user's home directory.
 * - `skillsDir` (`.github/skills/`) is Copilot's documented project skill
 *   location; it avoids colliding with `.claude/skills/` and
 *   `.agents/skills/` in mixed-harness installs.
 * - `instructionsFile` carries only the static kenkeep pointer block between
 *   the kk sentinels; the live catalog and per-user session state go through
 *   the sessionStart hook's `additionalContext`.
 * - `hooksDir` is the shared `.ai/kenkeep/hooks/copilot/` script directory.
 *
 * The one source for the adapter's `paths()`, installer and doctor checks.
 */
export function copilotPaths(root: string): CopilotPaths {
  const dir = join(root, '.github');
  return {
    dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'copilot'),
    skillsDir: join(dir, 'skills'),
    settingsFile: join(dir, 'hooks', 'kk.json'),
    instructionsFile: join(dir, 'copilot-instructions.md'),
  };
}

/**
 * Copies the Copilot-specific template tree into the consumer repo and
 * registers the canonical hook set in the **repo-level**
 * `.github/hooks/kk.json` (the file Copilot reads; loaded before any
 * user-level hooks). Skills install to `.github/skills/`; hook scripts
 * install to `.ai/kenkeep/hooks/copilot/`. The static pointer sentinel
 * block is written into `.github/copilot-instructions.md`.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 * Writes nothing outside the repository: no user-home mutation.
 */
export async function installCopilot(opts: HarnessInstallOptions): Promise<void> {
  const paths = copilotPaths(opts.root);
  // Register first: the writer refuses a malformed user config before any
  // other file of this adapter lands.
  await writeCopilotInstructionsSentinel(paths);
  await writeCopilotHookConfig(paths);
  copySharedHookScripts(opts.templatesDir, opts.paths, 'copilot');
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
