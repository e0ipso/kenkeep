import { z } from 'zod';

export const CaptureTriggerSchema = z.enum(['stop', 'session_end', 'pre_compact', 'manual']);
export type CaptureTrigger = z.infer<typeof CaptureTriggerSchema>;

export const GitleaksStatusSchema = z.enum(['clean', 'redacted', 'blocked', 'skipped']);
export type GitleaksStatus = z.infer<typeof GitleaksStatusSchema>;

export const Stage2StatusSchema = z.enum(['pending', 'done', 'failed', 'skipped']);
export type Stage2Status = z.infer<typeof Stage2StatusSchema>;

export const SessionLogFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  session_id: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  transcript_hash: z.string(),
  stage_2_status: Stage2StatusSchema,
  stage_2_completed_at: z.string().nullable(),
  stage_2_error: z.string().nullable(),
  stage_2_log: z.string().nullable(),
  gitleaks_status: GitleaksStatusSchema,
  topics: z.array(z.string()),
  proposals: z.object({
    practice: z.array(z.unknown()),
    map: z.array(z.unknown()),
  }),
});

export type SessionLogFrontmatter = z.infer<typeof SessionLogFrontmatterSchema>;

export const QueueEntrySchema = z.object({
  session_id: z.string(),
  session_log: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  attempts: z.number().int().nonnegative(),
});

export type QueueEntry = z.infer<typeof QueueEntrySchema>;

export const QueueFileSchema = z.object({
  schema_version: z.literal(1),
  entries: z.array(QueueEntrySchema),
});

export type QueueFile = z.infer<typeof QueueFileSchema>;

export const DedupCacheEntrySchema = z.object({
  hash: z.string(),
  expires_at: z.string(),
});

export const DedupCacheFileSchema = z.object({
  schema_version: z.literal(1),
  entries: z.array(DedupCacheEntrySchema),
});

export type DedupCacheFile = z.infer<typeof DedupCacheFileSchema>;

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const Stage2CandidateSchema = z.object({
  kind: z.enum(['practice', 'map']),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable(),
});

export type Stage2Candidate = z.infer<typeof Stage2CandidateSchema>;

export const Stage2OutputSchema = z.object({
  practice: z.array(Stage2CandidateSchema),
  map: z.array(Stage2CandidateSchema),
});

export type Stage2Output = z.infer<typeof Stage2OutputSchema>;

export const StateLockSchema = z.object({
  name: z.string(),
  pid: z.number().int(),
  acquired_at: z.string(),
  ttl_ms: z.number().int().positive(),
});

export type StateLock = z.infer<typeof StateLockSchema>;

export const StateFileSchema = z.object({
  schema_version: z.literal(1),
  lock: StateLockSchema.nullable().optional(),
  last_nudged_at: z.string().nullable().optional(),
});

export type StateFile = z.infer<typeof StateFileSchema>;

export const NodeKindSchema = z.enum(['practice', 'map']);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const NodeFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  updated: z.string(),
  supersedes: z.string().nullable(),
  superseded_by: z.string().nullable(),
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  depends_on: z.array(z.string()),
  confidence: ConfidenceSchema,
  summary: z.string(),
});
export type NodeFrontmatter = z.infer<typeof NodeFrontmatterSchema>;

export const ProposalKindSchema = z.enum(['addition', 'modification', 'contradiction']);
export type ProposalKind = z.infer<typeof ProposalKindSchema>;

export const ProposalBlockSchema = z.object({
  kind: ProposalKindSchema,
  source_sessions: z.array(z.string()),
  target_node: z.string().nullable(),
  rationale: z.string(),
  suggested_resolution: z.enum(['supersede', 'keep_both', 'reject']).nullable(),
  curator_log: z.string().nullable(),
});
export type ProposalBlock = z.infer<typeof ProposalBlockSchema>;

export const ProposalFrontmatterSchema = NodeFrontmatterSchema.extend({
  proposal: ProposalBlockSchema,
});
export type ProposalFrontmatter = z.infer<typeof ProposalFrontmatterSchema>;

/**
 * Curator output schema: one entry per stage-2 candidate. Drops omit
 * `proposed_node`; add/modify/contradict include it (without `proposal`
 * block — the curator wrapper builds that).
 */
export const CuratorProposedNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  supersedes: z.string().nullable(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  superseded_by: z.string().nullable(),
});
export type CuratorProposedNode = z.infer<typeof CuratorProposedNodeSchema>;

export const CuratorActionSchema = z.object({
  action: z.enum(['add', 'modify', 'contradict', 'drop']),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: z.string(),
  suggested_resolution: z.enum(['supersede', 'keep_both', 'reject']).nullable(),
});
export type CuratorAction = z.infer<typeof CuratorActionSchema>;

export const CuratorOutputSchema = z.array(CuratorActionSchema);
export type CuratorOutput = z.infer<typeof CuratorOutputSchema>;

export const IndexFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string(),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
  budget_tokens: z.number().int().positive(),
});
export type IndexFrontmatter = z.infer<typeof IndexFrontmatterSchema>;

export const GraphFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string(),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
export type GraphFrontmatter = z.infer<typeof GraphFrontmatterSchema>;

/**
 * Candidate emitted by the bootstrap-incremental prompt. Same shape as the
 * stage-2 candidate plus `derived_from` (the source-doc paths the chunk
 * provided). `supports_existing_node` and `contradicts_existing_node` are
 * always null in bootstrap output (the prompt forces this) but kept in the
 * schema to match the shared candidate shape.
 */
export const BootstrapCandidateSchema = z.object({
  kind: z.enum(['practice', 'map']),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  derived_from: z.array(z.string()),
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable(),
});
export type BootstrapCandidate = z.infer<typeof BootstrapCandidateSchema>;

export const BootstrapOutputSchema = z.object({
  practice: z.array(BootstrapCandidateSchema),
  map: z.array(BootstrapCandidateSchema),
});
export type BootstrapOutput = z.infer<typeof BootstrapOutputSchema>;

export const BootstrapDocEntrySchema = z.object({
  content_sha256: z.string(),
  last_processed_at: z.string(),
  produced_proposals: z.array(z.string()),
});
export type BootstrapDocEntry = z.infer<typeof BootstrapDocEntrySchema>;

export const BootstrapStateSchema = z.object({
  schema_version: z.literal(1),
  last_full_bootstrap_at: z.string().nullable().optional(),
  last_incremental_at: z.string().nullable().optional(),
  docs: z.record(BootstrapDocEntrySchema),
});
export type BootstrapState = z.infer<typeof BootstrapStateSchema>;
