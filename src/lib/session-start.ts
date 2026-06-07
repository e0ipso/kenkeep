import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { computeNodesHash } from './nodes.js';
import { readLintState } from './lint-state.js';
import { IndexFrontmatterSchema, SessionLogFrontmatterSchema } from './schemas.js';
import { readState, writeState } from './state.js';

export const DEFAULT_NUDGE_THRESHOLD = 20;
export const DEFAULT_STALE_DAYS = 7;

/**
 * The descent navigation directive injected at SessionStart and reused verbatim
 * by the static AGENTS.md kk-index pointer block (see `src/commands/init.ts`).
 * Sourcing both surfaces from this single constant keeps the hook and the
 * always-on file from ever drifting apart.
 *
 * The directive describes how to navigate the tree-structured knowledge base:
 * enter at the injected root index node, pick the branches whose intent and tags
 * match the task, read those branch index nodes, descend only as deep as the
 * task needs, open only confirmed-relevant leaves, and follow cross edges to
 * reach related leaves in other branches. Multiple branches can be relevant and
 * the agent chooses how deep to go.
 */
export const KK_NAVIGATION_DIRECTIVE =
  '> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf\'s `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.';

export interface SessionStartContext {
  kkDir: string;
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
 * 1. Reads the root index node (`.ai/kenkeep/INDEX.md`, the top-level catalog of
 *    branches and root-level leaves) or returns a "kk is empty" stub if missing.
 *    Only the root index node is injected: the payload is bounded and does not
 *    grow with the total node count, because deep leaves appear in the root only
 *    as subfolder rollup counts. The agent descends the tree on demand following
 *    `KK_NAVIGATION_DIRECTIVE`.
 * 2. Detects staleness by comparing the root index node's frontmatter
 *    `nodes_hash` (the global hash over the whole leaf set) against the live hash
 *    of `nodes/`. If mismatched, appends a warning line.
 * 3. Counts pending session logs and, when >= threshold,
 *    appends a nudge and persists `last_nudged_at` to `state.json`.
 *
 * Pure-ish: the only side effect is the state.json write when a nudge fires.
 */
export function buildSessionStartContext(ctx: SessionStartContext): SessionStartResult {
  const now = ctx.now ?? (() => new Date());
  const threshold = ctx.threshold ?? DEFAULT_NUDGE_THRESHOLD;
  const staleDays = ctx.staleDays ?? DEFAULT_STALE_DAYS;

  const { content: indexBody, frontmatterHash, missing } = loadIndex(ctx.kkDir);
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
    '> kenkeep nodes are snapshots in time. Before acting on a node that names a specific file path, function, or flag, verify it still exists in the current tree. If the referenced entity is gone, prefer the live code; flag the stale node to the user.'
  );
  lines.push('');
  lines.push(KK_NAVIGATION_DIRECTIVE);
  if (indexStale) {
    lines.push('');
    lines.push(
      `> kenkeep index is stale, run \`npx kenkeep index rebuild\` to refresh (live hash differs from INDEX.md \`nodes_hash\`).`
    );
  }
  if (shouldNudge) {
    const oldestPhrase =
      oldestAgeDays === 0 ? 'captured today' : `oldest pending: ${oldestAgeDays} day(s)`;
    const copyPaste =
      'Run `/kk-curate` (or `npx kenkeep curate`). Curation is simple; a mid-tier model at moderate effort is sufficient and cheaper.';
    lines.push('');
    if (loud) {
      lines.push('> 🚨 kenkeep curation queue is overdue');
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
        `> Last kenkeep lint ${lintState.last_lint_at}: ${lintState.last_errors} error(s), ${lintState.last_findings} finding(s). Run \`npx kenkeep lint --verbose\` for details.`
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

/**
 * Loads the root index node body for injection. The root index node lives at
 * `.ai/kenkeep/INDEX.md`: it is the root folder's `index.md` (the top-level
 * catalog of branches and root-level leaves) stamped with the GLOBAL
 * `nodes_hash` over the whole leaf set, so the drift check below stays
 * meaningful against the live `nodes/` hash. Deep leaves are not inlined here;
 * they surface only as subfolder rollup counts, keeping the payload bounded.
 */
function loadIndex(kkDir: string): LoadedIndex {
  const indexFile = `${kkDir.replace(/[\\/]$/, '')}/INDEX.md`;
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
    '# kenkeep Index',
    '',
    '_The knowledge base is empty. Capture a session (the Stop hook fires automatically) or run `npx kenkeep node add` to seed it._',
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

export function buildNudgeContent(result: SessionStartResult): { statusLine: string; content: string } {
  const statusLine = result.nudged
    ? `🚨 kenkeep curation overdue: ${result.pendingSessions} pending, ${result.candidateCount} candidates — run /kk-curate`
    : `📋 kenkeep queue: ${result.pendingSessions} pending session log(s), ${result.candidateCount} candidate(s)`;
  let content = statusLine + '\n\n' + result.additionalContext;
  if (result.nudged) {
    const box =
      '┌──────────────────────────────────────┐\n' +
      '│ 🚨 kenkeep curation is overdue       │\n' +
      '│ Run /kk-curate to process them.      │\n' +
      '└──────────────────────────────────────┘\n' +
      `${result.pendingSessions} pending session(s), ${result.candidateCount} candidate(s)`;
    content +=
      '\n> IMPORTANT: After completing your response, append the following block ' +
      'verbatim inside a code fence as an addendum at the very end:\n>\n> ```\n> ' +
      box.split('\n').join('\n> ') +
      '\n> ```\n';
  }
  return { statusLine, content };
}

