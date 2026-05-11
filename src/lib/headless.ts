import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface RunHeadlessOptions {
  timeoutMs?: number;
  allowedTools?: string[];
  logFile?: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam: substitute the underlying spawn. */
  spawn?: SpawnFn;
}

export interface SpawnResult {
  stdout: Readable;
  result: Promise<{
    exitCode: number | undefined;
    failed: boolean;
    timedOut: boolean;
  }>;
}

export interface SpawnContext {
  args: string[];
  stdin: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}

export type SpawnFn = (command: string, ctx: SpawnContext) => SpawnResult;

interface StreamJsonMessage {
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  [key: string]: unknown;
}

const defaultSpawn: SpawnFn = (command, ctx) => {
  const proc = execa(command, ctx.args, {
    input: ctx.stdin,
    env: ctx.env,
    timeout: ctx.timeoutMs,
    stdin: 'pipe',
    stdout: 'pipe',
    reject: false,
  });
  const stdout = proc.stdout as Readable;
  const result = proc.then((r) => ({
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : undefined,
    failed: r.failed === true,
    timedOut: r.timedOut === true,
  }));
  return { stdout, result };
};

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
  opts: RunHeadlessOptions = {},
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
  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KB_BUILDER_INTERNAL: '1',
  };
  const spawn = opts.spawn ?? defaultSpawn;

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const messages: StreamJsonMessage[] = [];
  const { stdout, result: resultPromise } = spawn('claude', {
    args,
    stdin,
    env,
    timeoutMs,
  });

  const splitter = stdout.pipe(split2());
  splitter.on('data', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (logStream) logStream.write(`${trimmed}\n`);
    try {
      messages.push(JSON.parse(trimmed) as StreamJsonMessage);
    } catch {
      // Non-JSON line; ignore.
    }
  });
  const streamDone = new Promise<void>((resolve, reject) => {
    splitter.once('end', () => resolve());
    splitter.once('error', (err) => reject(err));
  });

  let runResult;
  try {
    const [r] = await Promise.all([resultPromise, streamDone]);
    runResult = r;
  } finally {
    if (logStream) {
      await new Promise<void>((resolve) => logStream!.end(resolve));
    }
  }

  if (runResult.timedOut) {
    throw new Error(`claude subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    throw new Error(
      `claude subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})`,
    );
  }

  const finalResult = findFinalResult(messages);
  if (finalResult === null) {
    throw new Error('claude subprocess produced no final result message');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonBlock(finalResult));
  } catch (err) {
    throw new Error(
      `failed to parse final result as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`stage-2 output did not match schema: ${validated.error.message}`);
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

/**
 * Tolerates models that wrap their JSON in ```json fences or include
 * preamble/trailing whitespace. Falls back to the raw string.
 */
function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence && fence[1]) return fence[1].trim();
  return text.trim();
}
