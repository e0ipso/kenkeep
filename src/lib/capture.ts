import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDuplicate, recordHash } from './dedup-cache.js';
import type { SecretScanResult, SecretScanner } from './secret-scan.js';
import { scanAndRedact } from './secret-scan.js';
import { appendToQueue } from './queue.js';
import type { CaptureTrigger } from './schemas.js';
import { buildSessionLogFilename, renderSessionLog, writeSessionLog } from './session-log.js';
import { parseTranscriptJsonl, renderRoleTagged } from './transcript.js';

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  hook_event_name?: string;
  cwd?: string;
}

export type CaptureStatus =
  | 'written'
  | 'duplicate'
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
  const dedupCacheFile = join(ctx.sessionsDir, '.dedup-cache.json');
  const nowMs = (ctx.now?.() ?? new Date()).getTime();
  if (isDuplicate(dedupCacheFile, hash, nowMs)) {
    return { status: 'duplicate' };
  }

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
  const sessionId =
    typeof input.session_id === 'string' && input.session_id.length > 0
      ? input.session_id
      : hash.slice(7, 19);
  const filename = buildSessionLogFilename(capturedAt, sessionId);
  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    secretScanStatus: scanResult.status,
    body: scanResult.status === 'redacted' ? scanResult.redactedText : slice,
  });

  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);
  recordHash(dedupCacheFile, hash, nowMs);

  appendToQueue(join(ctx.sessionsDir, '.queue.json'), {
    session_id: sessionId,
    session_log: filename,
    captured_by: trigger,
    captured_at: capturedAt,
    attempts: 0,
  });

  return {
    status: 'written',
    sessionLogPath,
    secretScanStatus: scanResult.status,
  };
}
