import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { INDEX_FILENAME } from './nodes.js';

/**
 * A flat leaf as read by treeify. Treeify cannot use `readAllNodes` because
 * that reader rejects the old flat `nodes/<kind>/` layout outright (the plan 41
 * clean break). This tolerant reader exists specifically to read the leaves
 * treeify is about to migrate. It reads only the fields the clustering step
 * needs; the deterministic write primitive re-reads the full frontmatter from
 * `sourcePath` so nothing is lost in translation.
 */
export interface FlatLeaf {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  summary: string;
  relates_to: string[];
  /** Absolute path to the flat leaf on disk. */
  sourcePath: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Recursively reads every leaf `.md` file under `nodesDir` (skipping generated
 * `index.md` files), extracting the id and the facets the clustering step
 * needs. Leaves without a string `id` are skipped (they cannot be migrated by
 * id). Returns leaves sorted by id for deterministic prompts and reports.
 */
export function readAllNodesFlat(nodesDir: string): FlatLeaf[] {
  const out: FlatLeaf[] = [];
  if (!existsSync(nodesDir)) return out;
  walk(nodesDir, out);
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function walk(dir: string, out: FlatLeaf[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === INDEX_FILENAME) continue;
    let data: Record<string, unknown>;
    try {
      data = matter(readFileSync(full, 'utf8')).data as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = asString(data.id);
    if (id === '') continue;
    out.push({
      id,
      title: asString(data.title),
      kind: asString(data.kind),
      tags: asStringArray(data.tags),
      summary: asString(data.summary),
      relates_to: asStringArray(data.relates_to),
      sourcePath: full,
    });
  }
}
