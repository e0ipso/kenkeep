import { existsSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { getHarness, listHarnessIds } from '../harnesses/registry.js';
import type { HarnessAdapter } from '../harnesses/types.js';

/**
 * Default filename of the per-repo kk scope file at the repository root.
 */
export const KKIGNORE_FILENAME = '.kkignore';

/**
 * Renders the default `.kkignore` stub from a list of harness adapters.
 *
 * The stub is composed of:
 *   1. A header explaining purpose, gitignore-style syntax, that paths are
 *      repo-root relative, and that `STATIC_SKIPS` (`.git/`, `node_modules/`,
 *      and the categorical project-noise filenames in `src/lib/bootstrap.ts`)
 *      remain skipped regardless of what this file says.
 *   2. A worked example demonstrating directory deny + glob deny +
 *      correctly-ordered `!` un-ignore, with the parent-directory caveat
 *      called out explicitly.
 *   3. A commented-out "common noise" block users can uncomment.
 *   4. An UNCOMMENTED deny block listing every harness instruction directory
 *      currently produced by every registered harness adapter (the same set
 *      `harnessInstructionSkipPatterns` returns, but expressed as
 *      gitignore-style trailing-slash directory paths).
 *
 * Determinism: with the same adapter list (and `repoRoot`), this returns
 * byte-identical output. Adapter ids are sorted; harness directories are
 * sorted and de-duplicated.
 */
export function renderKbignoreStub(adapters: HarnessAdapter[]): string {
  const repoRoot = '/'; // sentinel — paths.relative cancels it out below.
  const dirs = collectHarnessDirs(adapters, repoRoot);

  const lines: string[] = [];
  // 1. Header.
  lines.push('# .kkignore — per-repo scope for the AI kenkeep doc scan.');
  lines.push('#');
  lines.push('# Syntax:   gitignore-style. Patterns match repo-root-relative paths');
  lines.push('#           with forward slashes. A leading `!` re-includes a path.');
  lines.push('#           A trailing `/` matches directories. `**` matches any');
  lines.push('#           number of path segments.');
  lines.push('#');
  lines.push('# Always-on: STATIC_SKIPS (see src/lib/bootstrap.ts) plus `.git/` and');
  lines.push('#           `node_modules/` are skipped regardless of what you put in');
  lines.push('#           this file. Editing `.kkignore` cannot opt them back in;');
  lines.push('#           use an explicit `--include` on the CLI for that.');
  lines.push('#');
  lines.push('# Worked example (note the parent-directory caveat):');
  lines.push('#');
  lines.push('#   # Deny a whole tree, then re-include one file inside it.');
  lines.push('#   # IMPORTANT: gitignore will NOT un-ignore a file under an ignored');
  lines.push('#   # directory unless every ancestor is also un-ignored first.');
  lines.push('#   docs/internal/');
  lines.push('#   !docs/internal/');
  lines.push('#   !docs/internal/AGENTS.md');
  lines.push('#');
  lines.push('#   # Glob deny:');
  lines.push('#   **/*.generated.md');
  lines.push('');

  // 2. Common-noise (commented out).
  lines.push('# --- Common noise (uncomment what applies to your repo) ---');
  lines.push('# build/');
  lines.push('# dist/');
  lines.push('# coverage/');
  lines.push('# **/*.generated.md');
  lines.push('');

  // 3. Strikethroo plans directory — uncommented.
  lines.push('.ai/strikethroo/');
  lines.push('.ai/kenkeep/hooks/');
  lines.push('');

  // 4. Harness instruction directories — uncommented.
  lines.push('# --- Harness instruction directories (auto-generated from registered adapters) ---');
  lines.push('# These describe how the AI should act (skills, commands, hooks,');
  lines.push('# plugins) rather than what the project is. Remove a line to');
  lines.push('# include that surface in the kenkeep scan.');
  for (const d of dirs) {
    lines.push(d);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Writes `<repoRoot>/.kkignore` from the current harness registry if and
 * only if the file does not already exist. Returns `{ written, path }` so
 * callers can log a single line consistent with the rest of `init`.
 *
 * Never overwrites — a user-edited `.kkignore` is sacred.
 */
export function ensureKbignore(repoRoot: string): { written: boolean; path: string } {
  const path = join(repoRoot, KKIGNORE_FILENAME);
  if (existsSync(path)) {
    return { written: false, path };
  }
  const adapters = listHarnessIds().map(id => getHarness(id));
  writeFileSync(path, renderKbignoreStub(adapters));
  return { written: true, path };
}

/**
 * Returns the repo-root-relative posix directory paths (with trailing `/`)
 * for every instruction surface every adapter owns: `skillsDir`,
 * `commandsDir`, non-shared `hooksDir`, `pluginsDir`. Sorted,
 * de-duplicated. The shared hook tree is emitted once by the stub body
 * above instead of once per adapter.
 */
function collectHarnessDirs(adapters: HarnessAdapter[], repoRoot: string): string[] {
  const sorted = [...adapters].sort((a, b) => a.id.localeCompare(b.id));
  const out = new Set<string>();
  for (const adapter of sorted) {
    const paths = adapter.paths(repoRoot);
    const dirs: (string | undefined)[] = [
      paths.skillsDir,
      paths.commandsDir,
      paths.hooksDir,
      paths.pluginsDir,
    ];
    for (const dir of dirs) {
      if (!dir) continue;
      const rel = relative(repoRoot, dir).split(sep).join(posix.sep);
      if (!rel || rel.startsWith('..')) continue;
      if (rel.startsWith('.ai/kenkeep/hooks/')) continue;
      out.add(`${rel}/`);
    }
  }
  return Array.from(out).sort();
}
