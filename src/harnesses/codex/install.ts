import { join } from 'node:path';
import { installSharedSkills } from '../../lib/install-skills.js';
import { log } from '../../lib/log.js';
import {
  copySharedHookScripts,
  sharedHarnessHooksDirForRoot,
  sharedHookScriptPath,
} from '../../lib/shared-hooks.js';
import type { HarnessInstallOptions, HarnessPaths } from '../types.js';
import { codexHookSpecs } from './hook-spec.js';
import { codexHookConfigPaths, writeCodexHooks } from './hooks-config.js';

/**
 * Where the Codex adapter's template tree lives under the package
 * `templates/` directory (created at build time from
 * `src/templates-source/codex/` plus compiled hook scripts under
 * `dist/hooks/codex/`).
 */
export const CODEX_TEMPLATE_SUBDIR = 'codex';

export interface CodexPaths extends HarnessPaths {
  hooksDir: string;
  settingsFile: string;
  /** Alias of `settingsFile`: `.codex/hooks.json`. */
  hooksFile: string;
  /** `.codex/config.toml`, which may declare a competing `[hooks]` table. */
  configToml: string;
}

/**
 * On-disk locations the Codex adapter owns. The one source for the adapter's
 * `paths()`, its installer and its doctor checks; the registration file
 * locations come from the writer so the two cannot drift.
 */
export function codexPaths(root: string): CodexPaths {
  const config = codexHookConfigPaths(root);
  return {
    dir: config.dir,
    hooksDir: sharedHarnessHooksDirForRoot(root, 'codex'),
    skillsDir: join(root, '.agents', 'skills'),
    settingsFile: config.settingsFile,
    hooksFile: config.settingsFile,
    configToml: config.configToml,
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
  // Register first: the writer refuses a malformed user config before any
  // other file of this adapter lands.
  await writeCodexHooks(
    opts.root,
    codexHookSpecs.map(spec => ({
      event: spec.event,
      scriptPath: sharedHookScriptPath('codex', spec.scriptPath),
      ...(spec.async ? { async: true } : {}),
      ...(spec.matcher ? { matcher: spec.matcher } : {}),
    }))
  );
  copySharedHookScripts(opts.templatesDir, opts.paths, 'codex');
  installSharedSkills(opts.templatesDir, paths.skillsDir);
  // Codex refuses to execute non-managed hooks until the user reviews and
  // trusts them; without this step the whole pipeline is silently inert.
  log.info(
    'Codex requires one-time hook trust: run /hooks inside a Codex session and trust the kenkeep entries, or capture will be silently skipped.'
  );
}
