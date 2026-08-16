import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { copySharedHookScripts } from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { writeGrokHookConfig } from './hooks-config.js';

export const GROK_TEMPLATE_SUBDIR = 'grok';

export function grokPaths(root: string) {
  const dir = join(root, '.grok');
  return {
    dir,
    hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'grok'),
    skillsDir: join(dir, 'skills'),
    settingsFile: join(dir, 'hooks', 'kk.json'),
  };
}

function harnessPaths(root: string): HarnessPaths {
  const p = grokPaths(root);
  return {
    dir: p.dir,
    hooksDir: p.hooksDir,
    skillsDir: p.skillsDir,
    settingsFile: p.settingsFile,
  };
}

function claudeSkillsAlreadyInstalled(root: string): boolean {
  return existsSync(join(root, '.claude', 'skills', 'kk-curate', 'SKILL.md'));
}

/**
 * Installs Grok hook scripts and `.grok/hooks/kk.json`.
 *
 * Skills: one home. If Claude skills are already present, Grok reads them
 * via Claude-compat and we do not copy a second tree. Grok-only installs
 * write `.grok/skills/`.
 */
export async function installGrok(opts: HarnessInstallOptions): Promise<void> {
  const paths = grokPaths(opts.root);

  copySharedHookScripts(opts.templatesDir, opts.paths, 'grok', GROK_TEMPLATE_SUBDIR);

  if (!claudeSkillsAlreadyInstalled(opts.root)) {
    installSharedSkills(opts.templatesDir, paths.skillsDir);
  }

  await writeGrokHookConfig(harnessPaths(opts.root));
}
