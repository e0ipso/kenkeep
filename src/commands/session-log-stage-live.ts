import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripPrivateSpans } from '../lib/capture.js';
import { atomicWriteFile } from '../lib/fs-atomic.js';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { ProposalOutputSchema } from '../lib/schemas.js';
import {
  assertValidSessionId,
  buildSessionLogFilename,
  findSessionLogBySessionId,
  renderSessionLog,
} from '../lib/session-log.js';

export interface SessionLogStageLiveOptions {
  sessionId?: string | undefined;
  generateSessionId?: boolean | undefined;
  transcriptExcerpt?: string | undefined;
  sessionsDir?: string | undefined;
  now?: () => Date | undefined;
}

async function readStdin(): Promise<string> {
  return new Promise((resolveStdin, rejectStdin) => {
    if (process.stdin.isTTY) {
      resolveStdin('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolveStdin(data));
    process.stdin.on('error', rejectStdin);
  });
}

function resolveTranscriptExcerpt(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return 'Live context processed by `/kk-session-extract`.';
  }
  try {
    const text = readFileSync(raw, 'utf8');
    return stripPrivateSpans(text);
  } catch {
    return stripPrivateSpans(raw);
  }
}

export async function runSessionLogStageLiveCommand(
  opts: SessionLogStageLiveOptions = {}
): Promise<number> {
  const hasSessionId = opts.sessionId !== undefined && opts.sessionId !== '';
  const generate = opts.generateSessionId === true;
  if (hasSessionId === generate) {
    log.error('Specify exactly one of --session-id <uuid-v4> or --generate-session-id.');
    return 1;
  }

  let sessionId: string;
  let idempotency: 'normal' | 'degraded';
  if (hasSessionId) {
    try {
      sessionId = assertValidSessionId(opts.sessionId);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
    idempotency = 'normal';
  } else {
    sessionId = assertValidSessionId(randomUUID());
    idempotency = 'degraded';
  }

  const raw = await readStdin();
  if (raw.trim().length === 0) {
    log.error('stdin is empty; expected proposal JSON.');
    return 1;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch (err) {
    log.error(`invalid JSON on stdin: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const validated = ProposalOutputSchema.safeParse(json);
  if (!validated.success) {
    log.error(`proposal JSON failed schema validation: ${validated.error.message}`);
    return 1;
  }

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const sessionsDir = opts.sessionsDir ?? paths.sessionsDir;
  const capturedAt = (opts.now?.() ?? new Date()).toISOString();
  const excerpt = resolveTranscriptExcerpt(opts.transcriptExcerpt);
  const transcriptBody = excerpt;
  const transcriptHash = `sha256:${createHash('sha256').update(transcriptBody).digest('hex')}`;

  const existingFilename = findSessionLogBySessionId(sessionsDir, sessionId);
  const filename = existingFilename ?? buildSessionLogFilename(capturedAt, sessionId);
  const filePath = join(sessionsDir, filename);

  const body = renderSessionLog({
    sessionId,
    capturedBy: 'manual',
    capturedAt,
    transcriptHash,
    body: transcriptBody,
    proposalStatus: 'done',
    proposalCompletedAt: capturedAt,
    proposalError: null,
    proposals: {
      practice: validated.data.practice,
      map: validated.data.map,
    },
  });

  try {
    atomicWriteFile(filePath, body);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  process.stdout.write(
    `${JSON.stringify({ path: filePath, session_id: sessionId, idempotency })}\n`
  );
  return 0;
}
