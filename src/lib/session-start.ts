import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { computeNodesHash } from './nodes.js';
import { readLintState } from './lint-state.js';
import { IndexFrontmatterSchema, SessionLogFrontmatterSchema } from './schemas.js';
import { readState, writeState } from './state.js';

export const DEFAULT_NUDGE_THRESHOLD = 5;
export const DEFAULT_STALE_DAYS = 7;

export interface SessionStartContext {
  kbDir: string;
  nodesDir: string;
  sessionsDir: string;
  stateFile: string;
  lintStateFile?: string;
  threshold?: number;
  staleDays?: number;
  now?: () => Date;
}

export interface SessionStartResult {
  /** Markdown text intended for injection into the session. */
  additionalContext: string;
  /** True if a nudge line was appended this run (and state mutated). */
  nudged: boolean;
  /** True if a lint summary block was appended this run. */
  lintNudged: boolean;
  /** True if the index was missing and a stub was generated. */
  indexMissing: boolean;
  /** True if INDEX.md exists but its nodes_hash does not match nodes/. */
  indexStale: boolean;
  /** Number of session logs awaiting processing (proposal extraction or curation). */
  pendingSessions: number;
  /** Total candidate proposals across pending sessions. */
  candidateCount: number;
}

/**
 * Builds the additional-context payload for the SessionStart sync hook.
 *
 * 1. Reads INDEX.md (or returns a "KB is empty" stub if missing).
 * 2. Detects staleness by comparing the frontmatter `nodes_hash` against
 *    the live hash of `nodes/`. If mismatched, appends a warning line.
 * 3. Counts pending session logs and, when >= threshold,
 *    appends a nudge and persists `last_nudged_at` to `state.json`.
 *
 * Pure-ish: the only side effect is the state.json write when a nudge fires.
 */
export function buildSessionStartContext(ctx: SessionStartContext): SessionStartResult {
  const now = ctx.now ?? (() => new Date());
  const threshold = ctx.threshold ?? DEFAULT_NUDGE_THRESHOLD;
  const staleDays = ctx.staleDays ?? DEFAULT_STALE_DAYS;

  const { content: indexBody, frontmatterHash, missing } = loadIndex(ctx.kbDir);
  const liveHash = computeNodesHash(ctx.nodesDir);
  const indexStale = !missing && frontmatterHash !== null && frontmatterHash !== liveHash;

  const summary = summarizePendingSessions(ctx.sessionsDir);
  const pending = summary.pending;
  const state = readState(ctx.stateFile);
  const nowDate = now();
  const shouldNudge = pending >= threshold;

  const oldestAgeDays =
    summary.oldestCapturedAt === null
      ? 0
      : Math.max(
          0,
          Math.floor((nowDate.getTime() - summary.oldestCapturedAt.getTime()) / 86_400_000)
        );
  const loud =
    shouldNudge &&
    ((pending >= threshold && oldestAgeDays >= staleDays) || pending >= 2 * threshold);

  const lines: string[] = [];
  lines.push(indexBody.trim());
  lines.push('');
  lines.push(
    '> KB nodes are snapshots in time. Before acting on a node that names a specific file path, function, or flag, verify it still exists in the current tree. If the referenced entity is gone, prefer the live code; flag the stale node to the user.'
  );
  lines.push('');
  lines.push(
    '> KB navigation: consult the index above first, then `grep -C 2 <term> nodes/` for candidate slugs (the `-C 2` context surfaces the `summary:` frontmatter line), and only open full node bodies for confirmed matches.'
  );
  if (indexStale) {
    lines.push('');
    lines.push(
      `> KB index is stale, run \`npx @e0ipso/ai-knowledge-base index rebuild\` to refresh (live hash differs from INDEX.md \`nodes_hash\`).`
    );
  }
  if (shouldNudge) {
    const oldestPhrase =
      oldestAgeDays === 0 ? 'captured today' : `oldest pending: ${oldestAgeDays} day(s)`;
    const copyPaste =
      'Run `/kb-curate` (or `npx @e0ipso/ai-knowledge-base curate`). Curation is simple; a mid-tier model at moderate effort is sufficient and cheaper.';
    lines.push('');
    if (loud) {
      lines.push('> 🚨 KB curation queue is overdue');
      lines.push(
        `> ${pending} pending session log(s), ${summary.candidateCount} candidate proposal(s), ${oldestPhrase}`
      );
      lines.push(`> ${copyPaste}`);
    } else {
      lines.push(
        `> ${pending} pending session log(s), ${summary.candidateCount} candidate proposal(s), ${oldestPhrase}`
      );
      lines.push(`> ${copyPaste}`);
    }
  }

  let lintNudged = false;
  if (ctx.lintStateFile !== undefined) {
    const lintState = readLintState(ctx.lintStateFile);
    if (lintState.last_errors > 0 || lintState.last_findings > 0) {
      lines.push('');
      lines.push(
        `> Last KB lint ${lintState.last_lint_at}: ${lintState.last_errors} error(s), ${lintState.last_findings} finding(s). Run \`npx @e0ipso/ai-knowledge-base lint --verbose\` for details.`
      );
      lintNudged = true;
    }
  }

  if (shouldNudge) {
    writeState(ctx.stateFile, { ...state, last_nudged_at: nowDate.toISOString() });
  }

  return {
    additionalContext: lines.join('\n') + '\n',
    nudged: shouldNudge,
    lintNudged,
    indexMissing: missing,
    indexStale,
    pendingSessions: pending,
    candidateCount: summary.candidateCount,
  };
}

interface LoadedIndex {
  content: string;
  frontmatterHash: string | null;
  missing: boolean;
}

function loadIndex(kbDir: string): LoadedIndex {
  const indexFile = `${kbDir.replace(/[\\/]$/, '')}/INDEX.md`;
  if (!existsSync(indexFile)) {
    return {
      content: stubIndex(),
      frontmatterHash: null,
      missing: true,
    };
  }
  const raw = readFileSync(indexFile, 'utf8');
  const parsed = matter(raw);
  const result = IndexFrontmatterSchema.safeParse(parsed.data);
  const hash = result.success ? normalizeNodesHash(result.data.nodes_hash) : null;
  return {
    content: parsed.content.trimStart(),
    frontmatterHash: hash,
    missing: false,
  };
}

function stubIndex(): string {
  return [
    '# KB Index',
    '',
    '_The knowledge base is empty. Capture a session (the Stop hook fires automatically) or run `npx @e0ipso/ai-knowledge-base node add` to seed it._',
  ].join('\n');
}

function normalizeNodesHash(value: string): string {
  // Stored as "sha256:<hex>"; compare against the raw hex from
  // `computeNodesHash` by stripping the prefix.
  return value.startsWith('sha256:') ? value.slice(7) : value;
}

export interface PendingSessionsSummary {
  pending: number;
  candidateCount: number;
  oldestCapturedAt: Date | null;
}

/**
 * Single-pass walk over `_sessions/*.md` returning the pending count, the
 * sum of candidate proposals across those sessions, and the oldest
 * `captured_at` timestamp. Counts both `proposal_status: 'pending'` (awaiting
 * proposal extraction) and `proposal_status: 'done'` (awaiting curation) logs
 * that have not yet been curator-processed. Only 'done' logs contribute to
 * `candidateCount`.
 */
export function summarizePendingSessions(sessionsDir: string): PendingSessionsSummary {
  if (!existsSync(sessionsDir)) {
    return { pending: 0, candidateCount: 0, oldestCapturedAt: null };
  }
  let pending = 0;
  let candidateCount = 0;
  let oldest: Date | null = null;
  for (const name of readdirSync(sessionsDir)) {
    if (!name.endsWith('.md')) continue;
    const file = join(sessionsDir, name);
    try {
      const parsed = matter(readFileSync(file, 'utf8'));
      const fm = SessionLogFrontmatterSchema.safeParse(parsed.data);
      if (!fm.success) continue;
      const status = fm.data.proposal_status;
      if (status !== 'pending' && status !== 'done') continue;
      const data = parsed.data as { curator_processed_at?: unknown };
      if (typeof data.curator_processed_at === 'string') continue;
      pending += 1;
      if (status === 'done') {
        const proposals = fm.data.proposals;
        candidateCount += (proposals?.practice?.length ?? 0) + (proposals?.map?.length ?? 0);
      }
      const ms = Date.parse(fm.data.captured_at);
      if (Number.isFinite(ms)) {
        const captured = new Date(ms);
        if (oldest === null || captured.getTime() < oldest.getTime()) {
          oldest = captured;
        }
      }
    } catch {
      // Skip unreadable session logs; doctor will surface them.
    }
  }
  return { pending, candidateCount, oldestCapturedAt: oldest };
}

/**
 * Back-compat thin wrapper around `summarizePendingSessions` for callers
 * that only need the pending count.
 */
export function countPendingSessions(sessionsDir: string): number {
  return summarizePendingSessions(sessionsDir).pending;
}

