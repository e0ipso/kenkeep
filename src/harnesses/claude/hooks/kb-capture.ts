/**
 * Stop / SessionEnd / PreCompact hook for the Claude Code adapter.
 *
 * Runs the deterministic transcript capture pipeline: secret-scan redact,
 * write session log, append to queue. Must complete within 1 second on any
 * trigger; if the wall-clock deadline elapses, exits silently to avoid
 * blocking session shutdown.
 */
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  // Recursion guard: when the proposal drain (M2) spawns `claude -p`, the
  // child process may itself trigger Stop/PreCompact hooks. We disable the
  // hook in those subprocesses by checking this env var.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  // Hard wall-clock deadline. unref() so timer doesn't prevent natural exit.
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  if (raw.trim().length === 0) return;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  const startCwd =
    typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
      ? (payload['cwd'] as string)
      : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);

  try {
    const sessionId = assertValidSessionId(payload['session_id']);
    const input: HookInput = {
      session_id: sessionId,
      ...(typeof payload['transcript_path'] === 'string'
        ? { transcript_path: payload['transcript_path'] as string }
        : {}),
      ...(typeof payload['hook_event_name'] === 'string'
        ? { hook_event_name: payload['hook_event_name'] as string }
        : {}),
      ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
    };
    const result = await captureSession(input, { sessionsDir: paths.sessionsDir });
    if (result.status === 'secret-scan-blocked') {
      process.stderr.write(
        `${PACKAGE_TAG} secret scan blocked transcript capture: ${result.error ?? 'unknown error'}\n`
      );
    }
    // All other statuses are intentionally silent. `ai-knowledge-base status`
    // surfaces pending counts when the user wants to check.
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

void main().catch(() => process.exit(0));
