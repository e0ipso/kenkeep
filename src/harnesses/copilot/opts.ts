import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoice,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * Copilot-local Zod schema for the opaque `harnessOpts` blob handed to
 * `runHeadlessCopilot`. The wrapper treats this blob as a black box and
 * routes it through unchanged; the adapter validates it at the start of
 * `runHeadless`.
 *
 * `model` is an opaque string passed verbatim to `copilot --model` (the
 * Copilot CLI accepts identifiers such as `claude-sonnet-4.5` or `gpt-5`).
 * Copilot exposes no reasoning-effort knob, so the schema carries `model`
 * only.
 */
export const CopilotHarnessOptsSchema = z
  .object({
    model: z.string().min(1).optional(),
  })
  .strict();

export type CopilotHarnessOpts = z.infer<typeof CopilotHarnessOptsSchema>;

/**
 * Builds a Copilot-shaped `harnessOpts` blob from the resolved settings and
 * the per-call role. When the configured model choice for the role does not
 * match the Copilot variant, the result is `{}` and the `copilot` CLI's own
 * default model applies.
 */
export function buildCopilotHarnessOpts(
  settings: EffectiveSettings,
  role: ModelChoiceRole
): Record<string, unknown> {
  const choice = pickModelChoice(settings, role);
  if (!choice || choice.harness !== 'copilot') return {};
  return { model: choice.model };
}

/**
 * Launcher argv for a Copilot model choice. `@github/copilot 1.0.91 --help`
 * lists `--model <model>` ("Set the AI model to use") next to
 * `-p, --prompt <text>`; the docs page
 * https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically
 * documents the same flag for scripted runs.
 */
export function copilotLaunchModelArgs(choice: ModelChoice): string[] {
  if (choice.harness !== 'copilot') {
    throw new Error(`copilot adapter received a model choice for harness '${choice.harness}'`);
  }
  return ['--model', choice.model];
}
