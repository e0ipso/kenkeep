import { mkdirSync, writeFileSync } from 'node:fs';
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
    'stage_2_status: pending',
    'stage_2_completed_at: null',
    'stage_2_error: null',
    'stage_2_log: null',
    `secret_scan_status: ${input.secretScanStatus}`,
    'topics: []',
    'proposals:',
    '  practice: []',
    '  map: []',
    '---',
    '',
    '## Stage 1: redacted transcript slice',
    '',
    input.body.trimEnd(),
    '',
    '## Stage 2: structured summary',
    '',
    '(populated by stage-2 worker)',
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
  const short = sessionId.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'session';
  return `${stamp}-${short}.md`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
