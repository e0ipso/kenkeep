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
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { parseKiroTranscript } from '../transcript.js';
import { extractKiroReads } from '../../read-extract.js';

const PACKAGE_TAG = '[kenkeep]';

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Resolves the path to the Kiro session JSON file for a given session ID.
 * Kiro stores sessions at `~/.kiro/sessions/cli/<session_id>.json`.
 */
function kiroSessionPath(sessionId: string): string {
  return join(homedir(), '.kiro', 'sessions', 'cli', `${sessionId}.json`);
}

runHookEntry({
  tag: 'kiro:kk-capture',
  deadlineMs: 1000,
  requirePayload: true,
  main: async payload => {
    const startCwd = pickString(payload, 'cwd') ?? process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);
    if (!existsSync(paths.installedVersionFile)) return;

    try {
      const sessionId = pickString(payload, 'session_id');
      if (!sessionId) {
        process.stderr.write(`${PACKAGE_TAG} capture: no session_id in payload; skipping.\n`);
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
        trigger: 'stop',
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
