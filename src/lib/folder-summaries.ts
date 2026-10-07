import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { atomicWriteFile } from './fs-atomic.js';
import { normalizeFolderKey } from './path-safety.js';

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

/**
 * Reconcile a sidecar registry against the owned folder set.
 *
 * The rule: a folder summary lives exactly as long as its folder is owned —
 * the bundle root plus every folder with a leaf somewhere beneath it, which
 * is also the set of folders that carry a generated `index.md`. When the last
 * leaf leaves a branch, `index rebuild` removes the branch's stale `index.md`
 * and prunes its sidecar entry on the same run, so `FOLDER_SUMMARIES.md`
 * never describes a folder the catalog no longer lists. A pruned summary is
 * recoverable from git history should the folder come back.
 *
 * Pure: returns the kept entries (input order, verbatim) and the pruned keys
 * (sorted, so the rebuild can name them deterministically).
 */
export function reconcileFolderSummaries(
  summaries: ReadonlyMap<string, string>,
  ownedDirs: ReadonlySet<string>
): { kept: Map<string, string>; pruned: string[] } {
  const kept = new Map<string, string>();
  const pruned: string[] = [];
  for (const [key, summary] of summaries) {
    if (ownedDirs.has(key)) kept.set(key, summary);
    else pruned.push(key);
  }
  pruned.sort((a, b) => a.localeCompare(b));
  return { kept, pruned };
}

export function writeFolderSummaries(
  nodesDir: string,
  summaries: ReadonlyMap<string, string> | Record<string, string>
): void {
  atomicWriteFile(folderSummariesFileForNodesDir(nodesDir), renderFolderSummaries(summaries));
}

/**
 * Render the deterministic sidecar bytes for a registry: normalized sorted
 * keys, trimmed non-empty summaries, one bullet per entry. Exposed so the
 * rebuild can treat the sidecar like every other owned artifact (compare
 * bytes, write only on change, stage the result).
 */
export function renderFolderSummaries(
  summaries: ReadonlyMap<string, string> | Record<string, string>
): string {
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
  return matter.stringify(lines.join('\n'), fm);
}

export function setFolderSummary(nodesDir: string, dirRel: string, summary: string): void {
  const summaries = readFolderSummaries(nodesDir);
  const normalized = normalizeFolderSummaryKey(dirRel);
  const trimmed = summary.trim();
  if (trimmed === '') return;
  summaries.set(normalized, trimmed);
  writeFolderSummaries(nodesDir, summaries);
}

/** Registry keys use the shared folder-key normalization (path-safety). */
function normalizeFolderSummaryKey(path: string): string {
  return normalizeFolderKey(path);
}
