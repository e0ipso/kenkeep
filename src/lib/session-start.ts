import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { computeNodesHash } from './nodes.js';
import { IndexFrontmatterSchema, SessionLogFrontmatterSchema } from './schemas.js';
import { readState, writeState } from './state.js';

export const DEFAULT_NUDGE_THRESHOLD = 5;
export const NUDGE_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export interface SessionStartContext {
  kbDir: string;
  nodesDir: string;
  sessionsDir: string;
  stateFile: string;
  threshold?: number;
  throttleMs?: number;
  now?: () => Date;
}

export interface SessionStartResult {
  /** Markdown text intended for injection into the session. */
  additionalContext: string;
  /** True if a nudge line was appended this run (and state mutated). */
  nudged: boolean;
  /** True if the index was missing and a stub was generated. */
  indexMissing: boolean;
  /** True if INDEX.md exists but its nodes_hash does not match nodes/. */
  indexStale: boolean;
  /** Number of pending session logs (stage_2 done, not curated). */
  pendingSessions: number;
}

/**
 * Builds the additional-context payload for the SessionStart sync hook.
 *
 * 1. Reads INDEX.md (or returns a "KB is empty" stub if missing).
 * 2. Detects staleness by comparing the frontmatter `nodes_hash` against
 *    the live hash of `nodes/`. If mismatched, appends a warning line.
 * 3. Counts pending session logs and, when ≥ threshold and not throttled,
 *    appends a nudge and persists `last_nudged_at` to `state.json`.
 *
 * Pure-ish: the only side effect is the state.json write when a nudge fires.
 */
export function buildSessionStartContext(ctx: SessionStartContext): SessionStartResult {
  const now = ctx.now ?? (() => new Date());
  const threshold = ctx.threshold ?? DEFAULT_NUDGE_THRESHOLD;
  const throttleMs = ctx.throttleMs ?? NUDGE_THROTTLE_MS;

  const { content: indexBody, frontmatterHash, missing } = loadIndex(ctx.kbDir);
  const liveHash = computeNodesHash(ctx.nodesDir);
  const indexStale = !missing && frontmatterHash !== null && frontmatterHash !== liveHash;

  const pending = countPendingSessions(ctx.sessionsDir);
  const state = readState(ctx.stateFile);
  const nowDate = now();
  const lastNudgedAt = parseLastNudgedAt(state.last_nudged_at ?? null);
  const throttled =
    lastNudgedAt !== null && nowDate.getTime() - lastNudgedAt.getTime() < throttleMs;
  const shouldNudge = pending >= threshold && !throttled;

  const lines: string[] = [];
  lines.push(indexBody.trim());
  if (indexStale) {
    lines.push('');
    lines.push(
      `> KB index is stale — run \`ai-knowledge-base index rebuild\` to refresh (live hash differs from INDEX.md \`nodes_hash\`).`,
    );
  }
  if (shouldNudge) {
    lines.push('');
    lines.push(
      `> You have ${pending} pending session log(s). Run \`/kb-curate\` (or \`ai-knowledge-base curate\`) when ready.`,
    );
  }

  if (shouldNudge) {
    writeState(ctx.stateFile, { ...state, last_nudged_at: nowDate.toISOString() });
  }

  return {
    additionalContext: lines.join('\n') + '\n',
    nudged: shouldNudge,
    indexMissing: missing,
    indexStale,
    pendingSessions: pending,
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
    '_The knowledge base is empty. Capture a session (the Stop hook fires automatically) or run `ai-knowledge-base node add` to seed it._',
  ].join('\n');
}

function normalizeNodesHash(value: string): string {
  // Stored as "sha256:<hex>"; compare against the raw hex from
  // `computeNodesHash` by stripping the prefix.
  return value.startsWith('sha256:') ? value.slice(7) : value;
}

/**
 * Counts session logs that are stage-2-done but not yet curated. Mirrors the
 * filter used by `listPendingSessions` in `src/lib/curate.ts`. Kept here so
 * the consume hook does not have to load the entire curate module.
 */
export function countPendingSessions(sessionsDir: string): number {
  if (!existsSync(sessionsDir)) return 0;
  let count = 0;
  for (const name of readdirSync(sessionsDir)) {
    if (!name.endsWith('.md')) continue;
    const file = join(sessionsDir, name);
    try {
      const parsed = matter(readFileSync(file, 'utf8'));
      const fm = SessionLogFrontmatterSchema.safeParse(parsed.data);
      if (!fm.success) continue;
      if (fm.data.stage_2_status !== 'done') continue;
      const data = parsed.data as { curator_processed_at?: unknown };
      if (typeof data.curator_processed_at === 'string') continue;
      count += 1;
    } catch {
      // Skip unreadable session logs; doctor will surface them.
    }
  }
  return count;
}

function parseLastNudgedAt(value: string | null): Date | null {
  if (value === null) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}
