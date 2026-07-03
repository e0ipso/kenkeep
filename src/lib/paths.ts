import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Returns the absolute path to the npm package root (the directory that
 * contains package.json and the shipped `templates/` directory).
 */
export function packageRoot(): string {
  // dist/cli.js lives one level below the package root.
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function packageTemplatesDir(): string {
  return join(packageRoot(), 'templates');
}

const NOTIFICATION_ICON_PNG = 'notification-icon.png';

/** Resolved path to the shipped kenkeep notification icon, if present. */
export function notificationIconPath(kkDir: string): string | null {
  const png = join(kkDir, 'assets', NOTIFICATION_ICON_PNG);
  return existsSync(png) ? png : null;
}

/**
 * Walks upward from `from` looking for a directory containing a `.git`
 * folder or the package's install marker at `.ai/kenkeep/.state/`.
 * Falls back to `from` if none are found.
 */
export function findRepoRoot(from: string = process.cwd()): string {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync(join(cur, '.git')) ||
      existsSync(join(cur, '.ai/kenkeep/.state/installed-version'))
    ) {
      return cur;
    }
    const parent = dirname(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}

/**
 * Walks upward from `from` looking for an initialized kenkeep directory.
 * Unlike `findRepoRoot`, this intentionally ignores nested `.git` folders so
 * launchers invoked from a subproject still run against the nearest parent
 * knowledge base.
 */
export function findKenkeepRoot(from: string = process.cwd()): string | null {
  let cur = resolve(from);
  while (true) {
    if (existsSync(join(cur, '.ai/kenkeep'))) {
      return cur;
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

export interface RepoPaths {
  root: string;
  aiDir: string;
  kkDir: string;
  /**
   * State directory under the kk root: `.ai/kenkeep/.state/`.
   * Holds the installed-version marker, lock/nudge state, and bootstrap state.
   */
  stateDir: string;
  /**
   * Config directory under the kk root: `.ai/kenkeep/.config/`.
   * Holds local prompt overrides and other user-editable configuration.
   */
  configDir: string;
  promptsDir: string;
  installedVersionFile: string;
  projectConfigFile: string;
  sessionsDir: string;
  logsDir: string;
  /**
   * Shared hook script directory under the kk root: `.ai/kenkeep/hooks/`.
   * Harness adapters install their compiled hook bundles under
   * `<hooksDir>/<harness>/` and register native hook config entries that
   * execute those shared scripts.
   */
  hooksDir: string;
  nodesDir: string;
  /**
   * Conflicts directory under the kk root: `.ai/kenkeep/conflicts/`.
   * Holds one markdown file per curator-detected contradiction; reviewed via
   * `git diff` and committed or `git restore`d like any other tracked file.
   */
  conflictsDir: string;
  /**
   * `.gitignore` shipped inside the kenkeep directory. Init creates
   * this so the project's root `.gitignore` is never touched.
   */
  kkGitignoreFile: string;
  /**
   * Per-user ledger of ingested harness auto-memory files
   * (`.ai/kenkeep/.state/memory-ledger.json`). Lives under `.state/`
   * so the existing gitignore rule keeps it out of commits.
   */
  memoryLedgerFile: string;
  /**
   * Append-only ledger of knowledge-base document usage
   * (`.ai/kenkeep/.state/usage.jsonl`). One JSON line per read occurrence of a
   * node leaf or branch index. Lives under `.state/` so the existing gitignore
   * rule keeps it out of commits.
   */
  usageFile: string;
}

export function repoPaths(root: string): RepoPaths {
  const aiDir = join(root, '.ai');
  const kkDir = join(aiDir, 'kenkeep');
  const stateDir = join(kkDir, '.state');
  const configDir = join(kkDir, '.config');
  const promptsDir = join(configDir, 'prompts');
  return {
    root,
    aiDir,
    kkDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join(stateDir, 'installed-version'),
    projectConfigFile: join(kkDir, 'config.yaml'),
    sessionsDir: join(kkDir, '_sessions'),
    logsDir: join(kkDir, '_logs'),
    hooksDir: join(kkDir, 'hooks'),
    nodesDir: join(kkDir, 'nodes'),
    conflictsDir: join(kkDir, 'conflicts'),
    kkGitignoreFile: join(kkDir, '.gitignore'),
    memoryLedgerFile: join(stateDir, 'memory-ledger.json'),
    usageFile: join(stateDir, 'usage.jsonl'),
  };
}

export function readJsonIfExists<T = unknown>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
