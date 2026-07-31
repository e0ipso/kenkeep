/**
 * session.created handler for the OpenCode adapter.
 *
 * OpenCode plugins have no v1 equivalent of Claude's
 * `{additionalContext}` stdout channel. To get the ENTRY.md context in
 * front of the agent at session start, this script writes the context
 * payload to `.opencode/AGENTS.md` (a location OpenCode reads at agent
 * resolution time when the user references it from a parent AGENTS.md).
 * Users opt in by referencing `.opencode/AGENTS.md` from their primary
 * agent doc; the file is overwritten on every session.created firing.
 *
 * The plugin shim runs this child after `KENKEEP_BUILDER_INTERNAL=1` is set,
 * which the script honors by exiting silently to avoid recursion when
 * our own headless runner spawns `opencode run`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';

const AGENTS_HEADER = `<!-- [kenkeep] auto-generated session-start context. Re-run init to remove. -->\n`;

class OpenCodeSessionStart extends SessionStartStrategy {
  readonly tag = 'opencode:kk-session-start';

  emit({ content, root }: SessionStartEmit): void {
    const target = join(root, '.opencode', 'AGENTS.md');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${AGENTS_HEADER}${content}`);
  }
}

runSessionStartHook(new OpenCodeSessionStart());
