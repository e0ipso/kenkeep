import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
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
 * Every marker kenkeep has written under `.ai/kenkeep/` has this shape (the
 * `assistants` field of the pre-rename releases lived under
 * `.ai/knowledge-base/`, which nothing reads), so no field has a fallback.
 * Unknown keys are dropped on rewrite.
 */
const InstalledVersionSchema = z.object({
  schema_version: z.literal(1),
  package: z.string(),
  version: z.string(),
  installed_at: z.string(),
  harnesses: z.array(z.string()),
});

/**
 * Reads the marker. Returns null when it does not exist and throws when it
 * cannot be parsed or does not match the marker shape: a corrupt inventory
 * must stop `init` rather than be silently replaced, and `doctor` reports it
 * through its own check.
 */
export function readInstalledVersion(file: string): InstalledVersion | null {
  if (!existsSync(file)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse ${file}: ${(err as Error).message}`);
  }
  const parsed = InstalledVersionSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? `"${issue.path.join('.')}"` : '(top level)';
    throw new Error(
      `Malformed ${file}: ${where}: ${issue?.message ?? 'invalid'}. Fix the file by hand; ` +
        'kenkeep left it unchanged.'
    );
  }
  return parsed.data;
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
