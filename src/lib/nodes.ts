import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import {
  NodeFrontmatterSchema,
  ProposalFrontmatterSchema,
  type NodeFrontmatter,
  type NodeKind,
  type ProposalFrontmatter,
} from './schemas.js';

export interface NodeFile {
  path: string;
  filename: string;
  frontmatter: NodeFrontmatter;
  body: string;
}

const KINDS: NodeKind[] = ['practice', 'map'];

export function readAllNodes(nodesDir: string): NodeFile[] {
  const out: NodeFile[] = [];
  for (const kind of KINDS) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const filePath = join(dir, name);
      const raw = readFileSync(filePath, 'utf8');
      const parsed = matter(raw);
      const result = NodeFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) continue;
      out.push({
        path: filePath,
        filename: name,
        frontmatter: result.data,
        body: parsed.content,
      });
    }
  }
  return out;
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

export function proposalFilename(kind: NodeKind, slugOrId: string): string {
  const slug = slugOrId.startsWith(`${kind}-`) ? slugOrId : `${kind}-${slugify(slugOrId)}`;
  return `${slug}.md`;
}

export function ensureUniqueId(existingIds: Set<string>, candidate: string): string {
  if (!existingIds.has(candidate)) return candidate;
  for (let i = 2; i < 100; i += 1) {
    const next = `${candidate}-${i}`;
    if (!existingIds.has(next)) return next;
  }
  // Fall back to a short hash discriminator.
  const disc = createHash('sha256').update(`${candidate}-${Date.now()}`).digest('hex').slice(0, 6);
  return `${candidate}-${disc}`;
}

export interface WriteProposalArgs {
  proposedDir: string;
  proposalKind: 'additions' | 'modifications' | 'contradictions';
  filename: string;
  frontmatter: ProposalFrontmatter;
  body: string;
}

export function writeProposalFile(args: WriteProposalArgs): string {
  const validated = ProposalFrontmatterSchema.parse(args.frontmatter);
  const targetDir = join(args.proposedDir, args.proposalKind);
  mkdirSync(targetDir, { recursive: true });
  const filePath = join(targetDir, args.filename);
  const out = matter.stringify(args.body.trimEnd() + '\n', validated);
  writeFileSync(filePath, out);
  return filePath;
}

export function listProposalFiles(proposedDir: string): {
  additions: string[];
  modifications: string[];
  contradictions: string[];
} {
  return {
    additions: listMd(join(proposedDir, 'additions')),
    modifications: listMd(join(proposedDir, 'modifications')),
    contradictions: listMd(join(proposedDir, 'contradictions')),
  };
}

function listMd(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => join(dir, n))
    .sort();
}

export function readProposalFile(file: string): {
  frontmatter: ProposalFrontmatter;
  body: string;
} | null {
  if (!existsSync(file)) return null;
  const parsed = matter(readFileSync(file, 'utf8'));
  const result = ProposalFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) return null;
  return { frontmatter: result.data, body: parsed.content };
}
