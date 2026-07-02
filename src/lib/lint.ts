import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { checkAgentsKkBlock } from './agents-block.js';
import { INDEX_FILENAME, readAllNodes, validateNodeNaming, type NodeFile } from './nodes.js';
import { readRedirectsLedger, resolveRedirect } from './redirects.js';

export type LintRule =
  | 'dangling-edge'
  | 'redirected-edge'
  | 'slug-id-mismatch'
  | 'tag-near-duplicate'
  | 'orphan'
  | 'missing-folder-index'
  | 'okf-conformance'
  | 'agents-kb-block';

const LEGACY_COMPATIBILITY_DIRS = new Set(['map', 'practice']);

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

  // Every folder under nodes/ must carry a generated index.md (the table of
  // contents for that folder). Directory placement is topical and independent
  // of kind. Stale legacy kind buckets that contain only dotfiles, such as a
  // retained .gitkeep, are not node folders and do not need an index.
  for (const dir of foldersUnder(opts.nodesDir)) {
    if (isEmptyLegacyCompatibilityFolder(opts.nodesDir, dir)) continue;
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

function isEmptyLegacyCompatibilityFolder(nodesDir: string, dir: string): boolean {
  const rel = relative(nodesDir, dir).split(sep).join(posix.sep);
  if (!LEGACY_COMPATIBILITY_DIRS.has(rel)) return false;
  const entries = readdirSync(dir, { withFileTypes: true });
  return (
    entries.length > 0 &&
    entries.every(entry => entry.name.startsWith('.')) &&
    entries.every(entry => !entry.name.endsWith('.md'))
  );
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
