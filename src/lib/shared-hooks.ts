import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { errCheck, ok, type DoctorCheckResult, type HookSpec } from '../harnesses/types.js';
import { copyTree } from './fs-atomic.js';
import type { RepoPaths } from './paths.js';

/**
 * Where every adapter's compiled hook scripts execute from inside the consumer
 * repo: `.ai/kenkeep/hooks/<harness>/`. The directory is gitignored (the
 * scripts are per-clone runtime assets restored by `init`), while the host
 * registration files that point at it are committed. These three helpers are
 * the single source for that location; adapters, `init` and `doctor` must not
 * spell the path out themselves.
 */
export function sharedHarnessHooksDir(paths: RepoPaths, harnessId: string): string {
  return join(paths.hooksDir, harnessId);
}

export function sharedHarnessHooksDirForRoot(root: string, harnessId: string): string {
  return join(root, '.ai', 'kenkeep', 'hooks', harnessId);
}

/** Repo-relative script path the host registration files reference. */
export function sharedHookScriptPath(harnessId: string, scriptPath: string): string {
  return `.ai/kenkeep/hooks/${harnessId}/${scriptPath}`;
}

export type TemplateHooksDirName = 'hooks' | 'kk-hooks';

/**
 * Locates the compiled hook scripts the build shipped for `harnessId` under
 * the package `templates/` tree. The build writes them to
 * `templates/<harness>/hooks/` by default and to `templates/<harness>/kk-hooks/`
 * for adapters whose host reserves `<dir>/hooks/` (a plugin shim or a
 * `.kk-hooks-output` marker); reading which one exists keeps that decision in
 * the build pipeline instead of a second hard-coded list here.
 */
export function templateHooksDir(
  templatesDir: string,
  harnessId: string
): { dir: string; name: TemplateHooksDirName } | null {
  for (const name of ['hooks', 'kk-hooks'] as const) {
    const dir = join(templatesDir, harnessId, name);
    if (existsSync(dir)) return { dir, name };
  }
  return null;
}

/**
 * Copies the shipped hook scripts for `harnessId` into the shared hooks
 * directory, overwriting whatever is there. No-ops when the package carries
 * no scripts for the adapter (partial dev builds).
 */
export function copySharedHookScripts(
  templatesDir: string,
  paths: RepoPaths,
  harnessId: string
): void {
  const src = templateHooksDir(templatesDir, harnessId);
  if (!src) return;
  copyTree(src.dir, sharedHarnessHooksDir(paths, harnessId));
}

/** Distinct script filenames the adapter's hook specs execute. */
export function expectedHookScripts(hooks: readonly HookSpec[]): string[] {
  return [...new Set(hooks.map(spec => spec.scriptPath))];
}

/** Expected script filenames absent from `hooksDir`. */
export function missingHookScripts(hooksDir: string, hooks: readonly HookSpec[]): string[] {
  return expectedHookScripts(hooks).filter(name => !existsSync(join(hooksDir, name)));
}

/**
 * Combined "hooks registered" doctor result for adapters whose native config
 * references the shared scripts entry by entry. The adapter derives
 * `missingRegistrations` from its own config format; the script check and
 * the remedy wording are shared. Missing registrations need `--upgrade`
 * (which rewrites host config); missing scripts alone need only a plain
 * `init`, which restores runtime assets without touching host config.
 */
export function hookRegistrationDoctorCheck(
  missingRegistrations: string[],
  hooksDir: string,
  hooks: readonly HookSpec[],
  harnessId: string
): DoctorCheckResult {
  const missingScripts = missingHookScripts(hooksDir, hooks);
  if (missingRegistrations.length === 0 && missingScripts.length === 0) {
    return ok('all expected hook entries and scripts present');
  }
  const parts: string[] = [];
  if (missingRegistrations.length > 0) {
    parts.push(`missing registrations: ${missingRegistrations.join(', ')}`);
  }
  if (missingScripts.length > 0) parts.push(`missing scripts: ${missingScripts.join(', ')}`);
  const remedy =
    missingRegistrations.length > 0
      ? `Re-run \`npx kenkeep init --harnesses ${harnessId} --upgrade\`.`
      : `Run \`npx kenkeep init --harnesses ${harnessId}\` to restore them.`;
  return errCheck(`${parts.join('; ')}. ${remedy}`);
}

/**
 * Doctor check for the shared hook scripts of one adapter. Used directly by
 * adapters whose registration lives elsewhere (a plugin or an aggregated
 * config) and folded into the combined "hooks registered" check by the rest.
 */
export function hookScriptsDoctorCheck(
  hooksDir: string,
  hooks: readonly HookSpec[],
  harnessId: string
): DoctorCheckResult {
  const missing = missingHookScripts(hooksDir, hooks);
  if (missing.length === 0) return ok(expectedHookScripts(hooks).join(', '));
  return errCheck(
    `missing scripts under ${hooksDir}: ${missing.join(', ')}. ` +
      `Run \`npx kenkeep init --harnesses ${harnessId}\` to restore them.`
  );
}
