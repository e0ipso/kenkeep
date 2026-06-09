/**
 * Stop hook for the Codex CLI adapter.
 *
 * Codex's hook payload does not carry a `transcript_path`; instead the CLI
 * writes rollout JSONL files under `${CODEX_HOME ?? ~/.codex}/sessions/
 * YYYY/MM/DD/rollout-*-<session_id>.jsonl`. This script locates the rollout,
 * runs it through the shared capture pipeline (parse, write
 * session log), and exits 0 unconditionally so a stalled lookup never blocks
 * the Codex Stop event.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { readStdin } from '../../../lib/stdin.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import { parseCodexTranscript } from '../transcript.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[kenkeep]';

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
    appendHookDiagnostic('codex:kk-capture', 'parse', err, paths.logsDir);
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
    const homeRoot = process.env['CODEX_HOME'] ?? join(homedir(), '.codex');
    const rolloutPath = locateRollout(homeRoot, sessionId);
    if (rolloutPath === null) {
      // The rollout JSONL may not have been flushed yet, or the session
      // happened on a different machine. Exit silently per
      // feedback_hide_cosmetic_shell_errors.
      return;
    }
    const input: HookInput = {
      session_id: sessionId,
      transcript_path: rolloutPath,
      hook_event_name: 'Stop',
      ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
    };
    process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
    await captureSession(input, {
      sessionsDir: paths.sessionsDir,
      parseTranscript: parseCodexTranscript,
    });
    process.stderr.write('💾 kenkeep Capture: Session transcript saved.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Locates the Codex rollout JSONL for `sessionId`. Tries today's UTC date
 * first, then yesterday's, and finally scans today's directory for any
 * `rollout-*.jsonl` whose first line is a `session_meta` with a matching
 * `payload.id`. Returns the absolute path or null if nothing matches.
 */
function locateRollout(homeRoot: string, sessionId: string): string | null {
  const sessionsRoot = join(homeRoot, 'sessions');
  if (!existsSync(sessionsRoot)) return null;
  const today = new Date();
  const todayDir = sessionsDirForDate(sessionsRoot, today);
  const direct = findByFilename(todayDir, sessionId);
  if (direct !== null) return direct;

  const yesterday = new Date(today.getTime() - 86_400_000);
  const yesterdayDir = sessionsDirForDate(sessionsRoot, yesterday);
  const fromYesterday = findByFilename(yesterdayDir, sessionId);
  if (fromYesterday !== null) return fromYesterday;

  return findBySessionMeta(todayDir, sessionId);
}

function sessionsDirForDate(sessionsRoot: string, when: Date): string {
  const y = when.getUTCFullYear().toString();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  return join(sessionsRoot, y, m, d);
}

function findByFilename(dir: string, sessionId: string): string | null {
  if (!existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const suffix = `-${sessionId}.jsonl`;
  for (const name of entries) {
    if (name.startsWith('rollout-') && name.endsWith(suffix)) {
      return join(dir, name);
    }
  }
  return null;
}

function findBySessionMeta(dir: string, sessionId: string): string | null {
  if (!existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (!name.startsWith('rollout-') || !name.endsWith('.jsonl')) continue;
    const full = join(dir, name);
    let firstLine: string;
    try {
      const text = readFileSync(full, 'utf8');
      const nl = text.indexOf('\n');
      firstLine = nl === -1 ? text : text.slice(0, nl);
    } catch {
      continue;
    }
    if (firstLine.length === 0) continue;
    try {
      const parsed = JSON.parse(firstLine) as {
        type?: string;
        payload?: { id?: string };
      };
      if (parsed.type === 'session_meta' && parsed.payload?.id === sessionId) {
        return full;
      }
    } catch {
      continue;
    }
  }
  return null;
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('codex:kk-capture', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
