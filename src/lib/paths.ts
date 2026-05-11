import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
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

/**
 * Walks upward from `from` looking for a directory containing a `.git`
 * folder or either of the package's install markers (new layout under
 * `.ai/knowledge-base/.state/` or legacy under `.ai/.kb-builder/`).
 * Falls back to `from` if none are found.
 */
export function findRepoRoot(from: string = process.cwd()): string {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync(join(cur, '.git')) ||
      existsSync(join(cur, '.ai/knowledge-base/.state/installed-version')) ||
      existsSync(join(cur, '.ai/.kb-builder/installed-version'))
    ) {
      return cur;
    }
    const parent = dirname(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}

export interface RepoPaths {
  root: string;
  aiDir: string;
  kbDir: string;
  /**
   * State directory under the KB root: `.ai/knowledge-base/.state/`.
   * Holds the installed-version marker, lock/nudge state, bootstrap state,
   * and local prompt overrides.
   */
  stateDir: string;
  /**
   * Legacy state directory `.ai/.kb-builder/` — only used for detection
   * and migration. New installs never write here.
   */
  legacyStateDir: string;
  installedVersionFile: string;
  legacyInstalledVersionFile: string;
  projectConfigFile: string;
  sessionsDir: string;
  proposedDir: string;
  logsDir: string;
  nodesDir: string;
  claudeDir: string;
  claudeCommandsDir: string;
  claudeSkillsDir: string;
  claudeHooksDir: string;
  claudeSettingsFile: string;
  gitignoreFile: string;
  preCommitConfigFile: string;
}

export function repoPaths(root: string): RepoPaths {
  const aiDir = join(root, '.ai');
  const kbDir = join(aiDir, 'knowledge-base');
  const stateDir = join(kbDir, '.state');
  const legacyStateDir = join(aiDir, '.kb-builder');
  const claudeDir = join(root, '.claude');
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    legacyStateDir,
    installedVersionFile: join(stateDir, 'installed-version'),
    legacyInstalledVersionFile: join(legacyStateDir, 'installed-version'),
    projectConfigFile: join(kbDir, '.config.json'),
    sessionsDir: join(kbDir, '_sessions'),
    proposedDir: join(kbDir, '_proposed'),
    logsDir: join(kbDir, '_logs'),
    nodesDir: join(kbDir, 'nodes'),
    claudeDir,
    claudeCommandsDir: join(claudeDir, 'commands'),
    claudeSkillsDir: join(claudeDir, 'skills'),
    claudeHooksDir: join(claudeDir, 'hooks'),
    claudeSettingsFile: join(claudeDir, 'settings.json'),
    gitignoreFile: join(root, '.gitignore'),
    preCommitConfigFile: join(root, '.pre-commit-config.yaml'),
  };
}

export function readJsonIfExists<T = unknown>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export interface MigrationResult {
  migrated: boolean;
  movedEntries: string[];
}

/**
 * Idempotently migrates a legacy `.ai/.kb-builder/` install to the new
 * `.ai/knowledge-base/.state/` layout. Safe to call on every CLI/hook
 * entry — returns `{ migrated: false }` quickly when nothing to do.
 *
 * Behavior:
 *   - If the legacy directory does not exist, no-op.
 *   - Otherwise: moves every entry into `stateDir` (creating it if needed).
 *     If both old and new versions of a file/dir exist, the new one wins
 *     (caller is mid-migration and has fresher data).
 *   - Removes the now-empty legacy directory.
 */
export function migrateLegacyState(paths: RepoPaths): MigrationResult {
  if (!existsSync(paths.legacyStateDir)) {
    return { migrated: false, movedEntries: [] };
  }
  const entries = readdirSync(paths.legacyStateDir);
  if (entries.length === 0) {
    // Empty legacy dir — just remove the husk.
    try {
      rmSync(paths.legacyStateDir, { recursive: true, force: true });
    } catch {
      // ignore — best-effort cleanup
    }
    return { migrated: false, movedEntries: [] };
  }
  mkdirSync(paths.stateDir, { recursive: true });
  const moved: string[] = [];
  for (const name of entries) {
    const src = join(paths.legacyStateDir, name);
    const dst = join(paths.stateDir, name);
    if (existsSync(dst)) {
      // New location already has this entry — keep the newer one, drop the legacy.
      try {
        rmSync(src, { recursive: true, force: true });
      } catch {
        // ignore
      }
      continue;
    }
    try {
      renameSync(src, dst);
    } catch {
      // Cross-device or other rename failure — fall back to copy+remove.
      try {
        cpSync(src, dst, { recursive: true });
        rmSync(src, { recursive: true, force: true });
      } catch {
        continue;
      }
    }
    moved.push(name);
  }
  try {
    rmSync(paths.legacyStateDir, { recursive: true, force: true });
  } catch {
    // ignore — best-effort
  }
  return { migrated: moved.length > 0, movedEntries: moved };
}

/**
 * Returns the resolved state directory. Performs an inline migration if
 * legacy state exists. Cheap when nothing to migrate.
 */
export function ensureStateLayout(paths: RepoPaths): MigrationResult {
  return migrateLegacyState(paths);
}

// Re-export for convenience: callers usually want a `statSync` check on
// directory existence rather than importing fs themselves.
export function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
