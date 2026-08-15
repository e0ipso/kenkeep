/**
 * Stop / SessionEnd / PreCompact hook for the Grok Build adapter.
 *
 * Grok hook stdin is camelCase (`sessionId`, `hookEventName`, `cwd`). The
 * transcript is not in the payload; this script locates
 * `$GROK_HOME/sessions/<encoded-cwd>/<sessionId>/chat_history.jsonl` under a
 * realpath confinement, then runs the shared capture pipeline.
 */
import { existsSync } from 'node:fs';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import { extractGrokReads } from '../../read-extract.js';
import { locateGrokChatHistory } from '../session-files.js';
import { assertValidGrokSessionId } from '../session-id.js';
import { parseGrokTranscript } from '../transcript.js';

const PACKAGE_TAG = '[kenkeep]';

export const GROK_EVENT_TO_TRIGGER = {
  Stop: 'stop',
  SessionEnd: 'session_end',
  PreCompact: 'pre_compact',
  stop: 'stop',
  sessionEnd: 'session_end',
  preCompact: 'pre_compact',
} as const satisfies Record<string, CaptureTrigger>;

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

runHookEntry({
  tag: 'grok:kk-capture',
  deadlineMs: 1000,
  requirePayload: true,
  main: async payload => {
    if (typeof payload['subagentType'] === 'string' && payload['subagentType'].length > 0) {
      return;
    }
    const startCwd = pickString(payload, 'cwd', 'workspaceRoot') ?? process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);
    if (!existsSync(paths.installedVersionFile)) return;

    try {
      const sessionId = assertValidGrokSessionId(pickString(payload, 'sessionId', 'session_id'));
      const transcriptPath = locateGrokChatHistory({ sessionId, cwd: startCwd });
      if (transcriptPath === null) return;

      const event = pickString(payload, 'hookEventName', 'hook_event_name', 'event');
      const trigger: CaptureTrigger =
        (event !== undefined
          ? GROK_EVENT_TO_TRIGGER[event as keyof typeof GROK_EVENT_TO_TRIGGER]
          : undefined) ?? 'stop';
      const input: HookInput = {
        session_id: sessionId,
        transcript_path: transcriptPath,
        trigger,
        cwd: startCwd,
      };
      process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
      await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: parseGrokTranscript,
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          extractReads: extractGrokReads,
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
