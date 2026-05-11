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
