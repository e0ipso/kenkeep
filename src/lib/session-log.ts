import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import type { CaptureTrigger, SecretScanStatus } from './schemas.js';

export interface SessionLogInput {
  sessionId: string;
  capturedBy: CaptureTrigger;
  capturedAt: string;
  transcriptHash: string;
  secretScanStatus: SecretScanStatus;
  body: string;
  proposalStatus?: 'pending' | 'skipped';
  proposalError?: string | null;
  proposalCompletedAt?: string | null;
}

export function renderSessionLog(input: SessionLogInput): string {
  const proposalStatus = input.proposalStatus ?? 'pending';
  const proposalError = input.proposalError ?? null;
  const proposalCompletedAt = input.proposalCompletedAt ?? null;
  const frontmatter = {
    schema_version: 1,
    session_id: input.sessionId,
    captured_by: input.capturedBy,
    captured_at: input.capturedAt,
    transcript_hash: input.transcriptHash,
    proposal_status: proposalStatus,
    proposal_completed_at: proposalCompletedAt,
    proposal_error: proposalError,
    proposal_log: null,
    secret_scan_status: input.secretScanStatus,
    proposals: { practice: [], map: [] },
  };
  const yaml = dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const bodyLines = [
    '## Transcript',
    '',
    input.body.trimEnd(),
    '',
    '## Proposal',
    '',
    '(populated by proposal worker)',
    '',
  ];
  return `---\n${yaml}---\n${bodyLines.join('\n')}`;
}

export function writeSessionLog(sessionsDir: string, filename: string, contents: string): string {
  mkdirSync(sessionsDir, { recursive: true });
  const path = join(sessionsDir, filename);
  writeFileSync(path, contents);
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
export function findSessionLogBySessionId(
  sessionsDir: string,
  sessionId: string
): string | null {
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
