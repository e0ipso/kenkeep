import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { hostname as osHostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import matter from 'gray-matter';
import { computeNodesHash } from './nodes.js';
import { readLintState } from './lint-state.js';
import { sendOsNotification } from './notifications.js';
import { notificationIconPath } from './paths.js';
import { IndexFrontmatterSchema, SessionLogFrontmatterSchema } from './schemas.js';
import type { EffectiveSettings } from './settings.js';
import { readState, writeState } from './state.js';

export const DEFAULT_NUDGE_THRESHOLD = 20;
export const DEFAULT_STALE_DAYS = 7;

/**
 * The descent navigation directive. The single source of truth for "how to
 * navigate the tree", reused verbatim by three surfaces: it is embedded in every
 * generated `index.md`/`ENTRY.md` body (`src/lib/index-gen.ts`) so a file is
 * self-describing in isolation; injected once at SessionStart (the hook appends
 * it only when the loaded body does not already embed it, so the injected
 * catalog carries it exactly once); and stamped into the static AGENTS.md
 * kk-index pointer block (see `src/commands/init.ts`). Sourcing every surface
 * from this one constant keeps them from ever drifting apart.
 *
 * The directive describes how to navigate the tree-structured knowledge base:
 * enter at the injected root index node, pick the branches whose intent and tags
 * match the task, read those branch index nodes, descend only as deep as the
 * task needs, open only confirmed-relevant leaves, and follow cross edges to
 * reach related leaves in other branches. Multiple branches can be relevant and
 * the agent chooses how deep to go.
 */
export const KK_NAVIGATION_DIRECTIVE =
  "> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.";

export interface SessionStartContext {
  kkDir: string;
  nodesDir: string;
  sessionsDir: string;
  stateFile: string;
  lintStateFile?: string;
  repoRoot?: string;
  hostName?: string;
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
  /** True if the entry catalog exists but its nodes_hash does not match nodes/. */
  indexStale: boolean;
  /** True when the curation nudge has escalated from backlog to overdue. */
  curationLoud: boolean;
  /** Number of session logs in the curation backlog, including logs awaiting extraction. */
  pendingSessions: number;
  /** Total candidate proposals across extracted logs in the curation backlog. */
  candidateCount: number;
  /** Age in days of the oldest session in the curation backlog, when one exists. */
  oldestPendingAgeDays: number | null;
  /** Repo root that produced this session-start result. */
  repoRoot: string;
  /** Human-facing project name derived from the repo root. */
  projectName: string;
  /** Runtime hostname that produced this session-start result. */
  hostName: string;
}

/**
 * Builds the additional-context payload for the SessionStart sync hook.
 *
 * 1. Reads the entry catalog (`.ai/kenkeep/ENTRY.md`, the whole-tree launchpad:
 *    totals plus the branch list) or returns a "kk is empty" stub if missing.
 *    Only the entry catalog is injected, never full leaf bodies; deep leaves
 *    surface as branch rollup counts, so the payload stays bounded by branch
 *    count, not total node count. The agent descends the tree on demand
 *    following `KK_NAVIGATION_DIRECTIVE`.
 * 2. Detects staleness by comparing the entry catalog's frontmatter
 *    `nodes_hash` (the global hash over the whole leaf set) against the live hash
 *    of `nodes/`. If mismatched, appends a warning line.
 * 3. Counts the curation backlog and, when >= threshold,
 *    appends a nudge and persists `last_nudged_at` to `state.json`.
 *
 * Pure-ish: the only side effect is the state.json write when a nudge fires.
 */
export function buildSessionStartContext(ctx: SessionStartContext): SessionStartResult {
  const now = ctx.now ?? (() => new Date());
  const threshold = ctx.threshold ?? DEFAULT_NUDGE_THRESHOLD;
  const staleDays = ctx.staleDays ?? DEFAULT_STALE_DAYS;
  const repoRoot = ctx.repoRoot ?? dirname(dirname(ctx.kkDir));
  const projectName = basename(repoRoot) || repoRoot;
  const hostName = ctx.hostName ?? osHostname();

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
  const trimmedBody = indexBody.trim();
  lines.push(trimmedBody);
  lines.push('');
  lines.push(
    '> kenkeep nodes are snapshots in time. Before acting on a node that names a specific file path, function, or flag, verify it still exists in the current tree. If the referenced entity is gone, prefer the live code; flag the stale node to the user.'
  );
  // The generated ENTRY.md body now embeds the descent directive itself, so
  // appending it again would double-print. Append only when the loaded body does
  // NOT already carry it — i.e. the legacy INDEX.md fallback (seeded before the
  // rename, not yet rebuilt) — so the injected catalog always contains the
  // directive exactly once. `KK_NAVIGATION_DIRECTIVE` stays the single source.
  if (!trimmedBody.includes(KK_NAVIGATION_DIRECTIVE)) {
    lines.push('');
    lines.push(KK_NAVIGATION_DIRECTIVE);
  }

  let lintNudged = false;
  if (ctx.lintStateFile !== undefined) {
    const lintState = readLintState(ctx.lintStateFile);
    if (lintState.last_errors > 0 || lintState.last_findings > 0) {
      lintNudged = true;
    }
  }

  const result: SessionStartResult = {
    additionalContext: '',
    nudged: shouldNudge,
    lintNudged,
    indexMissing: missing,
    indexStale,
    curationLoud: loud,
    pendingSessions: pending,
    candidateCount: summary.candidateCount,
    oldestPendingAgeDays: summary.oldestCapturedAt === null ? null : oldestAgeDays,
    repoRoot,
    projectName,
    hostName,
  };

  const attentionBlock = buildActionableBlock(result, { includeLabel: true });
  if (attentionBlock !== null) {
    lines.push('');
    lines.push(attentionBlock);
  }

  if (shouldNudge) {
    writeState(ctx.stateFile, { ...state, last_nudged_at: nowDate.toISOString() });
  }

  result.additionalContext = lines.join('\n') + '\n';
  return result;
}

interface LoadedIndex {
  content: string;
  frontmatterHash: string | null;
  missing: boolean;
}

/**
 * Loads the entry catalog body for injection. The entry catalog lives at
 * `.ai/kenkeep/ENTRY.md`: the whole-tree launchpad (totals plus the branch list)
 * stamped with the GLOBAL `nodes_hash` over the whole leaf set, so the drift
 * check below stays meaningful against the live `nodes/` hash. Deep leaves are
 * not inlined here; they surface only as branch rollup counts.
 *
 * Repos seeded before the rename carry the old catalog at `INDEX.md`. We fall
 * back to it so an upgraded-but-not-yet-rebuilt repo still gets a useful (if
 * old-format) injection; the next `index rebuild` writes `ENTRY.md` and removes
 * the legacy file.
 */
function loadIndex(kkDir: string): LoadedIndex {
  const base = kkDir.replace(/[\\/]$/, '');
  const entryFile = `${base}/ENTRY.md`;
  const indexFile = existsSync(entryFile) ? entryFile : `${base}/INDEX.md`;
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
    '# kenkeep',
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
 * Single-pass walk over `_sessions/*.md` returning the curation backlog count, the
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
 * that only need the curation backlog count.
 */
export function countPendingSessions(sessionsDir: string): number {
  return summarizePendingSessions(sessionsDir).pending;
}

export function buildNudgeContent(result: SessionStartResult): {
  statusLine: string;
  content: string;
} {
  const identity = `${result.projectName} on ${result.hostName}`;
  const statusLine =
    primaryAction(result) ??
    `kenkeep: ${identity}. Curation queue: ${result.pendingSessions} session log(s) awaiting curation, ${result.candidateCount} candidate(s).`;
  let content = statusLine + '\n\n' + result.additionalContext;
  if (result.nudged) {
    const box =
      '┌──────────────────────────────────────┐\n' +
      '│ 🚨 kenkeep curation is overdue       │\n' +
      '│ Run /kk-curate to process them.      │\n' +
      '└──────────────────────────────────────┘\n' +
      `${result.pendingSessions} session(s) awaiting curation, ${result.candidateCount} candidate(s)`;
    content +=
      '\nIMPORTANT: After completing your response, append the following block ' +
      'verbatim at the very end:\n' +
      box +
      '\n';
  }
  return { statusLine, content };
}

export function buildSessionStartNotifications(
  result: SessionStartResult
): Array<{ title: string; body: string }> {
  const body = buildActionableBlock(result, { includeLabel: false });
  if (body === null) return [];
  return [
    {
      title: `kenkeep: ${result.projectName} on ${result.hostName}`,
      body,
    },
  ];
}

export function sendSessionStartNotifications(
  settings: Pick<EffectiveSettings, 'notifications'>,
  result: SessionStartResult,
  kkDir: string
): void {
  if (!settings.notifications.enabled) return;
  const iconPath = notificationIconPath(kkDir);
  for (const notification of buildSessionStartNotifications(result)) {
    sendOsNotification(notification, { iconPath });
  }
}

interface ActionableSignal {
  severity: number;
  issue: string;
  action: string;
}

function buildActionableSignals(result: SessionStartResult): ActionableSignal[] {
  const signals: ActionableSignal[] = [];

  if (result.indexStale) {
    signals.push({
      severity: 2,
      issue: 'ENTRY.md is stale because nodes changed since the last index rebuild.',
      action: 'Run npx kenkeep index rebuild.',
    });
  }

  if (result.nudged) {
    const ageSuffix =
      result.oldestPendingAgeDays === null
        ? ''
        : result.oldestPendingAgeDays === 0
          ? ' Oldest uncurated capture: today.'
          : ` Oldest uncurated capture: ${result.oldestPendingAgeDays} day(s) old.`;
    signals.push({
      severity: result.curationLoud ? 3 : 1,
      issue: `${result.curationLoud ? 'Curation queue is overdue' : 'Curation queue awaits review'}: ${result.pendingSessions} session log(s) awaiting curation, ${result.candidateCount} candidate proposal(s).${ageSuffix}`,
      action: 'Run /kk-curate.',
    });
  }

  if (result.lintNudged) {
    signals.push({
      severity: 2,
      issue: 'Lint findings were recorded in the last kenkeep lint run.',
      action: 'Run npx kenkeep lint --verbose.',
    });
  }

  return signals.sort((a, b) => b.severity - a.severity);
}

function buildActionableBlock(
  result: SessionStartResult,
  opts: { includeLabel: boolean }
): string | null {
  const signals = buildActionableSignals(result);
  if (signals.length === 0) return null;

  const lines: string[] = [];
  if (opts.includeLabel) {
    lines.push('KENKEEP ATTENTION');
  }
  lines.push(`Project: ${result.projectName}`);
  lines.push(`Host: ${result.hostName}`);
  lines.push(`Path: ${result.repoRoot}`);

  for (const signal of signals) {
    lines.push('');
    lines.push(`Issue: ${signal.issue}`);
    lines.push(`Action: ${signal.action}`);
  }

  return lines.join('\n');
}

function primaryAction(result: SessionStartResult): string | null {
  const identity = `${result.projectName} on ${result.hostName}`;
  const signals = buildActionableSignals(result);
  const firstSignal = signals[0];
  if (firstSignal === undefined) return null;
  return `kenkeep: ${identity}. Action needed: ${firstSignal.action}`;
}
