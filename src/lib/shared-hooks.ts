import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree } from './fs-atomic.js';
import type { RepoPaths } from './paths.js';

export function sharedHarnessHooksDir(paths: RepoPaths, harnessId: string): string {
  return join(paths.hooksDir, harnessId);
}

export function sharedHarnessHooksDirForRoot(root: string, harnessId: string): string {
  return join(root, '.ai', 'kenkeep', 'hooks', harnessId);
}

export function sharedHookScriptPath(harnessId: string, scriptPath: string): string {
  return `.ai/kenkeep/hooks/${harnessId}/${scriptPath}`;
}

export function copySharedHookScripts(
  templatesDir: string,
  paths: RepoPaths,
  harnessId: string,
  templateSubdir: string,
  templateHooksDir: 'hooks' | 'kk-hooks' = 'hooks'
): void {
  const src = join(templatesDir, templateSubdir, templateHooksDir);
  if (!existsSync(src)) return;
  copyTree(src, sharedHarnessHooksDir(paths, harnessId));
}
