import { appendFileSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { CuratorOutputSchema, SessionLogFrontmatterSchema } from './schemas.js';
import { curationState } from './session-log.js';

/**
 * The consumed-session set: which session versions a curate run actually
 * consumed. Each batch draft lists the sessions it was drafted from next to
 * its actions; `drafts collect` takes the union over valid drafts only, and
 * `curate-dedup` stamps exactly that set. Nothing downstream enumerates
 * `_sessions/` to decide what to stamp, so a batch that wrote no draft, an
 * invalid draft, or a log that arrived after the batches were formed is never
 * marked processed.
 *
 * A session with zero candidates is consumed by being listed in a valid
 * draft; the set is never derived from surviving actions, which would strand
 * it.
 */

/** One consumed session: its id, its log filename and the transcript version it was drafted from. */
export const ConsumedSessionSchema = z.object({
  session_id: z.string().min(1),
  /**
   * Bare filename under `_sessions/`. Rejecting any path component here is
   * what lets dedup join it onto the sessions dir without a traversal risk.
   */
  file: z
    .string()
    .min(1)
    .refine(f => basename(f) === f && f !== '.' && f !== '..', {
      message: 'must be a bare filename under _sessions/',
    }),
  /**
   * The log's `transcript_hash` as the drafter read it. Dedup refuses to
   * stamp when the log has moved on, so the stamp always names the version
   * that was curated.
   */
  transcript_hash: z.string().min(1),
});
export type ConsumedSession = z.infer<typeof ConsumedSessionSchema>;

/**
 * One batch draft (`_logs/curator/<runId>__<batch>.draft.json`): every
 * session the batch read, including those that yielded no action, and the
 * curator actions drafted from them.
 */
export const CuratorDraftSchema = z.object({
  sessions: z.array(ConsumedSessionSchema).min(1),
  actions: CuratorOutputSchema,
});
export type CuratorDraft = z.infer<typeof CuratorDraftSchema>;

/**
 * The `curate-dedup` input contract: the actions to dedup plus the consumed
 * set they were drafted from. `drafts collect` prints exactly this document
 * (with extra batch diagnostics, which this schema strips).
 */
export const CurateDedupInputSchema = z.object({
  actions: CuratorOutputSchema,
  consumed: z.array(ConsumedSessionSchema),
});
export type CurateDedupInput = z.infer<typeof CurateDedupInputSchema>;

export function draftFilename(runId: string, batch: number): string {
  return `${runId}__${batch}.draft.json`;
}

export function eventLogFilename(runId: string, batch: number): string {
  return `${runId}__${batch}.jsonl`;
}

/** Appends one audit line to the batch's `.jsonl`; best-effort, never throws. */
export function appendBatchEvent(
  curatorDir: string,
  runId: string,
  batch: number,
  event: Record<string, unknown>
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), runId, batch, ...event });
  try {
    appendFileSync(join(curatorDir, eventLogFilename(runId, batch)), `${line}\n`);
  } catch {
    // The audit line is best-effort; a write failure must not abort the primitive.
  }
}

export type ConsumableSessionResult =
  | {
      ok: true;
      session: ConsumedSession;
      /**
       * The log's `transcript_chars` at read time, the length `transcript_hash`
       * covers (absent on logs written before it was recorded). Not part of
       * the draft; `curate-dedup` reads it alongside the version it validates
       * so the stamp can carry it.
       */
      transcript_chars: number | undefined;
    }
  | { ok: false; reason: string };

/**
 * Reads one session log and decides whether a curate run may consume it:
 * valid frontmatter, `proposal_status: done`, and not curated at its current
 * transcript version (`curationState` 'uncurated' or 'outdated'; see
 * session-log.ts). `curate-dedup` applies it immediately before stamping, so
 * a session that another run stamped in the meantime is refused rather than
 * double-curated, while one whose transcript grew after its stamp is
 * admitted again.
 */
export function readConsumableSession(filePath: string): ConsumableSessionResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ok: false, reason: `unreadable: ${(err as Error).message}` };
  }
  const fm = SessionLogFrontmatterSchema.safeParse(parsed.data);
  if (!fm.success) {
    return { ok: false, reason: 'frontmatter does not match the session-log schema' };
  }
  if (fm.data.proposal_status !== 'done') {
    return { ok: false, reason: `proposal_status is "${fm.data.proposal_status}", not "done"` };
  }
  const state = curationState(fm.data);
  if (state === 'current') {
    return { ok: false, reason: `already processed at ${fm.data.curator_processed_at}` };
  }
  if (state === 'unversioned') {
    return {
      ok: false,
      reason: `already processed at ${fm.data.curator_processed_at} by a stamp that predates version binding (no curated_transcript_hash); delete the log, or remove its curator_* fields to curate it again`,
    };
  }
  return {
    ok: true,
    session: {
      session_id: fm.data.session_id,
      file: basename(filePath),
      transcript_hash: fm.data.transcript_hash,
    },
    transcript_chars: fm.data.transcript_chars,
  };
}

/**
 * The session an action came from: `candidate_origin` is
 * `<session_id>:<practice|map>:<index>`, so the id is everything before the
 * first colon (an origin without a colon is taken whole and will not resolve).
 */
export function originSessionId(origin: string): string {
  const colon = origin.indexOf(':');
  return colon === -1 ? origin : origin.slice(0, colon);
}

/**
 * Returns every `candidate_origin` among `actions` whose session is not in
 * `consumedIds` (in input order, duplicates removed). Elements without a
 * string `candidate_origin` are not session-bound and are ignored.
 */
export function unresolvedOrigins(actions: unknown[], consumedIds: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const action of actions) {
    if (typeof action !== 'object' || action === null) continue;
    const origin = (action as { candidate_origin?: unknown }).candidate_origin;
    if (typeof origin !== 'string') continue;
    if (!consumedIds.has(originSessionId(origin)) && !out.includes(origin)) out.push(origin);
  }
  return out;
}
