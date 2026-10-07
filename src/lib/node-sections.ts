import { posix } from 'node:path';
import { resolveRedirect, type RedirectsLedger } from './redirects.js';
import type { NodeFrontmatter } from './schemas.js';

export const RELATED_SECTION_START = '<!-- kk:related:start -->';
export const RELATED_SECTION_END = '<!-- kk:related:end -->';
export const CITATIONS_SECTION_START = '<!-- kk:citations:start -->';
export const CITATIONS_SECTION_END = '<!-- kk:citations:end -->';

/**
 * Where the `nodes/` tree sits relative to the repository root. Fixed by the
 * kenkeep layout (`repoPaths().nodesDir`), and the base every rendered
 * citation is resolved against: a leaf at `nodes/<relPath>` lives at
 * `<root>/.ai/kenkeep/nodes/<relPath>`.
 */
export const NODES_DIR_FROM_REPO_ROOT = '.ai/kenkeep/nodes';

/** One leaf a rendered edge lands on: the live id and its `nodes/`-relative path. */
export interface LinkTarget {
  id: string;
  relPath: string;
}

/**
 * Every live leaf an edge id resolves to: the id's own leaf, or, for an id the
 * redirect ledger retired, each live successor. Empty when nothing is live
 * (a dangling edge).
 */
export type LinkTargetResolver = (id: string) => LinkTarget[];

/**
 * The one resolver every renderer uses, so a retired id always follows the
 * same redirect resolution as GRAPH/retrieval and lint. `pathsById` is the
 * live tree (plus any pre-minted paths a caller overlays).
 */
export function linkTargetResolver(
  pathsById: ReadonlyMap<string, string>,
  ledger: RedirectsLedger
): LinkTargetResolver {
  const live = new Set(pathsById.keys());
  return id => {
    const own = pathsById.get(id);
    if (own !== undefined) return [{ id, relPath: own }];
    return resolveRedirect(ledger, live, id).map(successor => ({
      id: successor,
      relPath: pathsById.get(successor) as string,
    }));
  };
}

/**
 * Where the leaf being rendered lives, and how to find every other leaf.
 *
 * The supported link base: every rendered href is RELATIVE TO THE LEAF'S OWN
 * FILE, so it resolves the same way on GitHub, in an editor preview and in any
 * plain markdown reader (`path.resolve(dirname(leaf), href)`).
 *
 * - Related / Depends on: `posix.relative(dirname(leafRelPath), targetRelPath)`
 *   within `nodes/`. An id the redirect ledger retired renders one link per
 *   live successor, labelled `<id> → <successor>`, so the edge the frontmatter
 *   still names lands on the leaf that now holds it. An id with no live leaf
 *   renders the root fallback `nodes/<id>.md`, still leaf-relative (lint
 *   reports the dangling edge).
 * - Citations: a repo-relative `kk_derived_from` path resolves against the
 *   repository root through the leaf's `../` depth
 *   (`NODES_DIR_FROM_REPO_ROOT/<leafRelPath>`). A `scheme://` URL links
 *   verbatim. Anything else (a `<session>:<kind>:<index>` origin, an absolute
 *   path, a path escaping the repo) has no portable target and renders as
 *   plain text.
 *
 * Because hrefs depend on the leaf's location, moving or grafting a leaf (or
 * any leaf it links to) changes its rendered bytes; the move/graft boundaries
 * refresh them (`refreshRenderedLinks`) and lint reports drift. Frontmatter
 * ids stay the authoritative identity; the sections are a navigation view.
 */
export interface RenderLinkContext {
  /** POSIX path of the leaf being rendered, relative to `nodes/`. */
  leafRelPath: string;
  resolveTargets: LinkTargetResolver;
}

function escapeMarkdownLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\`[\]])/g, '\\$1');
}

/** Percent-encode the few characters that would end or break a link destination. */
function encodeHref(href: string): string {
  return href.replace(/[ ()<>]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function relativeHref(fromDir: string, to: string): string {
  return encodeHref(posix.relative(fromDir, to));
}

const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * The leaf-relative href of a citation, or null when the reference has no
 * portable link target (see `RenderLinkContext`).
 */
function citationHref(ref: string, leafRelPath: string): string | null {
  if (URL_PATTERN.test(ref)) return ref;
  if (ref.trim() !== ref || ref === '' || ref.startsWith('/') || ref.includes(':')) return null;
  const hashAt = ref.indexOf('#');
  const pathPart = hashAt === -1 ? ref : ref.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : ref.slice(hashAt);
  const normalized = posix.normalize(pathPart);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  const leafDir = posix.dirname(posix.join(NODES_DIR_FROM_REPO_ROOT, leafRelPath));
  return `${relativeHref(leafDir, normalized)}${fragment}`;
}

export function renderRelatedSection(frontmatter: NodeFrontmatter, ctx: RenderLinkContext): string {
  const leafDir = posix.dirname(ctx.leafRelPath);
  const lines: string[] = [];
  const append = (label: string, id: string): void => {
    const targets = ctx.resolveTargets(id);
    if (targets.length === 0) {
      const fallback = relativeHref(leafDir, posix.normalize(`${id}.md`));
      lines.push(`- ${label}: [${escapeMarkdownLabel(id)}](${fallback})`);
      return;
    }
    for (const target of targets) {
      const text = target.id === id ? id : `${id} → ${target.id}`;
      const href = relativeHref(leafDir, posix.normalize(target.relPath));
      lines.push(`- ${label}: [${escapeMarkdownLabel(text)}](${href})`);
    }
  };
  for (const id of frontmatter.kk_relates_to) append('Related', id);
  for (const id of frontmatter.kk_depends_on) append('Depends on', id);
  if (lines.length === 0) return '';
  return [RELATED_SECTION_START, '# Related', '', ...lines, RELATED_SECTION_END].join('\n');
}

export function renderCitationsSection(frontmatter: NodeFrontmatter, leafRelPath: string): string {
  if (frontmatter.kk_derived_from.length === 0) return '';
  const lines = frontmatter.kk_derived_from.map((ref, index) => {
    const label = escapeMarkdownLabel(ref);
    const href = citationHref(ref, leafRelPath);
    return href === null ? `[${index + 1}] ${label}` : `[${index + 1}] [${label}](${href})`;
  });
  return [CITATIONS_SECTION_START, '# Citations', '', ...lines, CITATIONS_SECTION_END].join('\n');
}

export function renderGeneratedNodeSections(
  body: string,
  frontmatter: NodeFrontmatter,
  ctx: RenderLinkContext
): string {
  const withRelated = spliceDelimitedSection(
    body,
    RELATED_SECTION_START,
    RELATED_SECTION_END,
    renderRelatedSection(frontmatter, ctx)
  );
  return spliceDelimitedSection(
    withRelated,
    CITATIONS_SECTION_START,
    CITATIONS_SECTION_END,
    renderCitationsSection(frontmatter, ctx.leafRelPath)
  );
}

/** One generated section present in a leaf body whose bytes differ from a fresh render. */
export interface SectionDrift {
  section: 'Related' | 'Citations';
  /** The first line the fresh render has that the leaf lacks (or the reverse). */
  detail: string;
}

/**
 * Compare the generated sections a leaf body CARRIES with what a fresh render
 * from the current tree would produce. A section the body does not carry is
 * not drift (there is no stale link in it); a carried section that would now
 * render differently, or render to nothing, is.
 */
export function detectSectionDrift(
  body: string,
  frontmatter: NodeFrontmatter,
  ctx: RenderLinkContext
): SectionDrift[] {
  const checks: Array<[SectionDrift['section'], string, string, string]> = [
    ['Related', RELATED_SECTION_START, RELATED_SECTION_END, renderRelatedSection(frontmatter, ctx)],
    [
      'Citations',
      CITATIONS_SECTION_START,
      CITATIONS_SECTION_END,
      renderCitationsSection(frontmatter, ctx.leafRelPath),
    ],
  ];
  const out: SectionDrift[] = [];
  for (const [section, start, end, expected] of checks) {
    const actual = extractDelimitedSection(body, start, end);
    if (actual === null || actual === expected) continue;
    const actualLines = new Set(actual.split('\n'));
    const expectedLines = expected.split('\n');
    const missing = expectedLines.find(line => !actualLines.has(line));
    const extra = actual.split('\n').find(line => !expectedLines.includes(line));
    const detail =
      missing !== undefined
        ? `expected "${missing}"`
        : extra !== undefined
          ? `unexpected "${extra}"`
          : 'section order differs';
    out.push({ section, detail });
  }
  return out;
}

/**
 * Where a generated section sits in `body`: from the start of its start-marker
 * line to the end of its end marker. A marker counts only on its own line
 * (trailing whitespace allowed) and outside a fenced code block, so a marker
 * quoted inline in prose or shown in a fenced example never delimits a
 * section. Detection and replacement both use this, so a body the drift check
 * leaves alone is one the refresh leaves alone.
 */
function locateDelimitedSection(
  body: string,
  startMarker: string,
  endMarker: string
): { from: number; to: number } | null {
  let offset = 0;
  let fence: string | null = null;
  let from: number | null = null;
  for (const line of body.split('\n')) {
    const lineStart = offset;
    offset += line.length + 1;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch !== null) {
      const run = fenceMatch[1]!;
      if (fence === null) {
        fence = run;
      } else if (run[0] === fence[0] && run.length >= fence.length && line.trim() === run) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    const text = line.trimEnd();
    if (from === null) {
      if (text === startMarker) from = lineStart;
    } else if (text === endMarker) {
      return { from, to: lineStart + endMarker.length };
    }
  }
  return null;
}

function extractDelimitedSection(
  body: string,
  startMarker: string,
  endMarker: string
): string | null {
  const span = locateDelimitedSection(body, startMarker, endMarker);
  return span === null ? null : body.slice(span.from, span.to);
}

function spliceDelimitedSection(
  body: string,
  startMarker: string,
  endMarker: string,
  rendered: string
): string {
  const span = locateDelimitedSection(body, startMarker, endMarker);
  if (span !== null) {
    // The section takes its surrounding blank lines with it, so the splice
    // leaves exactly one blank line on each side.
    let from = span.from;
    let to = span.to;
    while (from > 0 && body[from - 1] === '\n') from -= 1;
    while (to < body.length && body[to] === '\n') to += 1;
    const replacement = rendered === '' ? '\n' : `\n\n${rendered}\n`;
    return (body.slice(0, from) + replacement + body.slice(to)).trimEnd();
  }
  if (rendered === '') return body.trimEnd();
  return `${body.trimEnd()}\n\n${rendered}`;
}
