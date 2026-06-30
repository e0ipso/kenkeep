import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CuratorOutputSchema,
  CuratorProposedNodeSchema,
  NodeFrontmatterSchema,
  PackManifestSchema,
  ProposalOutputSchema,
} from './schemas.js';

/**
 * Single source mapping stable, skill-facing names to the Zod schema that
 * already validates the corresponding JSON in `src/commands/`. The skills
 * reference these names via `kk schema <name>` (print the JSON Schema) and
 * `kk validate <name> [file]` (validate an artifact); `kk drafts collect`
 * resolves its `--schema` through the same map. Zod stays authoritative — the
 * JSON Schema is always derived here, never hand-authored.
 *
 * Keep this minimal (YAGNI): add a name only when a skill or primitive needs
 * to reference that exact contract.
 */
export const SCHEMA_REGISTRY: Readonly<Record<string, ZodTypeAny>> = {
  // Output of the proposal-extract prompt (session-extract / bootstrap drafting).
  'proposal-output': ProposalOutputSchema,
  // Array of curator actions an LLM drafts before `curate-dedup`/`curate-persist`.
  'curator-output': CuratorOutputSchema,
  // The node content an LLM drafts inside an add/modify action (kk-add/bootstrap).
  'proposed-node': CuratorProposedNodeSchema,
  // The persisted node frontmatter contract.
  node: NodeFrontmatterSchema,
  // The publishable knowledge-pack manifest.
  'pack-manifest': PackManifestSchema,
};

/** Sorted list of registered schema names, for help/error messages. */
export const SCHEMA_NAMES: readonly string[] = Object.keys(SCHEMA_REGISTRY).sort();

/** Resolves a registered name to its Zod schema, or `undefined` when unknown. */
export function resolveNamedSchema(name: string): ZodTypeAny | undefined {
  return SCHEMA_REGISTRY[name];
}

/**
 * Projects a registered Zod schema to JSON Schema. Returns `undefined` for an
 * unknown name so callers can emit a consistent "available names" error.
 */
export function toJsonSchema(name: string): Record<string, unknown> | undefined {
  const schema = resolveNamedSchema(name);
  if (!schema) return undefined;
  return zodToJsonSchema(schema, name) as Record<string, unknown>;
}
