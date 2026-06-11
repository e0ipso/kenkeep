/**
 * session.idle handler for the OpenCode adapter.
 *
 * Sources the transcript and read usage from `opencode export <sessionID>`:
 * spawns the export CLI, parses its JSON document once, shapes the messages
 * into a role-tagged transcript, extracts the read-tool paths, and feeds both
 * through the shared capture pipeline. Export is the sole, primary source —
 * there is no on-disk file-tree fallback.
 *
 * Always exits 0 so a stalled lookup never blocks the plugin's event
 * loop (per `feedback_hide_cosmetic_shell_errors`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput, type TranscriptParser } from '../../../lib/capture.js';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { readStdin } from '../../../lib/stdin.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import type { RoleTaggedTranscript } from '../../types.js';
import { normalizeOpenCodeSessionId } from '../session-id.js';
import { extractOpenCodeReads } from '../../read-extract.js';

// Measured `opencode export` latency is 1.4–3.0s (exceeds the previous 1s
// deadline). 8s leaves comfortable headroom; safe because plugins/kk.ts spawns
// the capture child fire-and-forget without awaiting it.
const HARD_DEADLINE_MS = 8000;
const EXPORT_TIMEOUT_MS = 30_000;
const PACKAGE_TAG = '[kenkeep]';

/** OpenCode's lifecycle event is `session.idle`; map it to the canonical trigger. */
export const OPENCODE_EVENT_TO_TRIGGER = {
  'session.idle': 'stop',
} as const satisfies Record<string, CaptureTrigger>;

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
    appendHookDiagnostic('opencode:kk-capture', 'parse', err, paths.logsDir);
    return;
  }

  const startCwd =
    typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
      ? (payload['cwd'] as string)
      : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);

  try {
    // The plugin passes the raw `ses_...` session id (see plugins/kk.ts);
    // normalize it to the UUID-shaped form the session log expects, then
    // validate. A genuinely bad value still throws into the catch below.
    const rawId = payload['session_id'];
    const normalized = typeof rawId === 'string' ? normalizeOpenCodeSessionId(rawId) : rawId;
    const sessionId = assertValidSessionId(normalized);

    // `opencode export` keys on the ORIGINAL `ses_...` id; the normalized UUID
    // (`sessionId`) is only the kenkeep session-log identity. `rawId` is a
    // string here — otherwise `assertValidSessionId` above would have thrown.
    const exportJson = runOpenCodeExport(typeof rawId === 'string' ? rawId : sessionId);
    if (!exportJson) return;

    const transcript = shapeExportedTranscript(exportJson);
    if (transcript.interleaved.length === 0) return;

    const readPaths = extractOpenCodeReads(exportJson);

    const tmpRoot = mkdtempSync(join(tmpdir(), 'kk-opencode-'));
    const transcriptFile = join(tmpRoot, 'transcript.json');
    writeFileSync(transcriptFile, JSON.stringify(transcript));

    const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;
    const input: HookInput = {
      session_id: sessionId,
      transcript_path: transcriptFile,
      trigger: OPENCODE_EVENT_TO_TRIGGER['session.idle'],
      ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
    };
    process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
    await captureSession(input, {
      sessionsDir: paths.sessionsDir,
      parseTranscript: parser,
      usage: {
        nodesDir: paths.nodesDir,
        kkDir: paths.kkDir,
        usageFile: paths.usageFile,
        readPaths,
      },
    });
    process.stderr.write('💾 kenkeep Capture: Session transcript saved.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Runs `opencode export <sessionID>` and returns the parsed JSON document
 * (the raw `{ info, messages }` shape) or `null` when the CLI is unavailable,
 * the export fails, or the output is not valid JSON. The `opencode --version`
 * probe avoids hanging when the binary is absent.
 *
 * The export is captured by redirecting the child's stdout to a temp FILE
 * rather than a pipe: on OpenCode v1.17.3 the CLI exits before fully flushing
 * its stdout to a pipe, so `spawnSync({ encoding: 'utf8' })` returns truncated,
 * unparseable JSON (measured: ~145 KB of a ~230 KB document, every run). A file
 * fd flushes completely, so the full document is captured. Verified end-to-end
 * against a real OpenCode v1.17.3 session.
 */
function runOpenCodeExport(sessionId: string): unknown | null {
  try {
    execFileSync('opencode', ['--version'], { timeout: 5000, stdio: 'ignore' });
  } catch {
    return null;
  }
  const tmpRoot = mkdtempSync(join(tmpdir(), 'kk-oc-export-'));
  const exportPath = join(tmpRoot, 'export.json');
  const fd = openSync(exportPath, 'w');
  let status: number | null;
  try {
    const run = spawnSync('opencode', ['export', sessionId], {
      timeout: EXPORT_TIMEOUT_MS,
      stdio: ['ignore', fd, 'ignore'],
    });
    status = run.status;
  } finally {
    closeSync(fd);
  }
  try {
    if (status !== 0) return null;
    const raw = readFileSync(exportPath, 'utf8');
    if (raw.length === 0) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

interface ExportedMessage {
  info?: { role?: string; time?: { created?: number } };
  parts?: Array<{ type?: string; text?: string }>;
}

interface ExportedSession {
  messages?: ExportedMessage[];
}

/**
 * Coerces the `opencode export` JSON shape into a role-tagged transcript.
 *
 * Shape measured against OpenCode v1.17.3 `opencode export`: the document is
 * `{ info, messages: [{ info: { role, time: { created } }, parts: [...] }] }`.
 * The role lives at `message.info.role` ("user" | "assistant") and the sort
 * timestamp at `message.info.time.created` (epoch ms) — NOT on `message`
 * directly. Only `type === 'text'` parts carry transcript text.
 */
function shapeExportedTranscript(json: unknown): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  if (!json || typeof json !== 'object') return out;
  const session = json as ExportedSession;
  if (!Array.isArray(session.messages)) return out;
  const sorted = [...session.messages].sort(
    (a, b) => (a.info?.time?.created ?? 0) - (b.info?.time?.created ?? 0)
  );
  for (const message of sorted) {
    const role = message.info?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text as string)
      .filter(s => s.length > 0)
      .join('\n');
    if (!text) continue;
    out.interleaved.push({ role: role === 'user' ? 'user' : 'agent', text });
  }
  return out;
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('opencode:kk-capture', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
