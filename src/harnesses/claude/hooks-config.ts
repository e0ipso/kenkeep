import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from '../../lib/fs-atomic.js';
import type { HookEvent, HookSpec } from '../types.js';

/**
 * The shape kenkeep walks to merge its registrations. Claude supports several
 * handler types (`command`, `prompt`, `agent`, `http`, ...; see
 * https://code.claude.com/docs/en/hooks), so only a handler's string `type`
 * is required and every other field passes through untouched.
 */
const ClaudeHookHandlerSchema = z.object({ type: z.string() }).passthrough();
const ClaudeHookGroupSchema = z.object({ hooks: z.array(ClaudeHookHandlerSchema) }).passthrough();
const ClaudeSettingsSchema = z
  .object({ hooks: z.record(z.array(ClaudeHookGroupSchema)).optional() })
  .passthrough();

type ClaudeHookHandler = z.infer<typeof ClaudeHookHandlerSchema>;
type ClaudeHookGroup = z.infer<typeof ClaudeHookGroupSchema>;
type ClaudeSettings = z.infer<typeof ClaudeSettingsSchema>;

const OWNED_COMMAND_MARKERS = ['.ai/kenkeep/hooks/claude/kk-', '.claude/hooks/kk-'];

/**
 * A handler is a candidate kenkeep-owned entry only when it is a `command`
 * handler with a string `command` carrying one of our script-path markers.
 * Every other handler type is user-owned by construction and preserved.
 */
function isOwnedHandler(handler: ClaudeHookHandler): boolean {
  const command = handler['command'];
  return (
    handler.type === 'command' &&
    typeof command === 'string' &&
    OWNED_COMMAND_MARKERS.some(marker => command.includes(marker))
  );
}

/** `hooks.Stop[1].hooks[0]` style path for a validation issue. */
function jsonPath(path: ReadonlyArray<string | number>): string {
  const rendered = path.reduce<string>(
    (acc, seg) => (typeof seg === 'number' ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg),
    ''
  );
  return rendered || '(top level)';
}

/**
 * Reads and validates `.claude/settings.json` (an absent file is `{}`).
 * Throws a diagnostic naming the file and the offending JSON path when the
 * file is unparseable or its `hooks` tree is malformed. The parsed object is
 * returned as read, so a rewrite keeps the user's key order.
 */
function loadClaudeSettings(settingsFile: string): ClaudeSettings {
  if (!existsSync(settingsFile)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(settingsFile, 'utf8'));
  } catch (err) {
    throw new Error(`Could not parse existing ${settingsFile}: ${(err as Error).message}`);
  }
  const parsed = ClaudeSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Malformed Claude settings in ${settingsFile}: "${jsonPath(issue?.path ?? [])}": ` +
        `${issue?.message ?? 'invalid'}. kenkeep left the file unchanged; fix or remove that ` +
        'entry, then re-run the command.'
    );
  }
  return raw as ClaudeSettings;
}

/**
 * Merges hook entries into `.claude/settings.json`. Existing user-defined
 * hooks of every type are preserved; `command` handlers previously written by
 * us are recognized by the shared `.ai/kenkeep/hooks/claude/kk-` script-path
 * marker or the legacy `.claude/hooks/kk-` marker and replaced wholesale.
 * The file is validated in full before it is rewritten, so malformed input
 * fails with a path-specific diagnostic and no partial write.
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
  const settings = loadClaudeSettings(settingsFile);
  settings.hooks ??= {};

  // Strip our previous registrations. A group or event is dropped only when
  // removing our handlers emptied it; anything the user left empty stays.
  for (const [event, groups] of Object.entries(settings.hooks)) {
    const filtered = groups.flatMap(group => {
      const kept = group.hooks.filter(h => !isOwnedHandler(h));
      if (kept.length === group.hooks.length) return [group];
      return kept.length > 0 ? [{ ...group, hooks: kept }] : [];
    });
    if (filtered.length === 0 && groups.length > 0) delete settings.hooks[event];
    else settings.hooks[event] = filtered;
  }

  for (const hook of hooks) {
    const groupList = (settings.hooks[hook.event] ??= []);
    const command = `node "$CLAUDE_PROJECT_DIR/${hook.scriptPath}"`;
    const group: ClaudeHookGroup = {
      hooks: [{ type: 'command', command, ...(hook.async ? { async: true } : {}) }],
    };
    if (hook.matcher) group.matcher = hook.matcher;
    groupList.push(group);
  }

  atomicWriteFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}

export type { HookSpec };
