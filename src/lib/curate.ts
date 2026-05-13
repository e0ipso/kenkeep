import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { ZodSchema } from 'zod';
import { generateGraph, generateIndex, writeGraph, writeIndex } from './index-gen.js';
import {
  deriveNodeId,
  ensureUniqueId,
  nodeFileExists,
  readAllNodes,
  writeNodeFile,
} from './nodes.js';
import {
  type ConflictReport,
  CuratorOutputSchema,
  type CuratorAction,
  type CuratorOutput,
  type EffortLevel,
  type FailureReport,
  type ModelFamily,
  type NodeFrontmatter,
  type NodeKind,
  SessionLogFrontmatterSchema,
  ProposalCandidateSchema,
  type ProposalCandidate,
} from './schemas.js';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { chunk } from './chunk-batch.js';
import type { RepoPaths } from './paths.js';
import { STATE_LOCK_OPTIONS } from './state.js';
import { compactStamp } from './time.js';

export const CURATE_BATCH_SIZE = 10;
export const DEFAULT_TIMEOUT_MS = 120_000;

export type CuratorRunner = <T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: {
    timeoutMs: number;
    allowedTools?: string[];
    logFile?: string;
    model?: ModelFamily;
    effort?: EffortLevel;
    onMessage?: (msg: unknown) => void;
  }
) => Promise<T>;

export interface CurateContext {
  paths: RepoPaths;
  promptTemplate: string;
  runner: CuratorRunner;
  timeoutMs?: number;
  /** Called once before each batch is sent to the runner. */
  onBatchStart?: (info: { index: number; total: number; batch: PendingSession[] }) => void;
  /** Called once after each batch completes. */
  onBatchEnd?: (info: { index: number; total: number; durationMs: number }) => void;
  /** Forwarded to the runner so callers can stream curator events. */
  onCuratorMessage?: (msg: unknown) => void;
  /** Pre-computed curator log file path (used by the CLI to show it up front). */
  logFile?: string;
  model?: ModelFamily;
  effort?: EffortLevel;
}

export interface CurateResult {
  status: 'completed' | 'locked' | 'no-pending';
  runId: string;
  batches: number;
  candidates: number;
  nodesWritten: number;
  drops: number;
  pendingSessions: number;
  failures: FailureReport[];
  conflicts: ConflictReport[];
  reason?: string;
}

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

export const BATCH_PLACEHOLDER = '[BATCH PLACEHOLDER — substituted at runtime]';

/**
 * Builds the JSON payload that the curator subprocess receives on stdin.
 * Includes the existing nodes the batch references plus the candidates.
 */
export interface CuratorBatchPayload {
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
    practice_candidates: ProposalCandidate[];
    map_candidates: ProposalCandidate[];
  }>;
}

export function buildBatchPayload(
  batch: PendingSession[],
  nodesDir: string
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

  return {
    existing_nodes: existingNodes,
    batch: batch.map(s => ({
      session_id: s.sessionId,
      captured_at: s.capturedAt,
      derived_from: s.filename,
      practice_candidates: s.practiceCandidates,
      map_candidates: s.mapCandidates,
    })),
  };
}

export function buildBatchPrompt(template: string, payload: CuratorBatchPayload): string {
  const json = JSON.stringify(payload, null, 2);
  if (!template.includes(BATCH_PLACEHOLDER)) {
    throw new Error(
      `curator prompt is missing the ${BATCH_PLACEHOLDER} placeholder; the prompt template must contain it verbatim`,
    );
  }
  return template.replace(BATCH_PLACEHOLDER, json);
}

/**
 * Runs one curate invocation across all pending sessions. Acquires the
 * `curator` lock on `state.json`, iterates the batched proposal outputs, asks
 * the runner for actions, materializes proposals on disk, and regenerates
 * INDEX/GRAPH from the (unchanged) nodes/ tree. Returns a summary.
 */
export async function runCurate(ctx: CurateContext): Promise<CurateResult> {
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runId = randomUUID();
  const stateFile = join(ctx.paths.stateDir, 'state.json');

  const pending = listPendingSessions(ctx.paths.sessionsDir);
  if (pending.length === 0) {
    // Always regenerate INDEX/GRAPH so a manual `node add` followed by an
    // empty curate run still refreshes the index.
    regenerateIndexAndGraph(ctx);
    return {
      status: 'no-pending',
      runId,
      batches: 0,
      candidates: 0,
      nodesWritten: 0,
      drops: 0,
      pendingSessions: 0,
      failures: [],
      conflicts: [],
    };
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(stateFile, STATE_LOCK_OPTIONS);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOCKED') {
      return {
        status: 'locked',
        runId,
        batches: 0,
        candidates: 0,
        nodesWritten: 0,
        drops: 0,
        pendingSessions: pending.length,
        failures: [],
        conflicts: [],
        reason: 'another curate run holds the lock',
      };
    }
    throw err;
  }

  const startStamp = compactStamp(new Date());
  const logFile =
    ctx.logFile ?? join(ctx.paths.logsDir, 'curator', `${runId}__${startStamp}.jsonl`);
  mkdirSync(join(ctx.paths.logsDir, 'curator'), { recursive: true });

  const batches = chunk(pending, CURATE_BATCH_SIZE);
  const allActions: CuratorAction[] = [];

  try {
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]!;
      const payload = buildBatchPayload(batch, ctx.paths.nodesDir);
      const prompt = buildBatchPrompt(ctx.promptTemplate, payload);
      if (ctx.onBatchStart) ctx.onBatchStart({ index: i, total: batches.length, batch });
      const batchStartMs = Date.now();
      const runnerOpts: Parameters<CuratorRunner>[3] = {
        timeoutMs,
        allowedTools: ['Read'],
        logFile,
      };
      if (ctx.model !== undefined) runnerOpts.model = ctx.model;
      if (ctx.effort !== undefined) runnerOpts.effort = ctx.effort;
      if (ctx.onCuratorMessage) runnerOpts.onMessage = ctx.onCuratorMessage;
      const actions: CuratorOutput = await ctx.runner(prompt, '', CuratorOutputSchema, runnerOpts);
      if (ctx.onBatchEnd) {
        ctx.onBatchEnd({
          index: i,
          total: batches.length,
          durationMs: Date.now() - batchStartMs,
        });
      }
      allActions.push(...actions);
    }

    const merged = dedupActions(allActions);
    const existingNodes = readAllNodes(ctx.paths.nodesDir);
    const existingIds = new Set(existingNodes.map(n => n.frontmatter.id));
    const seenSlugs = new Set<string>();
    let nodesWritten = 0;
    let drops = 0;
    const failures: FailureReport[] = [];
    const conflicts: ConflictReport[] = [];

    for (const action of merged) {
      const outcome = persistAction(action, {
        nodesDir: ctx.paths.nodesDir,
        existingIds,
        seenSlugs,
        runId,
        now: new Date(),
      });
      switch (outcome.kind) {
        case 'wrote':
          nodesWritten += 1;
          break;
        case 'dropped':
          drops += 1;
          break;
        case 'failed':
          failures.push(outcome.failure);
          break;
        case 'conflict':
          conflicts.push(outcome.conflict);
          break;
      }
    }

    markSessionsProcessed(pending, runId, new Date());
    regenerateIndexAndGraph(ctx);

    return {
      status: 'completed',
      runId,
      batches: batches.length,
      candidates: pending.reduce(
        (sum, s) => sum + s.practiceCandidates.length + s.mapCandidates.length,
        0
      ),
      nodesWritten,
      drops,
      pendingSessions: pending.length,
      failures,
      conflicts,
    };
  } finally {
    if (release !== undefined) await release();
  }
}

interface PersistContext {
  nodesDir: string;
  existingIds: Set<string>;
  seenSlugs: Set<string>;
  runId: string;
  now: Date;
}

type PersistOutcome =
  | { kind: 'wrote' }
  | { kind: 'dropped' }
  | { kind: 'failed'; failure: FailureReport }
  | { kind: 'conflict'; conflict: ConflictReport };

function persistAction(action: CuratorAction, ctx: PersistContext): PersistOutcome {
  if (action.action === 'drop' || !action.proposed_node) {
    return { kind: 'dropped' };
  }
  const proposedNode = action.proposed_node;

  if (action.action === 'contradict') {
    return {
      kind: 'conflict',
      conflict: {
        id: `${ctx.runId}-${ctx.existingIds.size + ctx.seenSlugs.size + 1}`,
        detected_at: ctx.now.toISOString(),
        run_id: ctx.runId,
        candidate_origin: action.candidate_origin,
        target_node_id: action.target_node_id ?? null,
        rationale: action.rationale,
        proposed_node: proposedNode,
      },
    };
  }

  const kind: NodeKind = proposedNode.kind;

  if (action.action === 'modify') {
    const targetId = action.target_node_id ?? proposedNode.id;
    if (!targetId || !ctx.existingIds.has(targetId)) {
      return {
        kind: 'failed',
        failure: {
          reason: 'modify_missing_target',
          candidate_origin: action.candidate_origin,
          node_id: targetId ?? proposedNode.id,
          detail: `modify target ${targetId ?? '(unset)'} not found in nodes/`,
        },
      };
    }
    const frontmatter = buildNodeFrontmatter(proposedNode, targetId);
    writeNodeFile({ nodesDir: ctx.nodesDir, frontmatter, body: proposedNode.body });
    return { kind: 'wrote' };
  }

  // action === 'add'
  const baseId = proposedNode.id || deriveNodeId(kind, proposedNode.title);
  if (ctx.existingIds.has(baseId) || nodeFileExists(ctx.nodesDir, kind, baseId)) {
    return {
      kind: 'failed',
      failure: {
        reason: 'add_collision',
        candidate_origin: action.candidate_origin,
        node_id: baseId,
        detail: `add target nodes/${kind}/${baseId}.md already exists; rerun curate or escalate to modify`,
      },
    };
  }
  const id = ensureUniqueId(new Set([...ctx.existingIds, ...ctx.seenSlugs]), baseId);
  ctx.seenSlugs.add(id);
  const frontmatter = buildNodeFrontmatter(proposedNode, id);
  writeNodeFile({ nodesDir: ctx.nodesDir, frontmatter, body: proposedNode.body });
  return { kind: 'wrote' };
}

function buildNodeFrontmatter(
  proposedNode: NonNullable<CuratorAction['proposed_node']>,
  id: string
): NodeFrontmatter {
  return {
    schema_version: 1,
    id,
    title: proposedNode.title,
    kind: proposedNode.kind,
    tags: proposedNode.tags,
    derived_from: proposedNode.derived_from,
    relates_to: proposedNode.relates_to,
    confidence: proposedNode.confidence,
    summary: proposedNode.summary,
  };
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

function regenerateIndexAndGraph(ctx: CurateContext): void {
  mkdirSync(ctx.paths.kbDir, { recursive: true });
  const index = generateIndex(ctx.paths.nodesDir);
  writeIndex(join(ctx.paths.kbDir, 'INDEX.md'), index);
  const graph = generateGraph(ctx.paths.nodesDir);
  writeGraph(join(ctx.paths.kbDir, 'GRAPH.md'), graph);
}

export function curatorLogFile(logsDir: string, runId: string, now: Date): string {
  return join(logsDir, 'curator', `${runId}__${compactStamp(now)}.jsonl`);
}

