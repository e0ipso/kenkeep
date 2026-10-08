import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { setFolderSummary } from './folder-summaries.js';
import { atomicWriteFile } from './fs-atomic.js';
import { MIGRATE_COMMAND_HINT } from './migrate-guidance.js';
import { linkTargetResolver, renderGeneratedNodeSections } from './node-sections.js';
import { assertContained, resolveContainedDir, validateNodeId } from './path-safety.js';
import { ledgerIds, readRedirectsLedger } from './redirects.js';
import {
  NODE_SCHEMA_VERSION,
  NodeFrontmatterSchema,
  type NodeFrontmatter,
  type NodeKind,
} from './schemas.js';

/** Filename of a generated per-folder index node. Never a leaf. */
export const INDEX_FILENAME = 'index.md';
const RESERVED_NODE_FILENAMES = new Set([INDEX_FILENAME, 'log.md']);

/**
 * Rough chars-per-token divisor shared by every token estimator (index-gen
 * stats, rebalance split decisions). One constant so the estimate that
 * triggers a folder split can never silently diverge from the estimate the
 * index reports.
 */
export const CHARS_PER_TOKEN = 4;

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
 * Thrown when a leaf declares an older node schema (the v1 flat
 * `nodes/<kind>/` storage carried `schema_version: 1`, the v2 tree
 * `schema_version: 2`). The reader rejects the old shape outright rather than
 * misparsing it; the message points the user at the `kk-migrate` skill, which
 * clusters in-session and preserves every node's id and edges (re-init would
 * not migrate, and deleting the tree would discard curated knowledge).
 *
 * Legacy status is decided by that schema evidence only. A topical folder
 * named after a kind (`nodes/map/`, `nodes/practice/`) is a legitimate v3
 * folder (`kind` is a facet, not a location), including in the window before
 * its generated `index.md` exists.
 */
export class OldLayoutError extends Error {
  constructor(detail: string) {
    super(
      `${detail} This knowledge base is not readable by kenkeep's current node schema ` +
        `(schema_version ${NODE_SCHEMA_VERSION}). Migrate the knowledge base with ` +
        `${MIGRATE_COMMAND_HINT}, then review the result with \`git diff\`.`
    );
    this.name = 'OldLayoutError';
  }
}

/**
 * Thrown by a tree walk given a `deadlineAt` once that instant has passed.
 * Hooks run synchronously under a timer that cannot interrupt them, so the
 * walk checks the clock itself and the hook fails open.
 */
export class BudgetExceededError extends Error {
  constructor(unit: string) {
    super(`cooperative budget exceeded before ${unit}`);
    this.name = 'BudgetExceededError';
  }
}

/** Throws {@link BudgetExceededError} when `deadlineAt` (epoch ms) has passed. */
export function assertWithinBudget(deadlineAt: number | undefined, unit: string): void {
  if (deadlineAt !== undefined && Date.now() > deadlineAt) throw new BudgetExceededError(unit);
}

/**
 * Optional deadline for the tree walks below. The clock is checked before
 * each directory listing and each leaf read, so a walk overruns by at most
 * one leaf.
 */
export interface WalkBudget {
  deadlineAt?: number | undefined;
}

/**
 * Recursively loads every leaf node `.md` file from the nested topical folder
 * tree under `nodesDir`, at any depth. Generated per-folder `index.md` files
 * are never treated as leaves. Directory entries are visited in deterministic
 * (lexicographic) order so downstream generation is byte-stable.
 *
 * `kind` is a frontmatter facet only and does not constrain directory placement
 * (placement is topical). A leaf declaring a legacy `schema_version` aborts the
 * whole read with `OldLayoutError` before its frontmatter is validated, so an
 * old KB fails loudly with migrate guidance instead of being misread.
 *
 * Aggregates parse and schema failures across the whole tree and throws a
 * single `InvalidNodeFrontmatterError` listing every offending file. Callers
 * that wrap this in a `try/catch` get one actionable report; everywhere else,
 * the failure aborts loudly instead of silently dropping nodes.
 */
export function readAllNodes(nodesDir: string, budget: WalkBudget = {}): NodeFile[] {
  const out: NodeFile[] = [];
  const failures: NodeLoadFailure[] = [];
  if (existsSync(nodesDir)) {
    collectLeafNodes(nodesDir, nodesDir, out, failures, budget.deadlineAt);
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
  failures: NodeLoadFailure[],
  deadlineAt: number | undefined
): void {
  assertWithinBudget(deadlineAt, 'directory listing');
  const names = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const entry of names) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectLeafNodes(rootDir, fullPath, out, failures, deadlineAt);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    if (RESERVED_NODE_FILENAMES.has(entry.name)) continue;
    assertWithinBudget(deadlineAt, 'leaf read');
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
    const legacySchemaVersion = (parsed.data as Record<string, unknown>).schema_version;
    if (typeof legacySchemaVersion === 'number' && legacySchemaVersion < NODE_SCHEMA_VERSION) {
      throw new OldLayoutError(
        `Detected node ${fullPath} with legacy schema_version ${legacySchemaVersion}.`
      );
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
    if (node.frontmatter.kk_id === id) return node;
  }
  return null;
}

/**
 * Deterministic content hash over the leaf nodes under `nodesDir`.
 *
 *   1. Walk all leaf `.md` files under nodes/ recursively, EXCLUDING every
 *      generated `index.md` at any depth (and the root ENTRY.md/GRAPH.md, which
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
export function computeNodesHash(nodesDir: string, budget: WalkBudget = {}): string {
  const entries: string[] = [];
  if (existsSync(nodesDir)) {
    walkMarkdown(nodesDir, nodesDir, entries, budget.deadlineAt);
  }
  entries.sort();
  return createHash('sha256').update(entries.join('\n'), 'utf8').digest('hex');
}

function walkMarkdown(
  rootDir: string,
  currentDir: string,
  out: string[],
  deadlineAt: number | undefined
): void {
  assertWithinBudget(deadlineAt, 'directory listing');
  for (const name of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, name.name);
    if (name.isDirectory()) {
      walkMarkdown(rootDir, fullPath, out, deadlineAt);
      continue;
    }
    if (!name.name.endsWith('.md')) continue;
    // OKF reserved files are not leaf nodes and do not contribute to the leaf hash.
    if (RESERVED_NODE_FILENAMES.has(name.name)) continue;
    assertWithinBudget(deadlineAt, 'leaf read');
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
 * Checks the canonical leaf identity contract shared by lint and pack
 * validation: `id` is `<kind>-<slug>` and the file is named `<id>.md`.
 */
export function validateNodeNaming(
  node: Pick<NodeFile, 'filename' | 'frontmatter'>
): string | null {
  const { kk_id: id, type } = node.frontmatter;
  const idProblem = validateNodeId(id, type);
  if (idProblem !== null) return idProblem;
  const expectedFilename = nodeFilename(id);
  if (node.filename !== expectedFilename) {
    return `filename ${node.filename} does not match expected ${expectedFilename}`;
  }
  return null;
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

/**
 * The ids a new leaf may not take: every live id plus every id the redirect
 * ledger records (`ledgerIds`). Seed `ensureUniqueId` from this rather than
 * from the live set alone; re-minting a retired id rebinds every edge that
 * reached its successors to the new leaf.
 */
export function reservedNodeIds(
  nodesDir: string,
  nodes: readonly NodeFile[] = readAllNodes(nodesDir)
): Set<string> {
  const reserved = ledgerIds(readRedirectsLedger(nodesDir));
  for (const node of nodes) reserved.add(node.frontmatter.kk_id);
  return reserved;
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
  /**
   * Pre-minted `id -> relPath` entries for leaves that do not exist on disk
   * yet (e.g. the siblings a split-leaf is about to write). They overlay the
   * on-disk tree when rendering Related links, so a link to a not-yet-written
   * sibling resolves to its real path instead of the root fallback.
   */
  pendingPaths?: ReadonlyMap<string, string>;
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
  // One shared resolver (path-safety): normalizes the key, rejects absolute
  // and `..` escapes, and refuses any symlinked segment on the real filesystem.
  return resolveContainedDir(nodesDir, relDir);
}

/**
 * Atomically writes a leaf to `nodes/<relDir>/<id>.md` (or `nodes/<id>.md` when
 * `relDir` is empty). Validates frontmatter, writes to a tmp sibling, then
 * renames into place. Returns the absolute path. The directory is topical and
 * independent of `kind`. A `relDir` that escapes `nodes/` is rejected before any
 * disk write.
 */
export function writeNodeFile(args: WriteNodeArgs): string {
  // The schema refinement guarantees a canonical `<kind>-<slug>` id, so the
  // filename below is a single safe segment; the directory and the final file
  // path are both containment-checked (no `..`, no symlinked segment) before
  // any disk write.
  const validated = NodeFrontmatterSchema.parse(args.frontmatter);
  const targetDir = resolveLeafDir(args.nodesDir, args.relDir ?? '');
  const filePath = assertContained(args.nodesDir, join(targetDir, nodeFilename(validated.kk_id)));
  const relPath = toPosixRel(args.nodesDir, filePath);
  const pathsById = new Map(readAllNodes(args.nodesDir).map(n => [n.frontmatter.kk_id, n.relPath]));
  for (const [id, pending] of args.pendingPaths ?? []) pathsById.set(id, pending);
  pathsById.set(validated.kk_id, relPath);
  // An edge to a retired id lands on its ledger successor(s), the same
  // resolution lint and retrieval apply, so the link never names a vacated path.
  const body = renderGeneratedNodeSections(args.body, validated, {
    leafRelPath: relPath,
    resolveTargets: linkTargetResolver(pathsById, readRedirectsLedger(args.nodesDir)),
  });
  const out = matter.stringify(body.trimEnd() + '\n', validated);
  atomicWriteFile(filePath, out);
  return filePath;
}

/**
 * Stamp an authored one-line `summary` into a folder's `index.md` frontmatter so
 * the next deterministic rebuild self-preserves it (the index harvest in
 * `generateIndex`). This is the write half of the two sanctioned authoring
 * moments — the v1->v2 migrate clustering and the rebalance clustering — where
 * an LLM invents the summary and deterministic code only persists it. The body
 * is a disposable placeholder: the rebuild regenerates it and carries the
 * frontmatter `summary` forward.
 *
 * A blank summary is a no-op (nothing to author). When an `index.md` already
 * exists, only its `summary` is updated; `nodes_hash`/`node_count` are left as
 * placeholders (`sha256:pending` / `0`) for the rebuild to overwrite. `dirRel`
 * is a POSIX-style folder under `nodesDir` and must stay within it.
 *
 * CALLER CONTRACT — load-bearing: every call MUST be followed by a
 * `runIndexRebuild()` (or equivalent `generateIndex` write) before any consumer
 * reads this folder's `index.md` for staleness. The placeholder
 * `nodes_hash: sha256:pending` is a poison value, not a real hash; until the
 * rebuild overwrites it, `nodesHashChanged`/`doctor` would read it as the
 * recorded hash. Both current callers honor this: the `place apply` migration
 * primitive expects the skill to rebuild once afterwards (`index rebuild`), and
 * the rebalance command wrapper rebuilds after `applyRebalancePlan`. This
 * primitive deliberately does NOT rebuild itself — it
 * is a single-folder write invoked in a loop, so rebuilding here would
 * regenerate the whole tree once per stamped folder, and `lib/` must not depend
 * on the `commands/` rebuild entry point.
 */
export function stampFolderSummary(nodesDir: string, dirRel: string, summary: string): void {
  const trimmed = summary.trim();
  if (trimmed === '') return;
  resolveLeafDir(nodesDir, dirRel);
  setFolderSummary(nodesDir, dirRel, trimmed);
}
