import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree } from '../../lib/fs-atomic.js';
import { installSharedSkills } from '../../lib/install-skills.js';
import {
  copySharedHookScripts,
  sharedHarnessHooksDir,
  sharedHookScriptPath,
} from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions } from '../types.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { writeClaudeHookConfig } from './hooks-config.js';

/**
 * Where the Claude adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/claude/` plus compiled hook scripts).
 */
export const CLAUDE_TEMPLATE_SUBDIR = 'claude';

export function claudePaths(root: string) {
  const dir = join(root, '.claude');
  return {
    dir,
    skillsDir: join(dir, 'skills'),
    hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'claude'),
    settingsFile: join(dir, 'settings.json'),
  };
}

/**
 * Copies the Claude-specific template tree into the consumer repo and
 * registers the canonical hook set in `.claude/settings.json`. Idempotent:
 * called both from first-time install and from `init --upgrade`.
 */
export async function installClaude(opts: HarnessInstallOptions): Promise<void> {
  const claudeTemplateDir = join(opts.templatesDir, CLAUDE_TEMPLATE_SUBDIR);
  const paths = claudePaths(opts.root);
  if (existsSync(join(claudeTemplateDir, 'settings.json')) && !existsSync(paths.settingsFile)) {
    mkdirSync(paths.dir, { recursive: true });
    cpSync(join(claudeTemplateDir, 'settings.json'), paths.settingsFile);
  }
  copySharedHookScripts(opts.templatesDir, opts.paths, 'claude', CLAUDE_TEMPLATE_SUBDIR);
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  await writeClaudeHookConfig(
    opts.root,
    CLAUDE_HOOK_SPECS.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('claude', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
}

/**
 * Refreshes hook scripts and skills from the bundled templates without
 * touching settings.json. The hook registration is rewritten by
 * `installClaude`, which the upgrade flow also calls.
 */
export function refreshClaudeTemplates(opts: HarnessInstallOptions): void {
  const paths = claudePaths(opts.root);
  copyTree(
    join(opts.templatesDir, CLAUDE_TEMPLATE_SUBDIR, 'hooks'),
    sharedHarnessHooksDir(opts.paths, 'claude')
  );
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
