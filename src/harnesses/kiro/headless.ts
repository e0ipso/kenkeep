import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions } from '../types.js';
import { BufferedAnswerStrategy, runHeadlessStrategy } from '../../lib/headless-run.js';
import { KiroHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface KiroHeadlessOptions extends HeadlessRunOptions {
  /**
   * Override the `kiro-cli-chat` binary path. Defaults to `'kiro-cli-chat'`
   * on PATH; tests point this at a stub script that prints a canned final
   * answer.
   */
  kiroCli?: string;
  /**
   * Repository root passed as the working directory of the headless child so
   * Kiro's file-system tools (`read`, `write`, shell commands) operate on the
   * correct project root regardless of the CWD the hook was invoked from.
   * Defaults to `process.cwd()`.
   */
  repoRoot?: string;
}

/**
 * `kiro-cli-chat chat <prompt> --no-interactive --trust-all-tools`.
 *
 * Kiro CLI has no `--json` programmatic-output flag, so it uses the shared
 * buffered-answer contract — the same one Copilot uses: the prompt instructs
 * the model to emit a JSON object (typically fenced) at the end of its answer,
 * and the shared runner recovers it from the collected stdout.
 * `--no-interactive` and `--trust-all-tools` are both required for fully
 * autonomous non-interactive operation.
 *
 * The recursion guard env var `KENKEEP_BUILDER_INTERNAL=1` is always set on
 * the child so capture and drain hooks fired from the spawned process exit
 * silently.
 */
class KiroHeadless extends BufferedAnswerStrategy {
  readonly cli: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  private readonly repoRoot: string;

  constructor(promptBody: string, stdin: string, opts: KiroHeadlessOptions) {
    super(opts);
    this.cli = opts.kiroCli ?? 'kiro-cli-chat';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';
    this.repoRoot = opts.repoRoot ?? process.cwd();

    const harnessOpts = KiroHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    const fullPrompt = stdin.length > 0 ? `${promptBody}\n\n--- input ---\n${stdin}` : promptBody;
    const args: string[] = ['chat', fullPrompt, '--no-interactive', '--trust-all-tools'];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  noOutputError(): string {
    return `${this.role} output was empty; kiro-cli-chat produced no final text.`;
  }

  /** `cli` may be a caller-supplied path; errors should name the harness. */
  override harnessName(): string {
    return 'kiro-cli-chat';
  }

  /** Kiro's file tools resolve against cwd, so pin it to the project root. */
  override cwd(): string {
    return this.repoRoot;
  }
}

export async function runHeadlessKiro<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: KiroHeadlessOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new KiroHeadless(promptBody, stdin, opts), schema);
}
