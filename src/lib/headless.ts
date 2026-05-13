import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { EffortLevel, ModelFamily } from './schemas.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface RunHeadlessOptions {
  timeoutMs?: number;
  allowedTools?: string[];
  logFile?: string;
  env?: NodeJS.ProcessEnv;
  /** When set, passed through as `claude -p --model <value>`. */
  model?: ModelFamily;
  /** When set, passed through as `claude -p --effort <value>`. */
  effort?: EffortLevel;
  /** Invoked once per successfully parsed stream-json line. */
  onMessage?: (msg: StreamJsonMessage) => void;
}

export interface StreamJsonMessage {
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  [key: string]: unknown;
}

/**
 * Invokes `claude -p` with stream-json verbose output. Each line of stdout is
 * a JSON event; we mirror them into `logFile` (if given) as they arrive and
 * search for the final `type: result` event. Its `result` text is parsed as
 * JSON and validated against `schema`.
 *
 * The recursion guard env var (`KB_BUILDER_INTERNAL=1`) is always set on the
 * child so that capture/drain hooks fired from the spawned process exit
 * silently.
 */
export async function runHeadlessClaude<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: RunHeadlessOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowedTools = opts.allowedTools ?? [];
  const args = [
    '-p',
    promptBody,
    '--allowedTools',
    allowedTools.join(','),
    '--output-format',
    'stream-json',
    '--verbose',
  ];
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KB_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const messages: StreamJsonMessage[] = [];
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
    let parsed: StreamJsonMessage;
    try {
      parsed = JSON.parse(trimmed) as StreamJsonMessage;
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

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(finalResult.trim());
  } catch (parseError) {
    throw new Error(
      `curator output was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. See ${opts.logFile ?? 'log'} for the full transcript.`
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`proposal output did not match schema: ${validated.error.message}`);
  }
  return validated.data;
}

function findFinalResult(messages: StreamJsonMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.type === 'result') {
      if (m.is_error === true) return null;
      if (typeof m.result === 'string') return m.result;
    }
  }
  return null;
}
