/**
 * Stop / SessionEnd / PreCompact hook.
 *
 * Runs the deterministic stage-1 capture pipeline: dedup, gitleaks redact,
 * write session log, append to queue. Must complete within 1 second on any
 * trigger; if the wall-clock deadline elapses, exits silently to avoid
 * blocking session shutdown.
 */
import { captureSession, type HookInput } from '../lib/capture.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  // Recursion guard: when stage-2 (M2) spawns `claude -p`, the child
  // process may itself trigger Stop/PreCompact hooks. We disable the
  // hook in those subprocesses by checking this env var.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  // Hard wall-clock deadline. unref() so timer doesn't prevent natural exit.
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: HookInput = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as HookInput;
    } catch {
      return;
    }
  }

  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  ensureStateLayout(paths);

  try {
    const result = await captureSession(input, { sessionsDir: paths.sessionsDir });
    if (result.status === 'gitleaks-blocked') {
      process.stderr.write(
        `${PACKAGE_TAG} gitleaks blocked stage-1 capture: ${result.error ?? 'unknown error'}\n`,
      );
    }
    // All other statuses are intentionally silent. `ai-knowledge-base status`
    // surfaces pending counts when the user wants to check.
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
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
