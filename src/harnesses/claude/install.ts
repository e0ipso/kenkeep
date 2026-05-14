import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessInstallOptions } from '../types.js';
import { CLAUDE_HOOK_SPECS } from './hook-spec.js';
import { writeClaudeHookConfig } from './hooks-config.js';

/**
 * Where the Claude adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/claude/`).
 */
export const CLAUDE_TEMPLATE_SUBDIR = 'claude';

/**
 * Copies the Claude-specific template tree into the consumer repo and
 * registers the canonical hook set in `.claude/settings.json`. Idempotent:
 * called both from first-time install and from `init --upgrade`.
 */
export async function installClaude(opts: HarnessInstallOptions): Promise<void> {
  const claudeTemplateDir = join(opts.templatesDir, CLAUDE_TEMPLATE_SUBDIR);
  if (existsSync(claudeTemplateDir)) {
    copyTree(claudeTemplateDir, opts.paths.claudeDir);
  }
  await writeClaudeHookConfig(
    opts.root,
    CLAUDE_HOOK_SPECS.map(spec => ({
      event: spec.event,
      scriptPath: `.claude/hooks/${spec.scriptPath}`,
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
  const templates = join(opts.templatesDir, CLAUDE_TEMPLATE_SUBDIR);
  copyTree(join(templates, 'hooks'), opts.paths.claudeHooksDir);
  copyTree(join(templates, 'skills'), opts.paths.claudeSkillsDir);
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}
