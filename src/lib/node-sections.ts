import { posix } from 'node:path';
import type { NodeFrontmatter } from './schemas.js';

export const RELATED_SECTION_START = '<!-- kk:related:start -->';
export const RELATED_SECTION_END = '<!-- kk:related:end -->';
export const CITATIONS_SECTION_START = '<!-- kk:citations:start -->';
export const CITATIONS_SECTION_END = '<!-- kk:citations:end -->';

export type NodePathResolver = (id: string) => string | null;

function escapeMarkdownLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\`[\]])/g, '\\$1');
}

function bundleAbsolutePath(relPath: string): string {
  const normalized = posix.normalize(relPath);
  return `/${normalized.replace(/^\/+/, '')}`;
}

function fallbackPathForId(id: string): string {
  return bundleAbsolutePath(`${id}.md`);
}

export function renderRelatedSection(
  frontmatter: NodeFrontmatter,
  resolvePath: NodePathResolver
): string {
  const lines: string[] = [];
  const append = (label: string, id: string): void => {
    const relPath = resolvePath(id);
    const href = relPath ? bundleAbsolutePath(relPath) : fallbackPathForId(id);
    lines.push(`- ${label}: [${escapeMarkdownLabel(id)}](${href})`);
  };
  for (const id of frontmatter.kk_relates_to) append('Related', id);
  for (const id of frontmatter.kk_depends_on) append('Depends on', id);
  if (lines.length === 0) return '';
  return [RELATED_SECTION_START, '# Related', '', ...lines, RELATED_SECTION_END].join('\n');
}

export function renderCitationsSection(frontmatter: NodeFrontmatter): string {
  if (frontmatter.kk_derived_from.length === 0) return '';
  const lines = frontmatter.kk_derived_from.map((ref, index) => {
    const label = escapeMarkdownLabel(ref);
    return `[${index + 1}] [${label}](${ref})`;
  });
  return [CITATIONS_SECTION_START, '# Citations', '', ...lines, CITATIONS_SECTION_END].join('\n');
}

export function renderGeneratedNodeSections(
  body: string,
  frontmatter: NodeFrontmatter,
  resolvePath: NodePathResolver
): string {
  const withRelated = spliceDelimitedSection(
    body,
    RELATED_SECTION_START,
    RELATED_SECTION_END,
    renderRelatedSection(frontmatter, resolvePath)
  );
  return spliceDelimitedSection(
    withRelated,
    CITATIONS_SECTION_START,
    CITATIONS_SECTION_END,
    renderCitationsSection(frontmatter)
  );
}

function spliceDelimitedSection(
  body: string,
  startMarker: string,
  endMarker: string,
  rendered: string
): string {
  const escapedStart = escapeRegExp(startMarker);
  const escapedEnd = escapeRegExp(endMarker);
  const sectionPattern = new RegExp(`\\n*${escapedStart}[\\s\\S]*?${escapedEnd}\\n*`, 'u');
  const replacement = rendered === '' ? '\n' : `\n\n${rendered}\n`;
  if (sectionPattern.test(body)) {
    return body.replace(sectionPattern, replacement).trimEnd();
  }
  if (rendered === '') return body.trimEnd();
  return `${body.trimEnd()}\n\n${rendered}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
