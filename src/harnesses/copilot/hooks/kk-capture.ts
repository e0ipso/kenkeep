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
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import { readStdin } from '../../../lib/stdin.js';
import { copilotHome } from '../hooks-config.js';
import { parseCopilotTranscript } from '../transcript.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[kenkeep]';

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

async function main(): Promise<void> {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  if (raw.trim().length === 0) return;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('copilot:kk-capture', 'parse', err, paths.logsDir);
    return;
  }

  const startCwd = pickString(payload, 'cwd') ?? process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  // No-op silently when this repo is not a kenkeep project. The user-level
  // ~/.copilot/hooks/kk.json fires for every repo where the user runs
  // copilot, so this guard keeps the hook inert outside initialized repos.
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    const sessionId = assertValidSessionId(pickString(payload, 'sessionId', 'session_id'));
    const eventsFile = join(copilotHome(), 'session-state', sessionId, 'events.jsonl');
    if (!existsSync(eventsFile)) {
      // The transcript may not be flushed yet, or the session ran elsewhere.
      return;
    }
    const event = pickString(payload, 'hook_event_name', 'event', 'type');
    const hookEventName = event === 'agentStop' ? 'Stop' : 'SessionEnd';
    const input: HookInput = {
      session_id: sessionId,
      transcript_path: eventsFile,
      hook_event_name: hookEventName,
      cwd: startCwd,
    };
    process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
    await captureSession(input, {
      sessionsDir: paths.sessionsDir,
      parseTranscript: parseCopilotTranscript,
    });
    process.stderr.write('💾 kenkeep Capture: Session transcript saved.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('copilot:kk-capture', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
