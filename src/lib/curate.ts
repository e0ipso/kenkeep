import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { deriveNodeId } from './nodes.js';
import {
  type CuratorAction,
  SessionLogFrontmatterSchema,
  ProposalCandidateSchema,
  type ProposalCandidate,
} from './schemas.js';

/**
 * Prefix used to encode `candidate_origin` for harness-memory candidates.
 * In-host curators (skills) stamp this prefix when a candidate comes from a
 * harness auto-memory IRI rather than a session log; downstream code uses it
 * to attribute `derived_from` to the source IRI.
 */
export const MEMORY_ORIGIN_PREFIX = 'harness-memory:';

export interface PendingSession {
  filename: string;
  filePath: string;
  sessionId: string;
  capturedAt: string;
  practiceCandidates: ProposalCandidate[];
  mapCandidates: ProposalCandidate[];
}

interface SessionMatterData {
  proposals?: { practice?: unknown; map?: unknown };
  curator_processed_at?: unknown;
}

/**
 * Reads `_sessions/` and returns every log with `proposal_status: done` that
 * has not yet been processed by curate. Used by the `curate dedup` primitive
 * and by `kenkeep status` for reporting.
 */
export function listPendingSessions(sessionsDir: string): PendingSession[] {
  if (!existsSync(sessionsDir)) return [];
  const out: PendingSession[] = [];
  for (const name of readdirSync(sessionsDir)) {
    if (!name.endsWith('.md')) continue;
    const filePath = join(sessionsDir, name);
    const parsed = matter(readFileSync(filePath, 'utf8'));
    const fmCheck = SessionLogFrontmatterSchema.safeParse(parsed.data);
    if (!fmCheck.success) continue;
    const fm = fmCheck.data;
    if (fm.proposal_status !== 'done') continue;
    const data = parsed.data as SessionMatterData;
    if (typeof data.curator_processed_at === 'string') continue;
    const practice = parseCandidateArray(data.proposals?.practice);
    const map = parseCandidateArray(data.proposals?.map);
    out.push({
      filename: name,
      filePath,
      sessionId: fm.session_id,
      capturedAt: fm.captured_at,
      practiceCandidates: practice,
      mapCandidates: map,
    });
  }
  out.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return out;
}

function parseCandidateArray(value: unknown): ProposalCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ProposalCandidate[] = [];
  for (const entry of value) {
    const parsed = ProposalCandidateSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Cross-batch dedup: two actions producing the same node (same target on
 * modify, or same slug derived from kind+title on add) collapse into one.
 * Higher-confidence wins.
 */
export function dedupActions(actions: CuratorAction[]): CuratorAction[] {
  const byKey = new Map<string, CuratorAction>();
  for (const action of actions) {
    if (action.action === 'drop' || !action.proposed_node) {
      byKey.set(`drop:${action.candidate_origin}`, action);
      continue;
    }
    const node = action.proposed_node;
    const key = action.target_node_id ?? deriveNodeId(node.kind, node.title);
    const existing = byKey.get(key);
    if (!existing || rankConfidence(action) > rankConfidence(existing)) {
      byKey.set(key, action);
    }
  }
  return [...byKey.values()];
}

function rankConfidence(action: CuratorAction): number {
  const node = action.proposed_node;
  if (!node) return 0;
  return node.confidence === 'high' ? 3 : node.confidence === 'medium' ? 2 : 1;
}

/**
 * Stamps `curator_processed_at` / `curator_run_id` into the frontmatter of
 * each pending session file. Exported so the standalone `curate dedup`
 * primitive can apply the same mark from the CLI.
 */
export function markSessionsProcessed(sessions: PendingSession[], runId: string, now: Date): void {
  for (const s of sessions) {
    const parsed = matter(readFileSync(s.filePath, 'utf8'));
    const data = { ...(parsed.data as Record<string, unknown>) };
    data['curator_processed_at'] = now.toISOString();
    data['curator_run_id'] = runId;
    const serialized = matter.stringify(parsed.content, data);
    writeFileSync(s.filePath, serialized);
  }
}

/**
 * Mints the deterministic conflict-file id used by the `curate dedup`
 * primitive. The shape `${runId}-${n}` is the authoritative public contract
 * for conflict filenames — keep this helper in sync with any test that
 * asserts it.
 */
export function mintConflictId(runId: string, n: number): string {
  return `${runId}-${n}`;
}
