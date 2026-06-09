import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';
import { EffortLevelSchema, ModelFamilySchema } from '../../lib/schemas.js';

/**
 * Claude-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessClaude`. The wrapper (`src/lib/curate.ts`, etc.) treats this
 * blob as a black box and routes it through unchanged; the adapter
 * validates it at the start of `runHeadless`.
 */
export const ClaudeHarnessOptsSchema = z
  .object({
    model: ModelFamilySchema.optional(),
    effort: EffortLevelSchema.optional(),
    allowedTools: z.array(z.string()).optional(),
  })
  .strict();

export type ClaudeHarnessOpts = z.infer<typeof ClaudeHarnessOptsSchema>;

/**
 * Per-role tool allowlist applied to Claude headless invocations. Curator
 * batches need `Read` to load the existing nodes; proposal and bootstrap
 * runs are pure transforms.
 */
const ROLE_ALLOWED_TOOLS: Record<ModelChoiceRole, string[]> = {
  proposal: [],
  curator: ['Read'],
  bootstrap: [],
};

/**
 * Builds a Claude-shaped `harnessOpts` blob from the resolved settings and
 * the per-call role. When the configured model choice for the role does
 * not match the Claude variant, the model/effort args are omitted and the
 * `claude` CLI's own defaults apply; the role-appropriate tool allowlist
 * is always included.
 */
export function buildClaudeHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const out: Record<string, unknown> = { allowedTools: ROLE_ALLOWED_TOOLS[role] };
  const choice = pickModelChoice(settings, role);
  if (choice && choice.harness === 'claude') {
    out['model'] = choice.name;
    out['effort'] = choice.effort;
  }
  return out;
}
