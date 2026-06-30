import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import yaml from 'js-yaml';
import { log } from '../lib/log.js';
import { SCHEMA_NAMES, resolveNamedSchema } from '../lib/schema-registry.js';
import { readStdin } from '../lib/stdin.js';

export interface ValidateCommandOptions {
  /** Registered schema name to validate against (see SCHEMA_NAMES). */
  name?: string | undefined;
  /** Artifact path. When omitted or `-`, read from stdin. */
  file?: string | undefined;
}

async function readArtifact(file: string | undefined): Promise<string> {
  if (file !== undefined && file !== '' && file !== '-') {
    const abs = isAbsolute(file) ? file : resolve(process.cwd(), file);
    if (!existsSync(abs)) {
      throw new Error(`file does not exist (${abs}).`);
    }
    return readFileSync(abs, 'utf8');
  }
  return readStdin();
}

/**
 * Validates a JSON or YAML artifact against a named Zod schema and prints
 * path-referenced errors. Mirrors the produce -> validate -> fix loop the kk
 * skills drive: exit 0 with a one-line OK on success; non-zero with one located
 * issue per line on a parse or validation failure.
 */
export async function runValidateCommand(opts: ValidateCommandOptions = {}): Promise<number> {
  const name = opts.name;
  if (name === undefined || name === '') {
    log.error(`validate: missing schema name. Available: ${SCHEMA_NAMES.join(', ')}`);
    return 1;
  }
  const schema = resolveNamedSchema(name);
  if (schema === undefined) {
    log.error(`validate: unknown schema "${name}". Available: ${SCHEMA_NAMES.join(', ')}`);
    return 1;
  }

  let raw: string;
  try {
    raw = await readArtifact(opts.file);
  } catch (err) {
    log.error(`validate: ${(err as Error).message}`);
    return 1;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    try {
      parsed = yaml.load(raw);
    } catch (yamlErr) {
      log.error(
        `validate: input is not valid JSON or YAML: ${(err as Error).message}; ` +
          `${(yamlErr as Error).message}`
      );
      return 1;
    }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    log.error(`validate: ${name} artifact is invalid:`);
    for (const issue of result.error.issues) {
      log.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return 1;
  }

  process.stdout.write(`${name}: valid\n`);
  return 0;
}
