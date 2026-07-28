import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  HeadlessStrategy,
  routePrompt,
  runHeadlessStrategy,
  type ChildStdin,
} from '../../lib/headless-run.js';
import { CursorHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

interface CursorResultEvent extends HeadlessStreamMessage {
  type?: string;
  subtype?: string;
  result?: string;
}

/**
 * `agent -p --output-format json`. With `json` format the CLI emits a single
 * terminal `type: result` object; `stream-json` is also accepted when callers
 * switch format later.
 */
class CursorHeadless extends HeadlessStrategy {
  readonly cli: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  private readonly childStdin: string;
  private lastResultText: string | undefined;

  constructor(
    promptBody: string,
    stdin: string,
    private readonly opts: HeadlessRunOptions
  ) {
    super();
    const harnessOpts = CursorHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    this.cli = harnessOpts.agentCli ?? 'agent';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';

    const args: string[] = ['-p', '--output-format', 'json'];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    const routed = routePrompt(promptBody, stdin);
    args.push(routed.promptArg);
    this.childStdin = routed.childStdin;
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  consumeLine(line: string): void {
    let parsed: CursorResultEvent;
    try {
      parsed = JSON.parse(line) as CursorResultEvent;
    } catch {
      return;
    }
    if (parsed.type === 'result' && typeof parsed.result === 'string') {
      this.lastResultText = parsed.result;
    }
    if (this.opts.onMessage) this.opts.onMessage(parsed);
  }

  finalText(): string | undefined {
    return this.lastResultText;
  }

  noOutputError(): string {
    return `${this.harnessName()} subprocess produced no result event`;
  }

  /** `cli` may be a caller-supplied path; errors should name the harness. */
  override harnessName(): string {
    return 'agent';
  }

  override stdin(): ChildStdin {
    return { mode: 'write', input: this.childStdin };
  }

  override logFile(): string | undefined {
    return this.opts.logFile;
  }

  override cwd(): string | undefined {
    return this.opts.cwd;
  }
}

export async function runHeadlessCursor<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new CursorHeadless(promptBody, stdin, opts), schema);
}
