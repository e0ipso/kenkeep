import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { folderSummariesFileForNodesDir, FolderSummaryRegistrySchema } from './folder-summaries.js';
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

/**
 * Every directory under `knowledgeDir`, inclusive, as a POSIX path relative to
 * it. The root folder is the empty string, matching the registry's root key.
 */
function knowledgeFolders(knowledgeDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    out.push(relative(knowledgeDir, dir).split(sep).join(posix.sep));
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
    }
  };
  walk(knowledgeDir);
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Normalize an untrusted registry key exactly as `normalizeFolderSummaryKey`
 * (src/lib/folder-summaries.ts) does on write, but returning `null` instead of
 * throwing when the key escapes the knowledge tree. A pack is third-party
 * content and its keys are never normalized on read, so a hostile pack can ship
 * `../../../evil`; prefixing with the destination branch does not neutralize it
 * because `dest/../..` normalizes away. `''`, `.` and `/` all denote the
 * legitimate root folder and must be accepted.
 */
function normalizeRegistryKey(key: string): string | null {
  const normalized = posix.normalize(key.split(sep).join(posix.sep));
  if (normalized === '.' || normalized === '/') return '';
  if (normalized.startsWith('../') || normalized === '..' || normalized.startsWith('/')) {
    return null;
  }
  return normalized.replace(/\/+$/u, '');
}

/**
 * Validate the pack-root folder summary registry. An absent file is valid and
 * silent: packs published before the registry existed carry none and must keep
 * importing. A present file is untrusted input — schema failures and keys that
 * escape the knowledge tree are errors, rejected here rather than mid-merge so
 * a consumer registry is never left partially written. Folders shipped in
 * `knowledge/` with no entry are warnings only.
 */
function validateFolderSummaryRegistry(
  knowledgeDir: string,
  errors: string[],
  warnings: string[]
): void {
  const file = folderSummariesFileForNodesDir(knowledgeDir);
  const name = basename(file);
  if (!existsSync(file)) return;

  let content: string;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    errors.push(`cannot read ${name}: ${(err as Error).message}`);
    return;
  }

  let data: unknown;
  try {
    data = matter(content).data;
  } catch (err) {
    errors.push(`malformed frontmatter in ${name}: ${(err as Error).message}`);
    return;
  }

  const result = FolderSummaryRegistrySchema.safeParse(data);
  if (!result.success) {
    errors.push(`${name} does not match FolderSummaryRegistrySchema:`);
    for (const issue of result.error.issues) {
      errors.push(`  - ${formatIssue(issue)}`);
    }
    return;
  }

  const entries = new Set<string>();
  for (const key of Object.keys(result.data.summaries)) {
    const normalized = normalizeRegistryKey(key);
    if (normalized === null) {
      errors.push(`folder summary key "${key}" escapes ${PACK_KNOWLEDGE_DIRNAME}/`);
      continue;
    }
    entries.add(normalized);
  }

  for (const folder of knowledgeFolders(knowledgeDir)) {
    // The pack root never needs an entry: import stamps the destination branch
    // key from the manifest's required `summary` field, which is authoritative.
    if (folder === '' || entries.has(folder)) continue;
    warnings.push(`folder "${folder}" has no summary in ${name}`);
  }
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

    const id = node.frontmatter.kk_id;
    const first = seen.get(id);
    if (first) {
      errors.push(`duplicate node id ${id} in pack: ${first} and ${node.path}`);
    } else {
      seen.set(id, node.path);
    }
  }

  validateFolderSummaryRegistry(knowledgeDir, errors, warnings);

  return {
    ok: errors.length === 0,
    manifest,
    errors,
    warnings,
  };
}
