import { z } from 'zod';

/**
 * Schema version for node, index, and graph artifacts. At version 2, `kind` is a
 * frontmatter facet that does not determine directory placement, leaves live in a
 * nested topical folder tree, and every folder carries a generated `index.md`. The
 * reader rejects any `schema_version: 1` artifact and points the user to re-init;
 * there is no migrator (see `practice-strict-schema-version-bump-policy`). The
 * `treeify` command migrates existing flat knowledge bases.
 */
export const NODE_SCHEMA_VERSION = 2;

export const CaptureTriggerSchema = z.enum(['stop', 'session_end', 'pre_compact', 'manual']);
export type CaptureTrigger = z.infer<typeof CaptureTriggerSchema>;

export const ProposalStatusSchema = z.enum(['pending', 'done', 'failed']);
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
  proposals: z.object({
    practice: z.array(z.unknown()),
    map: z.array(z.unknown()),
  }),
});

export type SessionLogFrontmatter = z.infer<typeof SessionLogFrontmatterSchema>;

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ModelFamilySchema = z.enum(['haiku', 'sonnet', 'opus']);
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

export const EffortLevelSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

/**
 * Per-call model choice. Discriminated on `harness` so each adapter can
 * declare its own validation rules: Claude exposes a closed enum of
 * families and effort levels, Codex accepts opaque strings (the Codex CLI
 * validates them at spawn time).
 */
export const ClaudeModelChoiceSchema = z
  .object({
    harness: z.literal('claude'),
    name: ModelFamilySchema,
    effort: EffortLevelSchema,
  })
  .strict();
export type ClaudeModelChoice = z.infer<typeof ClaudeModelChoiceSchema>;

export const CodexModelChoiceSchema = z
  .object({
    harness: z.literal('codex'),
    model: z.string().min(1),
    reasoningEffort: z.string().min(1).optional(),
  })
  .strict();
export type CodexModelChoice = z.infer<typeof CodexModelChoiceSchema>;

export const OpenCodeModelChoiceSchema = z
  .object({
    harness: z.literal('opencode'),
    model: z.string().min(1),
    agent: z.string().min(1).optional(),
  })
  .strict();
export type OpenCodeModelChoice = z.infer<typeof OpenCodeModelChoiceSchema>;

export const CursorModelChoiceSchema = z
  .object({
    harness: z.literal('cursor'),
    model: z.string().min(1),
  })
  .strict();
export type CursorModelChoice = z.infer<typeof CursorModelChoiceSchema>;

export const CopilotModelChoiceSchema = z
  .object({
    harness: z.literal('copilot'),
    model: z.string().min(1),
  })
  .strict();
export type CopilotModelChoice = z.infer<typeof CopilotModelChoiceSchema>;

export const ModelChoiceSchema = z.discriminatedUnion('harness', [
  ClaudeModelChoiceSchema,
  CodexModelChoiceSchema,
  OpenCodeModelChoiceSchema,
  CursorModelChoiceSchema,
  CopilotModelChoiceSchema,
]);
export type ModelChoice = z.infer<typeof ModelChoiceSchema>;

/**
 * Candidate emitted by the proposal-extract prompt. The wrapper does not
 * consume `supports_existing_node` / `contradicts_existing_node` hints; both
 * are gone from the prompt and the schema. `.strict()` rejects any
 * reintroduction (including the legacy non-null hint values).
 */
export const ProposalCandidateSchema = z
  .object({
    kind: z.enum(['practice', 'map']),
    tags: z.array(z.string()),
    title: z.string(),
    summary: z.string(),
    body: z.string(),
    confidence: ConfidenceSchema,
  })
  .strict();

export type ProposalCandidate = z.infer<typeof ProposalCandidateSchema>;

export const ProposalOutputSchema = z.object({
  practice: z.array(ProposalCandidateSchema),
  map: z.array(ProposalCandidateSchema),
});

export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;

export const StateFileSchema = z.object({
  schema_version: z.literal(1),
  last_nudged_at: z.string().nullable().optional(),
});

export type StateFile = z.infer<typeof StateFileSchema>;

export const LintStateFileSchema = z.object({
  schema_version: z.literal(1),
  sessions_since_last_lint: z.number().int().nonnegative(),
  last_lint_at: z.string().nullable(),
  last_errors: z.number().int().nonnegative(),
  last_findings: z.number().int().nonnegative(),
});
export type LintStateFile = z.infer<typeof LintStateFileSchema>;

export const NodeKindSchema = z.enum(['practice', 'map']);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const NodeFrontmatterSchema = z.object({
  schema_version: z.literal(NODE_SCHEMA_VERSION),
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  confidence: ConfidenceSchema,
  summary: z.string(),
});
export type NodeFrontmatter = z.infer<typeof NodeFrontmatterSchema>;

/**
 * Curator output schema: one entry per proposal candidate. Drops and
 * contradicts may omit `proposed_node`; add/modify include it. The wrapper
 * stamps `id` from `deriveNodeId`/`target_node_id` and synthesizes
 * `derived_from` from `candidate_origin`, so the LLM does not author either.
 * `.strict()` rejects any reintroduction.
 */
export const CuratorProposedNodeSchema = z
  .object({
    title: z.string(),
    kind: NodeKindSchema,
    tags: z.array(z.string()),
    summary: z.string(),
    body: z.string(),
    confidence: ConfidenceSchema,
    relates_to: z.array(z.string()),
  })
  .strict();
export type CuratorProposedNode = z.infer<typeof CuratorProposedNodeSchema>;

export const CuratorActionSchema = z.object({
  action: z.enum(['add', 'modify', 'contradict', 'drop']),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: z.string(),
  /**
   * Chosen existing folder relative to `nodes/` for a new-leaf `add` (the home
   * branch picked by the relate ranking). Absent, null, or empty selects the
   * `nodes/` root fallback. Placement is presentation only and never changes the
   * node id; `modify`, `contradict`, and `drop` actions never set it. The
   * writer's `--folder` guard owns traversal rejection, so this field only
   * carries the value through dedup.
   */
  home_folder: z.string().nullable().optional(),
});
export type CuratorAction = z.infer<typeof CuratorActionSchema>;

export const CuratorOutputSchema = z.array(CuratorActionSchema);
export type CuratorOutput = z.infer<typeof CuratorOutputSchema>;

export const IndexFrontmatterSchema = z.object({
  schema_version: z.literal(NODE_SCHEMA_VERSION),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
export type IndexFrontmatter = z.infer<typeof IndexFrontmatterSchema>;

export const GraphFrontmatterSchema = z.object({
  schema_version: z.literal(NODE_SCHEMA_VERSION),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
export type GraphFrontmatter = z.infer<typeof GraphFrontmatterSchema>;

/**
 * Candidate emitted by the bootstrap-incremental prompt. The wrapper attributes
 * `derived_from` deterministically from the (single-file) batch, so the LLM
 * does not author it. `.strict()` rejects any reintroduction (including the
 * formerly-emitted always-null `supports_existing_node` /
 * `contradicts_existing_node` hints).
 */
export const BootstrapCandidateSchema = z
  .object({
    kind: z.enum(['practice', 'map']),
    tags: z.array(z.string()),
    title: z.string(),
    summary: z.string(),
    body: z.string(),
    confidence: ConfidenceSchema,
  })
  .strict();
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
 * Persistence failure surfaced by the curator: an `add` whose target file
 * already exists, or a `modify` whose `target_node_id` is missing on disk.
 * Reported in run output; not persisted across runs.
 */
export interface FailureReport {
  reason: 'add_collision' | 'modify_missing_target';
  candidate_origin: string;
  node_id: string;
  detail: string;
}

/**
 * Settings shipped in the project-level `.ai/kenkeep/config.yaml`
 * (committed). Every field is optional in the on-disk file; `resolveSettings()`
 * layers the documented defaults under project-level overrides. The
 * `schema_version` field is the only required key when a file is present.
 * Unknown keys are rejected by the strict schema.
 *
 * Model and effort selection: `proposalModel`, `curatorModel`, and
 * `bootstrapModel` each take a single per-harness variant keyed by the
 * `harness` discriminator: `{ harness: 'claude', name, effort }` or
 * `{ harness: 'codex', model, reasoningEffort? }`. The active adapter
 * consumes only the variant whose `harness` matches its id; a mismatch
 * yields the adapter's CLI defaults.
 */
export const SettingsSchema = z
  .object({
    schema_version: z.literal(1),
    curationThreshold: z.number().int().positive().optional(),
    logsRetentionDays: z.number().int().positive().optional(),
    lintEveryNSessions: z.number().int().positive().optional(),
    proposalModel: ModelChoiceSchema.optional(),
    curatorModel: ModelChoiceSchema.optional(),
    bootstrapModel: ModelChoiceSchema.optional(),
    /**
     * Default harness for plain-shell CLI invocations (e.g.
     * `npx kenkeep curate` from a terminal that is not inside
     * any assistant session). Skills and hooks always auto-resolve via
     * env detection (`CLAUDECODE=1`, `CLAUDE_PROJECT_DIR`, …) and do
     * NOT consult this setting — only the bare CLI fallback path does.
     *
     * Must match a registered harness adapter; the registry validates
     * this at use time. Omitted from `defaultProjectConfigBody` so
     * existing repos continue to default to the first registered
     * harness (`claude`).
     */
    cliDefaultHarness: z.string().min(1).optional(),
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

/**
 * Per-user ledger for harness auto-memory ingestion. Keyed by `file://` IRI,
 * value is the last-seen content hash plus the run that recorded it. Lives
 * under `.ai/kenkeep/.state/memory-ledger.json` (gitignored). Born at
 * `schema_version: 1`; malformed files are rebuilt from empty, never migrated.
 */
export const MemoryLedgerSchema = z.object({
  schema_version: z.literal(1),
  entries: z.record(
    z.string(),
    z.object({
      sha256: z.string(),
      lastSeenRunId: z.string(),
      lastSeenAt: z.string(),
    })
  ),
});
export type MemoryLedger = z.infer<typeof MemoryLedgerSchema>;
