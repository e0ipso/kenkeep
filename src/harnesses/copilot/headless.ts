import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  prepareHeadlessPrompt,
  spawnHeadless,
  validateHeadlessJson,
} from '../../lib/headless-runner.js';
import { CopilotHarnessOptsSchema } from './opts.js';

export interface CopilotHeadlessOptions extends HeadlessRunOptions {
  /**
   * Override the `copilot` binary path. Defaults to `'copilot'` on PATH;
   * tests point this at a stub script that prints a canned final answer.
   */
  copilotCli?: string;
  /**
   * Repository root passed to `copilot --add-dir` so the agent can read
   * project files. Defaults to `process.cwd()`.
   */
  repoRoot?: string;
}

/**
 * Invokes `copilot` in programmatic mode and validates the embedded fenced
 * JSON payload from the agent's final stdout text against `schema`.
 *
 * Copilot has no `--json` programmatic-output flag, so the runner relies on
 * the same embedded-JSON contract the other adapters fall back to: the
 * prompt instructs the model to emit a JSON object (typically fenced) at the
 * end of its answer, and the shared validator recovers it from the buffered
 * stdout. `--no-ask-user` and `--allow-all-tools` are both required for
 * fully autonomous non-interactive operation and are never optional.
 *
 * Transport: a prompt within `PROMPT_STDIN_THRESHOLD` goes through `-p`; a
 * larger one is piped to stdin with no `-p`, which Copilot reads as the
 * prompt. The two are exclusive by design: "Piped input is ignored if you
 * also provide a prompt with the -p or --prompt option" (GitHub Docs,
 * "Running GitHub Copilot CLI programmatically").
 *
 * Copilot emits no intermediate stream events, so `opts.onMessage` receives
 * one synthetic message carrying the final result at completion.
 */
export async function runHeadlessCopilot<T>(
  promptBody: string,
  schema: ZodSchema<T>,
  opts: CopilotHeadlessOptions = {}
): Promise<T> {
  const harnessOpts = CopilotHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.copilotCli ?? 'copilot';
  const repoRoot = opts.repoRoot ?? process.cwd();
  const prompt = prepareHeadlessPrompt(promptBody);

  const args: string[] = [];
  if (prompt.transport === 'argv') args.push('-p', prompt.text);
  args.push('--no-ask-user', '--allow-all-tools', '--add-dir', repoRoot);
  if (harnessOpts.model) args.push('--model', harnessOpts.model);

  const lines: string[] = [];
  await spawnHeadless(
    {
      command: cli,
      args,
      input: prompt.input,
      label: 'copilot',
      onLine: line => {
        lines.push(line);
      },
    },
    opts
  );

  const stdout = lines.join('\n');
  const role = opts.role ?? 'headless';
  if (stdout.trim().length === 0) {
    throw new Error(`${role} output was empty; copilot produced no final text.`);
  }

  const validated = validateHeadlessJson(stdout, schema, opts);

  if (opts.onMessage) {
    const message: HeadlessStreamMessage = {
      type: 'result',
      result: stdout,
      is_error: false,
    };
    opts.onMessage(message);
  }

  return validated;
}
