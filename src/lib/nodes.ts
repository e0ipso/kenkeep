import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { NodeFrontmatterSchema, type NodeFrontmatter, type NodeKind } from './schemas.js';

export interface NodeFile {
  path: string;
  filename: string;
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

const KINDS: NodeKind[] = ['practice', 'map'];

/**
 * Loads every `nodes/<kind>/*.md` file. Aggregates parse and schema failures
 * across the entire tree and throws a single `InvalidNodeFrontmatterError`
 * listing all offending files if any are found. Callers that wrap this in a
 * `try/catch` get one actionable report; everywhere else, the failure aborts
 * loudly instead of silently dropping nodes.
 */
export function readAllNodes(nodesDir: string): NodeFile[] {
  const out: NodeFile[] = [];
  const failures: NodeLoadFailure[] = [];
  for (const kind of KINDS) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const filePath = join(dir, name);
      const raw = readFileSync(filePath, 'utf8');
      let parsed: ReturnType<typeof matter>;
      try {
        parsed = matter(raw);
      } catch (err) {
        failures.push({
          file: filePath,
          reason: `YAML frontmatter parse error: ${(err as Error).message}`,
          issues: [],
        });
        continue;
      }
      const result = NodeFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        failures.push({
          file: filePath,
          reason: 'frontmatter does not match NodeFrontmatterSchema',
          issues: result.error.issues,
        });
        continue;
      }
      out.push({
        path: filePath,
        filename: name,
        frontmatter: result.data,
        body: parsed.content,
      });
    }
  }
  if (failures.length > 0) {
    throw new InvalidNodeFrontmatterError(failures);
  }
  return out;
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
 * Deterministic content hash over the nodes/ directory per IMPLEMENTATION.md §8.1.
 *
 *   1. Walk all `.md` files under nodes/ recursively.
 *   2. For each file, sha256(file contents).
 *   3. Build "<relative-path-from-nodes-dir>\t<sha256-hex>" strings.
 *   4. Sort lexicographically.
 *   5. Join with newlines.
 *   6. sha256(joined), hex-encoded.
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
    const rel = relative(rootDir, fullPath).split(sep).join(posix.sep);
    const sha = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
    out.push(`${rel}\t${sha}`);
  }
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

export function deriveNodeId(kind: NodeKind, title: string): string {
  return `${kind}-${slugify(title)}`;
}

export function nodeFilename(kind: NodeKind, slugOrId: string): string {
  const slug = slugOrId.startsWith(`${kind}-`) ? slugOrId : `${kind}-${slugify(slugOrId)}`;
  return `${slug}.md`;
}

export function nodeFilePath(nodesDir: string, kind: NodeKind, idOrSlug: string): string {
  return join(nodesDir, kind, nodeFilename(kind, idOrSlug));
}

export function nodeFileExists(nodesDir: string, kind: NodeKind, idOrSlug: string): boolean {
  return existsSync(nodeFilePath(nodesDir, kind, idOrSlug));
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
}

/**
 * Atomically writes `nodes/<kind>/<id>.md`. Validates frontmatter, writes
 * to a tmp sibling, then renames into place. Returns the absolute path.
 */
export function writeNodeFile(args: WriteNodeArgs): string {
  const validated = NodeFrontmatterSchema.parse(args.frontmatter);
  const targetDir = join(args.nodesDir, validated.kind);
  mkdirSync(targetDir, { recursive: true });
  const filePath = join(targetDir, nodeFilename(validated.kind, validated.id));
  const tmp = `${filePath}.tmp`;
  const out = matter.stringify(args.body.trimEnd() + '\n', validated);
  writeFileSync(tmp, out);
  renameSync(tmp, filePath);
  return filePath;
}
