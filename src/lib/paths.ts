import { existsSync, readFileSync } from 'node:fs';
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
 * folder (or the marker file `.ai/.kb-builder/installed-version`). Falls
 * back to `from` if neither is found.
 */
export function findRepoRoot(from: string = process.cwd()): string {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync(join(cur, '.git')) ||
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
  builderDir: string;
  installedVersionFile: string;
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
  const builderDir = join(aiDir, '.kb-builder');
  const claudeDir = join(root, '.claude');
  return {
    root,
    aiDir,
    kbDir,
    builderDir,
    installedVersionFile: join(builderDir, 'installed-version'),
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
