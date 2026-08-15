import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * Grok-local Zod schema for the opaque `harnessOpts` blob. `model` is passed
 * to `grok --model`; `effort` to `--effort` when present.
 */
export const GrokHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
    effort: z.string().min(1).optional(),
  })
  .strict();

export type GrokHarnessOpts = z.infer<typeof GrokHarnessOptsSchema>;

export function buildGrokHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const choice = pickModelChoice(settings, role);
  if (!choice || choice.harness !== 'grok') return {};
  const out: Record<string, unknown> = { model: choice.model };
  if (choice.effort !== undefined) out['effort'] = choice.effort;
  return out;
}
