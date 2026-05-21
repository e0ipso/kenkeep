import matter from 'gray-matter';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodSchema } from 'zod';
import { ProposalOutputSchema } from './schemas.js';
import lockfile from 'proper-lockfile';
import type { RepoPaths } from './paths.js';
import { STATE_LOCK_OPTIONS } from './state.js';
import { compactStamp } from './time.js';

export const DEFAULT_MAX_ENTRIES = 5;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const MAX_PROPOSAL_ERROR_LEN = 500;

export type ProposalRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: {
    timeoutMs: number;
    logFile?: string;
    harnessOpts?: Record<string, unknown>;
  }
) => Promise<T>;

export interface DrainContext {
  paths: RepoPaths;
  promptTemplate: string;
  runner: ProposalRunner;
  maxEntries?: number;
  timeoutMs?: number;
  /** Adapter-specific knobs (model, effort, allowedTools, ...). */
  harnessOpts?: Record<string, unknown>;
}

export type DrainEntryStatus = 'done' | 'failed';

export interface DrainEntryResult {
  sessionId: string;
  status: DrainEntryStatus;
  error?: string;
  logFile?: string;
}

export interface DrainSummary {
  status: 'locked' | 'completed';
  processed: DrainEntryResult[];
  remaining: number;
  reason?: string;
}

export const TRANSCRIPT_PLACEHOLDER = '[TRANSCRIPT PLACEHOLDER, substituted at runtime]';

interface PendingSessionLog {
  sessionId: string;
  file: string;
}

/**
 * Drains pending session logs. Acquires a lock on `state.json`, sweeps
 * `_sessions/*.md`, processes every log whose frontmatter has
 * `proposal_status: 'pending'` up to `maxEntries`, and writes the outcome
 * back into the same frontmatter (`done` or `failed`). No retries: a failed
 * log stays `failed` until a human intervenes.
 */
export async function drainProposalQueue(ctx: DrainContext): Promise<DrainSummary> {
  const maxEntries = ctx.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const stateFile = join(ctx.paths.stateDir, 'state.json');

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(stateFile, STATE_LOCK_OPTIONS);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOCKED') {
      return { status: 'locked', processed: [], remaining: countPending(ctx.paths.sessionsDir) };
    }
    throw err;
  }

  const processed: DrainEntryResult[] = [];
  try {
    const pending = listPending(ctx.paths.sessionsDir);
    for (const entry of pending) {
      if (processed.length >= maxEntries) break;
      const result = await processSessionLog({
        entry,
        sessionsDir: ctx.paths.sessionsDir,
        logsDir: ctx.paths.logsDir,
        promptTemplate: ctx.promptTemplate,
        runner: ctx.runner,
        timeoutMs,
        ...(ctx.harnessOpts !== undefined ? { harnessOpts: ctx.harnessOpts } : {}),
      });
      processed.push(result);
    }
  } finally {
    if (release !== undefined) await release();
  }

  const remaining = countPending(ctx.paths.sessionsDir);
  return { status: 'completed', processed, remaining };
}

function listPending(sessionsDir: string): PendingSessionLog[] {
  if (!existsSync(sessionsDir)) return [];
  const names = readdirSync(sessionsDir)
    .filter(name => name.endsWith('.md') && !name.startsWith('.'))
    .sort();
  const out: PendingSessionLog[] = [];
  for (const name of names) {
    const file = join(sessionsDir, name);
    const data = readFrontmatter(file);
    if (!data) continue;
    if (data['proposal_status'] !== 'pending') continue;
    const sessionId = typeof data['session_id'] === 'string' ? data['session_id'] : name;
    out.push({ sessionId, file });
  }
  return out;
}

function countPending(sessionsDir: string): number {
  return listPending(sessionsDir).length;
}

function readFrontmatter(file: string): Record<string, unknown> | null {
  try {
    const parsed = matter(readFileSync(file, 'utf8'));
    return parsed.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface ProcessArgs {
  entry: PendingSessionLog;
  sessionsDir: string;
  logsDir: string;
  promptTemplate: string;
  runner: ProposalRunner;
  timeoutMs: number;
  harnessOpts?: Record<string, unknown>;
}

async function processSessionLog(args: ProcessArgs): Promise<DrainEntryResult> {
  const { entry, sessionsDir, logsDir, promptTemplate, runner, timeoutMs, harnessOpts } = args;
  const parsed = matter(readFileSync(entry.file, 'utf8'));
  const transcript = extractTranscript(parsed.content);
  const prompt = buildProposalPrompt(promptTemplate, transcript);
  const startedAt = new Date();
  const logFile = proposalLogPath(logsDir, entry.sessionId, startedAt);

  try {
    const out = await runner(prompt, '', ProposalOutputSchema, {
      timeoutMs,
      logFile,
      ...(harnessOpts !== undefined ? { harnessOpts } : {}),
    });
    writeSessionLogFrontmatter(entry.file, parsed, {
      proposal_status: 'done',
      proposal_completed_at: new Date().toISOString(),
      proposal_error: null,
      proposal_log: relativeLogPath(sessionsDir, logFile),
      proposals: { practice: out.practice, map: out.map },
    });
    return { sessionId: entry.sessionId, status: 'done', logFile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const truncated =
      message.length > MAX_PROPOSAL_ERROR_LEN
        ? `${message.slice(0, MAX_PROPOSAL_ERROR_LEN)}...`
        : message;
    writeSessionLogFrontmatter(entry.file, parsed, {
      proposal_status: 'failed',
      proposal_completed_at: new Date().toISOString(),
      proposal_error: truncated,
      proposal_log: relativeLogPath(sessionsDir, logFile),
    });
    return { sessionId: entry.sessionId, status: 'failed', error: truncated, logFile };
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
      `proposal-extract prompt is missing the ${TRANSCRIPT_PLACEHOLDER} placeholder; the prompt template must contain it verbatim`
    );
  }
  return template.replace(TRANSCRIPT_PLACEHOLDER, transcript);
}

export function proposalLogPath(logsDir: string, sessionId: string, when: Date): string {
  const stamp = compactStamp(when);
  return join(logsDir, 'proposal', `${sessionId}__${stamp}.jsonl`);
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
  proposal_status: 'done' | 'failed';
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
