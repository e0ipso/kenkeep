import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaptureTrigger, SecretScanStatus } from './schemas.js';

export interface SessionLogInput {
  sessionId: string;
  capturedBy: CaptureTrigger;
  capturedAt: string;
  transcriptHash: string;
  secretScanStatus: SecretScanStatus;
  body: string;
}

/**
 * Renders the session log markdown including frontmatter. We emit YAML by
 * hand (rather than via a dump library) because the frontmatter shape is
 * small and stable, and the hook ships as compiled JS — avoiding extra
 * runtime deps keeps the bundled hook small.
 */
export function renderSessionLog(input: SessionLogInput): string {
  const lines = [
    '---',
    'schema_version: 1',
    `session_id: ${yamlString(input.sessionId)}`,
    `captured_by: ${input.capturedBy}`,
    `captured_at: ${yamlString(input.capturedAt)}`,
    `transcript_hash: ${yamlString(input.transcriptHash)}`,
    'proposal_status: pending',
    'proposal_completed_at: null',
    'proposal_error: null',
    'proposal_log: null',
    `secret_scan_status: ${input.secretScanStatus}`,
    'proposals:',
    '  practice: []',
    '  map: []',
    '---',
    '',
    '## Transcript',
    '',
    input.body.trimEnd(),
    '',
    '## Proposal',
    '',
    '(populated by proposal worker)',
    '',
  ];
  return lines.join('\n');
}

function yamlString(value: string): string {
  // Always quote with JSON-style double quotes for safety; escapes special
  // characters and ensures the value round-trips through gray-matter.
  return JSON.stringify(value);
}

export function writeSessionLog(sessionsDir: string, filename: string, contents: string): string {
  mkdirSync(sessionsDir, { recursive: true });
  const path = join(sessionsDir, filename);
  writeFileSync(path, contents);
  return path;
}

/**
 * Builds a stable, sortable filename for a session log:
 * `YYYYMMDD-HHmm-<id>.md`. The id is sanitized and truncated; the
 * timestamp comes from `capturedAt` (UTC) so logs sort chronologically.
 */
export function buildSessionLogFilename(capturedAt: string, sessionId: string): string {
  const d = new Date(capturedAt);
  const stamp =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `${stamp}-${shortSessionId(sessionId)}.md`;
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
  const suffix = `-${shortSessionId(sessionId)}.md`;
  const matches = readdirSync(sessionsDir)
    .filter(f => f.endsWith(suffix))
    .sort();
  return matches[0] ?? null;
}

function shortSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'session';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
