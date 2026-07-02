import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix, sep } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { atomicWriteFile } from './fs-atomic.js';

export const FOLDER_SUMMARIES_FILENAME = 'FOLDER_SUMMARIES.md';

export const FolderSummaryRegistrySchema = z
  .object({
    schema_version: z.literal(1),
    summaries: z.record(z.string()),
  })
  .strict();

export type FolderSummaryRegistry = z.infer<typeof FolderSummaryRegistrySchema>;

export function folderSummariesFileForNodesDir(nodesDir: string): string {
  if (basename(nodesDir) === 'nodes') return join(dirname(nodesDir), FOLDER_SUMMARIES_FILENAME);
  return join(dirname(nodesDir), `${basename(nodesDir)}.${FOLDER_SUMMARIES_FILENAME}`);
}

export function readFolderSummaries(nodesDir: string): Map<string, string> {
  const file = folderSummariesFileForNodesDir(nodesDir);
  if (!existsSync(file)) return new Map();
  const parsed = matter(readFileSync(file, 'utf8'));
  const registry = FolderSummaryRegistrySchema.parse(parsed.data);
  return new Map(
    Object.entries(registry.summaries)
      .filter(([, summary]) => summary.trim() !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

export function writeFolderSummaries(
  nodesDir: string,
  summaries: ReadonlyMap<string, string> | Record<string, string>
): void {
  const entries = summaries instanceof Map ? [...summaries.entries()] : Object.entries(summaries);
  const normalized: Record<string, string> = {};
  for (const [path, summary] of entries) {
    const key = normalizeFolderSummaryKey(path);
    const value = summary.trim();
    if (value === '') continue;
    normalized[key] = value;
  }
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(normalized).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = normalized[key]!;
  }
  const fm = FolderSummaryRegistrySchema.parse({
    schema_version: 1,
    summaries: sorted,
  });
  const lines = ['# kenkeep Folder Summaries', ''];
  if (Object.keys(sorted).length === 0) {
    lines.push('_No folder summaries recorded._');
  } else {
    for (const [path, summary] of Object.entries(sorted)) {
      const label = path === '' ? '.' : path;
      lines.push(`- \`${label}\`: ${summary}`);
    }
  }
  atomicWriteFile(folderSummariesFileForNodesDir(nodesDir), matter.stringify(lines.join('\n'), fm));
}

export function setFolderSummary(nodesDir: string, dirRel: string, summary: string): void {
  const summaries = readFolderSummaries(nodesDir);
  const normalized = normalizeFolderSummaryKey(dirRel);
  const trimmed = summary.trim();
  if (trimmed === '') return;
  summaries.set(normalized, trimmed);
  writeFolderSummaries(nodesDir, summaries);
}

function normalizeFolderSummaryKey(path: string): string {
  const posixPath = path.split(sep).join(posix.sep);
  const normalized = posix.normalize(posixPath);
  if (normalized === '.' || normalized === '/') return '';
  if (normalized.startsWith('../') || normalized === '..' || normalized.startsWith('/')) {
    throw new Error(`folder summary path "${path}" escapes nodes/`);
  }
  return normalized.replace(/\/+$/u, '');
}
