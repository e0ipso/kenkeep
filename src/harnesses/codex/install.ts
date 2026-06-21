import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { log } from '../../lib/log.js';
import { copySharedHookScripts, sharedHookScriptPath } from '../../lib/shared-hooks.js';
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

export function codexPaths(root: string) {
  const dir = join(root, '.codex');
  return {
    dir,
    hooksDir: join(root, '.ai', 'kenkeep', 'hooks', 'codex'),
    skillsDir: join(root, '.agents/skills'),
    settingsFile: join(dir, 'hooks.json'),
    hooksFile: join(dir, 'hooks.json'),
    configToml: join(dir, 'config.toml'),
  };
}

/**
 * Copies the Codex-specific template tree into the consumer repo and
 * registers the canonical hook set in `.codex/hooks.json`. Skills live
 * under the shared `.agents/skills/` location used by every harness that
 * supports it; hook scripts live under `.ai/kenkeep/hooks/codex/`. Idempotent:
 * called from both first-time install and from `init --upgrade`.
 */
export async function installCodex(opts: HarnessInstallOptions): Promise<void> {
  const paths = codexPaths(opts.root);
  copySharedHookScripts(opts.templatesDir, opts.paths, 'codex', CODEX_TEMPLATE_SUBDIR);
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  await writeCodexHooks(
    opts.root,
    codexHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('codex', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
  // Codex refuses to execute non-managed hooks until the user reviews and
  // trusts them; without this step the whole pipeline is silently inert.
  log.info(
    'Codex requires one-time hook trust: run /hooks inside a Codex session and trust the kenkeep entries, or capture will be silently skipped.'
  );
}
