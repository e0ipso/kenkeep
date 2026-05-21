import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { CursorHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

const PROMPT_STDIN_THRESHOLD = 64 * 1024;

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
 */
export async function runHeadlessCursor<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = CursorHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const agentCli = harnessOpts.agentCli ?? 'agent';

  const usePromptStdin =
    stdin.length > 0 || Buffer.byteLength(promptBody, 'utf8') > PROMPT_STDIN_THRESHOLD;
  const args: string[] = ['-p', '--output-format', 'json'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  let childStdin: string;
  if (usePromptStdin) {
    args.push('-');
    childStdin = stdin.length > 0 ? stdin : promptBody;
  } else {
    args.push(promptBody);
    childStdin = '';
  }

  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KB_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  let lastResultText: string | undefined;
  const stderrChunks: string[] = [];
  const proc = execa(agentCli, args, {
    input: childStdin,
    env,
    timeout: timeoutMs,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    reject: false,
  });
  const stdout = proc.stdout as Readable;
  const stderr = proc.stderr as Readable | null;
  if (stderr) {
    stderr.setEncoding('utf8');
    stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
    });
  }

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
    let parsed: CursorResultEvent;
    try {
      parsed = JSON.parse(trimmed) as CursorResultEvent;
    } catch {
      return;
    }
    if (parsed.type === 'result' && typeof parsed.result === 'string') {
      lastResultText = parsed.result;
    }
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
    throw new Error(`${agentCli} subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    const stderrTail = tailString(stderrChunks.join(''), 2000);
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    throw new Error(
      `${agentCli} subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})${suffix}`
    );
  }

  if (typeof lastResultText !== 'string') {
    throw new Error(`${agentCli} subprocess produced no result event`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(lastResultText.trim());
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

function tailString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}
