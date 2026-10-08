import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { CaptureTrigger } from './schemas.js';
import type { SessionLogInput } from './session-log.js';
import {
  buildSessionLogFilename,
  curationState,
  findSessionLogBySessionId,
  renderSessionLog,
  withSessionLogLock,
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

/**
 * `unchanged`: an existing log for this session already holds a transcript
 * with the same hash, so nothing was rewritten (a duplicate Stop/SessionEnd,
 * or a re-fire with no new turns). Its extraction and curation state is
 * untouched.
 */
export type CaptureStatus = 'written' | 'unchanged' | 'no-content' | 'no-transcript';

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
 * the transcript hash, or the cursory-session stats. Spans nest: a span ends
 * at the closing tag that matches its own opening tag, so an inner span never
 * ends the outer one early. An UNCLOSED opening tag strips to the end of that
 * message: privacy-first, a typo must fail toward removing too much, never
 * too little. A closing tag with no open span is left as text. This is
 * explicit user-intent marking, not a secret scanner; the PRD's human-review
 * gate (Goal 6) remains the safeguard for everything unmarked.
 */
export const PRIVATE_SPAN_PLACEHOLDER = '[kk-private removed]';

const PRIVATE_TAG_RE = /<(\/?)kk-private>/g;

export function stripPrivateSpans(text: string): string {
  let out = '';
  let depth = 0;
  let kept = 0;
  for (const match of text.matchAll(PRIVATE_TAG_RE)) {
    const closing = match[1] === '/';
    if (!closing) {
      if (depth === 0) out += text.slice(kept, match.index);
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0) {
        out += PRIVATE_SPAN_PLACEHOLDER;
        kept = match.index + match[0].length;
      }
    }
  }
  return depth > 0 ? out + PRIVATE_SPAN_PLACEHOLDER : out + text.slice(kept);
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

  const hash = sha256(slice);

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

  // Version binding. The existing log's frontmatter decides how
  // this capture relates to what was already extracted or curated:
  //  - same transcript_hash: no new version; leave the file alone.
  //  - stamped for an earlier version whose rendered text is still a prefix
  //    of this one: keep the stamp, mark the new content pending and render
  //    the consumed prefix apart so only the delta is extracted.
  //  - otherwise (never curated, rewritten/compacted transcript, or an
  //    unversioned pre-binding stamp): the whole version is pending.
  // The read and the write share the session log lock with proposal
  // write-back, so a write-back checked against the previous version can
  // never replace this one afterwards.
  const target = join(ctx.sessionsDir, filename);
  const written = await withSessionLogLock(target, () => {
    const existing = existingFilename ? readExistingFrontmatter(target) : null;
    if (existing && existing['transcript_hash'] === hash) return false;
    const carried = existing ? carriedCurationStamp(existing, slice) : undefined;

    const body = renderSessionLog({
      sessionId,
      capturedBy: trigger,
      capturedAt,
      transcriptHash: hash,
      body: slice,
      ...(carried ?? {}),
      ...(isCursory && !carried
        ? {
            proposalStatus: 'skipped' as const,
            proposalError: 'cursory_session',
            proposalCompletedAt: capturedAt,
          }
        : {}),
    });

    writeSessionLog(ctx.sessionsDir, filename, body);
    return true;
  });

  await trackUsage(ctx, transcriptText, sessionId, capturedAt);

  return {
    status: written ? 'written' : 'unchanged',
    sessionLogPath: target,
  };
}

function readExistingFrontmatter(path: string): Record<string, unknown> | null {
  try {
    return matter(readFileSync(path, 'utf8')).data as Record<string, unknown>;
  } catch {
    // Best-effort: an unreadable log is replaced like a first capture.
    return null;
  }
}

/**
 * The curation stamp a changed recapture carries forward, plus the prefix
 * split when the consumed version is still the start of `slice`. Only a
 * versioned stamp is carried: `curationState` 'unversioned' (and 'uncurated')
 * yields nothing, so the new version starts a fresh lifecycle.
 */
function carriedCurationStamp(
  existing: Record<string, unknown>,
  slice: string
):
  | Pick<
      SessionLogInput,
      | 'curatorProcessedAt'
      | 'curatorRunId'
      | 'curatedTranscriptHash'
      | 'curatedTranscriptChars'
      | 'curatedPrefixChars'
    >
  | undefined {
  const state = curationState(existing);
  if (state !== 'current' && state !== 'outdated') return undefined;
  const curatedHash = existing['curated_transcript_hash'] as string;
  const curatedChars = existing['curated_transcript_chars'];
  const prefixIntact =
    typeof curatedChars === 'number' &&
    curatedChars > 0 &&
    curatedChars < slice.length &&
    sha256(slice.slice(0, curatedChars)) === curatedHash;
  return {
    curatorProcessedAt: existing['curator_processed_at'] as string,
    curatorRunId:
      typeof existing['curator_run_id'] === 'string' ? existing['curator_run_id'] : null,
    curatedTranscriptHash: curatedHash,
    curatedTranscriptChars: typeof curatedChars === 'number' ? curatedChars : null,
    curatedPrefixChars: prefixIntact ? curatedChars : undefined,
  };
}

function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function trackUsage(
  ctx: CaptureContext,
  transcriptText: string,
  sessionId: string,
  usedAt: string
): Promise<void> {
  if (!ctx.usage) return;
  try {
    const readPaths =
      ctx.usage.readPaths ?? (ctx.usage.extractReads ? ctx.usage.extractReads(transcriptText) : []);
    if (readPaths.length > 0) {
      await recordUsage({
        usageFile: ctx.usage.usageFile,
        nodesDir: ctx.usage.nodesDir,
        kkDir: ctx.usage.kkDir,
        sessionId,
        usedAt,
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
