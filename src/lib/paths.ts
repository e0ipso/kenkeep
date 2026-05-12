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

/**
 * Walks upward from `from` looking for a directory containing a `.git`
 * folder or the package's install marker at `.ai/knowledge-base/.state/`.
 * Falls back to `from` if none are found.
 */
export function findRepoRoot(from: string = process.cwd()): string {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync(join(cur, '.git')) ||
      existsSync(join(cur, '.ai/knowledge-base/.state/installed-version'))
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
   * Holds the installed-version marker, lock/nudge state, and bootstrap state.
   */
  stateDir: string;
  /**
   * Config directory under the KB root: `.ai/knowledge-base/.config/`.
   * Holds local prompt overrides and other user-editable configuration.
   */
  configDir: string;
  promptsDir: string;
  installedVersionFile: string;
  projectConfigFile: string;
  sessionsDir: string;
  logsDir: string;
  nodesDir: string;
  claudeDir: string;
  claudeCommandsDir: string;
  claudeSkillsDir: string;
  claudeHooksDir: string;
  claudeSettingsFile: string;
  gitignoreFile: string;
  secretlintrcFile: string;
  huskyDir: string;
  huskyPreCommitFile: string;
  packageJsonFile: string;
  lintstagedrcFile: string;
}

export function repoPaths(root: string): RepoPaths {
  const aiDir = join(root, '.ai');
  const kbDir = join(aiDir, 'knowledge-base');
  const stateDir = join(kbDir, '.state');
  const configDir = join(kbDir, '.config');
  const promptsDir = join(configDir, 'prompts');
  const claudeDir = join(root, '.claude');
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join(stateDir, 'installed-version'),
    projectConfigFile: join(kbDir, 'config.yaml'),
    sessionsDir: join(kbDir, '_sessions'),
    logsDir: join(kbDir, '_logs'),
    nodesDir: join(kbDir, 'nodes'),
    claudeDir,
    claudeCommandsDir: join(claudeDir, 'commands'),
    claudeSkillsDir: join(claudeDir, 'skills'),
    claudeHooksDir: join(claudeDir, 'hooks'),
    claudeSettingsFile: join(claudeDir, 'settings.json'),
    gitignoreFile: join(root, '.gitignore'),
    secretlintrcFile: join(root, '.secretlintrc.json'),
    huskyDir: join(root, '.husky'),
    huskyPreCommitFile: join(root, '.husky', 'pre-commit'),
    packageJsonFile: join(root, 'package.json'),
    lintstagedrcFile: join(root, '.lintstagedrc.cjs'),
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
