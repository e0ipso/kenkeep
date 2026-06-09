import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { INDEX_FILENAME } from './nodes.js';

/**
 * A single declarative step that brings on-disk artifacts from one
 * schema_version to the next. Steps are never executed by the CLI: the
 * `migrate status` primitive reports the pending chain, and the in-host
 * `kk-migrate` skill carries each step out by driving the step's CLI
 * primitives. A registry of these lets a future schema bump add one entry
 * rather than a new command.
 */
export interface MigrationStep {
  /** Stable step identifier, matched against SKILL.md procedure sections. */
  readonly id: string;
  readonly from: number;
  readonly to: number;
  /** The deterministic CLI primitives the in-host skill drives for this step. */
  readonly primitives: readonly string[];
}

/**
 * The ordered registry of every known migration step, consumed by the
 * `migrate status` CLI primitive and the in-host `kk-migrate` skill. Two rules
 * bind every entry:
 *
 * 1. A step's primitives must refuse to run unless the detected on-disk
 *    version equals the step's `from`, so a step can never apply to a tree it
 *    was not written for.
 * 2. Adding an entry requires a matching per-step procedure section in the
 *    kk-migrate SKILL.md plus a `<!-- Version -->` bump there, so the skill
 *    and the registry never drift apart.
 */
export const MIGRATION_STEPS: readonly MigrationStep[] = [
  { id: 'flat-to-tree', from: 1, to: 2, primitives: ['place inventory', 'place apply'] },
];

const LEGACY_KIND_DIRS = ['practice', 'map'];

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listLeafMarkdown(dir: string): string[] {
  if (!isDirectory(dir)) return [];
  return readdirSync(dir).filter(name => name.endsWith('.md') && name !== INDEX_FILENAME);
}

function collectLeafPaths(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      if (entry.name === INDEX_FILENAME) continue;
      out.push(full);
    }
  };
  walk(rootDir);
  return out;
}

function readSchemaVersion(file: string): number | null {
  try {
    const raw = (matter(readFileSync(file, 'utf8')).data as Record<string, unknown>).schema_version;
    return typeof raw === 'number' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Reads the schema_version the knowledge base is currently stored at, so the
 * caller can compare it against the code's target version. Returns the lowest
 * version found across leaves (a mixed tree advances from its oldest leaf), or
 * `null` when there is nothing to act on. The legacy two-bucket `nodes/<kind>/`
 * layout (leaf docs with no generated index.md) reads as version 1.
 */
export function detectSchemaVersion(nodesDir: string): number | null {
  if (!isDirectory(nodesDir)) return null;

  for (const kind of LEGACY_KIND_DIRS) {
    const dir = join(nodesDir, kind);
    if (!isDirectory(dir)) continue;
    if (listLeafMarkdown(dir).length > 0 && !existsSync(join(dir, INDEX_FILENAME))) {
      return 1;
    }
  }

  let min = Infinity;
  for (const leaf of collectLeafPaths(nodesDir)) {
    const v = readSchemaVersion(leaf);
    if (v !== null && v < min) min = v;
  }
  return Number.isFinite(min) ? min : null;
}

/**
 * Resolves the ordered pending chain that takes `current` up to `target` for
 * the `migrate status` dispatch primitive, picking the step whose `from`
 * matches the running version at each hop. Throws when a gap has no step so a
 * missing registry entry fails loudly rather than silently leaving artifacts
 * behind.
 */
export function planMigration(
  steps: readonly MigrationStep[],
  current: number,
  target: number
): MigrationStep[] {
  const chain: MigrationStep[] = [];
  let version = current;
  while (version < target) {
    const next = steps.find(s => s.from === version);
    if (!next) {
      throw new Error(`No step from schema_version ${version} toward ${target}.`);
    }
    chain.push(next);
    version = next.to;
  }
  return chain;
}
