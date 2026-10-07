import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { atomicWriteFile } from './fs-atomic.js';
import type { CaptureTrigger, ProposalStatus } from './schemas.js';

export interface SessionLogProposals {
  practice: unknown[];
  map: unknown[];
}

export interface SessionLogInput {
  sessionId: string;
  capturedBy: CaptureTrigger;
  capturedAt: string;
  /** `sha256:<hex>` over the full rendered transcript (`body`). */
  transcriptHash: string;
  /** The full rendered transcript this version consists of. */
  body: string;
  /**
   * When the first `curatedPrefixChars` characters of `body` were already
   * consumed by a curate run (see {@link curationState}), they are rendered
   * under `## Curated prefix` and only the remainder under `## Transcript`,
   * so extraction sees the new turns alone.
   */
  curatedPrefixChars?: number | undefined;
  /** Initial queue state at capture time; the worker owns 'done'/'failed'. */
  proposalStatus?: Extract<ProposalStatus, 'pending' | 'skipped' | 'done' | 'failed'>;
  proposalError?: string | null;
  proposalCompletedAt?: string | null;
  proposals?: SessionLogProposals;
  curatorProcessedAt?: string | null;
  curatorRunId?: string | null;
  /** The `transcript_hash` / `transcript_chars` a curate run consumed. */
  curatedTranscriptHash?: string | null;
  curatedTranscriptChars?: number | null;
}

/**
 * Where a session log stands relative to curation. A curator stamp binds to
 * the transcript version it consumed (`curated_transcript_hash`), so a log
 * is consumable again once its `transcript_hash` moves on:
 *
 * - `uncurated`: no stamp.
 * - `current`: stamped for exactly this version; nothing left to curate.
 * - `outdated`: stamped for an earlier version; the new content is pending.
 * - `unversioned`: a stamp written before version binding carried no hash.
 *   It is never re-admitted (its version cannot be told apart) and a
 *   changed recapture drops it, starting a fresh lifecycle.
 */
export type CurationState = 'uncurated' | 'current' | 'outdated' | 'unversioned';

export function curationState(fm: {
  transcript_hash?: unknown;
  curator_processed_at?: unknown;
  curated_transcript_hash?: unknown;
}): CurationState {
  const processedAt = fm.curator_processed_at;
  if (typeof processedAt !== 'string' || processedAt === '') return 'uncurated';
  const curated = fm.curated_transcript_hash;
  if (typeof curated !== 'string' || curated === '') return 'unversioned';
  return curated === fm.transcript_hash ? 'current' : 'outdated';
}

/** The heading under which the already-curated start of a transcript is kept. */
export const CURATED_PREFIX_HEADING = '## Curated prefix';

export function renderSessionLog(input: SessionLogInput): string {
  const proposalStatus = input.proposalStatus ?? 'pending';
  const proposalError = input.proposalError ?? null;
  const proposalCompletedAt = input.proposalCompletedAt ?? null;
  const frontmatter: Record<string, unknown> = {
    schema_version: 1,
    session_id: input.sessionId,
    captured_by: input.capturedBy,
    captured_at: input.capturedAt,
    transcript_hash: input.transcriptHash,
    transcript_chars: input.body.length,
    proposal_status: proposalStatus,
    proposal_completed_at: proposalCompletedAt,
    proposal_error: proposalError,
    proposal_log: null,
    proposals: input.proposals ?? { practice: [], map: [] },
  };
  if (input.curatorProcessedAt) {
    frontmatter['curator_processed_at'] = input.curatorProcessedAt;
  }
  if (input.curatorRunId) {
    frontmatter['curator_run_id'] = input.curatorRunId;
  }
  if (input.curatedTranscriptHash) {
    frontmatter['curated_transcript_hash'] = input.curatedTranscriptHash;
  }
  if (typeof input.curatedTranscriptChars === 'number') {
    frontmatter['curated_transcript_chars'] = input.curatedTranscriptChars;
  }
  const yaml = dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const proposalSection =
    proposalStatus === 'done'
      ? '_Extraction complete; see proposals in frontmatter._'
      : '(populated by proposal worker)';
  const prefixChars = input.curatedPrefixChars;
  const split =
    prefixChars !== undefined && prefixChars > 0 && prefixChars < input.body.length
      ? prefixChars
      : 0;
  const bodyLines = [
    ...(split > 0
      ? [
          CURATED_PREFIX_HEADING,
          '',
          '_Already curated; not extracted again._',
          '',
          input.body.slice(0, split).trimEnd(),
          '',
        ]
      : []),
    '## Transcript',
    '',
    input.body.slice(split).trim(),
    '',
    '## Proposal',
    '',
    proposalSection,
    '',
  ];
  return `---\n${yaml}---\n${bodyLines.join('\n')}`;
}

/**
 * Writes a captured session log atomically so a host terminating the capture
 * hook mid-write can never leave a truncated log behind.
 */
export function writeSessionLog(sessionsDir: string, filename: string, contents: string): string {
  const path = join(sessionsDir, filename);
  atomicWriteFile(path, contents);
  return path;
}

/**
 * Builds a stable, sortable filename for a session log:
 * `YYYYMMDD-HHmm-<sessionId>.md`. The timestamp comes from `capturedAt`
 * (UTC) so logs sort chronologically. `sessionId` must already be a
 * validated UUID v4 (see `assertValidSessionId`); UUID dashes are
 * filename-safe.
 */
export function buildSessionLogFilename(capturedAt: string, sessionId: string): string {
  const d = new Date(capturedAt);
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `${stamp}-${sessionId}.md`;
}

/**
 * Returns the filename of an existing session log for the given session_id,
 * or null if none exists. Stop fires after every assistant turn, so a single
 * Claude Code session emits multiple capture events; this lets the capture
 * path overwrite the prior file in place instead of writing a new one each turn.
 */
export function findSessionLogBySessionId(sessionsDir: string, sessionId: string): string | null {
  if (!existsSync(sessionsDir)) return null;
  const suffix = `-${sessionId}.md`;
  const matches = readdirSync(sessionsDir)
    .filter(f => f.endsWith(suffix))
    .sort();
  return matches[0] ?? null;
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates a session_id once at the hook boundary. Throws on non-string,
 * empty, or non-UUID-v4 input. Returns the lowercased UUID for downstream use.
 */
export function assertValidSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('session_id must be a non-empty string');
  }
  if (!UUID_V4_RE.test(sessionId)) {
    throw new Error(`session_id "${sessionId}" is not a UUID v4`);
  }
  return sessionId.toLowerCase();
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
