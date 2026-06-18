import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
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
 * `kkHooksDir` (`.copilot/kk-hooks/`) holds the actual hook scripts, kept
 * out of `hooksDir` so the config artifact and the scripts never collide.
 *
 * `skillsDir` (`.github/skills/`) is Copilot's documented project skill
 * location; it lives outside `.copilot/` and avoids colliding with
 * `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
 *
 * `settingsFile` (`.github/hooks/kk.json`) is the **repo-level** hook
 * config Copilot reads. Copilot CLI loads `.github/hooks/*.json` before
 * user-level `~/.copilot/hooks/`, so a committed repo-level file is the
 * canonical registration: team-shared, no write into the user's home
 * directory, and no cross-repo leakage. `hooksDir` (`.copilot/hooks/`) is
 * retained for path-shape symmetry but is no longer written to.
 */
export function copilotPaths(root: string) {
  const dir = join(root, '.copilot');
  return {
    dir,
    hooksDir: join(dir, 'hooks'),
    kkHooksDir: join(dir, 'kk-hooks'),
    skillsDir: join(root, '.github', 'skills'),
    settingsFile: join(root, '.github', 'hooks', 'kk.json'),
    instructionsFile: join(root, '.github', 'copilot-instructions.md'),
  };
}

/**
 * Maps the wide `copilotPaths` shape onto the harness-neutral
 * `HarnessPaths` the writers accept. Everything the writers need beyond
 * these fields (the `kk-hooks/` script dir and
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
 * install to `.copilot/kk-hooks/`. The entry-catalog sentinel block is
 * injected into `.github/copilot-instructions.md`.
 *
 * Idempotent: called from both first-time install and `init --upgrade`.
 * Writes nothing outside the repository: no user-home mutation.
 */
export async function installCopilot(opts: HarnessInstallOptions): Promise<void> {
  const templateDir = join(opts.templatesDir, COPILOT_TEMPLATE_SUBDIR);
  const paths = copilotPaths(opts.root);

  const kkHooksSrc = join(templateDir, 'kk-hooks');
  if (existsSync(kkHooksSrc)) {
    copyTree(kkHooksSrc, paths.kkHooksDir);
  }

  installSharedSkills(opts.templatesDir, paths.skillsDir);

  const hp = harnessPaths(opts.root);
  await writeCopilotHookConfig(hp);
  await writeCopilotInstructionsSentinel(hp);
}
