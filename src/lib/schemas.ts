import { z } from 'zod';

export const CaptureTriggerSchema = z.enum(['stop', 'session_end', 'pre_compact', 'manual']);
export type CaptureTrigger = z.infer<typeof CaptureTriggerSchema>;

export const SecretScanStatusSchema = z.enum(['clean', 'redacted', 'blocked', 'skipped']);
export type SecretScanStatus = z.infer<typeof SecretScanStatusSchema>;

export const ProposalStatusSchema = z.enum(['pending', 'done', 'failed', 'skipped']);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const SessionLogFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  session_id: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  transcript_hash: z.string(),
  proposal_status: ProposalStatusSchema,
  proposal_completed_at: z.string().nullable(),
  proposal_error: z.string().nullable(),
  proposal_log: z.string().nullable(),
  secret_scan_status: SecretScanStatusSchema,
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

export const ModelFamilySchema = z.enum(['haiku', 'sonnet', 'opus']);
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

export const EffortLevelSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const ModelChoiceSchema = z
  .object({ name: ModelFamilySchema, effort: EffortLevelSchema })
  .strict();
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;

export const ProposalCandidateSchema = z.object({
  kind: z.enum(['practice', 'map']),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable(),
});

export type ProposalCandidate = z.infer<typeof ProposalCandidateSchema>;

export const ProposalOutputSchema = z.object({
  practice: z.array(ProposalCandidateSchema),
  map: z.array(ProposalCandidateSchema),
});

export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;

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
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  depends_on: z.array(z.string()),
  confidence: ConfidenceSchema,
  summary: z.string(),
});
export type NodeFrontmatter = z.infer<typeof NodeFrontmatterSchema>;

/**
 * Curator output schema: one entry per proposal candidate. Drops and
 * contradicts may omit `proposed_node`; add/modify include it.
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
});
export type CuratorProposedNode = z.infer<typeof CuratorProposedNodeSchema>;

export const CuratorActionSchema = z.object({
  action: z.enum(['add', 'modify', 'contradict', 'drop']),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: z.string(),
});
export type CuratorAction = z.infer<typeof CuratorActionSchema>;

export const CuratorOutputSchema = z.array(CuratorActionSchema);
export type CuratorOutput = z.infer<typeof CuratorOutputSchema>;

export const IndexFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
export type IndexFrontmatter = z.infer<typeof IndexFrontmatterSchema>;

export const GraphFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
export type GraphFrontmatter = z.infer<typeof GraphFrontmatterSchema>;

/**
 * Candidate emitted by the bootstrap-incremental prompt. Same shape as the
 * proposal candidate plus `derived_from` (the source-doc paths the chunk
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
  produced_nodes: z.array(z.string()),
});
export type BootstrapDocEntry = z.infer<typeof BootstrapDocEntrySchema>;

/**
 * Conflict surfaced by the curator when a `contradict` action is emitted.
 * The curator does not write conflicting nodes to disk; instead, runs
 * append entries here and the kb-curate skill resolves them in-session
 * with the user. Persisted to `.ai/knowledge-base/.state/pending-conflicts.json`.
 */
export const ConflictReportSchema = z.object({
  id: z.string(),
  detected_at: z.string(),
  run_id: z.string(),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  rationale: z.string(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
});
export type ConflictReport = z.infer<typeof ConflictReportSchema>;

export const PendingConflictsFileSchema = z.object({
  schema_version: z.literal(1),
  conflicts: z.array(ConflictReportSchema),
});
export type PendingConflictsFile = z.infer<typeof PendingConflictsFileSchema>;

/**
 * Persistence failure surfaced by the curator: an `add` whose target file
 * already exists, or a `modify` whose `target_node_id` is missing on disk.
 * Reported in run output; not persisted across runs.
 */
export const FailureReportSchema = z.object({
  reason: z.enum(['add_collision', 'modify_missing_target']),
  candidate_origin: z.string(),
  node_id: z.string(),
  detail: z.string(),
});
export type FailureReport = z.infer<typeof FailureReportSchema>;

/**
 * Settings shipped in `.ai/knowledge-base/config.yaml` (project-level, committed)
 * and `~/.config/ai-knowledge-base/config.yaml` (user-level overrides).
 *
 * Every field is optional in the on-disk file; `resolveSettings()` layers the
 * documented defaults under user-level overrides under project-level overrides.
 * The `schema_version` field is the only required key when a file is present.
 *
 * Model and effort selection: `proposalModel`, `curatorModel`, and `bootstrapModel`
 * each take a `{ name, effort }` object that steers the corresponding `claude -p`
 * subprocess. `name` is one of `haiku`, `sonnet`, `opus`. `effort` is one of
 * `low`, `medium`, `high`, `xhigh`, `max`. When a key is unset the spawn omits
 * both `--model` and `--effort` and the user's `claude` CLI default applies.
 */
export const SettingsSchema = z
  .object({
    schema_version: z.literal(1),
    drainBound: z.number().int().positive().optional(),
    maxAttempts: z.number().int().positive().optional(),
    proposalTimeout: z.number().int().positive().optional(),
    lockTtlMs: z.number().int().positive().optional(),
    curationThreshold: z.number().int().positive().optional(),
    bootstrapTokenBudget: z.number().int().positive().optional(),
    logsRetentionDays: z.number().int().positive().optional(),
    proposalModel: ModelChoiceSchema.optional(),
    curatorModel: ModelChoiceSchema.optional(),
    bootstrapModel: ModelChoiceSchema.optional(),
  })
  .strict();
export type SettingsFile = z.infer<typeof SettingsSchema>;

export const BootstrapStateSchema = z.object({
  schema_version: z.literal(1),
  last_full_bootstrap_at: z.string().nullable().optional(),
  last_incremental_at: z.string().nullable().optional(),
  docs: z.record(BootstrapDocEntrySchema),
});
export type BootstrapState = z.infer<typeof BootstrapStateSchema>;
