import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import {
  parseJsonLine,
  prepareHeadlessPrompt,
  spawnHeadless,
  validateHeadlessJson,
} from '../../lib/headless-runner.js';
import { ClaudeHarnessOptsSchema } from './opts.js';

/**
 * Spawns `claude -p` with stream-json verbose output, mirrors each line into
 * `logFile` (if given), and returns the trimmed string from the final
 * `type: result` event. Throws on subprocess failure / timeout / missing
 * result event. Callers that need typed JSON validate the returned string
 * themselves (e.g. `runHeadlessClaude` adds a `JSON.parse` + Zod schema pass
 * on top).
 *
 * Transport: a prompt within `PROMPT_STDIN_THRESHOLD` is the positional
 * argument; a larger one is piped to stdin with no positional, which `claude
 * -p` reads as the prompt (Claude Code docs, "Pipe data through Claude";
 * piped stdin is capped at 10 MB). The recursion guard env is set by
 * `spawnHeadless`.
 */
export async function runHeadlessClaudeRaw(
  promptBody: string,
  opts: HeadlessRunOptions = {}
): Promise<string> {
  const harnessOpts = ClaudeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const allowedTools = harnessOpts.allowedTools ?? [];
  const prompt = prepareHeadlessPrompt(promptBody);
  const args = [
    '-p',
    ...prompt.positional,
    '--allowedTools',
    allowedTools.join(','),
    '--output-format',
    'stream-json',
    '--verbose',
  ];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.effort) args.push('--effort', harnessOpts.effort);

  const messages: HeadlessStreamMessage[] = [];
  await spawnHeadless(
    {
      command: 'claude',
      args,
      input: prompt.input,
      label: 'claude',
      onLine: line => {
        const parsed = parseJsonLine<HeadlessStreamMessage>(line);
        if (!parsed) return;
        messages.push(parsed);
        if (opts.onMessage) opts.onMessage(parsed);
      },
    },
    opts
  );

  const finalResult = findFinalResult(messages);
  if (finalResult === null) {
    throw new Error('claude subprocess produced no final result message');
  }
  return finalResult;
}

/**
 * Invokes `claude -p` and validates the final `result` string as JSON against
 * `schema`. See `runHeadlessClaudeRaw` for the underlying spawn contract.
 *
 * Claude-specific knobs (`model`, `effort`, `allowedTools`) live inside the
 * adapter-opaque `harnessOpts` blob and are validated by
 * `ClaudeHarnessOptsSchema` inside the raw runner.
 */
export async function runHeadlessClaude<T>(
  promptBody: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const finalResult = await runHeadlessClaudeRaw(promptBody, opts);
  return validateHeadlessJson(finalResult, schema, opts);
}

function findFinalResult(messages: HeadlessStreamMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.type === 'result') {
      if (m.is_error === true) return null;
      if (typeof m.result === 'string') return m.result;
    }
  }
  return null;
}
