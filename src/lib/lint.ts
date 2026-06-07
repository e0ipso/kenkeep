import { existsSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { INDEX_FILENAME, readAllNodes, slugify, type NodeFile } from './nodes.js';

export type LintRule =
  | 'dangling-edge'
  | 'slug-id-mismatch'
  | 'tag-near-duplicate'
  | 'orphan'
  | 'missing-folder-index';

export interface LintEntry {
  rule: LintRule;
  file: string;
  message: string;
  action: string;
}

export interface LintResult {
  errors: LintEntry[];
  findings: LintEntry[];
}

export interface LintOptions {
  nodesDir: string;
}

export function runLint(opts: LintOptions): LintResult {
  const nodes = readAllNodes(opts.nodesDir);
  const errors: LintEntry[] = [];
  const findings: LintEntry[] = [];

  const idSet = new Set<string>(nodes.map(n => n.frontmatter.id));

  const incomingRefs = new Map<string, Set<string>>();
  for (const node of nodes) {
    const refs = node.frontmatter.relates_to;
    for (const ref of refs) {
      let set = incomingRefs.get(ref);
      if (!set) {
        set = new Set<string>();
        incomingRefs.set(ref, set);
      }
      set.add(node.frontmatter.id);
    }
  }

  for (const node of nodes) {
    const refs = node.frontmatter.relates_to;
    for (const ref of refs) {
      if (!idSet.has(ref)) {
        errors.push({
          rule: 'dangling-edge',
          file: node.path,
          message: `references unknown node ${ref}`,
          action: 'Remove the broken reference from the frontmatter or create the missing node.',
        });
      }
    }
  }

  for (const node of nodes) {
    const mismatch = checkSlugId(node);
    if (mismatch) {
      errors.push({
        rule: 'slug-id-mismatch',
        file: node.path,
        message: mismatch,
        action:
          'Fix the id so it is canonical (id == <kind>-<slug>) and rename the file so filename == <id>.md. Directory placement is topical and not constrained by kind.',
      });
    }
  }

  // Every folder under nodes/ must carry a generated index.md (the table of
  // contents for that folder). Directory placement is topical and independent
  // of kind.
  for (const dir of foldersUnder(opts.nodesDir)) {
    if (!existsSync(join(dir, INDEX_FILENAME))) {
      errors.push({
        rule: 'missing-folder-index',
        file: dir,
        message: `folder ${posix.normalize(relative(opts.nodesDir, dir).split(sep).join(posix.sep)) || '.'} has no index.md`,
        action: 'Run `npx kenkeep index rebuild` to regenerate the per-folder index nodes.',
      });
    }
  }

  const clusters = new Map<string, { original: Set<string>; nodeIds: Set<string> }>();
  for (const node of nodes) {
    for (const tag of node.frontmatter.tags) {
      const key = normalizeTag(tag);
      if (!key) continue;
      let entry = clusters.get(key);
      if (!entry) {
        entry = { original: new Set<string>(), nodeIds: new Set<string>() };
        clusters.set(key, entry);
      }
      entry.original.add(tag);
      entry.nodeIds.add(node.frontmatter.id);
    }
  }
  for (const entry of clusters.values()) {
    if (entry.original.size >= 2) {
      const members = [...entry.original].sort().join(', ');
      findings.push({
        rule: 'tag-near-duplicate',
        file: '',
        message: `tag cluster {${members}} affects ${entry.nodeIds.size} node(s)`,
        action: 'Pick a canonical tag and normalize the affected nodes.',
      });
    }
  }

  for (const node of nodes) {
    const outgoing = node.frontmatter.relates_to.length;
    const incoming = incomingRefs.get(node.frontmatter.id);
    const incomingFromOthers = incoming
      ? [...incoming].filter(src => src !== node.frontmatter.id).length
      : 0;
    if (outgoing === 0 && incomingFromOthers === 0) {
      findings.push({
        rule: 'orphan',
        file: node.path,
        message: `orphan node ${node.frontmatter.id}`,
        action:
          'Add cross-links to neighboring nodes, or accept that this node legitimately stands alone.',
      });
    }
  }

  errors.sort(compareEntries);
  findings.sort(compareEntries);

  return { errors, findings };
}

/**
 * Asserts filename/id agreement and that the leaf carries a stable, canonical
 * id (`<kind>-<slug>`). The kind prefix is part of the id (identity); directory
 * placement is topical and unconstrained by kind.
 */
function checkSlugId(node: NodeFile): string | null {
  const { id, kind } = node.frontmatter;
  if (id.trim() === '') {
    return 'leaf has an empty id; every leaf must carry a stable id';
  }
  const prefix = `${kind}-`;
  if (!id.startsWith(prefix)) {
    return `id ${id} does not start with kind prefix ${prefix}`;
  }
  const bare = id.slice(prefix.length);
  const canonicalBare = slugify(bare);
  if (bare !== canonicalBare) {
    return `id ${id} is not canonical; expected ${kind}-${canonicalBare}`;
  }
  const expectedFilename = `${id}.md`;
  if (node.filename !== expectedFilename) {
    return `filename ${node.filename} does not match expected ${expectedFilename}`;
  }
  return null;
}

/**
 * Every directory under `nodesDir`, inclusive of `nodesDir` itself, that is
 * expected to carry an `index.md`. Returns absolute paths.
 */
function foldersUnder(nodesDir: string): string[] {
  if (!existsSync(nodesDir)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    out.push(dir);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
    }
  };
  walk(nodesDir);
  return out;
}

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/s$/, '');
}

function compareEntries(a: LintEntry, b: LintEntry): number {
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
}
