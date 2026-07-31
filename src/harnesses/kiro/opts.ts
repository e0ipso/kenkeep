import { z } from 'zod';
import { KiroModelChoiceSchema } from '../../lib/schemas.js';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * Kiro-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessKiro`. The wrapper treats this blob as a black box and
 * routes it through unchanged; the adapter validates it at the start of
 * `runHeadless`.
 *
 * `model` is an opaque string passed verbatim to `kiro-cli-chat --model`.
 * Kiro exposes no reasoning-effort knob, so the schema carries `model` only.
 */
export const KiroHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
  })
  .strict();

export type KiroHarnessOpts = z.infer<typeof KiroHarnessOptsSchema>;

/**
 * Builds a Kiro-shaped `harnessOpts` blob from the resolved settings and
 * the per-call role. When the configured model choice for the role does not
 * match the Kiro variant, the result is `{}` and the `kiro-cli-chat` binary's
 * own default model applies.
 */
export function buildKiroHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const raw = pickModelChoice(settings, role);
  const result = KiroModelChoiceSchema.safeParse(raw);
  if (!result.success) return {};
  return { model: result.data.model };
}
