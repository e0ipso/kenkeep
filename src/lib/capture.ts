import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
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

/**
 * Removes user-marked private spans before anything is persisted. Text
 * wrapped in `<kk-private>…</kk-private>` never reaches the session log,
 * the transcript hash, or the cursory-session stats. An UNCLOSED opening
 * tag strips to the end of that message — privacy-first: a typo must fail
 * toward removing too much, never too little. This is explicit user-intent
 * marking, not a secret scanner; the PRD's human-review gate (Goal 6)
 * remains the safeguard for everything unmarked.
 */
export const PRIVATE_SPAN_PLACEHOLDER = '[kk-private removed]';

export function stripPrivateSpans(text: string): string {
  return text
    .replace(/<kk-private>[\s\S]*?<\/kk-private>/g, PRIVATE_SPAN_PLACEHOLDER)
    .replace(/<kk-private>[\s\S]*$/, PRIVATE_SPAN_PLACEHOLDER);
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
  for (const seg of parsed.interleaved) {
    seg.text = stripPrivateSpans(seg.text);
  }
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

  interface CuratedPreserve {
    curatorProcessedAt: string;
    curatorRunId?: string | undefined;
    proposalStatus?: 'done' | 'failed' | 'skipped' | undefined;
    proposalCompletedAt?: string | null | undefined;
    proposalError?: string | null | undefined;
    proposals?: { practice: unknown[]; map: unknown[] } | undefined;
    topics?: string[] | undefined;
  }

  let curatedPreserve: CuratedPreserve | undefined;
  if (existingFilename) {
    const existingPath = join(ctx.sessionsDir, existingFilename);
    try {
      const parsed = matter(readFileSync(existingPath, 'utf8'));
      const data = parsed.data as Record<string, unknown>;
      if (
        typeof data['curator_processed_at'] === 'string' &&
        data['curator_processed_at'].length > 0
      ) {
        const preserve: CuratedPreserve = {
          curatorProcessedAt: data['curator_processed_at'],
        };
        if (typeof data['curator_run_id'] === 'string') {
          preserve.curatorRunId = data['curator_run_id'];
        }
        if (typeof data['proposal_status'] === 'string') {
          preserve.proposalStatus = data['proposal_status'] as NonNullable<
            CuratedPreserve['proposalStatus']
          >;
        }
        if (data['proposal_completed_at'] !== undefined) {
          preserve.proposalCompletedAt = data['proposal_completed_at'] as string | null;
        }
        if (data['proposal_error'] !== undefined) {
          preserve.proposalError = data['proposal_error'] as string | null;
        }
        if (data['proposals'] && typeof data['proposals'] === 'object') {
          const proposals = data['proposals'] as { practice?: unknown; map?: unknown };
          preserve.proposals = {
            practice: Array.isArray(proposals.practice) ? proposals.practice : [],
            map: Array.isArray(proposals.map) ? proposals.map : [],
          };
        }
        if (Array.isArray(data['topics'])) {
          preserve.topics = data['topics'] as string[];
        }
        curatedPreserve = preserve;
      }
    } catch {
      // Best-effort: if the existing log cannot be read, refresh as today.
    }
  }

  const curatedInput = curatedPreserve
    ? {
        ...(curatedPreserve.proposalStatus !== undefined
          ? { proposalStatus: curatedPreserve.proposalStatus }
          : {}),
        ...(curatedPreserve.proposalCompletedAt !== undefined
          ? { proposalCompletedAt: curatedPreserve.proposalCompletedAt }
          : {}),
        ...(curatedPreserve.proposalError !== undefined
          ? { proposalError: curatedPreserve.proposalError }
          : {}),
        ...(curatedPreserve.proposals !== undefined
          ? { proposals: curatedPreserve.proposals }
          : {}),
        curatorProcessedAt: curatedPreserve.curatorProcessedAt,
        ...(curatedPreserve.curatorRunId !== undefined
          ? { curatorRunId: curatedPreserve.curatorRunId }
          : {}),
        ...(curatedPreserve.topics !== undefined ? { topics: curatedPreserve.topics } : {}),
      }
    : isCursory
      ? {
          proposalStatus: 'skipped' as const,
          proposalError: 'cursory_session',
          proposalCompletedAt: capturedAt,
        }
      : {};

  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    body: slice,
    ...curatedInput,
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
