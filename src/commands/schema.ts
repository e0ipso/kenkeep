import { log } from '../lib/log.js';
import { SCHEMA_NAMES, toJsonSchema } from '../lib/schema-registry.js';

export interface SchemaCommandOptions {
  /** Registered schema name to print (see SCHEMA_NAMES). */
  name?: string | undefined;
}

/**
 * Prints the JSON Schema for a named Zod contract to stdout. The schema is
 * derived from `src/lib/schemas.ts` via the shared registry — never
 * hand-authored — so it cannot drift from the runtime validator. Unknown or
 * missing names exit non-zero and list the available names.
 */
export async function runSchemaCommand(opts: SchemaCommandOptions = {}): Promise<number> {
  const name = opts.name;
  if (name === undefined || name === '') {
    log.error(`schema: missing schema name. Available: ${SCHEMA_NAMES.join(', ')}`);
    return 1;
  }
  const json = toJsonSchema(name);
  if (json === undefined) {
    log.error(`schema: unknown schema "${name}". Available: ${SCHEMA_NAMES.join(', ')}`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  return 0;
}
