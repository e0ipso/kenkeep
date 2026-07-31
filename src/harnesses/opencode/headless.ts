import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { HeadlessStrategy, runHeadlessStrategy, type ChildStdin } from '../../lib/headless-run.js';
import { OpenCodeHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * OpenCode event-stream record shape. The runtime emits a newline-
 * delimited JSON stream when invoked with `opencode run --format json`.
 * Event types include `session.created`, `message.part.updated`, and
 * `session.idle`; the runner only needs `message.part.updated` (which
 * carries text deltas for the active assistant message) and
 * `session.idle` (which marks the end of the stream).
 */
interface OpenCodeEvent extends HeadlessStreamMessage {
  type?: string;
  properties?: {
    messageID?: string;
    part?: {
      type?: string;
      text?: string;
    };
    [key: string]: unknown;
  };
}

export interface OpenCodeHeadlessOptions extends HeadlessRunOptions {
  /**
   * Override the `opencode` binary path. Defaults to `'opencode'` on
   * PATH; tests can point this at a stub script that emits a canned
   * event stream.
   */
  opencodeCli?: string;
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}...`;
}

/**
 * `opencode run --format json`.
 *
 * Accumulates `properties.part.text` deltas for the most-recent assistant
 * message id; the accumulated string is the final answer. The recursion guard
 * env var `KENKEEP_BUILDER_INTERNAL=1` is always set on the child so the
 * spawned opencode's plugin shim no-ops.
 */
class OpenCodeHeadless extends HeadlessStrategy {
  readonly cli: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly role: string;

  private currentAssistantMessageId: string | undefined;
  private accumulatedText = '';

  constructor(
    promptBody: string,
    private readonly childStdin: string,
    private readonly opts: OpenCodeHeadlessOptions
  ) {
    super();
    this.cli = opts.opencodeCli ?? 'opencode';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.role = opts.role ?? 'headless';

    const harnessOpts = OpenCodeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
    const args: string[] = ['run', '--format', 'json'];
    if (harnessOpts.model) args.push('--model', harnessOpts.model);
    if (harnessOpts.agent) args.push('--agent', harnessOpts.agent);
    // The prompt is positional. OpenCode does not document a `-` stdin
    // alternative, so we always pass it as argv.
    args.push(promptBody);
    this.args = args;

    this.env = { ...(opts.env ?? process.env), KENKEEP_BUILDER_INTERNAL: '1' };
  }

  consumeLine(line: string): void {
    let parsed: OpenCodeEvent;
    try {
      parsed = JSON.parse(line) as OpenCodeEvent;
    } catch {
      return;
    }
    if (parsed.type === 'session.created') {
      this.currentAssistantMessageId = undefined;
      this.accumulatedText = '';
    }
    if (parsed.type === 'message.part.updated') {
      const messageId = parsed.properties?.messageID;
      const part = parsed.properties?.part;
      if (messageId && part && part.type === 'text' && typeof part.text === 'string') {
        if (messageId !== this.currentAssistantMessageId) {
          this.currentAssistantMessageId = messageId;
          this.accumulatedText = '';
        }
        this.accumulatedText += part.text;
      }
    }
    if (this.opts.onMessage) this.opts.onMessage(parsed);
  }

  finalText(): string | undefined {
    return this.accumulatedText.length > 0 ? this.accumulatedText : undefined;
  }

  noOutputError(): string {
    return 'opencode subprocess produced no assistant text';
  }

  /** `cli` may be a caller-supplied path; errors should name the harness. */
  override harnessName(): string {
    return 'opencode';
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

  /** A timeout mid-stream is far easier to diagnose with the partial answer. */
  override timeoutDetail(): string {
    return `; accumulated text: ${truncate(this.accumulatedText, 200)}`;
  }

  override jsonParseError(err: unknown, finalText: string): string {
    const detail = err instanceof Error ? err.message : String(err);
    return `${this.role} output was not valid JSON: ${truncate(finalText, 200)} (${detail})`;
  }
}

export async function runHeadlessOpenCode<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: OpenCodeHeadlessOptions = {}
): Promise<T> {
  return runHeadlessStrategy(new OpenCodeHeadless(promptBody, stdin, opts), schema);
}
