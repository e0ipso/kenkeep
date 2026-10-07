import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { atomicWriteFile } from './fs-atomic.js';
import {
  detectSectionDrift,
  findMalformedSections,
  linkTargetResolver,
  renderGeneratedNodeSections,
  type RenderLinkContext,
} from './node-sections.js';
import { readAllNodes, type NodeFile } from './nodes.js';
import { assertContained } from './path-safety.js';
import { readRedirectsLedger, resolveRedirect, type RedirectsLedger } from './redirects.js';

/** One leaf whose carried Related/Citations links no longer match the tree. */
export interface RenderedLinkDrift {
  node: NodeFile;
  message: string;
}

function contextFor(
  node: NodeFile,
  pathsById: ReadonlyMap<string, string>,
  ledger: RedirectsLedger
): RenderLinkContext {
  return { leafRelPath: node.relPath, resolveTargets: linkTargetResolver(pathsById, ledger) };
}

function pathIndex(nodes: readonly NodeFile[]): Map<string, string> {
  return new Map(nodes.map(n => [n.frontmatter.kk_id, n.relPath]));
}

/**
 * Every leaf carrying a generated Related/Citations section that a fresh
 * render from `nodes` (resolving retired ids through `ledger`) would change:
 * a link to a moved/grafted/retired target, a leaf that itself moved (its
 * leaf-relative hrefs changed depth), a hand edit. A dangling edge renders
 * the same fallback every time, so it is not drift; lint reports it as
 * `dangling-edge`. Pure over the snapshot; nothing is read or written.
 */
export function findRenderedLinkDrift(
  nodes: readonly NodeFile[],
  ledger: RedirectsLedger = {}
): RenderedLinkDrift[] {
  const pathsById = pathIndex(nodes);
  const out: RenderedLinkDrift[] = [];
  for (const node of nodes) {
    const problems = detectSectionDrift(
      node.body,
      node.frontmatter,
      contextFor(node, pathsById, ledger)
    ).map(d => `rendered ${d.section} section is stale: ${d.detail}`);
    if (problems.length === 0) continue;
    out.push({ node, message: problems.join('; ') });
  }
  return out;
}

/**
 * Re-render the owned Related/Citations sections of drifted leaves at an
 * explicit write/move/graft boundary. Index rebuild never calls this: it does
 * not rewrite leaves.
 *
 * `scope` limits the refresh to the leaves a boundary affected: a leaf is in
 * scope when its own id is in the set (it moved or was grafted) or it has an
 * edge to an id in the set (its target moved, appeared or retired), where an
 * edge naming a retired id counts for every live successor the ledger
 * resolves it to (the leaf links to the successor's path, so moving or
 * splitting the successor stales it too). Omit `scope` to refresh every
 * drifted leaf. Retired ids resolve through the ledger on disk, so callers
 * that retire an id must write the ledger first.
 * Only the body after the frontmatter is replaced, so frontmatter bytes are
 * preserved verbatim, and a leaf whose fresh render matches its bytes (a
 * current section, or a dangling edge at its fallback) is not touched
 * (idempotent).
 *
 * A planned write through a symlinked leaf or folder is refused (throws)
 * before any leaf is written, the same boundary `writeNodeFile` applies.
 *
 * A section with malformed markers is never rewritten (see
 * `findMalformedSections`); lint keeps reporting it. With `refuseMalformed`,
 * an in-scope leaf carrying one refuses the whole refresh (throws) before any
 * leaf is written, so the explicit repair never reports success over it.
 *
 * Returns the rewritten paths in tree order. Callers must rebuild the
 * generated catalogs afterwards: a refreshed leaf's hash changed.
 */
export function refreshRenderedLinks(
  nodesDir: string,
  scope?: ReadonlySet<string>,
  opts: { refuseMalformed?: boolean } = {}
): string[] {
  const nodes = readAllNodes(nodesDir);
  const pathsById = pathIndex(nodes);
  const ledger = readRedirectsLedger(nodesDir);
  const live = new Set(pathsById.keys());
  const edgeInScope = (id: string): boolean =>
    scope === undefined ||
    scope.has(id) ||
    resolveRedirect(ledger, live, id).some(target => scope.has(target));
  const inScope = (node: NodeFile): boolean =>
    scope === undefined ||
    scope.has(node.frontmatter.kk_id) ||
    [...node.frontmatter.kk_relates_to, ...node.frontmatter.kk_depends_on].some(edgeInScope);
  const planned: Array<{ node: NodeFile; body: string }> = [];
  const malformed: string[] = [];
  for (const { node } of findRenderedLinkDrift(nodes, ledger)) {
    if (!inScope(node)) continue;
    for (const { section, detail } of findMalformedSections(node.body)) {
      malformed.push(`${node.relPath}: ${section} has malformed section markers: ${detail}`);
    }
    const body =
      renderGeneratedNodeSections(
        node.body,
        node.frontmatter,
        contextFor(node, pathsById, ledger)
      ).trimEnd() + '\n';
    if (body === node.body.trimEnd() + '\n') continue;
    planned.push({ node, body });
  }
  if (opts.refuseMalformed === true && malformed.length > 0) {
    throw new Error(
      `refusing to refresh while generated section markers are ambiguous; repair them by hand:\n` +
        malformed.map(line => `  ${line}`).join('\n')
    );
  }
  // The read follows symlinks, but a write must not: check the whole planned
  // set against the shared containment boundary first, so a refused leaf
  // leaves every other leaf untouched too.
  for (const { node } of planned) assertContained(nodesDir, node.path);
  for (const { node, body } of planned) atomicWriteFile(node.path, withBody(node, body));
  return planned.map(({ node }) => node.path);
}

/**
 * The leaf file with its body replaced. The parsed body is the exact tail of
 * the raw file (gray-matter slices it after the closing fence), so the
 * frontmatter prefix is kept byte-for-byte; a file that does not match that
 * shape is reserialized from the parsed frontmatter instead.
 */
function withBody(node: NodeFile, body: string): string {
  const raw = readFileSync(node.path, 'utf8');
  if (raw.endsWith(node.body)) return raw.slice(0, raw.length - node.body.length) + body;
  return matter.stringify(body, node.frontmatter);
}
