import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HookEvent, HookSpec } from '../types.js';

interface ClaudeSettings {
  hooks?: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> }>
  >;
  [key: string]: unknown;
}

const OWNED_COMMAND_MARKERS = ['.ai/kenkeep/hooks/claude/kk-', '.claude/hooks/kk-'];

/**
 * Merges hook entries into `.claude/settings.json`. Existing user-defined
 * hooks are preserved; entries previously written by us are recognized by
 * the shared `.ai/kenkeep/hooks/claude/kk-` script-path marker or the
 * legacy `.claude/hooks/kk-` marker and replaced wholesale.
 *
 * Hook specs accepted here use repo-relative script paths (for example
 * `.ai/kenkeep/hooks/claude/kk-capture.cjs`), so the caller of this
 * function is responsible for choosing the install location before
 * invoking it.
 */
export async function writeClaudeHookConfig(
  repoRoot: string,
  hooks: Array<{ event: HookEvent; scriptPath: string; matcher?: string; async?: boolean }>
): Promise<void> {
  const settingsFile = join(repoRoot, '.claude/settings.json');
  let settings: ClaudeSettings = {};
  if (existsSync(settingsFile)) {
    try {
      settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as ClaudeSettings;
    } catch (err) {
      throw new Error(`Could not parse existing ${settingsFile}: ${(err as Error).message}`);
    }
  }
  settings.hooks ??= {};

  for (const [event, entries] of Object.entries(settings.hooks)) {
    const filtered = entries
      .map(entry => ({
        ...entry,
        hooks: entry.hooks.filter(
          h => !OWNED_COMMAND_MARKERS.some(marker => h.command.includes(marker))
        ),
      }))
      .filter(entry => entry.hooks.length > 0);
    if (filtered.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = filtered;
  }

  for (const hook of hooks) {
    const entryList = (settings.hooks[hook.event] ??= []);
    const command = `node "$CLAUDE_PROJECT_DIR/${hook.scriptPath}"`;
    const entry: {
      matcher?: string;
      hooks: Array<{ type: string; command: string; async?: boolean }>;
    } = {
      hooks: [{ type: 'command', command, ...(hook.async ? { async: true } : {}) }],
    };
    if (hook.matcher) entry.matcher = hook.matcher;
    entryList.push(entry);
  }

  mkdirSync(dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}

export type { HookSpec };
