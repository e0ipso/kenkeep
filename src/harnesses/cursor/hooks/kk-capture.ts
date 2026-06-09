/**
 * Capture hook for the Cursor adapter (stop, sessionEnd, preCompact).
 *
 * Normalizes Cursor stdin (`conversation_id`, camelCase event names) at
 * the adapter boundary and delegates to the shared capture pipeline.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput } from '../../../lib/capture.js';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { readStdin } from '../../../lib/stdin.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import { normalizeCursorConversationId } from '../session-id.js';
import { parseCursorTranscript } from '../transcript.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[kenkeep]';

const CURSOR_EVENT_TO_HOOK: Record<string, string> = {
  stop: 'Stop',
  sessionEnd: 'SessionEnd',
  preCompact: 'PreCompact',
};

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
    appendHookDiagnostic('cursor:kk-capture', 'parse', err, paths.logsDir);
    return;
  }

  const workspaceRoots = payload['workspace_roots'];
  const startCwd =
    Array.isArray(workspaceRoots) &&
    typeof workspaceRoots[0] === 'string' &&
    workspaceRoots[0].length > 0
      ? (workspaceRoots[0] as string)
      : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.kkDir)) return;

  try {
    const conversationId =
      typeof payload['conversation_id'] === 'string' ? payload['conversation_id'] : '';
    if (!conversationId) return;
    const sessionId = assertValidSessionId(normalizeCursorConversationId(conversationId));

    let transcriptPath =
      typeof payload['transcript_path'] === 'string' && payload['transcript_path'].length > 0
        ? (payload['transcript_path'] as string)
        : process.env['CURSOR_TRANSCRIPT_PATH'];
    if (!transcriptPath || !existsSync(transcriptPath)) {
      const fallback = locateTranscriptByConversationId(conversationId);
      if (fallback !== null) transcriptPath = fallback;
    }

    const hookEvent =
      typeof payload['hook_event_name'] === 'string'
        ? (CURSOR_EVENT_TO_HOOK[payload['hook_event_name']] ?? payload['hook_event_name'])
        : undefined;

    const input: HookInput = {
      session_id: sessionId,
      ...(transcriptPath ? { transcript_path: transcriptPath } : {}),
      ...(hookEvent ? { hook_event_name: hookEvent } : {}),
      cwd: startCwd,
    };
    process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
    await captureSession(input, {
      sessionsDir: paths.sessionsDir,
      parseTranscript: parseCursorTranscript,
    });
    process.stderr.write('💾 kenkeep Capture: Session transcript saved.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

function locateTranscriptByConversationId(conversationId: string): string | null {
  const projectsRoot = join(homedir(), '.cursor', 'projects');
  if (!existsSync(projectsRoot)) return null;
  let newest: { path: string; mtime: number } | null = null;
  for (const projectDir of readdirSync(projectsRoot)) {
    const transcriptsDir = join(projectsRoot, projectDir, 'agent-transcripts');
    if (!existsSync(transcriptsDir)) continue;
    newest = findNewestMatching(transcriptsDir, conversationId, newest);
  }
  return newest?.path ?? null;
}

function findNewestMatching(
  dir: string,
  conversationId: string,
  current: { path: string; mtime: number } | null
): { path: string; mtime: number } | null {
  let newest = current;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return newest;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      newest = findNewestMatching(full, conversationId, newest);
      continue;
    }
    if (!name.includes(conversationId) || !name.endsWith('.jsonl')) continue;
    if (!newest || st.mtimeMs > newest.mtime) {
      newest = { path: full, mtime: st.mtimeMs };
    }
  }
  return newest;
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('cursor:kk-capture', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
