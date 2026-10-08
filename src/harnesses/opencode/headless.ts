import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  parseJsonLine,
  prepareHeadlessPrompt,
  spawnHeadless,
  validateHeadlessJson,
} from '../../lib/headless-runner.js';
import { OpenCodeHarnessOptsSchema } from './opts.js';

/**
 * One stdout record of `opencode run --format json`. The CLI subscribes to
 * the SDK event bus internally and writes its own records through `emit`
 * (`packages/opencode/src/cli/cmd/run.ts`, v1.18.34): `type`, `timestamp`
 * and `sessionID`, then the payload. A completed text part is written once,
 * whole, as `{ type: 'text', part }`; a session error as
 * `{ type: 'error', error }`, after which the CLI exits non-zero. SDK
 * envelopes such as `message.part.updated` never reach stdout.
 */
interface OpenCodeRecord extends HeadlessStreamMessage {
  type?: string;
  part?: {
    type?: string;
    messageID?: string;
    text?: string;
  };
  error?: {
    name?: unknown;
    data?: { message?: unknown };
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

/**
 * Invokes `opencode run --format json` and validates the final assistant
 * message as structured JSON against `schema`.
 *
 * The runner keeps the completed text parts of the most recent assistant
 * message (a tool step starts a new message), joins them, and runs the
 * result through the caller-supplied Zod schema. An `error` record is
 * carried into the thrown error so a failed run names its cause.
 *
 * Transport: a prompt within `PROMPT_STDIN_THRESHOLD` is the positional
 * message; a larger one is piped to stdin with no positional. `opencode run`
 * reads piped stdin (`process.stdin.isTTY ? undefined : await
 * Bun.stdin.text()`) and uses it as the message when no positional is given
 * (`packages/opencode/src/cli/cmd/run.ts`, `resolveRunInput`, present at
 * v1.18.34). The docs page only lists the positional form.
 */
export async function runHeadlessOpenCode<T>(
  promptBody: string,
  schema: ZodSchema<T>,
  opts: OpenCodeHeadlessOptions = {}
): Promise<T> {
  const harnessOpts = OpenCodeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.opencodeCli ?? 'opencode';
  const prompt = prepareHeadlessPrompt(promptBody);

  const args: string[] = ['run', '--format', 'json'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.agent) args.push('--agent', harnessOpts.agent);
  args.push(...prompt.positional);

  let lastMessageId: string | undefined;
  let lastMessageParts: string[] = [];
  const reportedErrors: string[] = [];
  try {
    await spawnHeadless(
      {
        command: cli,
        args,
        input: prompt.input,
        label: 'opencode',
        onLine: line => {
          const parsed = parseJsonLine<OpenCodeRecord>(line);
          if (!parsed) return;
          if (parsed.type === 'text') {
            const part = parsed.part;
            if (part?.type === 'text' && typeof part.text === 'string') {
              if (part.messageID !== lastMessageId) {
                lastMessageId = part.messageID;
                lastMessageParts = [];
              }
              lastMessageParts.push(part.text);
            }
          }
          if (parsed.type === 'error') reportedErrors.push(describeError(parsed.error));
          if (opts.onMessage) opts.onMessage(parsed);
        },
      },
      opts
    );
  } catch (err) {
    if (reportedErrors.length === 0 || !(err instanceof Error)) throw err;
    throw new Error(`${err.message}; opencode reported: ${reportedErrors.join('; ')}`);
  }

  const text = lastMessageParts.join('\n');
  if (text.trim().length === 0) {
    if (reportedErrors.length > 0) {
      throw new Error(`opencode reported an error: ${reportedErrors.join('; ')}`);
    }
    throw new Error('opencode subprocess produced no assistant text');
  }
  return validateHeadlessJson(text, schema, opts);
}

/** Mirrors the CLI's own rendering: `data.message` when present, else `name`. */
function describeError(error: OpenCodeRecord['error']): string {
  const message = error?.data?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  return typeof error?.name === 'string' ? error.name : 'unknown error';
}
