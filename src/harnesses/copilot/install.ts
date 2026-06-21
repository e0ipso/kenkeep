import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { copySharedHookScripts } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { writeCopilotHookConfig, writeCopilotInstructionsSentinel } from './hooks-config.js';

/**
 * Where the Copilot adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/copilot/` plus compiled hook scripts under
 * `dist/hooks/copilot/`, copied to `templates/copilot/kk-hooks/`).
 */
export const COPILOT_TEMPLATE_SUBDIR = 'copilot';

/**
 * On-disk locations the Copilot adapter owns.
 *
 * `dir` (`.copilot/`) is a kenkeep-tool convention: Copilot itself does
 * not read it. It mirrors `.claude/`, `.codex/`, `.opencode/` so the
 * adapter has a symmetric home for its hook scripts.
 *
 * `kkHooksDir` aliases the shared `.ai/kenkeep/hooks/copilot/` script
 * directory. It stays on the return shape for existing adapter code that
 * asks for "the script directory" explicitly.
 *
 * `skillsDir` (`.github/skills/`) is Copilot's documented project skill
 * location; it lives outside `.copilot/` and avoids colliding with
 * `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
 *
 * `settingsFile` (`.github/hooks/kk.json`) is the **repo-level** hook
 * config Copilot reads. Copilot CLI loads `.github/hooks/*.json` before
 * user-level `~/.copilot/hooks/`, so a committed repo-level file is the
 * canonical registration: team-shared, no write into the user's home
 * directory, and no cross-repo leakage. `hooksDir` points at the shared
 * script directory.
 */
export function copilotPaths(root: string) {
  const dir = join(root, '.copilot');
  return {
    dir,
    hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'copilot'),
    kkHooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'copilot'),
    skillsDir: join(root, '.github', 'skills'),
    settingsFile: join(root, '.github', 'hooks', 'kk.json'),
    instructionsFile: join(root, '.github', 'copilot-instructions.md'),
  };
}

/**
 * Maps the wide `copilotPaths` shape onto the harness-neutral
 * `HarnessPaths` the writers accept. Everything the writers need beyond
 * these fields (the shared hook script dir and
 * `.github/copilot-instructions.md`) is derived from `dir`.
 */
function harnessPaths(root: string): HarnessPaths {
  const p = copilotPaths(root);
  return {
    dir: p.dir,
    hooksDir: p.hooksDir,
    skillsDir: p.skillsDir,
    settingsFile: p.settingsFile,
  };
}

/**
 * Copies the Copilot-specific template tree into the consumer repo and
 * registers the canonical hook set in the **repo-level**
 * `.github/hooks/kk.json` (the file Copilot reads; loaded before any
 * user-level hooks). Skills install to `.github/skills/`; hook scripts
 * install to `.ai/kenkeep/hooks/copilot/`. The entry-catalog sentinel
 * block is injected into `.github/copilot-instructions.md`.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 * Writes nothing outside the repository: no user-home mutation.
 */
export async function installCopilot(opts: HarnessInstallOptions): Promise<void> {
  const paths = copilotPaths(opts.root);

  copySharedHookScripts(
    opts.templatesDir,
    opts.paths,
    'copilot',
    COPILOT_TEMPLATE_SUBDIR,
    'kk-hooks'
  );

  installSharedSkills(opts.templatesDir, paths.skillsDir);

  const hp = harnessPaths(opts.root);
  await writeCopilotHookConfig(hp);
  await writeCopilotInstructionsSentinel(hp);
}
