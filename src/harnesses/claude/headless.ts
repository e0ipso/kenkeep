import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  HeadlessStrategy,
  runHeadlessStrategy,
  runHeadlessStrategyRaw,
  type ChildStdin,
} from '../../lib/headless-run.js';
import { ClaudeHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * `claude -p` with stream-json verbose output. The final answer is the
 * `result` string of the last non-error `type: result` event.
 *
 * Claude-specific knobs (`model`, `effort`, `allowedTools`) live inside the
 * adapter-opaque `harnessOpts` blob and are validated by
 * `ClaudeHarnessOptsSchema` here. The recursion guard env var
 * (`KENKEEP_BUILDER_INTERNAL=1`) is always set on the child so capture/drain
 * hooks fired from the spawned process exit silently.
 */
class ClaudeHeadless extends HeadlessStrategy {
  readonly cli = 'claude';
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  private readonly messages: HeadlessStreamMessage[] = [];

  constructor(
    promptBody: string,
    private readonly childStdin: string,
    private readonly opts: HeadlessRunOptions
  ) {
    super();
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';

    const harnessOpts = ClaudeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    const args = [
      '-p',
      promptBody,
      '--allowedTools',
      (harnessOpts.allowedTools ?? []).join(','),
      '--output-format',
      'stream-json',
      '--verbose',
    ];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    if (harnessOpts.effort) args.push('--effort', harnessOpts.effort);
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  consumeLine(line: string): void {
    let parsed: HeadlessStreamMessage;
    try {
      parsed = JSON.parse(line) as HeadlessStreamMessage;
    } catch {
      return;
    }
    this.messages.push(parsed);
    if (this.opts.onMessage) this.opts.onMessage(parsed);
  }

  finalText(): string | undefined {
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      const m = this.messages[i];
      if (m && m.type === 'result') {
        if (m.is_error === true) return undefined;
        if (typeof m.result === 'string') return m.result;
      }
    }
    return undefined;
  }

  noOutputError(): string {
    return 'claude subprocess produced no final result message';
  }

  override stdin(): ChildStdin {
    return { mode: 'write', input: this.childStdin };
  }

  override logFile(): string | undefined {
    return this.opts.logFile;
  }

  /** Claude's stderr carries no useful diagnostics; quoting it adds only noise. */
  override failureIncludesStderr(): boolean {
    return false;
  }
}

/**
 * Spawns `claude -p` and returns the trimmed string from the final
 * `type: result` event. Throws on subprocess failure / timeout / missing
 * result event. Callers that need typed JSON use `runHeadlessClaude`.
 */
export async function runHeadlessClaudeRaw(
  promptBody: string,
  stdin: string,
  opts: HeadlessRunOptions = {}
): Promise<string> {
  return runHeadlessStrategyRaw(new ClaudeHeadless(promptBody, stdin, opts));
}

/**
 * Invokes `claude -p` and validates the final `result` string as JSON against
 * `schema`. See `runHeadlessClaudeRaw` for the underlying spawn contract.
 */
export async function runHeadlessClaude<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new ClaudeHeadless(promptBody, stdin, opts), schema);
}
