import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions } from '../types.js';
import { BufferedAnswerStrategy, runHeadlessStrategy } from '../../lib/headless-run.js';
import { CopilotHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

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
 * `copilot -p` in programmatic mode.
 *
 * Copilot has no `--json` programmatic-output flag, so it uses the shared
 * buffered-answer contract: the prompt instructs the model to emit a JSON
 * object (typically fenced) at the end of its answer, and the shared runner
 * recovers it from the collected stdout. `--no-ask-user` and
 * `--allow-all-tools` are both required for fully autonomous non-interactive
 * operation and are never optional.
 *
 * The recursion guard env var `KENKEEP_BUILDER_INTERNAL=1` is always set on
 * the child so capture and drain hooks fired from the spawned process exit
 * silently.
 */
class CopilotHeadless extends BufferedAnswerStrategy {
  readonly cli: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  constructor(promptBody: string, stdin: string, opts: CopilotHeadlessOptions) {
    super(opts);
    this.cli = opts.copilotCli ?? 'copilot';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';

    const harnessOpts = CopilotHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    const fullPrompt = stdin.length > 0 ? `${promptBody}\n\n--- input ---\n${stdin}` : promptBody;
    const args: string[] = [
      '-p',
      fullPrompt,
      '--no-ask-user',
      '--allow-all-tools',
      '--add-dir',
      opts.repoRoot ?? process.cwd(),
    ];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  noOutputError(): string {
    return `${this.role} output was empty; copilot produced no final text.`;
  }

  /** `cli` may be a caller-supplied path; errors should name the harness. */
  override harnessName(): string {
    return 'copilot';
  }
}

export async function runHeadlessCopilot<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: CopilotHeadlessOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new CopilotHeadless(promptBody, stdin, opts), schema);
}
