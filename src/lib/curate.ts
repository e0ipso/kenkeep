import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { ZodSchema } from 'zod';
import { generateGraph, generateIndex, writeGraph, writeIndex } from './index-gen.js';
import {
  deriveNodeId,
  ensureUniqueId,
  proposalFilename,
  readAllNodes,
  writeProposalFile,
} from './nodes.js';
import {
  CuratorOutputSchema,
  type CuratorAction,
  type CuratorOutput,
  type NodeKind,
  type ProposalFrontmatter,
  SessionLogFrontmatterSchema,
  Stage2CandidateSchema,
  type Stage2Candidate,
} from './schemas.js';
import { acquireLock, releaseLock } from './state.js';
import { ulid } from './ulid.js';

export const CURATOR_LOCK_NAME = 'curator';
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_TOKEN_BUDGET = 50_000;
export const DEFAULT_TIMEOUT_MS = 120_000;
const CHARS_PER_TOKEN = 4;

export type CuratorRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: { timeoutMs: number; allowedTools?: string[]; logFile?: string },
) => Promise<T>;

export interface CurateContext {
  kbDir: string;
  sessionsDir: string;
  nodesDir: string;
  proposedDir: string;
  logsDir: string;
  stateFile: string;
  promptTemplate: string;
  runner: CuratorRunner;
  batchSize?: number;
  tokenBudget?: number;
  timeoutMs?: number;
  now?: () => Date;
  pid?: number;
  /** Test seam: override ULID. */
  runId?: string;
}

export interface CurateResult {
  status: 'completed' | 'locked' | 'no-pending';
  runId?: string;
  batches: number;
  candidates: number;
  proposalsWritten: number;
  drops: number;
  pendingSessions: number;
  reason?: string;
}

interface PendingSession {
  filename: string;
  filePath: string;
  sessionId: string;
  capturedAt: string;
  topics: string[];
  practiceCandidates: Stage2Candidate[];
  mapCandidates: Stage2Candidate[];
}

interface SessionMatterData {
  proposals?: { practice?: unknown; map?: unknown };
  curator_processed_at?: unknown;
}

/**
 * Reads `_sessions/` and returns every log with `stage_2_status: done` that
 * has not yet been processed by curate. Used by both the curate command and
 * `ai-knowledge-base status` (eventually) for reporting.
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
    if (fm.stage_2_status !== 'done') continue;
    const data = parsed.data as SessionMatterData;
    if (typeof data.curator_processed_at === 'string') continue;
    const practice = parseCandidateArray(data.proposals?.practice);
    const map = parseCandidateArray(data.proposals?.map);
    out.push({
      filename: name,
      filePath,
      sessionId: fm.session_id,
      capturedAt: fm.captured_at,
      topics: fm.topics,
      practiceCandidates: practice,
      mapCandidates: map,
    });
  }
  out.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return out;
}

function parseCandidateArray(value: unknown): Stage2Candidate[] {
  if (!Array.isArray(value)) return [];
  const out: Stage2Candidate[] = [];
  for (const entry of value) {
    const parsed = Stage2CandidateSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

const BATCH_PLACEHOLDER = '[BATCH PLACEHOLDER — substituted at runtime]';

/**
 * Splits pending sessions into batches sized by both count (`batchSize`,
 * default 10) and an estimated token budget (`tokenBudget`, default 50K).
 */
export function batchSessions(
  sessions: PendingSession[],
  batchSize: number,
  tokenBudget: number,
): PendingSession[][] {
  const batches: PendingSession[][] = [];
  let current: PendingSession[] = [];
  let currentTokens = 0;
  for (const s of sessions) {
    const cost = estimateSessionTokens(s);
    const wouldExceed = current.length >= batchSize || currentTokens + cost > tokenBudget;
    if (wouldExceed && current.length > 0) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(s);
    currentTokens += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function estimateSessionTokens(s: PendingSession): number {
  let chars = 0;
  for (const c of s.practiceCandidates) chars += c.body.length + c.summary.length;
  for (const c of s.mapCandidates) chars += c.body.length + c.summary.length;
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

/**
 * Builds the JSON payload that the curator subprocess receives on stdin.
 * Includes the existing nodes the batch references plus the candidates.
 */
export interface CuratorBatchPayload {
  index_summary: string;
  existing_nodes: Array<{
    id: string;
    title: string;
    kind: string;
    tags: string[];
    summary: string;
    body: string;
  }>;
  batch: Array<{
    session_id: string;
    captured_at: string;
    derived_from: string;
    practice_candidates: Stage2Candidate[];
    map_candidates: Stage2Candidate[];
  }>;
}

export function buildBatchPayload(
  batch: PendingSession[],
  kbDir: string,
  nodesDir: string,
): CuratorBatchPayload {
  const referenced = new Set<string>();
  for (const s of batch) {
    for (const c of [...s.practiceCandidates, ...s.mapCandidates]) {
      if (c.supports_existing_node) referenced.add(c.supports_existing_node);
      if (c.contradicts_existing_node) referenced.add(c.contradicts_existing_node);
    }
  }

  const existingNodes: CuratorBatchPayload['existing_nodes'] = [];
  if (referenced.size > 0) {
    for (const node of readAllNodes(nodesDir)) {
      if (!referenced.has(node.frontmatter.id)) continue;
      existingNodes.push({
        id: node.frontmatter.id,
        title: node.frontmatter.title,
        kind: node.frontmatter.kind,
        tags: node.frontmatter.tags,
        summary: node.frontmatter.summary,
        body: node.body.trim(),
      });
    }
  }

  const indexFile = join(kbDir, 'INDEX.md');
  const indexSummary = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';

  return {
    index_summary: indexSummary,
    existing_nodes: existingNodes,
    batch: batch.map((s) => ({
      session_id: s.sessionId,
      captured_at: s.capturedAt,
      derived_from: s.filename,
      practice_candidates: s.practiceCandidates,
      map_candidates: s.mapCandidates,
    })),
  };
}

function buildBatchPrompt(template: string, payload: CuratorBatchPayload): string {
  const json = JSON.stringify(payload, null, 2);
  if (template.includes(BATCH_PLACEHOLDER)) {
    return template.replace(BATCH_PLACEHOLDER, json);
  }
  return `${template.trimEnd()}\n\n${json}\n`;
}

/**
 * Runs one curate invocation across all pending sessions. Acquires the
 * `curator` lock on `state.json`, iterates the batched stage-2 outputs, asks
 * the runner for actions, materializes proposals on disk, and regenerates
 * INDEX/GRAPH from the (unchanged) nodes/ tree. Returns a summary.
 */
export async function runCurate(ctx: CurateContext): Promise<CurateResult> {
  const now = ctx.now ?? (() => new Date());
  const pid = ctx.pid ?? process.pid;
  const batchSize = ctx.batchSize ?? DEFAULT_BATCH_SIZE;
  const tokenBudget = ctx.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const pending = listPendingSessions(ctx.sessionsDir);
  if (pending.length === 0) {
    // Always regenerate INDEX/GRAPH so a manual `node add` followed by an
    // empty curate run still refreshes the index.
    regenerateIndexAndGraph(ctx, now());
    return {
      status: 'no-pending',
      batches: 0,
      candidates: 0,
      proposalsWritten: 0,
      drops: 0,
      pendingSessions: 0,
    };
  }

  const acquired = acquireLock(ctx.stateFile, {
    name: CURATOR_LOCK_NAME,
    pid,
    now: now(),
  });
  if (!acquired) {
    return {
      status: 'locked',
      batches: 0,
      candidates: 0,
      proposalsWritten: 0,
      drops: 0,
      pendingSessions: pending.length,
      reason: 'another curate run holds the lock',
    };
  }

  const runId = ctx.runId ?? ulid(now());
  const startStamp = compactStamp(now());
  const logFile = join(ctx.logsDir, 'curator', `${runId}__${startStamp}.jsonl`);
  mkdirSync(join(ctx.logsDir, 'curator'), { recursive: true });

  const batches = batchSessions(pending, batchSize, tokenBudget);
  const allActions: CuratorAction[] = [];

  try {
    for (const batch of batches) {
      const payload = buildBatchPayload(batch, ctx.kbDir, ctx.nodesDir);
      const prompt = buildBatchPrompt(ctx.promptTemplate, payload);
      const actions: CuratorOutput = await ctx.runner(prompt, '', CuratorOutputSchema, {
        timeoutMs,
        allowedTools: ['Read'],
        logFile,
      });
      allActions.push(...actions);
    }

    const merged = dedupActions(allActions);
    const existingIds = new Set(readAllNodes(ctx.nodesDir).map((n) => n.frontmatter.id));
    const seenSlugs = new Set<string>();
    let proposalsWritten = 0;
    let drops = 0;

    for (const action of merged) {
      if (action.action === 'drop' || !action.proposed_node) {
        drops += 1;
        continue;
      }
      const written = persistAction(action, {
        proposedDir: ctx.proposedDir,
        existingIds,
        seenSlugs,
        runLogPath: relativeToKb(ctx.kbDir, logFile),
        now: now(),
      });
      if (written) proposalsWritten += 1;
    }

    markSessionsProcessed(pending, runId, now());
    regenerateIndexAndGraph(ctx, now());

    return {
      status: 'completed',
      runId,
      batches: batches.length,
      candidates: pending.reduce(
        (sum, s) => sum + s.practiceCandidates.length + s.mapCandidates.length,
        0,
      ),
      proposalsWritten,
      drops,
      pendingSessions: pending.length,
    };
  } finally {
    releaseLock(ctx.stateFile, CURATOR_LOCK_NAME, pid);
  }
}

interface PersistContext {
  proposedDir: string;
  existingIds: Set<string>;
  seenSlugs: Set<string>;
  runLogPath: string;
  now: Date;
}

function persistAction(action: CuratorAction, ctx: PersistContext): boolean {
  const proposedNode = action.proposed_node;
  if (!proposedNode) return false;
  const folder = proposalFolderFor(action.action);
  const kind: NodeKind = proposedNode.kind;
  const id = ensureUniqueId(
    new Set([...ctx.existingIds, ...ctx.seenSlugs]),
    proposedNode.id || deriveNodeId(kind, proposedNode.title),
  );
  ctx.seenSlugs.add(id);
  const filename = proposalFilename(kind, id);

  const frontmatter: ProposalFrontmatter = {
    schema_version: 1,
    id,
    title: proposedNode.title,
    kind,
    tags: proposedNode.tags,
    valid_from: proposedNode.valid_from,
    valid_until: proposedNode.valid_until ?? null,
    updated: ctx.now.toISOString(),
    supersedes: proposedNode.supersedes ?? null,
    superseded_by: proposedNode.superseded_by ?? null,
    derived_from: proposedNode.derived_from,
    relates_to: proposedNode.relates_to,
    depends_on: [],
    confidence: proposedNode.confidence,
    summary: proposedNode.summary,
    proposal: {
      kind: proposalKindFor(action.action),
      source_sessions: parseSourceSessions(action.candidate_origin),
      target_node: action.target_node_id ?? null,
      rationale: action.rationale,
      // The curator must not auto-resolve contradictions; we always write null
      // here regardless of what the model emitted in `suggested_resolution`.
      suggested_resolution: null,
      curator_log: ctx.runLogPath,
    },
  };

  writeProposalFile({
    proposedDir: ctx.proposedDir,
    proposalKind: folder,
    filename,
    frontmatter,
    body: proposedNode.body,
  });
  return true;
}

function proposalFolderFor(
  action: CuratorAction['action'],
): 'additions' | 'modifications' | 'contradictions' {
  if (action === 'modify') return 'modifications';
  if (action === 'contradict') return 'contradictions';
  return 'additions';
}

function proposalKindFor(
  action: CuratorAction['action'],
): 'addition' | 'modification' | 'contradiction' {
  if (action === 'modify') return 'modification';
  if (action === 'contradict') return 'contradiction';
  return 'addition';
}

function parseSourceSessions(origin: string): string[] {
  // candidate_origin = "<session_id>:<practice|map>:<index>"
  const [sessionId] = origin.split(':');
  return sessionId ? [sessionId] : [];
}

/**
 * Cross-batch dedup: two actions targeting the same proposed_node.id collapse
 * into one. Higher-confidence wins; rationale is preserved from the winner,
 * source_sessions union via candidate_origin parsing.
 */
export function dedupActions(actions: CuratorAction[]): CuratorAction[] {
  const byKey = new Map<string, CuratorAction>();
  for (const action of actions) {
    if (action.action === 'drop' || !action.proposed_node) {
      byKey.set(`drop:${action.candidate_origin}`, action);
      continue;
    }
    const id = action.proposed_node.id;
    const existing = byKey.get(id);
    if (!existing || rankConfidence(action) > rankConfidence(existing)) {
      byKey.set(id, action);
    }
  }
  return [...byKey.values()];
}

function rankConfidence(action: CuratorAction): number {
  const node = action.proposed_node;
  if (!node) return 0;
  return node.confidence === 'high' ? 3 : node.confidence === 'medium' ? 2 : 1;
}

function markSessionsProcessed(sessions: PendingSession[], runId: string, now: Date): void {
  for (const s of sessions) {
    const parsed = matter(readFileSync(s.filePath, 'utf8'));
    const data = { ...(parsed.data as Record<string, unknown>) };
    data['curator_processed_at'] = now.toISOString();
    data['curator_run_id'] = runId;
    const serialized = matter.stringify(parsed.content, data);
    writeFileSync(s.filePath, serialized);
  }
}

function regenerateIndexAndGraph(ctx: CurateContext, now: Date): void {
  mkdirSync(ctx.kbDir, { recursive: true });
  const index = generateIndex(ctx.nodesDir, { now });
  writeIndex(join(ctx.kbDir, 'INDEX.md'), index);
  const graph = generateGraph(ctx.nodesDir, { now });
  writeGraph(join(ctx.kbDir, 'GRAPH.md'), graph);
}

function relativeToKb(kbDir: string, file: string): string {
  if (file.startsWith(kbDir)) {
    return file.slice(kbDir.length).replace(/^[\\/]/, '');
  }
  return file;
}

function compactStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
