import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { sharedHookScriptPath } from '../../lib/shared-hooks.js';
import type { HarnessPaths } from '../types.js';
import { grokHookSpecs } from './hook-spec.js';

interface GrokHookHandler {
  type: string;
  command: string;
  timeout?: number;
}

interface GrokHookGroup {
  matcher?: string;
  hooks: GrokHookHandler[];
}

interface GrokHookFile {
  hooks?: Record<string, GrokHookGroup[]>;
  [key: string]: unknown;
}

const OWNED_MARKER = '.ai/kenkeep/hooks/grok/kk-';

/**
 * Walk-up command so the committed hook file carries no absolute path.
 * stdin stays attached via `exec`.
 */
function walkUpCommand(scriptPath: string): string {
  const rel = sharedHookScriptPath('grok', scriptPath);
  return `d="$PWD"; while [ "$d" != "/" ]; do s="$d/${rel}"; [ -f "$s" ] && exec node "$s"; d="$(dirname "$d")"; done; :`;
}

/**
 * Merges kenkeep hook entries into `.grok/hooks/kk.json`. Existing
 * user-defined hooks are preserved; previous kenkeep grok entries are
 * replaced wholesale.
 */
export async function writeGrokHookConfig(paths: HarnessPaths): Promise<void> {
  if (!paths.settingsFile) {
    throw new Error('writeGrokHookConfig requires paths.settingsFile (.grok/hooks/kk.json)');
  }
  let settings: GrokHookFile = {};
  if (existsSync(paths.settingsFile)) {
    try {
      settings = JSON.parse(readFileSync(paths.settingsFile, 'utf8')) as GrokHookFile;
    } catch (err) {
      throw new Error(`Could not parse existing ${paths.settingsFile}: ${(err as Error).message}`);
    }
  }
  settings.hooks ??= {};

  for (const [event, entries] of Object.entries(settings.hooks)) {
    const filtered = entries
      .map(entry => ({
        ...entry,
        hooks: entry.hooks.filter(h => !h.command.includes(OWNED_MARKER)),
      }))
      .filter(entry => entry.hooks.length > 0);
    if (filtered.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = filtered;
  }

  for (const spec of grokHookSpecs) {
    const entryList = (settings.hooks[spec.event] ??= []);
    const handler: GrokHookHandler = {
      type: 'command',
      command: walkUpCommand(spec.scriptPath),
      timeout: spec.async === true ? 10 : 10,
    };
    const group: GrokHookGroup = { hooks: [handler] };
    if (spec.matcher) group.matcher = spec.matcher;
    entryList.push(group);
  }

  mkdirSync(dirname(paths.settingsFile), { recursive: true });
  writeFileSync(paths.settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}
