import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
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

/**
 * Invokes `opencode run --format json` and validates the final assistant
 * message as structured JSON against `schema`.
 *
 * The runner accumulates `properties.part.text` deltas (the part stream
 * for the most-recent assistant message id), parses the accumulated
 * string as JSON after `session.idle` (or stream end), then runs it
 * through the caller-supplied Zod schema.
 *
 * The recursion guard env var `KB_BUILDER_INTERNAL=1` is always set on
 * the child so the spawned opencode's plugin shim no-ops.
 */
export async function runHeadlessOpenCode<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: OpenCodeHeadlessOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = OpenCodeHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.opencodeCli ?? 'opencode';

  const args: string[] = ['run', '--format', 'json'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.agent) args.push('--agent', harnessOpts.agent);
  // The prompt is positional. OpenCode does not document a `-` stdin
  // alternative, so we always pass it as argv.
  args.push(promptBody);

  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KB_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  let currentAssistantMessageId: string | undefined;
  let accumulatedText = '';
  const stderrChunks: string[] = [];
  const proc = execa(cli, args, {
    input: stdin,
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
    let parsed: OpenCodeEvent;
    try {
      parsed = JSON.parse(trimmed) as OpenCodeEvent;
    } catch {
      return;
    }
    if (parsed.type === 'session.created') {
      currentAssistantMessageId = undefined;
      accumulatedText = '';
    }
    if (parsed.type === 'message.part.updated') {
      const messageId = parsed.properties?.messageID;
      const part = parsed.properties?.part;
      if (
        messageId &&
        part &&
        part.type === 'text' &&
        typeof part.text === 'string'
      ) {
        if (messageId !== currentAssistantMessageId) {
          currentAssistantMessageId = messageId;
          accumulatedText = '';
        }
        accumulatedText += part.text;
      }
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
    throw new Error(
      `opencode subprocess timed out after ${timeoutMs}ms; accumulated text: ${truncate(accumulatedText, 200)}`
    );
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    const stderrTail = tail(stderrChunks.join(''), 2000);
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    throw new Error(
      `opencode subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})${suffix}`
    );
  }

  if (accumulatedText.length === 0) {
    throw new Error('opencode subprocess produced no assistant text');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(accumulatedText.trim());
  } catch (parseError) {
    throw new Error(
      `Could not parse opencode output as JSON: ${truncate(accumulatedText, 200)} (${parseError instanceof Error ? parseError.message : String(parseError)})`
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`opencode output did not match schema: ${validated.error.message}`);
  }
  return validated.data;
}

function tail(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}...`;
}
