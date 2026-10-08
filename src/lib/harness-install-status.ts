import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessAdapter } from '../harnesses/types.js';
import { copyMissingEntries } from './fs-atomic.js';
import { assertContained } from './path-safety.js';
import {
  expectedHookScripts,
  missingHookScripts,
  sharedHarnessHooksDirForRoot,
  sharedHookScriptPath,
  templateHooksDir,
} from './shared-hooks.js';

/** The adapter's shared hook-script directory (`.ai/kenkeep/hooks/<id>/`). */
function hooksDirOf(root: string, adapter: HarnessAdapter): string {
  return adapter.paths(root).hooksDir ?? sharedHarnessHooksDirForRoot(root, adapter.id);
}

/** Hook scripts the adapter's specs run that are absent from its hooks directory. */
export function missingRuntimeScripts(root: string, adapter: HarnessAdapter): string[] {
  return missingHookScripts(hooksDirOf(root, adapter), adapter.hooks);
}

function shippedPlugins(templatesDir: string, harnessId: string): string[] {
  const dir = join(templatesDir, harnessId, 'plugins');
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

/** A checked restore of one adapter's missing hook scripts; see `planHarnessRuntimeRepair`. */
export interface HarnessRuntimeRepair {
  src: string;
  dest: string;
  names: string[];
}

/**
 * Plans the restore of the adapter's hook scripts from the running package.
 * They are the one runtime asset a clone lacks: the consumer `.gitignore`
 * covers `.ai/kenkeep/hooks/`, while skills, plugins, prompts and host
 * registrations are committed. Every destination must stay inside `root`
 * without crossing a symlink; otherwise this throws and nothing is written,
 * so callers can plan every adapter before repairing any.
 */
export function planHarnessRuntimeRepair(
  root: string,
  templatesDir: string,
  adapter: HarnessAdapter
): HarnessRuntimeRepair | null {
  const src = templateHooksDir(templatesDir, adapter.id);
  if (!src) return null;
  const dest = hooksDirOf(root, adapter);
  const names = expectedHookScripts(adapter.hooks);
  for (const name of names) assertContained(root, join(dest, name), 'the repository');
  return { src: src.dir, dest, names };
}

/**
 * Copies the planned scripts that are missing and returns their names.
 * Scripts already on disk stay byte-identical; replacing the set is what
 * `init --upgrade` is for.
 */
export function repairHarnessRuntime(plan: HarnessRuntimeRepair): string[] {
  return copyMissingEntries(plan.src, plan.dest, plan.names);
}

/**
 * The committed host file that shows this adapter is registered in the repo
 * even though the install marker does not list it, or null when no such
 * evidence exists. Registration evidence is generic: the adapter's settings
 * file names the shared script path, or its plugin directory carries a
 * shipped plugin. Used by `doctor` to catch inventory drift.
 */
export function registrationEvidence(
  root: string,
  templatesDir: string,
  adapter: HarnessAdapter
): string | null {
  const locs = adapter.paths(root);
  if (locs.settingsFile && existsSync(locs.settingsFile)) {
    const marker = sharedHookScriptPath(adapter.id, '');
    if (readFileSync(locs.settingsFile, 'utf8').includes(marker)) return locs.settingsFile;
  }
  if (locs.pluginsDir) {
    const pluginsDir = locs.pluginsDir;
    const present = shippedPlugins(templatesDir, adapter.id).find(name =>
      existsSync(join(pluginsDir, name))
    );
    if (present) return join(pluginsDir, present);
  }
  return null;
}
