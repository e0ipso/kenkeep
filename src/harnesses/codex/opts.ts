import { z } from 'zod';
import {
  pickModelChoice,
  type EffectiveSettings,
  type ModelChoice,
  type ModelChoiceRole,
} from '../../lib/settings.js';

/**
 * `codex exec --help` (0.159.3) accepts `-m, --model <MODEL>` and
 * `-c, --config <key=value>` overrides of `config.toml`. The reasoning
 * effort lives under the top-level key `model_reasoning_effort`
 * (https://learn.chatgpt.com/docs/config-file/config-reference, fetched
 * 2026-10-02); no `reasoning.effort` key exists, so the override must name
 * the documented key or Codex ignores it.
 */
export const CODEX_REASONING_EFFORT_KEY = 'model_reasoning_effort';

/**
 * Shared argv fragment for a Codex model/effort pair. Used by the headless
 * runner (from the validated `harnessOpts`) and by the launcher (from the
 * settings model choice) so both paths agree on the host flags.
 */
export function codexModelArgs(model?: string, reasoningEffort?: string): string[] {
  const args: string[] = [];
  if (model !== undefined) args.push('--model', model);
  if (reasoningEffort !== undefined) {
    args.push('-c', `${CODEX_REASONING_EFFORT_KEY}=${reasoningEffort}`);
  }
  return args;
}

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

/** Launcher argv for a Codex model choice (`--model`, optional effort override). */
export function codexLaunchModelArgs(choice: ModelChoice): string[] {
  if (choice.harness !== 'codex') {
    throw new Error(`codex adapter received a model choice for harness '${choice.harness}'`);
  }
  return codexModelArgs(choice.model, choice.reasoningEffort);
}
