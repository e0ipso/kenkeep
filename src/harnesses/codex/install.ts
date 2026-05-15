import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import type { HarnessInstallOptions } from '../types.js';
import { codexHookSpecs } from './hook-spec.js';
import { writeCodexHooks } from './hooks-config.js';

/**
 * Where the Codex adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/codex/` plus compiled hook scripts under
 * `dist/hooks/codex/`).
 */
export const CODEX_TEMPLATE_SUBDIR = 'codex';

function codexPaths(root: string) {
  const dir = join(root, '.codex');
  return {
    dir,
    hooksDir: join(dir, 'hooks'),
    skillsDir: join(root, '.agents/skills'),
    settingsFile: join(dir, 'hooks.json'),
  };
}

/**
 * Copies the Codex-specific template tree into the consumer repo and
 * registers the canonical hook set in `.codex/hooks.json`. Skills live
 * under the shared `.agents/skills/` location used by every harness that
 * supports it; hook scripts live under `.codex/hooks/`. Idempotent:
 * called from both first-time install and from `init --upgrade`.
 */
export async function installCodex(opts: HarnessInstallOptions): Promise<void> {
  const templateDir = join(opts.templatesDir, CODEX_TEMPLATE_SUBDIR);
  const paths = codexPaths(opts.root);
  if (existsSync(join(templateDir, 'hooks'))) {
    copyTree(join(templateDir, 'hooks'), paths.hooksDir);
  }
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  await writeCodexHooks(
    opts.root,
    codexHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: `.codex/hooks/${spec.scriptPath}`,
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
}

/**
 * Refreshes hook scripts and skills from the bundled templates without
 * touching `.codex/hooks.json`. The hook registration is rewritten by
 * `installCodex`, which the upgrade flow also calls.
 */
export function refreshCodexTemplates(opts: HarnessInstallOptions): void {
  const templates = join(opts.templatesDir, CODEX_TEMPLATE_SUBDIR);
  const paths = codexPaths(opts.root);
  copyTree(join(templates, 'hooks'), paths.hooksDir);
  installSharedSkills(opts.templatesDir, paths.skillsDir);
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}
