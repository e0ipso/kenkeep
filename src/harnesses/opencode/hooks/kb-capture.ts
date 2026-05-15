/**
 * session.idle handler for the OpenCode adapter.
 *
 * Parses the on-disk OpenCode session storage into a role-tagged
 * transcript and feeds it through the shared capture pipeline. When the
 * disk parse yields zero turns or the session directory is missing,
 * falls back to spawning `opencode export <sessionID>` and parsing its
 * JSON output through the same shape adapter.
 *
 * Always exits 0 so a stalled lookup never blocks the plugin's event
 * loop (per `feedback_hide_cosmetic_shell_errors`).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSession, type HookInput, type TranscriptParser } from '../../../lib/capture.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { assertValidSessionId } from '../../../lib/session-log.js';
import type { RoleTaggedTranscript } from '../../types.js';
import { defaultOpenCodeStorageDir, parseOpenCodeTranscript } from '../transcript.js';

const HARD_DEADLINE_MS = 1000;
const EXPORT_TIMEOUT_MS = 30_000;
const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

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
    const storageDir = defaultOpenCodeStorageDir();

    let transcript = parseOpenCodeTranscript(storageDir, sessionId);
    if (transcript.interleaved.length === 0) {
      const fromExport = exportFallback(sessionId);
      if (fromExport) transcript = fromExport;
    }
    if (transcript.interleaved.length === 0) return;

    const tmpRoot = mkdtempSync(join(tmpdir(), 'kb-opencode-'));
    const transcriptFile = join(tmpRoot, 'transcript.json');
    writeFileSync(transcriptFile, JSON.stringify(transcript));

    const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;
    const input: HookInput = {
      session_id: sessionId,
      transcript_path: transcriptFile,
      hook_event_name: 'Stop',
      ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] as string } : {}),
    };
    const result = await captureSession(input, {
      sessionsDir: paths.sessionsDir,
      parseTranscript: parser,
    });
    if (result.status === 'secret-scan-blocked') {
      process.stderr.write(
        `${PACKAGE_TAG} secret scan blocked transcript capture: ${result.error ?? 'unknown error'}\n`
      );
    }
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

/**
 * Falls back to `opencode export <sessionID>` when the disk parse fails.
 * OpenCode's export CLI returns a JSON document with messages and parts;
 * we coerce it through the same parser shape by writing it into a
 * temporary storage tree, then re-running the disk parser against the
 * tree. This keeps a single transcript-extraction path.
 */
function exportFallback(sessionId: string): RoleTaggedTranscript | null {
  try {
    execFileSync('opencode', ['--version'], { timeout: 5000, stdio: 'ignore' });
  } catch {
    return null;
  }
  const run = spawnSync('opencode', ['export', sessionId], {
    timeout: EXPORT_TIMEOUT_MS,
    encoding: 'utf8',
  });
  if (run.status !== 0 || !run.stdout) return null;
  let exported: unknown;
  try {
    exported = JSON.parse(run.stdout);
  } catch {
    return null;
  }
  return shapeExportedTranscript(exported);
}

interface ExportedMessage {
  role?: 'user' | 'assistant' | string;
  parts?: Array<{ type?: string; text?: string }>;
  time?: { created?: number };
}

interface ExportedSession {
  messages?: ExportedMessage[];
}

/**
 * Coerces the `opencode export` JSON shape into a role-tagged transcript.
 * The export format documents a `messages: [{ role, parts: [{ type, text }] }]`
 * structure; we only consume `type === 'text'` parts.
 */
function shapeExportedTranscript(json: unknown): RoleTaggedTranscript {
  const out: RoleTaggedTranscript = { interleaved: [] };
  if (!json || typeof json !== 'object') return out;
  const session = json as ExportedSession;
  if (!Array.isArray(session.messages)) return out;
  const sorted = [...session.messages].sort(
    (a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0)
  );
  for (const message of sorted) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const text = parts
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text as string)
      .filter(s => s.length > 0)
      .join('\n');
    if (!text) continue;
    out.interleaved.push({ role: message.role === 'user' ? 'user' : 'agent', text });
  }
  return out;
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
