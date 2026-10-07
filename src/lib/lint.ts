import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { checkAgentsKkBlock } from './agents-block.js';
import { folderSummariesFileForNodesDir, FolderSummaryRegistrySchema } from './folder-summaries.js';
import { computeOwnedFolderDirs, findStaleFolderIndexes } from './index-gen.js';
import { INDEX_FILENAME, readAllNodes, validateNodeNaming, type NodeFile } from './nodes.js';
import { readRedirectsLedger, resolveRedirect } from './redirects.js';
import { findRenderedLinkDrift } from './rendered-links.js';

export type LintRule =
  | 'dangling-edge'
  | 'redirected-edge'
  | 'slug-id-mismatch'
  | 'tag-near-duplicate'
  | 'tag-whitespace'
  | 'empty-summary'
  | 'orphan'
  | 'missing-folder-index'
  | 'stale-folder-index'
  | 'okf-conformance'
  | 'stale-rendered-link'
  | 'agents-kb-block';

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
  /**
   * Repo root, enabling the `agents-kb-block` drift check (AGENTS.md carries
   * the kenkeep pointer block and its target exists). Omitted by callers
   * that lint a bare nodes tree with no surrounding repo.
   */
  root?: string;
  /** `.ai/kenkeep` dir, required alongside `root` for the block check. */
  kkDir?: string;
}

export function runLint(opts: LintOptions): LintResult {
  const errors: LintEntry[] = [];
  const findings: LintEntry[] = [];
  errors.push(...checkOkfConformance(opts.nodesDir));
  if (errors.length > 0) return { errors: errors.sort(compareEntries), findings };

  const nodes = readAllNodes(opts.nodesDir);

  const idSet = new Set<string>(nodes.map(n => n.frontmatter.kk_id));

  const incomingRefs = new Map<string, Set<string>>();
  for (const node of nodes) {
    for (const ref of edgeRefs(node)) {
      let set = incomingRefs.get(ref);
      if (!set) {
        set = new Set<string>();
        incomingRefs.set(ref, set);
      }
      set.add(node.frontmatter.kk_id);
    }
  }

  // A cross edge (relates_to or depends_on) to a retired id is not a hard
  // dangling error when the redirects ledger still resolves it to live ids; it
  // is a fixable finding (repoint the edge). Only an edge that resolves nowhere
  // is a dangling-edge error.
  const ledger = readRedirectsLedger(opts.nodesDir);
  for (const node of nodes) {
    for (const ref of edgeRefs(node)) {
      if (idSet.has(ref)) continue;
      const live = resolveRedirect(ledger, idSet, ref);
      if (live.length > 0) {
        findings.push({
          rule: 'redirected-edge',
          file: node.path,
          message: `edge to retired node ${ref}; superseded by ${live.join(', ')}`,
          action: `Repoint the edge to ${live.join(', ')}; ${ref} was split or retired and only the redirect ledger still resolves it.`,
        });
      } else {
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

  // Owned folder indexes: exactly the bundle root plus every folder with a
  // leaf beneath it carries a generated index.md, the same owned set `index
  // rebuild` renders and reconciles. A missing one is an error; an index.md
  // anywhere else is a stale owned artifact (a branch whose last leaf left, a
  // hand-written or imported navigation file) that the rebuild would remove.
  // Directory placement is topical and independent of kind; a leafless folder
  // holding only dotfiles (a retained .gitkeep) owns nothing and needs no index.
  errors.push(...checkOwnedFolderIndexes(opts.nodesDir, nodes));

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
      entry.nodeIds.add(node.frontmatter.kk_id);
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
    for (const tag of node.frontmatter.tags) {
      const normalized = normalizeTagWhitespace(tag);
      if (tag !== normalized) {
        findings.push({
          rule: 'tag-whitespace',
          file: node.path,
          message: `tag "${tag}" has stray whitespace`,
          action: `Use "${normalized}" instead.`,
        });
      }
    }
  }

  findings.push(...checkEmptyFolderSummaries(opts.nodesDir));

  // Rendered Related/Citations links are a leaf-relative navigation view of
  // the id graph. A carried section that a fresh render would change (a moved
  // target or leaf, a retired target the ledger now resolves elsewhere, a hand
  // edit) is reported, never silently rewritten: index rebuild does not touch
  // leaves, so the fix is an explicit refresh.
  for (const drift of findRenderedLinkDrift(nodes, ledger)) {
    findings.push({
      rule: 'stale-rendered-link',
      file: drift.node.path,
      message: drift.message,
      action:
        'Run `npx kenkeep node refresh-links` to re-render the generated Related/Citations sections from the current tree.',
    });
  }

  for (const node of nodes) {
    const outgoing = edgeRefs(node).length;
    const incoming = incomingRefs.get(node.frontmatter.kk_id);
    const incomingFromOthers = incoming
      ? [...incoming].filter(src => src !== node.frontmatter.kk_id).length
      : 0;
    if (outgoing === 0 && incomingFromOthers === 0) {
      findings.push({
        rule: 'orphan',
        file: node.path,
        message: `orphan node ${node.frontmatter.kk_id}`,
        action:
          'Add cross-links to neighboring nodes, or accept that this node legitimately stands alone.',
      });
    }
  }

  errors.sort(compareEntries);
  // Agents-file lobby drift (warn-only): the AGENTS.md pointer block is how
  // agents-file surfaces discover the knowledge base; a populated tree whose
  // lobby is missing degrades discoverability silently.
  if (opts.root && opts.kkDir) {
    for (const issue of checkAgentsKkBlock(opts.root, opts.kkDir, nodes.length)) {
      findings.push({
        rule: 'agents-kb-block',
        file: issue.file,
        message: issue.message,
        action: issue.action,
      });
    }
  }

  findings.sort(compareEntries);

  return { errors, findings };
}

function checkOkfConformance(nodesDir: string): LintEntry[] {
  const errors: LintEntry[] = [];
  if (!existsSync(nodesDir)) return errors;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name === INDEX_FILENAME) {
        errors.push(...checkIndexConformance(nodesDir, full));
      } else if (entry.name === 'log.md') {
        continue;
      } else {
        errors.push(...checkLeafConformance(full));
      }
    }
  };
  walk(nodesDir);
  return errors;
}

function checkIndexConformance(nodesDir: string, file: string): LintEntry[] {
  const parsed = matter(readFileSync(file, 'utf8'));
  const rel = relative(nodesDir, file).split(sep).join(posix.sep);
  const keys = Object.keys(parsed.data).sort();
  if (rel === INDEX_FILENAME) {
    if (keys.length === 1 && keys[0] === 'okf_version' && parsed.data.okf_version === '0.1') {
      return [];
    }
    return [
      {
        rule: 'okf-conformance',
        file,
        message: 'bundle-root nodes/index.md frontmatter must be exactly okf_version: "0.1"',
        action: 'Run `npx kenkeep index rebuild` to regenerate OKF reserved index files.',
      },
    ];
  }
  if (keys.length === 0) return [];
  return [
    {
      rule: 'okf-conformance',
      file,
      message: 'reserved index.md files below the bundle root must not have frontmatter',
      action: 'Run `npx kenkeep index rebuild` to regenerate OKF reserved index files.',
    },
  ];
}

function checkLeafConformance(file: string): LintEntry[] {
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(readFileSync(file, 'utf8'));
  } catch (err) {
    return [
      {
        rule: 'okf-conformance',
        file,
        message: `frontmatter is not parseable YAML: ${(err as Error).message}`,
        action: 'Fix the YAML frontmatter block so the file is a valid OKF concept document.',
      },
    ];
  }
  const type = parsed.data.type;
  if (typeof type === 'string' && type.trim() !== '') return [];
  return [
    {
      rule: 'okf-conformance',
      file,
      message: 'OKF concept document is missing a non-empty type field',
      action: 'Add a non-empty `type` frontmatter field or run the schema migration.',
    },
  ];
}

/**
 * Every outgoing cross edge of a leaf, by id: `relates_to` (loose) followed by
 * `depends_on` (dependency). Both are id-resolved overlay edges, so lint treats
 * them identically for dangling/redirect detection and orphan counting.
 */
function edgeRefs(node: NodeFile): string[] {
  return [...node.frontmatter.kk_relates_to, ...node.frontmatter.kk_depends_on];
}

/**
 * Asserts filename/id agreement and that the leaf carries a stable, canonical
 * id (`<kind>-<slug>`). The kind prefix is part of the id (identity); directory
 * placement is topical and unconstrained by kind.
 */
function checkSlugId(node: NodeFile): string | null {
  return validateNodeNaming(node);
}

/**
 * The owned-index invariant, both directions: every owned folder (root plus
 * every folder with a leaf beneath it) carries an `index.md`, and no other
 * folder does. Returns absolute file paths for both rule kinds.
 */
function checkOwnedFolderIndexes(nodesDir: string, nodes: NodeFile[]): LintEntry[] {
  if (!existsSync(nodesDir)) return [];
  const errors: LintEntry[] = [];
  const ownedDirs = computeOwnedFolderDirs(nodes);
  for (const rel of [...ownedDirs].sort()) {
    const dir = rel === '' ? nodesDir : join(nodesDir, ...rel.split('/'));
    if (existsSync(join(dir, INDEX_FILENAME))) continue;
    errors.push({
      rule: 'missing-folder-index',
      file: dir,
      message: `folder ${rel || '.'} has no index.md`,
      action: 'Run `npx kenkeep index rebuild` to regenerate the per-folder index nodes.',
    });
  }
  for (const file of findStaleFolderIndexes(nodesDir, ownedDirs)) {
    const rel = posix.dirname(relative(nodesDir, file).split(sep).join(posix.sep));
    errors.push({
      rule: 'stale-folder-index',
      file,
      message: `folder ${rel} holds no leaves but still carries an index.md`,
      action:
        'Run `npx kenkeep index rebuild` to remove stale owned index files (or move leaves back into the folder).',
    });
  }
  return errors;
}

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/s$/, '');
}

function normalizeTagWhitespace(tag: string): string {
  return tag.replace(/\s+/g, ' ').trim();
}

function checkEmptyFolderSummaries(nodesDir: string): LintEntry[] {
  const file = folderSummariesFileForNodesDir(nodesDir);
  if (!existsSync(file)) return [];
  try {
    const parsed = matter(readFileSync(file, 'utf8'));
    const registry = FolderSummaryRegistrySchema.safeParse(parsed.data);
    if (!registry.success) return [];
    const out: LintEntry[] = [];
    for (const [path, summary] of Object.entries(registry.data.summaries)) {
      if (typeof summary !== 'string' || summary.trim() !== '') continue;
      const label = path === '' ? '.' : path;
      out.push({
        rule: 'empty-summary',
        file,
        message: `folder "${label}" has an empty summary`,
        action:
          'Author a non-empty one-line folder summary in FOLDER_SUMMARIES.md, or run rebalance/migrate clustering to generate one.',
      });
    }
    return out;
  } catch {
    return [];
  }
}

function compareEntries(a: LintEntry, b: LintEntry): number {
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
}
