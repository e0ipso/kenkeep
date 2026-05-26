import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { extractJsonPayload } from '../../lib/json-extract.js';
import { ClaudeHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Spawns `claude -p` with stream-json verbose output, mirrors each line into
 * `logFile` (if given), and returns the trimmed string from the final
 * `type: result` event. Throws on subprocess failure / timeout / missing
 * result event. Callers that need typed JSON validate the returned string
 * themselves (e.g. `runHeadlessClaude` adds a `JSON.parse` + Zod schema pass
 * on top).
 *
 * The recursion guard env var (`KB_BUILDER_INTERNAL=1`) is always set on the
 * child so capture/drain hooks fired from the spawned process exit silently.
 */
export async function runHeadlessClaudeRaw(
  promptBody: string,
  stdin: string,
  opts: HeadlessRunOptions = {}
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = ClaudeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const allowedTools = harnessOpts.allowedTools ?? [];
  const args = [
    '-p',
    promptBody,
    '--allowedTools',
    allowedTools.join(','),
    '--output-format',
    'stream-json',
    '--verbose',
  ];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.effort) args.push('--effort', harnessOpts.effort);
  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KB_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const messages: HeadlessStreamMessage[] = [];
  const proc = execa('claude', args, {
    input: stdin,
    env,
    timeout: timeoutMs,
    stdin: 'pipe',
    stdout: 'pipe',
    reject: false,
  });
  const stdout = proc.stdout as Readable;
  const resultPromise = proc.then(r => ({
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : undefined,
    failed: r.failed === true,
    timedOut: r.timedOut === true,
  }));

  const splitter = stdout.pipe(split2());
  splitter.on('data', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (logStream) logStream.write(`${trimmed}\n`);
    let parsed: HeadlessStreamMessage;
    try {
      parsed = JSON.parse(trimmed) as HeadlessStreamMessage;
    } catch {
      return;
    }
    messages.push(parsed);
    if (opts.onMessage) opts.onMessage(parsed);
  });
  const streamDone = new Promise<void>((resolve, reject) => {
    splitter.once('end', () => resolve());
    splitter.once('error', err => reject(err));
  });

  let runResult;
  try {
    const [r] = await Promise.all([resultPromise, streamDone]);
    runResult = r;
  } finally {
    if (logStream) {
      await new Promise<void>(resolve => logStream!.end(resolve));
    }
  }

  if (runResult.timedOut) {
    throw new Error(`claude subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    throw new Error(
      `claude subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})`
    );
  }

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
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const finalResult = await runHeadlessClaudeRaw(promptBody, stdin, opts);
  const role = opts.role ?? 'headless';

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(finalResult));
  } catch (parseError) {
    throw new Error(
      `${role} output was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. See ${opts.logFile ?? 'log'} for the full transcript.`
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`${role} output did not match schema: ${validated.error.message}`);
  }
  return validated.data;
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
