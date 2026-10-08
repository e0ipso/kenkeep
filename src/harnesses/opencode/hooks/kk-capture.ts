/**
 * session.idle handler for the OpenCode adapter.
 *
 * Sources the transcript and read usage from `opencode export <sessionID>`:
 * spawns the export CLI into a private temp directory, parses its JSON
 * document, shapes the messages into a role-tagged transcript, extracts the
 * read-tool paths, and feeds both through the shared capture pipeline with the
 * export document itself as the transcript source. Export is the sole, primary
 * source; there is no on-disk file-tree fallback.
 *
 * Temp-file lifecycle: the export document is OpenCode's own stdout,
 * captured to a file because the CLI does not flush a pipe (see
 * `runOpenCodeExport`). That directory is the only thing this hook writes
 * outside the knowledge base; it is removed in `finally` on success, thrown
 * failure and export timeout, and additionally on process exit so a
 * cooperative-deadline exit mid-capture cannot leak it. kenkeep never writes
 * its own copy of the transcript: the only transcript it produces on disk is
 * the session log, written after `<kk-private>` spans are stripped.
 *
 * Time bound: the scaffold's 8 s deadline is cooperative and cannot
 * interrupt the synchronous export, so the export child's own timeout is
 * derived from the remaining budget (minus a reserve for parsing and the
 * capture write) and is therefore always inside the outer deadline.
 *
 * Always exits 0 so a stalled lookup never blocks the plugin's event
 * loop (per `feedback_hide_cosmetic_shell_errors`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput, type TranscriptParser } from '../../../lib/capture.js';
import { captureOutcomeMessage, captureSkippedMessage } from '../../../lib/capture-report.js';
import { runHookEntry, type HookBudget } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import type { CaptureTrigger } from '../../../lib/schemas.js';
import type { RoleTaggedTranscript } from '../../types.js';
import { normalizeOpenCodeSessionId } from '../session-id.js';
import { extractOpenCodeReads } from '../../read-extract.js';

/**
 * Measured `opencode export` latency is 1.4–3.0 s. 8 s leaves headroom; safe
 * because plugins/kk.ts spawns the capture child fire-and-forget.
 */
const OPENCODE_CAPTURE_DEADLINE_MS = 8000;
/** Budget kept back from the export timeout for parsing, shaping and the capture write. */
const CAPTURE_RESERVE_MS = 1000;
/** Upper bound on the `opencode --version` probe, further capped by the remaining budget. */
const VERSION_PROBE_TIMEOUT_MS = 5000;
const PACKAGE_TAG = '[kenkeep]';

/** OpenCode's lifecycle event is `session.idle`; map it to the canonical trigger. */
export const OPENCODE_EVENT_TO_TRIGGER = {
  'session.idle': 'stop',
} as const satisfies Record<string, CaptureTrigger>;

/** The export document is the transcript source; `captureSession` re-reads it from disk. */
const parseExportedTranscript: TranscriptParser = text =>
  shapeExportedTranscript(JSON.parse(text) as unknown);

runHookEntry({
  tag: 'opencode:kk-capture',
  deadlineMs: OPENCODE_CAPTURE_DEADLINE_MS,
  requirePayload: true,
  main: async (payload, _raw, budget) => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);

    let exportDir: string | undefined;
    const cleanup = (): void => {
      if (exportDir !== undefined) rmSync(exportDir, { recursive: true, force: true });
    };
    process.once('exit', cleanup);
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
      exportDir = mkdtempSync(join(tmpdir(), 'kk-oc-export-'));
      const exported = runOpenCodeExport(
        typeof rawId === 'string' ? rawId : sessionId,
        exportDir,
        budget
      );
      if (!exported) {
        process.stderr.write(
          `${captureSkippedMessage('opencode export unavailable, failed or timed out')}\n`
        );
        return;
      }

      const transcript = shapeExportedTranscript(exported.json);
      if (transcript.interleaved.length === 0) {
        process.stderr.write(`${captureSkippedMessage('export has no transcript text')}\n`);
        return;
      }

      const readPaths = extractOpenCodeReads(exported.json);
      const input: HookInput = {
        session_id: sessionId,
        transcript_path: exported.path,
        trigger: OPENCODE_EVENT_TO_TRIGGER['session.idle'],
        ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
      };
      process.stderr.write('📸 kenkeep Capture: Saving session transcript…\n');
      const result = await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: parseExportedTranscript,
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          readPaths,
        },
      });
      process.stderr.write(`${captureOutcomeMessage(result)}\n`);
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    } finally {
      process.off('exit', cleanup);
      cleanup();
    }
  },
});

interface ExportedDocument {
  /** Absolute path of the captured export document inside the private temp dir. */
  path: string;
  /** The parsed raw `{ info, messages }` shape. */
  json: unknown;
}

/**
 * Runs `opencode export <sessionID>` into `exportDir` and returns the captured
 * document (path plus parsed JSON) or `null` when the CLI is unavailable, the
 * budget is already too short to run it, the export fails or times out, or the
 * output is not valid JSON. The `opencode --version` probe avoids hanging when
 * the binary is absent.
 *
 * The export is captured by redirecting the child's stdout to a temp FILE
 * rather than a pipe: on OpenCode v1.17.3 the CLI exits before fully flushing
 * its stdout to a pipe, so `spawnSync({ encoding: 'utf8' })` returns truncated,
 * unparseable JSON (measured: ~145 KB of a ~230 KB document, every run). A file
 * fd flushes completely, so the full document is captured. Verified end-to-end
 * against a real OpenCode v1.17.3 session.
 *
 * Both child timeouts are cut from the hook's remaining budget and end the
 * child with SIGKILL, which it cannot ignore, so the synchronous spawn can
 * never outlive the (cooperative) outer deadline. SIGTERM would not do: Node
 * waits for the child to exit, and a child that ignores SIGTERM keeps the
 * hook blocked past its deadline with the export directory still on disk.
 */
function runOpenCodeExport(
  sessionId: string,
  exportDir: string,
  budget: HookBudget
): ExportedDocument | null {
  // The guard travels on the export child (not on this hook's own env): if
  // `opencode export` ever loads project plugins, the plugin's host-env check
  // makes it a no-op instead of re-entering the dispatch loop.
  const childEnv = { ...process.env, KENKEEP_BUILDER_INTERNAL: '1' };
  const probeTimeoutMs = Math.min(VERSION_PROBE_TIMEOUT_MS, budget.remainingMs());
  if (probeTimeoutMs <= 0) return null;
  try {
    execFileSync('opencode', ['--version'], {
      timeout: probeTimeoutMs,
      killSignal: 'SIGKILL',
      stdio: 'ignore',
      env: childEnv,
    });
  } catch {
    return null;
  }
  const exportTimeoutMs = budget.remainingMs() - CAPTURE_RESERVE_MS;
  if (exportTimeoutMs <= 0) return null;
  const exportPath = join(exportDir, 'export.json');
  const fd = openSync(exportPath, 'w');
  let status: number | null;
  try {
    const run = spawnSync('opencode', ['export', sessionId], {
      ...(Number.isFinite(exportTimeoutMs)
        ? { timeout: exportTimeoutMs, killSignal: 'SIGKILL' as const }
        : {}),
      stdio: ['ignore', fd, 'ignore'],
      env: childEnv,
    });
    status = run.status;
  } finally {
    closeSync(fd);
  }
  if (status !== 0) return null;
  try {
    const raw = readFileSync(exportPath, 'utf8');
    if (raw.length === 0) return null;
    return { path: exportPath, json: JSON.parse(raw) as unknown };
  } catch {
    return null;
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
