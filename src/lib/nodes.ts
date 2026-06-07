import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import {
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  type NodeFrontmatter,
  type NodeKind,
} from './schemas.js';

/** Filename of a generated per-folder index node. Never a leaf. */
export const INDEX_FILENAME = 'index.md';

export interface NodeFile {
  /** Absolute path to the leaf file on disk. */
  path: string;
  /** Bare filename, e.g. `practice-foo.md`. */
  filename: string;
  /**
   * POSIX-style path relative to `nodes/`, e.g. `topic/practice-foo.md`.
   * Path is presentation; `id` is identity. Cross references resolve by id and
   * render this current path.
   */
  relPath: string;
  /**
   * POSIX-style directory of this leaf relative to `nodes/`. The empty string
   * means the leaf sits at the `nodes/` root.
   */
  relDir: string;
  frontmatter: NodeFrontmatter;
  body: string;
}

export interface NodeLoadFailure {
  file: string;
  reason: string;
  issues: z.ZodIssue[];
}

export class InvalidNodeFrontmatterError extends Error {
  readonly failures: NodeLoadFailure[];
  constructor(failures: NodeLoadFailure[]) {
    super(formatFailures(failures));
    this.name = 'InvalidNodeFrontmatterError';
    this.failures = failures;
  }
}

/**
 * Thrown when the on-disk knowledge base uses the old flat `nodes/<kind>/`
 * layout (or `schema_version: 1`). The tree-storage clean break (plan 41,
 * `practice-strict-schema-version-bump-policy`) rejects the old shape outright
 * rather than misparsing it; there is no migrator. The message points the user
 * to re-init.
 */
export class OldLayoutError extends Error {
  constructor(detail: string) {
    super(
      `${detail} kenkeep now stores nodes in a nested topical folder tree ` +
        `(schema_version ${NODE_SCHEMA_VERSION}); the old flat nodes/<kind>/ layout is no ` +
        `longer readable. Re-initialize with \`npx kenkeep init --upgrade\` (or remove the ` +
        `old nodes/ tree and re-init). There is no automatic migration in this version.`
    );
    this.name = 'OldLayoutError';
  }
}

const LEGACY_KIND_DIRS = ['practice', 'map'];

/**
 * Detects the old flat layout: a `nodes/practice/` or `nodes/map/` directory
 * that holds leaf `.md` files (the legacy two-bucket shape) without the new
 * per-folder `index.md` convention. Throws `OldLayoutError` if found. This is
 * the clean-break guard; it must fire before any attempt to parse leaves so an
 * old KB fails loudly instead of being silently misread.
 */
export function assertNotOldLayout(nodesDir: string): void {
  if (!existsSync(nodesDir)) return;
  for (const kind of LEGACY_KIND_DIRS) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir) || !isDirectory(dir)) continue;
    const hasLeafDocs = readdirSync(dir).some(name => name.endsWith('.md') && name !== 'index.md');
    const hasIndex = existsSync(join(dir, 'index.md'));
    if (hasLeafDocs && !hasIndex) {
      throw new OldLayoutError(
        `Detected the legacy nodes/${kind}/ bucket with leaf documents and no index.md.`
      );
    }
  }
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively loads every leaf node `.md` file from the nested topical folder
 * tree under `nodesDir`, at any depth. Generated per-folder `index.md` files
 * are never treated as leaves. Directory entries are visited in deterministic
 * (lexicographic) order so downstream generation is byte-stable.
 *
 * `kind` is a frontmatter facet only and does not constrain directory placement
 * (placement is topical). `assertNotOldLayout` runs first and rejects the flat
 * `nodes/<kind>/` layout.
 *
 * Aggregates parse and schema failures across the whole tree and throws a
 * single `InvalidNodeFrontmatterError` listing every offending file. Callers
 * that wrap this in a `try/catch` get one actionable report; everywhere else,
 * the failure aborts loudly instead of silently dropping nodes.
 */
export function readAllNodes(nodesDir: string): NodeFile[] {
  assertNotOldLayout(nodesDir);
  const out: NodeFile[] = [];
  const failures: NodeLoadFailure[] = [];
  if (existsSync(nodesDir)) {
    collectLeafNodes(nodesDir, nodesDir, out, failures);
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  if (failures.length > 0) {
    throw new InvalidNodeFrontmatterError(failures);
  }
  return out;
}

function collectLeafNodes(
  rootDir: string,
  currentDir: string,
  out: NodeFile[],
  failures: NodeLoadFailure[]
): void {
  const names = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of names) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectLeafNodes(rootDir, fullPath, out, failures);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === INDEX_FILENAME) continue;
    const raw = readFileSync(fullPath, 'utf8');
    let parsed: ReturnType<typeof matter>;
    try {
      parsed = matter(raw);
    } catch (err) {
      failures.push({
        file: fullPath,
        reason: `YAML frontmatter parse error: ${(err as Error).message}`,
        issues: [],
      });
      continue;
    }
    const result = NodeFrontmatterSchema.safeParse(parsed.data);
    if (!result.success) {
      failures.push({
        file: fullPath,
        reason: 'frontmatter does not match NodeFrontmatterSchema',
        issues: result.error.issues,
      });
      continue;
    }
    const relPath = toPosixRel(rootDir, fullPath);
    out.push({
      path: fullPath,
      filename: entry.name,
      relPath,
      relDir: posix.dirname(relPath) === '.' ? '' : posix.dirname(relPath),
      frontmatter: result.data,
      body: parsed.content,
    });
  }
}

function toPosixRel(rootDir: string, fullPath: string): string {
  return relative(rootDir, fullPath).split(sep).join(posix.sep);
}

function formatFailures(failures: NodeLoadFailure[]): string {
  const lines = [`Invalid node frontmatter in ${failures.length} file(s):`];
  for (const f of failures) {
    lines.push(`  ${f.file}: ${f.reason}`);
    for (const issue of f.issues) {
      lines.push(`    - ${formatIssue(issue)}`);
    }
  }
  return lines.join('\n');
}

export function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `${path}: ${issue.message}`;
}

export function findNodeById(nodesDir: string, id: string): NodeFile | null {
  for (const node of readAllNodes(nodesDir)) {
    if (node.frontmatter.id === id) return node;
  }
  return null;
}

/**
 * Deterministic content hash over the leaf nodes under `nodesDir`.
 *
 *   1. Walk all leaf `.md` files under nodes/ recursively, EXCLUDING every
 *      generated `index.md` at any depth (and any root INDEX.md/GRAPH.md, which
 *      live outside `nodesDir`).
 *   2. For each leaf, sha256(file contents).
 *   3. Build "<relative-path-from-nodes-dir>\t<sha256-hex>" strings.
 *   4. Sort lexicographically.
 *   5. Join with newlines.
 *   6. sha256(joined), hex-encoded.
 *
 * Generated artifacts MUST NOT feed this hash: if `index.md` were hashed the
 * hash would be self-referential and every rebuild (which rewrites `index.md`)
 * would perturb it, breaking source-drift detection. Hashing leaves only keeps
 * the hash content-addressed and mtime-independent
 * (`practice-determinism-contract`).
 */
export function computeNodesHash(nodesDir: string): string {
  const entries: string[] = [];
  if (existsSync(nodesDir)) {
    walkMarkdown(nodesDir, nodesDir, entries);
  }
  entries.sort();
  return createHash('sha256').update(entries.join('\n'), 'utf8').digest('hex');
}

function walkMarkdown(rootDir: string, currentDir: string, out: string[]): void {
  for (const name of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, name.name);
    if (name.isDirectory()) {
      walkMarkdown(rootDir, fullPath, out);
      continue;
    }
    if (!name.name.endsWith('.md')) continue;
    // Generated index nodes are derived artifacts, never hashed.
    if (name.name === INDEX_FILENAME) continue;
    const rel = relative(rootDir, fullPath).split(sep).join(posix.sep);
    const sha = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
    out.push(`${rel}\t${sha}`);
  }
}

/**
 * Deterministic hash over an in-memory leaf set, using the same
 * `<relPath>\t<sha256(body+fm)>`, sort, join, sha256 algorithm as
 * `computeNodesHash`. Used for per-folder index-node frontmatter so a leaf edit
 * only perturbs the hash recorded in that leaf's own folder index, not in
 * unrelated folders. Hashes the reconstructed leaf content (frontmatter + body)
 * so it tracks any field or body change.
 */
export function hashLeaves(leaves: NodeFile[]): string {
  const entries = leaves.map(n => {
    const content = matter.stringify(n.body, n.frontmatter);
    const sha = createHash('sha256').update(content, 'utf8').digest('hex');
    return `${n.relPath}\t${sha}`;
  });
  entries.sort();
  return createHash('sha256').update(entries.join('\n'), 'utf8').digest('hex');
}

/**
 * Slugify a string for use as a node id segment. Keeps lowercase ascii and
 * dashes; collapses other runs to a single dash. Trims leading/trailing
 * dashes. Returns "untitled" for empty input.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

/**
 * Derives a node id from a kind and title. The id format is `<kind>-<slug>`;
 * `kind` is part of the id but does not determine the on-disk directory.
 */
export function deriveNodeId(kind: NodeKind, title: string): string {
  return `${kind}-${slugify(title)}`;
}

/**
 * The leaf filename for a node id. Filename is always `<id>.md`. The id already
 * carries its `<kind>-` prefix (identity); the directory is topical and chosen
 * separately ("path is presentation, id is identity").
 */
export function nodeFilename(id: string): string {
  return `${id}.md`;
}

/**
 * Resolves the on-disk path for a leaf. `relDir` is the topical folder under
 * `nodes/` (POSIX-style, may be empty for the `nodes/` root).
 */
export function nodeFilePath(nodesDir: string, id: string, relDir = ''): string {
  const dir = relDir ? join(nodesDir, ...relDir.split(posix.sep)) : nodesDir;
  return join(dir, nodeFilename(id));
}

/**
 * True if a leaf with `id` exists anywhere in the topical tree.
 */
export function nodeFileExists(nodesDir: string, id: string): boolean {
  return findNodeById(nodesDir, id) !== null;
}

export function ensureUniqueId(existingIds: Set<string>, candidate: string): string {
  if (!existingIds.has(candidate)) return candidate;
  for (let i = 2; i <= 4; i += 1) {
    const next = `${candidate}-${i}`;
    if (!existingIds.has(next)) return next;
  }
  throw new Error(`id "${candidate}" collides with 4 existing ids; choose a more distinct title`);
}

export interface WriteNodeArgs {
  nodesDir: string;
  frontmatter: NodeFrontmatter;
  body: string;
  /**
   * Topical home folder under `nodes/` (POSIX-style, may be empty for the
   * `nodes/` root). Curation picks the best-fitting existing folder and threads
   * it here. An empty or
   * omitted value is the deliberate root fallback. A value that escapes `nodes/`
   * is rejected by `resolveLeafDir` before any disk write.
   */
  relDir?: string;
}

/**
 * Resolves and validates a target leaf directory under `nodesDir`. The home
 * folder is presentation: it may name any existing topical folder, but it must
 * stay within `nodes/`. A folder that escapes `nodes/` (absolute path or `..`
 * traversal) is rejected so a caller-supplied placement can never write outside
 * the knowledge base. Returns the absolute directory; the empty/omitted folder
 * resolves to the `nodes/` root (the deliberate root fallback, not an error).
 */
export function resolveLeafDir(nodesDir: string, relDir = ''): string {
  if (!relDir) return nodesDir;
  // Reject an absolute placement up front: an absolute relDir (POSIX `/foo` or
  // a platform-absolute path) is never a folder under `nodes/`. Joining it
  // would silently neutralize the leading separator into a subfolder, so guard
  // before `join` rather than relying on the post-join `relative` check.
  if (isAbsolute(relDir) || relDir.startsWith('/')) {
    throw new Error(
      `home folder "${relDir}" escapes nodes/; placement must target a folder under nodes/`
    );
  }
  const resolved = join(nodesDir, ...relDir.split(posix.sep));
  const rel = relative(nodesDir, resolved);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(
      `home folder "${relDir}" escapes nodes/; placement must target a folder under nodes/`
    );
  }
  return resolved;
}

/**
 * Atomically writes a leaf to `nodes/<relDir>/<id>.md` (or `nodes/<id>.md` when
 * `relDir` is empty). Validates frontmatter, writes to a tmp sibling, then
 * renames into place. Returns the absolute path. The directory is topical and
 * independent of `kind`. A `relDir` that escapes `nodes/` is rejected before any
 * disk write.
 */
export function writeNodeFile(args: WriteNodeArgs): string {
  const validated = NodeFrontmatterSchema.parse(args.frontmatter);
  const targetDir = resolveLeafDir(args.nodesDir, args.relDir ?? '');
  const filePath = join(targetDir, nodeFilename(validated.id));
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  const out = matter.stringify(args.body.trimEnd() + '\n', validated);
  writeFileSync(tmp, out);
  renameSync(tmp, filePath);
  return filePath;
}
