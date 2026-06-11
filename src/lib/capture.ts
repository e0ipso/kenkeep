import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
import type { RoleTaggedTranscript } from '../harnesses/types.js';
import { renderRoleTagged } from './transcript-render.js';
import { recordUsage } from './usage.js';

export type TranscriptParser = (text: string) => RoleTaggedTranscript;

export interface HookInput {
  session_id: string;
  transcript_path?: string;
  trigger?: CaptureTrigger;
  cwd?: string;
}

export type CaptureStatus = 'written' | 'no-content' | 'no-transcript';

export interface CaptureResult {
  status: CaptureStatus;
  sessionLogPath?: string;
  error?: string;
}

export interface CaptureContext {
  sessionsDir: string;
  parseTranscript: TranscriptParser;
  now?: () => Date;
  /**
   * Optional knowledge-base usage tracking. After the session log is written,
   * the file paths the agent read this turn are classified against `nodesDir`
   * and reconciled into `usageFile`. Read paths come from either `extractReads`
   * (run on the raw transcript text — the text-based harnesses) or a
   * precomputed `readPaths` (e.g. OpenCode, whose raw tool parts are not in the
   * transcript text). Best-effort and non-fatal.
   */
  usage?: {
    nodesDir: string;
    kkDir: string;
    usageFile: string;
    extractReads?: (rawText: string) => string[];
    readPaths?: string[];
  };
}

export async function captureSession(
  input: HookInput,
  ctx: CaptureContext
): Promise<CaptureResult> {
  const trigger = input.trigger ?? 'stop';
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return {
      status: 'no-transcript',
      error: `transcript_path missing or absent: ${transcriptPath ?? '(none)'}`,
    };
  }

  const transcriptText = readFileSync(transcriptPath, 'utf8');
  const parsed = ctx.parseTranscript(transcriptText);
  const slice = renderRoleTagged(parsed);
  if (!slice.trim()) {
    return { status: 'no-content' };
  }

  const hash = `sha256:${createHash('sha256').update(slice).digest('hex')}`;

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
    body: slice,
    ...(isCursory
      ? {
          proposalStatus: 'skipped' as const,
          proposalError: 'cursory_session',
          proposalCompletedAt: capturedAt,
        }
      : {}),
  });

  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);

  if (ctx.usage) {
    try {
      const readPaths =
        ctx.usage.readPaths ??
        (ctx.usage.extractReads ? ctx.usage.extractReads(transcriptText) : []);
      if (readPaths.length > 0) {
        await recordUsage({
          usageFile: ctx.usage.usageFile,
          nodesDir: ctx.usage.nodesDir,
          kkDir: ctx.usage.kkDir,
          sessionId,
          usedAt: capturedAt,
          readPaths,
        });
      }
    } catch (err) {
      // Usage tracking is best-effort: it must never fail or alter capture.
      process.stderr.write(
        `[kenkeep] usage tracking skipped: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  return {
    status: 'written',
    sessionLogPath,
  };
}
