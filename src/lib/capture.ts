import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { SecretScanResult, SecretScanner } from './secret-scan.js';
import { scanAndRedact } from './secret-scan.js';
import type { CaptureTrigger } from './schemas.js';
import {
  buildSessionLogFilename,
  findSessionLogBySessionId,
  renderSessionLog,
  writeSessionLog,
} from './session-log.js';
import {
  CURSORY_MAX_AGENT_CHARS,
  CURSORY_MAX_USER_CHARS,
  CURSORY_MAX_USER_TURNS,
} from './settings.js';
import { parseTranscriptJsonl, renderRoleTagged } from './transcript.js';

export interface HookInput {
  session_id: string;
  transcript_path?: string;
  hook_event_name?: string;
  cwd?: string;
}

export type CaptureStatus =
  | 'written'
  | 'no-content'
  | 'no-transcript'
  | 'secret-scan-blocked';

export interface CaptureResult {
  status: CaptureStatus;
  sessionLogPath?: string;
  secretScanStatus?: SecretScanResult['status'];
  error?: string;
}

export interface CaptureContext {
  sessionsDir: string;
  now?: () => Date;
  scan?: SecretScanner;
  scanTimeoutMs?: number;
}

const HOOK_EVENT_TO_TRIGGER: Record<string, CaptureTrigger> = {
  Stop: 'stop',
  SessionEnd: 'session_end',
  PreCompact: 'pre_compact',
};

export function eventToTrigger(event: string | undefined): CaptureTrigger {
  if (event && HOOK_EVENT_TO_TRIGGER[event]) {
    return HOOK_EVENT_TO_TRIGGER[event];
  }
  return 'stop';
}

export async function captureSession(
  input: HookInput,
  ctx: CaptureContext
): Promise<CaptureResult> {
  const trigger = eventToTrigger(input.hook_event_name);
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return {
      status: 'no-transcript',
      error: `transcript_path missing or absent: ${transcriptPath ?? '(none)'}`,
    };
  }

  const transcriptText = readFileSync(transcriptPath, 'utf8');
  const parsed = parseTranscriptJsonl(transcriptText);
  const slice = renderRoleTagged(parsed);
  if (!slice.trim()) {
    return { status: 'no-content' };
  }

  const hash = `sha256:${createHash('sha256').update(slice).digest('hex')}`;

  const scan = ctx.scan ?? ((text: string) => scanAndRedact(text, ctx.scanTimeoutMs ?? 1000));
  const scanResult = await scan(slice);
  if (scanResult.status === 'blocked') {
    return {
      status: 'secret-scan-blocked',
      secretScanStatus: 'blocked',
      ...(scanResult.error !== undefined ? { error: scanResult.error } : {}),
    };
  }

  const capturedAt = (ctx.now?.() ?? new Date()).toISOString();
  const sessionId = input.session_id;
  // Stop fires per-turn, so a multi-turn session would otherwise produce one
  // log file per turn. Reuse the existing file for this session_id; the new
  // transcript is a superset of the previous capture.
  const existingFilename = findSessionLogBySessionId(ctx.sessionsDir, sessionId);
  const filename = existingFilename ?? buildSessionLogFilename(capturedAt, sessionId);

  let userTurns = 0;
  let userChars = 0;
  let agentChars = 0;
  for (const seg of parsed.interleaved) {
    if (seg.role === 'user') {
      userTurns += 1;
      userChars += seg.text.length;
    } else if (seg.role === 'agent') {
      agentChars += seg.text.length;
    }
  }
  const isCursory =
    userTurns <= CURSORY_MAX_USER_TURNS &&
    userChars <= CURSORY_MAX_USER_CHARS &&
    agentChars <= CURSORY_MAX_AGENT_CHARS;

  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    secretScanStatus: scanResult.status,
    body: scanResult.status === 'redacted' ? scanResult.redactedText : slice,
    ...(isCursory
      ? {
          proposalStatus: 'skipped' as const,
          proposalError: 'cursory_session',
          proposalCompletedAt: capturedAt,
        }
      : {}),
  });

  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);

  return {
    status: 'written',
    sessionLogPath,
    secretScanStatus: scanResult.status,
  };
}
