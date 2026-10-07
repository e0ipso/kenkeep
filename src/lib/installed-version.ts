import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { packageVersion } from './version.js';

/**
 * The committed install marker at `.ai/kenkeep/.state/installed-version`.
 * `harnesses` is the team's harness inventory: every adapter whose host
 * registration lives in the repo. `init` and `init --upgrade` only ever add
 * to it; nothing removes a harness implicitly (see `mergeHarnessInventory`).
 */
export interface InstalledVersion {
  schema_version: 1;
  package: string;
  version: string;
  installed_at: string;
  harnesses: string[];
}

/**
 * Reads the marker. Returns null when it does not exist and throws when it
 * cannot be parsed: a corrupt inventory must stop `init` rather than be
 * silently replaced, and `doctor` reports it through its own check.
 */
export function readInstalledVersion(file: string): InstalledVersion | null {
  if (!existsSync(file)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse ${file}: ${(err as Error).message}`);
  }
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Could not parse ${file}: expected a JSON object`);
  }
  const record = raw as Partial<InstalledVersion> & { harnesses?: unknown };
  const harnesses = Array.isArray(record.harnesses)
    ? record.harnesses.filter((h): h is string => typeof h === 'string')
    : [];
  return {
    schema_version: 1,
    package: typeof record.package === 'string' ? record.package : 'kenkeep',
    version: typeof record.version === 'string' ? record.version : '',
    installed_at: typeof record.installed_at === 'string' ? record.installed_at : '',
    harnesses,
  };
}

/** A fresh marker for the current package version. */
export function installedVersionRecord(harnesses: string[]): InstalledVersion {
  return {
    schema_version: 1,
    package: 'kenkeep',
    version: packageVersion(),
    installed_at: new Date().toISOString(),
    harnesses,
  };
}

export function writeInstalledVersion(
  file: string,
  stateDir: string,
  record: InstalledVersion
): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

/**
 * Recorded inventory plus any newly requested harness, in recorded order
 * then request order. Removal is deliberately not expressible here: a
 * harness leaves the inventory only when a human deletes its host
 * registration and edits the marker.
 */
export function mergeHarnessInventory(recorded: string[], requested: string[]): string[] {
  const merged = [...recorded];
  for (const id of requested) if (!merged.includes(id)) merged.push(id);
  return merged;
}
