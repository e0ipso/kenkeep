/**
 * Capture hook for the GitHub Copilot CLI adapter.
 *
 * Wired to Copilot's `sessionEnd` and `agentStop` events. Copilot pipes a
 * stdin JSON payload that carries the active `sessionId`; the script locates
 * the per-session transcript at
 * `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl`, runs
 * it through the shared capture pipeline (parse, write session log), and
 * exits 0 unconditionally so a stalled lookup never blocks the Copilot
 * session lifecycle.
 *
 * Copilot exports no in-session env var, so the script depends entirely on
 * the stdin `sessionId`. The `sessionEnd` event maps to the `session_end`
 * capture trigger; `agentStop` maps to `stop`. The shared transcript_hash
 * dedup keeps one session log per unique transcript even when both fire.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import { copilotHome } from '../hooks-config.js';
import { parseCopilotTranscript } from '../transcript.js';
import { extractCopilotReads } from '../../read-extract.js';

const PACKAGE_TAG = '[kenkeep]';

/** Maps Copilot's native event names to the canonical capture trigger. */
export const COPILOT_EVENT_TO_TRIGGER = {
  agentStop: 'stop',
  sessionEnd: 'session_end',
} as const satisfies Record<string, CaptureTrigger>;

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

runHookEntry({
  tag: 'copilot:kk-capture',
  deadlineMs: 1000,
  requirePayload: true,
  main: async payload => {
    const startCwd = pickString(payload, 'cwd') ?? process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);
    // No-op silently when this repo is not a kenkeep project. The repo-level
    // .github/hooks/kk.json only exists in initialized repos, but the hook
    // command walks up from the session cwd, so this guard keeps it inert
    // when invoked outside any kenkeep repo.
    if (!existsSync(paths.installedVersionFile)) return;

    try {
      const sessionId = assertValidSessionId(pickString(payload, 'sessionId', 'session_id'));
      const eventsFile = join(copilotHome(), 'session-state', sessionId, 'events.jsonl');
      if (!existsSync(eventsFile)) {
        // The transcript may not be flushed yet, or the session ran elsewhere.
        return;
      }
      const event = pickString(payload, 'hook_event_name', 'event', 'type');
      const trigger: CaptureTrigger =
        (event !== undefined
          ? COPILOT_EVENT_TO_TRIGGER[event as keyof typeof COPILOT_EVENT_TO_TRIGGER]
          : undefined) ?? 'stop';
      const input: HookInput = {
        session_id: sessionId,
        transcript_path: eventsFile,
        trigger,
        cwd: startCwd,
      };
      process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
      await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: parseCopilotTranscript,
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          extractReads: extractCopilotReads,
        },
      });
      process.stderr.write('💾 kenkeep Capture: Session transcript saved.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
