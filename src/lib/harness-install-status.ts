import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getHarness, listHarnessIds } from '../harnesses/registry.js';
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

/** The file's text, or null when the path is missing, not a file, or unreadable. */
function readTextFile(file: string): string | null {
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The committed host file that shows this adapter is registered in the repo,
 * or null. Registration is detected from the adapter's settings file naming
 * the shared hook-script path, or from a shipped plugin in its plugin
 * directory. An unreadable or non-file settings path counts as no evidence.
 * `init` and `doctor` use this to find the repo's harnesses.
 */
export function registrationEvidence(
  root: string,
  templatesDir: string,
  adapter: HarnessAdapter
): string | null {
  const locs = adapter.paths(root);
  if (locs.settingsFile) {
    const marker = sharedHookScriptPath(adapter.id, '');
    if (readTextFile(locs.settingsFile)?.includes(marker)) return locs.settingsFile;
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

/** Ids of every adapter with registration evidence in `root`, in registry order. */
export function registeredHarnesses(root: string, templatesDir: string): string[] {
  return listHarnessIds().filter(
    id => registrationEvidence(root, templatesDir, getHarness(id)) !== null
  );
}
