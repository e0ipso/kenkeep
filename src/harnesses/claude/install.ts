import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import {
  copySharedHookScripts,
  sharedHarnessHooksDirForRoot,
  sharedHookScriptPath,
} from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { writeClaudeHookConfig } from './hooks-config.js';

/**
 * Where the Claude adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/claude/` plus compiled hook scripts).
 */
export const CLAUDE_TEMPLATE_SUBDIR = 'claude';

export interface ClaudePaths extends HarnessPaths {
  commandsDir: string;
  hooksDir: string;
  settingsFile: string;
}

/**
 * On-disk locations the Claude adapter owns. The one source for the
 * adapter's `paths()`, its installer and its doctor checks. `commandsDir`
 * is never written by kenkeep but is a native Claude directory that
 * bootstrap discovery must skip, so it stays declared here.
 */
export function claudePaths(root: string): ClaudePaths {
  const dir = join(root, '.claude');
  return {
    dir,
    commandsDir: join(dir, 'commands'),
    skillsDir: join(dir, 'skills'),
    hooksDir: sharedHarnessHooksDirForRoot(root, 'claude'),
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
  // Register first: the writer refuses a malformed user config before any
  // other file of this adapter lands.
  await writeClaudeHookConfig(
    opts.root,
    CLAUDE_HOOK_SPECS.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('claude', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
  copySharedHookScripts(opts.templatesDir, opts.paths, 'claude');
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}
