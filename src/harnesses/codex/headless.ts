import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  HeadlessStrategy,
  routePrompt,
  runHeadlessStrategy,
  type ChildStdin,
} from '../../lib/headless-run.js';
import { CodexHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Codex event-stream record shape. Codex documents `thread.started`,
 * `turn.started`, `item.started`, `item.completed`, `turn.completed`, and
 * `error`. We only consume `item.completed` events whose nested
 * `item.type === 'agent_message'` to recover the final structured answer;
 * everything else is forwarded to `onMessage` / logged but does not influence
 * the return value.
 */
interface CodexEvent extends HeadlessStreamMessage {
  type?: string;
  item?: {
    type?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/** `codex exec --json --sandbox read-only`. */
class CodexHeadless extends HeadlessStrategy {
  readonly cli = 'codex';
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  private readonly childStdin: string;
  private lastAgentMessage: string | undefined;

  constructor(
    promptBody: string,
    stdin: string,
    private readonly opts: HeadlessRunOptions
  ) {
    super();
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';

    const harnessOpts = CodexHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    const args: string[] = ['exec', '--json', '--sandbox', 'read-only'];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    if (harnessOpts.reasoningEffort) {
      args.push('-c', `reasoning.effort=${harnessOpts.reasoningEffort}`);
    }
    const routed = routePrompt(promptBody, stdin);
    args.push(routed.promptArg);
    this.childStdin = routed.childStdin;
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  consumeLine(line: string): void {
    let parsed: CodexEvent;
    try {
      parsed = JSON.parse(line) as CodexEvent;
    } catch {
      return;
    }
    if (
      parsed.type === 'item.completed' &&
      parsed.item &&
      parsed.item.type === 'agent_message' &&
      typeof parsed.item.text === 'string'
    ) {
      this.lastAgentMessage = parsed.item.text;
    }
    if (this.opts.onMessage) this.opts.onMessage(parsed);
  }

  finalText(): string | undefined {
    return this.lastAgentMessage;
  }

  noOutputError(): string {
    return 'codex subprocess produced no agent_message event';
  }

  override stdin(): ChildStdin {
    return { mode: 'write', input: this.childStdin };
  }

  override logFile(): string | undefined {
    return this.opts.logFile;
  }
}

export async function runHeadlessCodex<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new CodexHeadless(promptBody, stdin, opts), schema);
}
