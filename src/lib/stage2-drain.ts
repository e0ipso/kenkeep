import matter from 'gray-matter';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodSchema } from 'zod';
import { Stage2OutputSchema, type Stage2Output, type QueueEntry } from './schemas.js';
import { appendToQueue, readQueue } from './queue.js';
import { acquireLock, releaseLock } from './state.js';

export const DEFAULT_MAX_ENTRIES = 5;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const STAGE2_LOCK_NAME = 'stage2-drain';

export type Stage2Runner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: { timeoutMs: number; allowedTools?: string[]; logFile?: string },
) => Promise<T>;

export interface DrainContext {
  sessionsDir: string;
  logsDir: string;
  stateFile: string;
  promptTemplate: string;
  runner: Stage2Runner;
  now?: () => Date;
  maxEntries?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  pid?: number;
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

const TRANSCRIPT_PLACEHOLDER = '[TRANSCRIPT PLACEHOLDER — substituted at runtime]';

/**
 * Drains the stage-2 queue. Acquires a lock on `state.json`, iterates up to
 * `maxEntries` queue items, invokes the runner for each, and updates the
 * session log frontmatter with the outcome. Persistent failures (≥ maxAttempts)
 * mark the session log as `skipped` and remove the entry from the queue.
 */
export async function drainStage2Queue(ctx: DrainContext): Promise<DrainSummary> {
  const now = ctx.now ?? (() => new Date());
  const queueFile = join(ctx.sessionsDir, '.queue.json');
  const maxEntries = ctx.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pid = ctx.pid ?? process.pid;

  const lockHeld = acquireLock(ctx.stateFile, {
    name: STAGE2_LOCK_NAME,
    pid,
    now: now(),
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
    releaseLock(ctx.stateFile, STAGE2_LOCK_NAME, pid);
  }

  const remaining = readQueue(queueFile).entries.length;
  return { status: 'completed', processed, remaining };
}

interface ProcessEntryArgs {
  entry: QueueEntry;
  sessionsDir: string;
  logsDir: string;
  promptTemplate: string;
  runner: Stage2Runner;
  now: () => Date;
  timeoutMs: number;
  maxAttempts: number;
}

async function processEntry(args: ProcessEntryArgs): Promise<DrainEntryResult> {
  const { entry, sessionsDir, logsDir, promptTemplate, runner, now, timeoutMs, maxAttempts } = args;
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
  const transcript = extractStage1Transcript(parsed.content);
  const prompt = buildStage2Prompt(promptTemplate, transcript);
  const attemptIndex = entry.attempts + 1;
  const startedAt = now();
  const logFile = stage2LogPath(logsDir, entry.session_id, startedAt);

  try {
    const out = await runner(prompt, '', Stage2OutputSchema, {
      timeoutMs,
      allowedTools: [],
      logFile,
    });
    writeSessionLogFrontmatter(sessionLogPath, parsed, {
      stage_2_status: 'done',
      stage_2_completed_at: now().toISOString(),
      stage_2_error: null,
      stage_2_log: relativeLogPath(sessionsDir, logFile),
      topics: collectTopics(out),
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
      stage_2_status: exhausted ? 'skipped' : 'failed',
      stage_2_completed_at: exhausted ? now().toISOString() : null,
      stage_2_error: message,
      stage_2_log: relativeLogPath(sessionsDir, logFile),
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

function extractStage1Transcript(body: string): string {
  const startMatch = body.match(/## Stage 1: redacted transcript slice\s*\n+/);
  if (!startMatch || startMatch.index === undefined) return body.trim();
  const start = startMatch.index + startMatch[0].length;
  const rest = body.slice(start);
  const endMatch = rest.match(/\n## Stage 2:/);
  if (!endMatch) return rest.trim();
  return rest.slice(0, endMatch.index).trim();
}

function buildStage2Prompt(template: string, transcript: string): string {
  if (template.includes(TRANSCRIPT_PLACEHOLDER)) {
    return template.replace(TRANSCRIPT_PLACEHOLDER, transcript);
  }
  return `${template.trimEnd()}\n\n${transcript}\n`;
}

function stage2LogPath(logsDir: string, sessionId: string, when: Date): string {
  const stamp = isoToCompactStamp(when);
  const safe = sessionId.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'session';
  return join(logsDir, 'stage-2', `${safe}__${stamp}.jsonl`);
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

function collectTopics(out: Stage2Output): string[] {
  const all = new Set<string>();
  for (const c of out.practice) for (const t of c.tags) all.add(t);
  for (const c of out.map) for (const t of c.tags) all.add(t);
  return [...all];
}

interface FrontmatterPatch {
  stage_2_status: 'done' | 'failed' | 'skipped';
  stage_2_completed_at: string | null;
  stage_2_error: string | null;
  stage_2_log: string | null;
  topics?: string[];
  proposals?: { practice: unknown[]; map: unknown[] };
}

function writeSessionLogFrontmatter(
  file: string,
  parsed: matter.GrayMatterFile<string>,
  patch: FrontmatterPatch,
): void {
  const data = { ...(parsed.data as Record<string, unknown>) };
  data['stage_2_status'] = patch.stage_2_status;
  data['stage_2_completed_at'] = patch.stage_2_completed_at;
  data['stage_2_error'] = patch.stage_2_error;
  data['stage_2_log'] = patch.stage_2_log;
  if (patch.topics) data['topics'] = patch.topics;
  if (patch.proposals) data['proposals'] = patch.proposals;
  const body = updateStage2Body(parsed.content, patch);
  const serialized = matter.stringify(body, data);
  writeFileSync(file, serialized);
}

function updateStage2Body(content: string, patch: FrontmatterPatch): string {
  if (patch.stage_2_status !== 'done') return content;
  // Replace the "(populated by stage-2 worker)" placeholder with a brief
  // summary so a human browsing the session log can see what the extractor
  // produced without opening the stream-json log.
  return content.replace(
    /\(populated by stage-2 worker\)/,
    `_Extraction complete — see proposals in frontmatter._`,
  );
}

function removeFromQueueHead(queueFile: string, sessionId: string): void {
  const queue = readQueue(queueFile);
  const next = {
    schema_version: 1 as const,
    entries: queue.entries.filter((e) => e.session_id !== sessionId),
  };
  atomicWriteJson(queueFile, next);
}

function bumpAndRotate(queueFile: string, sessionId: string, attempts: number): void {
  const queue = readQueue(queueFile);
  const matchIdx = queue.entries.findIndex((e) => e.session_id === sessionId);
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
// /kb:propose-from-session command).
export { appendToQueue };
