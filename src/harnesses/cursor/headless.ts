import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  parseJsonLine,
  prepareHeadlessPrompt,
  spawnHeadless,
  validateHeadlessJson,
} from '../../lib/headless-runner.js';
import { CursorHarnessOptsSchema } from './opts.js';

interface CursorResultEvent extends HeadlessStreamMessage {
  type?: string;
  subtype?: string;
  result?: string;
}

/**
 * Invokes `agent -p --output-format json` and validates the final result
 * text as structured JSON against `schema`. With `json` format the CLI emits
 * a single terminal `type: result` object; `stream-json` is also accepted
 * when callers switch format later.
 *
 * Transport: a prompt within `PROMPT_STDIN_THRESHOLD` is the positional
 * argument; a larger one is piped to stdin with no positional at all. The
 * agent CLI (2026.09.28, `src/commands/build-prompt.ts`) reads stdin only
 * when the positional prompt is empty, so a `-` placeholder would reach the
 * model verbatim and the real prompt would be discarded.
 */
export async function runHeadlessCursor<T>(
  promptBody: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const harnessOpts = CursorHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const agentCli = harnessOpts.agentCli ?? 'agent';
  const prompt = prepareHeadlessPrompt(promptBody);

  const args: string[] = ['-p', '--output-format', 'json'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  args.push(...prompt.positional);

  let lastResultText: string | undefined;
  await spawnHeadless(
    {
      command: agentCli,
      args,
      input: prompt.input,
      label: agentCli,
      onLine: line => {
        const parsed = parseJsonLine<CursorResultEvent>(line);
        if (!parsed) return;
        if (parsed.type === 'result' && typeof parsed.result === 'string') {
          lastResultText = parsed.result;
        }
        if (opts.onMessage) opts.onMessage(parsed);
      },
    },
    opts
  );

  if (typeof lastResultText !== 'string') {
    throw new Error(`${agentCli} subprocess produced no result event`);
  }
  return validateHeadlessJson(lastResultText, schema, opts);
}
