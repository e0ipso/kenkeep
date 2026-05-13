import matter from 'gray-matter';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodSchema } from 'zod';
import {
  ProposalOutputSchema,
  type EffortLevel,
  type ModelFamily,
  type QueueEntry,
} from './schemas.js';
import { appendToQueue, readQueue } from './queue.js';
import { acquireLock, releaseLock } from './state.js';

export const DEFAULT_MAX_ENTRIES = 5;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const PROPOSAL_LOCK_NAME = 'proposal-drain';

export type ProposalRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: {
    timeoutMs: number;
    allowedTools?: string[];
    logFile?: string;
    model?: ModelFamily;
    effort?: EffortLevel;
  }
) => Promise<T>;

export interface DrainContext {
  sessionsDir: string;
  logsDir: string;
  stateFile: string;
  promptTemplate: string;
  runner: ProposalRunner;
  now?: () => Date;
  maxEntries?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  lockTtlMs?: number;
  pid?: number;
  model?: ModelFamily;
  effort?: EffortLevel;
}

export type DrainEntryStatus = 'done' | 'failed' | 'skipped' | 'missing-log';

export interface DrainEntryResult {
  sessionId: string;
  status: DrainEntryStatus;
  attempts: number;
  error?: string;
  logFile?: string;
}

export interface DrainSummary {
  status: 'locked' | 'completed';
  processed: DrainEntryResult[];
  remaining: number;
  reason?: string;
}

export const TRANSCRIPT_PLACEHOLDER = '[TRANSCRIPT PLACEHOLDER - substituted at runtime]';

/**
 * Drains the proposal queue. Acquires a lock on `state.json`, iterates up to
 * `maxEntries` queue items, invokes the runner for each, and updates the
 * session log frontmatter with the outcome. Persistent failures (>= maxAttempts)
 * mark the session log as `skipped` and remove the entry from the queue.
 */
export async function drainProposalQueue(ctx: DrainContext): Promise<DrainSummary> {
  const now = ctx.now ?? (() => new Date());
  const queueFile = join(ctx.sessionsDir, '.queue.json');
  const maxEntries = ctx.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pid = ctx.pid ?? process.pid;

  const lockHeld = acquireLock(ctx.stateFile, {
    name: PROPOSAL_LOCK_NAME,
    pid,
    now: now(),
    ...(ctx.lockTtlMs !== undefined ? { ttlMs: ctx.lockTtlMs } : {}),
  });
  if (!lockHeld) {
    return { status: 'locked', processed: [], remaining: readQueue(queueFile).entries.length };
  }

  const processed: DrainEntryResult[] = [];
  try {
    for (let i = 0; i < maxEntries; i += 1) {
      const queue = readQueue(queueFile);
      if (queue.entries.length === 0) break;
      const entry = queue.entries[0]!;
      const result = await processEntry({
        entry,
        sessionsDir: ctx.sessionsDir,
        logsDir: ctx.logsDir,
        promptTemplate: ctx.promptTemplate,
        runner: ctx.runner,
        now,
        timeoutMs,
        maxAttempts,
        ...(ctx.model !== undefined ? { model: ctx.model } : {}),
        ...(ctx.effort !== undefined ? { effort: ctx.effort } : {}),
      });
      processed.push(result);

      if (
        result.status === 'done' ||
        result.status === 'skipped' ||
        result.status === 'missing-log'
      ) {
        removeFromQueueHead(queueFile, entry.session_id);
      } else {
        // Failed but more attempts left: bump attempts and rotate to the back.
        bumpAndRotate(queueFile, entry.session_id, result.attempts);
      }
    }
  } finally {
    releaseLock(ctx.stateFile, PROPOSAL_LOCK_NAME, pid);
  }

  const remaining = readQueue(queueFile).entries.length;
  return { status: 'completed', processed, remaining };
}

interface ProcessEntryArgs {
  entry: QueueEntry;
  sessionsDir: string;
  logsDir: string;
  promptTemplate: string;
  runner: ProposalRunner;
  now: () => Date;
  timeoutMs: number;
  maxAttempts: number;
  model?: ModelFamily;
  effort?: EffortLevel;
}

async function processEntry(args: ProcessEntryArgs): Promise<DrainEntryResult> {
  const {
    entry,
    sessionsDir,
    logsDir,
    promptTemplate,
    runner,
    now,
    timeoutMs,
    maxAttempts,
    model,
    effort,
  } = args;
  const sessionLogPath = join(sessionsDir, entry.session_log);
  if (!existsSync(sessionLogPath)) {
    return {
      sessionId: entry.session_id,
      status: 'missing-log',
      attempts: entry.attempts,
      error: `session log not found: ${entry.session_log}`,
    };
  }

  const parsed = matter(readFileSync(sessionLogPath, 'utf8'));
  const transcript = extractTranscript(parsed.content);
  const prompt = buildProposalPrompt(promptTemplate, transcript);
  const attemptIndex = entry.attempts + 1;
  const startedAt = now();
  const logFile = proposalLogPath(logsDir, entry.session_id, startedAt);

  try {
    const out = await runner(prompt, '', ProposalOutputSchema, {
      timeoutMs,
      allowedTools: [],
      logFile,
      ...(model !== undefined ? { model } : {}),
      ...(effort !== undefined ? { effort } : {}),
    });
    writeSessionLogFrontmatter(sessionLogPath, parsed, {
      proposal_status: 'done',
      proposal_completed_at: now().toISOString(),
      proposal_error: null,
      proposal_log: relativeLogPath(sessionsDir, logFile),
      proposals: { practice: out.practice, map: out.map },
    });
    return {
      sessionId: entry.session_id,
      status: 'done',
      attempts: attemptIndex,
      logFile,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = attemptIndex >= maxAttempts;
    writeSessionLogFrontmatter(sessionLogPath, parsed, {
      proposal_status: exhausted ? 'skipped' : 'failed',
      proposal_completed_at: exhausted ? now().toISOString() : null,
      proposal_error: message,
      proposal_log: relativeLogPath(sessionsDir, logFile),
    });
    return {
      sessionId: entry.session_id,
      status: exhausted ? 'skipped' : 'failed',
      attempts: attemptIndex,
      error: message,
      logFile,
    };
  }
}

function extractTranscript(body: string): string {
  const startMatch = body.match(/## Transcript\s*\n+/);
  if (!startMatch || startMatch.index === undefined) return body.trim();
  const start = startMatch.index + startMatch[0].length;
  const rest = body.slice(start);
  const endMatch = rest.match(/\n## Proposal/);
  if (!endMatch) return rest.trim();
  return rest.slice(0, endMatch.index).trim();
}

export function buildProposalPrompt(template: string, transcript: string): string {
  if (!template.includes(TRANSCRIPT_PLACEHOLDER)) {
    throw new Error(
      `proposal-extract prompt is missing the ${TRANSCRIPT_PLACEHOLDER} placeholder; the prompt template must contain it verbatim`,
    );
  }
  return template.replace(TRANSCRIPT_PLACEHOLDER, transcript);
}

export function proposalLogPath(logsDir: string, sessionId: string, when: Date): string {
  const stamp = isoToCompactStamp(when);
  const safe = sessionId.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'session';
  return join(logsDir, 'proposal', `${safe}__${stamp}.jsonl`);
}

function isoToCompactStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function relativeLogPath(sessionsDir: string, logFile: string): string {
  // Store paths relative to the knowledge-base root for cross-machine portability.
  // sessionsDir = .ai/knowledge-base/_sessions; the kb root is its parent.
  const kbRoot = join(sessionsDir, '..');
  const rel = logFile.startsWith(kbRoot)
    ? logFile.slice(kbRoot.length).replace(/^[\\/]/, '')
    : logFile;
  return rel;
}

interface FrontmatterPatch {
  proposal_status: 'done' | 'failed' | 'skipped';
  proposal_completed_at: string | null;
  proposal_error: string | null;
  proposal_log: string | null;
  proposals?: { practice: unknown[]; map: unknown[] };
}

function writeSessionLogFrontmatter(
  file: string,
  parsed: matter.GrayMatterFile<string>,
  patch: FrontmatterPatch
): void {
  const data = { ...(parsed.data as Record<string, unknown>) };
  data['proposal_status'] = patch.proposal_status;
  data['proposal_completed_at'] = patch.proposal_completed_at;
  data['proposal_error'] = patch.proposal_error;
  data['proposal_log'] = patch.proposal_log;
  if (patch.proposals) data['proposals'] = patch.proposals;
  const body = updateProposalBody(parsed.content, patch);
  const serialized = matter.stringify(body, data);
  writeFileSync(file, serialized);
}

function updateProposalBody(content: string, patch: FrontmatterPatch): string {
  if (patch.proposal_status !== 'done') return content;
  // Replace the "(populated by proposal worker)" placeholder with a brief
  // summary so a human browsing the session log can see what the extractor
  // produced without opening the stream-json log.
  return content.replace(
    /\(populated by proposal worker\)/,
    `_Extraction complete; see proposals in frontmatter._`
  );
}

function removeFromQueueHead(queueFile: string, sessionId: string): void {
  const queue = readQueue(queueFile);
  const next = {
    schema_version: 1 as const,
    entries: queue.entries.filter(e => e.session_id !== sessionId),
  };
  atomicWriteJson(queueFile, next);
}

function bumpAndRotate(queueFile: string, sessionId: string, attempts: number): void {
  const queue = readQueue(queueFile);
  const matchIdx = queue.entries.findIndex(e => e.session_id === sessionId);
  if (matchIdx < 0) return;
  const [entry] = queue.entries.splice(matchIdx, 1);
  if (!entry) return;
  const updated: QueueEntry = { ...entry, attempts };
  queue.entries.push(updated);
  atomicWriteJson(queueFile, queue);
}

function atomicWriteJson(file: string, data: unknown): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

// Re-export for callers that want to append directly (e.g. tests / future
// /kb-propose-from-session skill).
export { appendToQueue };
