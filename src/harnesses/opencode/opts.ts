import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * OpenCode-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessOpenCode`. The wrapper treats this blob as a black box and
 * routes it through unchanged; the adapter validates it at the start of
 * `runHeadless`.
 *
 * `model` is a `<provider>/<model>` string passed verbatim to
 * `opencode run --model`. `agent`, when set, is forwarded as `--agent`.
 */
export const OpenCodeHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
    agent: z.string().min(1).optional(),
  })
  .strict();

export type OpenCodeHarnessOpts = z.infer<typeof OpenCodeHarnessOptsSchema>;

/**
 * Builds an OpenCode-shaped `harnessOpts` blob from the resolved settings
 * and the per-call role. When the configured model choice for the role
 * does not match the OpenCode variant, the result is `{}` and the
 * `opencode` CLI's own defaults apply.
 */
export function buildOpenCodeHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const choice = pickModelChoice(settings, role);
  if (!choice || choice.harness !== 'opencode') return {};
  const out: Record<string, unknown> = {};
  if (choice.model !== undefined) out['model'] = choice.model;
  if (choice.agent !== undefined) out['agent'] = choice.agent;
  return out;
}
