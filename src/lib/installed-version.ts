import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { atomicWriteFile } from './fs-atomic.js';
import { packageVersion } from './version.js';

/**
 * The committed install marker at `.ai/kenkeep/.state/installed-version`.
 * Its existence is the "kenkeep is initialized" signal that hooks, commands
 * and `init` routing check; its content is the package version that last
 * installed or upgraded the repo. It names no harness: `init` and `doctor`
 * find a repo's harnesses from its committed host registrations
 * (`registeredHarnesses`). Nothing in it varies per developer or per run.
 */
export interface InstalledVersion {
  schema_version: 1;
  package: string;
  version: string;
}

/**
 * Every marker kenkeep has written under `.ai/kenkeep/` carries these three
 * fields (the `assistants` field of the pre-rename releases lived under
 * `.ai/knowledge-base/`, which nothing reads), so no field has a fallback.
 * A plain `z.object`, neither `.strict()` nor `.passthrough()`: unknown keys
 * are stripped on parse.
 */
const InstalledVersionSchema = z.object({
  schema_version: z.literal(1),
  package: z.string(),
  version: z.string(),
});

/**
 * Reads the marker. Returns null when it does not exist. The schema strips
 * the keys that older releases wrote (the install timestamp and the
 * `harnesses` list), so a legacy marker reads without error and the next
 * write drops them. Throws when the file is not JSON or a kept field has the
 * wrong type: a corrupt marker must stop `init` rather than be silently
 * replaced, and `doctor` reports it through its own check.
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

/** The marker for the running package version; one version always gives the same record. */
export function installedVersionRecord(): InstalledVersion {
  return { schema_version: 1, package: 'kenkeep', version: packageVersion() };
}

/**
 * Writes `record` unless `file` already holds exactly its serialized bytes.
 * Running `init` or `init --upgrade` again at the same package version
 * therefore leaves the committed marker untouched, while a legacy marker (or
 * an older version) is rewritten to three fields.
 */
export function writeInstalledVersionIfChanged(file: string, record: InstalledVersion): void {
  const content = `${JSON.stringify(record, null, 2)}\n`;
  if (existsSync(file) && readFileSync(file).equals(Buffer.from(content))) return;
  atomicWriteFile(file, content);
}
