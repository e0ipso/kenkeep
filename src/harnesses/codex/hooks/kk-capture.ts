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
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import { parseCodexTranscript } from '../transcript.js';
import { extractCodexReads } from '../../read-extract.js';
import { assertValidCodexSessionId } from '../session-id.js';

const PACKAGE_TAG = '[kenkeep]';

/**
 * Codex capture events mapped to canonical triggers. `Stop` fires per turn;
 * `PreCompact` (added to Codex by 0.139) fires before context compaction —
 * the same about-to-lose-context moment the Claude and Cursor adapters
 * capture on.
 */
export const CODEX_EVENT_TO_TRIGGER = {
  Stop: 'stop',
  PreCompact: 'pre_compact',
} as const satisfies Record<string, CaptureTrigger>;

function triggerFor(payload: Record<string, unknown>): CaptureTrigger {
  const event = payload['event'] ?? payload['hook_event_name'];
  if (typeof event === 'string' && event in CODEX_EVENT_TO_TRIGGER) {
    return CODEX_EVENT_TO_TRIGGER[event as keyof typeof CODEX_EVENT_TO_TRIGGER];
  }
  return 'stop';
}

runHookEntry({
  tag: 'codex:kk-capture',
  deadlineMs: 1000,
  requirePayload: true,
  invalidJson: 'ignore',
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);

    try {
      const sessionId = assertValidCodexSessionId(payload['session_id']);
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
        trigger: triggerFor(payload),
        ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
      };
      process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
      await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: parseCodexTranscript,
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          extractReads: extractCodexReads,
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
