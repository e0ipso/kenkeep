import { z } from 'zod';
import type { EffectiveSettings, ModelChoice } from '../../lib/settings.js';
import type { ModelChoiceRole } from '../types.js';

/**
 * Cursor-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessCursor`. The wrapper treats this blob as a black box; the
 * adapter validates it at the start of `runHeadless`.
 */
export const CursorHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
    agentCli: z.string().min(1).optional(),
  })
  .strict();

export type CursorHarnessOpts = z.infer<typeof CursorHarnessOptsSchema>;

function pickModelChoice(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): ModelChoice | undefined {
  switch (role) {
    case 'proposal':
      return settings.proposalModel;
    case 'curator':
      return settings.curatorModel;
    case 'bootstrap':
      return settings.bootstrapModel;
  }
}

/**
 * Builds a Cursor-shaped `harnessOpts` blob from resolved settings and
 * the per-call role. When the configured model choice does not match the
 * Cursor variant, the result is `{}` and the `agent` CLI defaults apply.
 */
export function buildCursorHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const choice = pickModelChoice(settings, role);
  if (!choice || choice.harness !== 'cursor') return {};
  const out: Record<string, unknown> = { model: choice.model };
  return out;
}
