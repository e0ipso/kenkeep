import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';

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
