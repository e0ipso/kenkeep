import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  formatIssue,
  InvalidNodeFrontmatterError,
  readAllNodes,
  validateNodeNaming,
} from './nodes.js';
import { NODE_SCHEMA_VERSION, PackManifestSchema, type PackManifest } from './schemas.js';

export const PACK_MANIFEST_FILENAME = 'kenkeep-pack.yaml';
export const PACK_KNOWLEDGE_DIRNAME = 'knowledge';

export interface PackValidationResult {
  ok: boolean;
  manifest?: PackManifest;
  errors: string[];
  warnings: string[];
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function parseManifest(file: string): { data?: unknown; error?: string } {
  try {
    return { data: yaml.load(readFileSync(file, 'utf8')) };
  } catch (err) {
    return { error: `malformed YAML in ${PACK_MANIFEST_FILENAME}: ${(err as Error).message}` };
  }
}

function schemaMismatchMessage(actual: unknown): string | null {
  if (typeof actual !== 'number' || actual === NODE_SCHEMA_VERSION) return null;
  return (
    `pack schema_version ${actual} does not match installed kenkeep node schema ` +
    `${NODE_SCHEMA_VERSION}; the pack and installed kenkeep are on different schemas.`
  );
}

function validateManifest(packRoot: string, errors: string[]): PackManifest | undefined {
  const manifestFile = join(packRoot, PACK_MANIFEST_FILENAME);
  if (!existsSync(manifestFile)) {
    errors.push(`missing required manifest ${PACK_MANIFEST_FILENAME}`);
    return undefined;
  }

  const parsed = parseManifest(manifestFile);
  if (parsed.error) {
    errors.push(parsed.error);
    return undefined;
  }

  if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    const mismatch = schemaMismatchMessage((parsed.data as Record<string, unknown>).schema_version);
    if (mismatch) {
      errors.push(mismatch);
      return undefined;
    }
  }

  const result = PackManifestSchema.safeParse(parsed.data);
  if (!result.success) {
    errors.push(`${PACK_MANIFEST_FILENAME} does not match PackManifestSchema:`);
    for (const issue of result.error.issues) {
      errors.push(`  - ${formatIssue(issue)}`);
    }
    return undefined;
  }
  return result.data;
}

function invalidFrontmatterErrors(err: InvalidNodeFrontmatterError): string[] {
  const lines = ['invalid node frontmatter in pack knowledge/:'];
  for (const failure of err.failures) {
    lines.push(`  - ${failure.file}: ${failure.reason}`);
    for (const issue of failure.issues) {
      lines.push(`    - ${formatIssue(issue)}`);
    }
  }
  return lines;
}

export function validatePack(packRoot: string): PackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifest = validateManifest(packRoot, errors);
  if (!manifest) return { ok: false, errors, warnings };

  const knowledgeDir = join(packRoot, PACK_KNOWLEDGE_DIRNAME);
  if (!existsSync(knowledgeDir)) {
    errors.push(`missing required ${PACK_KNOWLEDGE_DIRNAME}/ directory`);
    return { ok: false, manifest, errors, warnings };
  }
  if (!isDirectory(knowledgeDir)) {
    errors.push(`${PACK_KNOWLEDGE_DIRNAME}/ exists but is not a directory`);
    return { ok: false, manifest, errors, warnings };
  }

  let nodes;
  try {
    nodes = readAllNodes(knowledgeDir);
  } catch (err) {
    if (err instanceof InvalidNodeFrontmatterError) {
      errors.push(...invalidFrontmatterErrors(err));
    } else {
      errors.push((err as Error).message);
    }
    return { ok: false, manifest, errors, warnings };
  }

  const seen = new Map<string, string>();
  for (const node of nodes) {
    const namingError = validateNodeNaming(node);
    if (namingError) {
      errors.push(`${node.path}: ${namingError}`);
    }

    const id = node.frontmatter.id;
    const first = seen.get(id);
    if (first) {
      errors.push(`duplicate node id ${id} in pack: ${first} and ${node.path}`);
    } else {
      seen.set(id, node.path);
    }
  }

  return {
    ok: errors.length === 0,
    manifest,
    errors,
    warnings,
  };
}
