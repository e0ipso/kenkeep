import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * Codex-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessCodex`. The wrapper (`src/lib/curate.ts`, etc.) treats this
 * blob as a black box and routes it through unchanged; the adapter
 * validates it at the start of `runHeadless`.
 *
 * The Codex CLI accepts arbitrary model identifiers (e.g. `gpt-5-codex`)
 * and an opaque reasoning-effort string, so neither field is enum-typed.
 */
export const CodexHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
  })
  .strict();

export type CodexHarnessOpts = z.infer<typeof CodexHarnessOptsSchema>;

/**
 * Builds a Codex-shaped `harnessOpts` blob from the resolved settings and
 * the per-call role. When the configured model choice for the role does
 * not match the Codex variant, the result is `{}` and the `codex` CLI's
 * own defaults apply.
 */
export function buildCodexHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const choice = pickModelChoice(settings, role);
  if (!choice || choice.harness !== 'codex') return {};
  const out: Record<string, unknown> = { model: choice.model };
  if (choice.reasoningEffort !== undefined) out['reasoningEffort'] = choice.reasoningEffort;
  return out;
}
