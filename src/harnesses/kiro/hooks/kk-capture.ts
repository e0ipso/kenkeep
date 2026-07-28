/**
 * stop hook for the Kiro CLI adapter.
 *
 * Kiro fires `stop` at the end of each agent turn. The payload carries
 * `session_id` and `assistant_response` on stdin. The full session transcript
 * is at `~/.kiro/sessions/cli/<session_id>.json` (Kiro's standard session
 * store). This script reads that file and runs it through the shared capture
 * pipeline.
 *
 * Note: the `assistant_response` field in the payload contains only the
 * most recent assistant turn. kenkeep reads the full session JSON from disk
 * to get the complete conversation history for curation purposes.
 *
 * Note on user turns: Kiro's session JSON stores only assistant responses in
 * `user_turn_metadatas`. User message text is not persisted. Session logs
 * will have empty user turns — this is a known limitation of the Kiro session
 * format.
 *
 * Payload received on stdin:
 *   { hook_event_name: "stop", cwd: "...", session_id: "...",
 *     assistant_response: "..." }
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import { runHookEntry, hookStartCwd, payloadString } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { parseKiroTranscript } from '../transcript.js';
import { extractKiroReads } from '../../read-extract.js';

const PACKAGE_TAG = '[kenkeep]';

/**
 * The canonical `captured_by` value every Kiro capture records.
 *
 * The other adapters export an event→trigger map because they register
 * kk-capture on several native events. Kiro registers it on exactly one
 * (`stop`), whose native name already equals the canonical trigger, so a map
 * would have a single identity entry. This constant is the single source of
 * truth instead; `tests/harnesses/captured-by-trigger.test.ts` pins it against
 * the registered hook spec so the two cannot drift.
 */
export const KIRO_CAPTURE_TRIGGER: CaptureTrigger = 'stop';

/**
 * Validates that `value` is safe to interpolate into the session-file path as
 * a single filename component.
 *
 * The check is deliberately shape-agnostic rather than pinned to UUID v4:
 * kenkeep does not control Kiro's session-id format, and a version-specific
 * pattern turns a harmless format change (a v7 UUID, an opaque `ses_…` token)
 * into capture silently doing nothing forever. The security requirement is
 * only that the value cannot escape `~/.kiro/sessions/cli/` — so the allowed
 * alphabet excludes `/`, `\`, NUL, and every other separator, the first
 * character must be alphanumeric (which rules out `.` and `..`), and the
 * length is bounded well under any filesystem's component limit.
 */
export function isValidSessionId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function kiroSessionPath(sessionId: string): string {
  return join(homedir(), '.kiro', 'sessions', 'cli', `${sessionId}.json`);
}

runHookEntry({
  tag: 'kiro:kk-capture',
  deadlineMs: 1000,
  requirePayload: true,
  main: async payload => {
    const startCwd = hookStartCwd(payload);
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);
    if (!existsSync(paths.installedVersionFile)) return;

    try {
      const sessionId = payloadString(payload, 'session_id');
      if (!sessionId) {
        process.stderr.write(`${PACKAGE_TAG} capture: no session_id in payload; skipping.\n`);
        return;
      }
      if (!isValidSessionId(sessionId)) {
        process.stderr.write(`${PACKAGE_TAG} capture: invalid session_id format; skipping.\n`);
        return;
      }
      const sessionFile = kiroSessionPath(sessionId);
      if (!existsSync(sessionFile)) {
        // Session file may not be flushed yet. Exit silently.
        return;
      }
      const input: HookInput = {
        session_id: sessionId,
        transcript_path: sessionFile,
        trigger: KIRO_CAPTURE_TRIGGER,
        cwd: startCwd,
      };
      process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
      await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: text => parseKiroTranscript(text),
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          extractReads: extractKiroReads,
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
