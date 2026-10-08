import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import { INDEX_FILENAME } from './nodes.js';

/**
 * A leaf read from the legacy flat layout. The normal reader rejects that layout
 * outright, so this tolerant reader exists to read the leaves the flat-to-tree
 * (v1->v2) migration step is about to place. It reads only the fields the
 * clustering step needs; the write primitive re-reads full frontmatter from
 * `sourcePath`.
 */
export interface FlatLeaf {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  summary: string;
  relates_to: string[];
  /** Absolute path to the leaf on disk. */
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
 * Recursively reads every leaf `.md` under `nodesDir` (skipping generated
 * `index.md`), extracting the id and the facets the clustering step needs.
 * Leaves without a string `id` are skipped. Returns leaves sorted by id for
 * deterministic prompts and reports.
 *
 * Throws when two leaves carry the same id: the placement contract is "every
 * id placed exactly once", which is undecidable for an ambiguous id, and a
 * silent last-one-wins read would leave the other file behind as an
 * unmigrated v1 leaf. The message names every file so the ids can be fixed
 * before the inventory is clustered.
 */
export function readAllNodesFlat(nodesDir: string): FlatLeaf[] {
  const out: FlatLeaf[] = [];
  if (!existsSync(nodesDir)) return out;
  walk(nodesDir, out);
  out.sort((a, b) => a.id.localeCompare(b.id));
  const pathsById = new Map<string, string[]>();
  for (const leaf of out) {
    pathsById.set(leaf.id, [...(pathsById.get(leaf.id) ?? []), leaf.sourcePath]);
  }
  const duplicates = [...pathsById].filter(([, paths]) => paths.length > 1);
  if (duplicates.length > 0) {
    throw new Error(
      'more than one leaf carries the same id; fix the duplicate ids before migrating: ' +
        duplicates
          .map(([id, paths]) => `"${id}" at ${paths.map(p => relative(nodesDir, p)).join(', ')}`)
          .join('; ')
    );
  }
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
