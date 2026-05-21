import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteJson } from '../../lib/fs-atomic.js';
import type { HookEvent } from '../types.js';

/**
 * Path marker for hook commands owned by this package. Entries whose
 * `command` includes this substring are replaced on upgrade; user hooks
 * are preserved.
 */
const OWNED_COMMAND_MARKER = '.cursor/hooks/kb-';

const DEFAULT_HOOK_TIMEOUT_SECONDS = 30;

const CursorHookCommandSchema = z
  .object({
    command: z.string(),
    timeout: z.number().optional(),
  })
  .passthrough();

const CursorHooksFileSchema = z
  .object({
    version: z.number().optional(),
    hooks: z.record(z.array(CursorHookCommandSchema)).optional(),
  })
  .passthrough();

export type CursorHookCommand = z.infer<typeof CursorHookCommandSchema>;
export type CursorHooksFile = z.infer<typeof CursorHooksFileSchema>;

export interface CursorHookWritePaths {
  dir: string;
  settingsFile: string;
}

export function cursorHookConfigPaths(repoRoot: string): CursorHookWritePaths {
  const dir = join(repoRoot, '.cursor');
  return {
    dir,
    settingsFile: join(dir, 'hooks.json'),
  };
}

export function readCursorHooks(paths: CursorHookWritePaths): CursorHooksFile {
  if (!existsSync(paths.settingsFile)) return { version: 1, hooks: {} };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.settingsFile, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse existing ${paths.settingsFile}: ${(err as Error).message}`);
  }
  const parsed = CursorHooksFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Existing ${paths.settingsFile} does not match expected shape: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

function isOwnedCommand(command: string): boolean {
  return command.includes(OWNED_COMMAND_MARKER);
}

/**
 * Merges owned kb hook entries into `.cursor/hooks.json`. User hooks whose
 * commands do not include `.cursor/hooks/kb-` are preserved.
 */
export async function writeCursorHooksConfig(
  repoRoot: string,
  hooks: Array<{ event: HookEvent; scriptPath: string }>
): Promise<void> {
  const paths = cursorHookConfigPaths(repoRoot);
  const existing = readCursorHooks(paths);
  const hookTable: Record<string, CursorHookCommand[]> = { ...(existing.hooks ?? {}) };

  for (const [event, entries] of Object.entries(hookTable)) {
    const filtered = entries.filter(entry => !isOwnedCommand(entry.command));
    if (filtered.length === 0) delete hookTable[event];
    else hookTable[event] = filtered;
  }

  for (const hook of hooks) {
    const list = (hookTable[hook.event] ??= []);
    list.push({
      command: `node ${hook.scriptPath}`,
      timeout: DEFAULT_HOOK_TIMEOUT_SECONDS,
    });
  }

  const out: CursorHooksFile = { version: 1, hooks: hookTable };
  atomicWriteJson(paths.settingsFile, out);
}
