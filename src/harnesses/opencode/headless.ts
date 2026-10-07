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

/**
 * Invokes `opencode run --format json` and validates the final assistant
 * message as structured JSON against `schema`.
 *
 * The runner accumulates `properties.part.text` deltas (the part stream
 * for the most-recent assistant message id), parses the accumulated
 * string as JSON after `session.idle` (or stream end), then runs it
 * through the caller-supplied Zod schema.
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

  let currentAssistantMessageId: string | undefined;
  let accumulatedText = '';
  await spawnHeadless(
    {
      command: cli,
      args,
      input: prompt.input,
      label: 'opencode',
      onLine: line => {
        const parsed = parseJsonLine<OpenCodeEvent>(line);
        if (!parsed) return;
        if (parsed.type === 'session.created') {
          currentAssistantMessageId = undefined;
          accumulatedText = '';
        }
        if (parsed.type === 'message.part.updated') {
          const messageId = parsed.properties?.messageID;
          const part = parsed.properties?.part;
          if (messageId && part && part.type === 'text' && typeof part.text === 'string') {
            if (messageId !== currentAssistantMessageId) {
              currentAssistantMessageId = messageId;
              accumulatedText = '';
            }
            accumulatedText += part.text;
          }
        }
        if (opts.onMessage) opts.onMessage(parsed);
      },
    },
    opts
  );

  if (accumulatedText.length === 0) {
    throw new Error('opencode subprocess produced no assistant text');
  }
  return validateHeadlessJson(accumulatedText, schema, opts);
}
