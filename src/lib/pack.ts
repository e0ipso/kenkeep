import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { folderSummariesFileForNodesDir, FolderSummaryRegistrySchema } from './folder-summaries.js';
import { tryNormalizeFolderKey } from './path-safety.js';
import {
  formatIssue,
  InvalidNodeFrontmatterError,
  readAllNodes,
  validateNodeNaming,
  type NodeFile,
} from './nodes.js';
import {
  mergeRedirectsLedgers,
  parseRedirectsLedger,
  REDIRECTS_FILENAME,
  resolveRedirect,
  type RedirectsLedger,
} from './redirects.js';
import { NODE_SCHEMA_VERSION, PackManifestSchema, type PackManifest } from './schemas.js';

export const PACK_MANIFEST_FILENAME = 'kenkeep-pack.yaml';
export const PACK_KNOWLEDGE_DIRNAME = 'knowledge';

export interface PackValidationResult {
  ok: boolean;
  manifest?: PackManifest;
  /** Every validated leaf of `knowledge/`, present once the tree parsed. */
  nodes?: NodeFile[];
  /** The pack's redirect ledger (`knowledge/.redirects.json`), `{}` when absent. */
  ledger?: RedirectsLedger;
  errors: string[];
  warnings: string[];
}

/**
 * The consumer side of an import, so identity and edge semantics are decided
 * against the tree the pack will join rather than the pack alone.
 * Omitted (or empty) for a standalone pack: references then have to resolve
 * within the pack itself.
 */
export interface PackValidationContext {
  /** Live consumer node ids, each mapped to its `nodes/`-relative path for diagnostics. */
  consumerIds?: ReadonlyMap<string, string>;
  /** The consumer's root redirect ledger. */
  consumerLedger?: RedirectsLedger;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
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
 * Every symlink among the pack files import reads, as POSIX paths relative to
 * the pack root, sorted. The root manifest, `knowledge/` itself, every entry
 * below it (leaves, reserved indexes, directories, dotfiles, non-markdown
 * files) and the root-level folder summary sidecar are `lstat`ed; nothing is
 * followed and nothing is read. A pack is third-party input: a link anywhere
 * in it would let the import read whatever the consumer's machine can read,
 * so the structural rule is "no links at all" rather than a target check,
 * which a link could satisfy at scan time and defeat later. Callers run this
 * before the manifest is parsed.
 */
export function findPackSymlinks(packRoot: string): string[] {
  const found: string[] = [];
  const report = (path: string): void => {
    found.push(relative(packRoot, path).split(sep).join(posix.sep));
  };
  const manifestFile = join(packRoot, PACK_MANIFEST_FILENAME);
  if (isSymlink(manifestFile)) report(manifestFile);
  const knowledgeDir = join(packRoot, PACK_KNOWLEDGE_DIRNAME);
  if (isSymlink(knowledgeDir)) {
    report(knowledgeDir);
    return found.sort((a, b) => a.localeCompare(b));
  }
  if (isSymlink(folderSummariesFileForNodesDir(knowledgeDir))) {
    report(folderSummariesFileForNodesDir(knowledgeDir));
  }
  const walk = (dir: string): void => {
    if (!isDirectory(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) report(full);
      else if (entry.isDirectory()) walk(full);
    }
  };
  walk(knowledgeDir);
  return found.sort((a, b) => a.localeCompare(b));
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
    // Keys are third-party input: `../../../evil` survives prefixing with the
    // destination branch, because `dest/../..` normalizes away.
    const normalized = tryNormalizeFolderKey(key);
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

/**
 * The pack's redirect ledger. Export copies `nodes/` wholesale, so a pack
 * published after a split ships `knowledge/.redirects.json`; absent means no
 * retired ids. A present file is untrusted, so it is parsed strictly: the
 * lenient consumer reader would turn a corrupt ledger into `{}` and drop the
 * only record of what the pack's retired-id edges mean.
 */
function validateRedirectsLedger(knowledgeDir: string, errors: string[]): RedirectsLedger {
  const file = join(knowledgeDir, REDIRECTS_FILENAME);
  if (!existsSync(file)) return {};
  try {
    return parseRedirectsLedger(readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(
      `malformed ${PACK_KNOWLEDGE_DIRNAME}/${REDIRECTS_FILENAME}: ${(err as Error).message}`
    );
    return {};
  }
}

/**
 * Identity and edge semantics of the pack against the tree it will join.
 *
 * Identity: a pack id is bound to the pack's own leaf, never to a consumer
 * leaf that happens to share the id, so a collision with a live consumer node
 * (or with an id the consumer retired) is an error that needs a human
 * decision. Likewise the pack may not retire an id that is live on either
 * side, and a retired id both ledgers record must agree on its successors.
 *
 * Edges: every `kk_relates_to` / `kk_depends_on` reference must resolve, via
 * the merged ledgers, to a live id in the pack or the consumer. An unresolved
 * reference would graft as a dangling edge; a pack referencing a node only the
 * consumer has is legitimate (an extension of a base pack it imported).
 */
function validateGraphIdentity(
  nodes: readonly NodeFile[],
  packLedger: RedirectsLedger,
  context: PackValidationContext,
  errors: string[]
): void {
  const consumerIds = context.consumerIds ?? new Map<string, string>();
  const consumerLedger = context.consumerLedger ?? {};
  const packIds = new Map(nodes.map(node => [node.frontmatter.kk_id, node.relPath]));

  for (const [id, relPath] of packIds) {
    const consumerPath = consumerIds.get(id);
    if (consumerPath !== undefined) {
      errors.push(
        `node id ${id} (${relPath}) already exists in this knowledge base at nodes/${consumerPath}; ` +
          `import never binds a pack reference to unrelated content. Retire or rename one side, then re-run.`
      );
    }
    const retiredTo = consumerLedger[id];
    if (retiredTo !== undefined) {
      errors.push(
        `node id ${id} (${relPath}) was retired in this knowledge base ` +
          `(${REDIRECTS_FILENAME} redirects it to ${retiredTo.join(', ')}); ` +
          `re-publishing a retired id needs a human decision.`
      );
    }
  }

  for (const retired of Object.keys(packLedger)) {
    const packPath = packIds.get(retired);
    if (packPath !== undefined) {
      errors.push(
        `${REDIRECTS_FILENAME} retires ${retired}, which is a live node in the pack (${packPath}).`
      );
    }
    const consumerPath = consumerIds.get(retired);
    if (consumerPath !== undefined) {
      errors.push(
        `${REDIRECTS_FILENAME} retires ${retired}, which is a live node in this knowledge base ` +
          `(nodes/${consumerPath}); resolve the identity by hand before importing.`
      );
    }
  }

  const { merged, collisions } = mergeRedirectsLedgers(consumerLedger, packLedger);
  for (const collision of collisions) {
    errors.push(
      `redirect ${collision.id} is already recorded in this knowledge base with different ` +
        `successors (here: ${collision.existing.join(', ')}; pack: ${collision.incoming.join(', ')}); ` +
        `reconcile the ledgers by hand before importing.`
    );
  }

  const live = new Set<string>([...packIds.keys(), ...consumerIds.keys()]);
  for (const node of nodes) {
    const refs = [...node.frontmatter.kk_relates_to, ...node.frontmatter.kk_depends_on];
    for (const ref of refs) {
      if (resolveRedirect(merged, live, ref).length > 0) continue;
      errors.push(
        `${node.relPath}: edge ${ref} does not resolve to a node in the pack or in this knowledge base.`
      );
    }
  }
}

/**
 * Validates a pack against the tree it will join. Reads through links, so
 * callers refuse a pack with `findPackSymlinks` first.
 */
export function validatePack(
  packRoot: string,
  context: PackValidationContext = {}
): PackValidationResult {
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

  let nodes: NodeFile[];
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
  const ledger = validateRedirectsLedger(knowledgeDir, errors);
  validateGraphIdentity(nodes, ledger, context, errors);

  return {
    ok: errors.length === 0,
    manifest,
    nodes,
    ledger,
    errors,
    warnings,
  };
}
