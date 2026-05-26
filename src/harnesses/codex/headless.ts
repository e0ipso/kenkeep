import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { extractJsonPayload } from '../../lib/json-extract.js';
import { CodexHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Threshold above which the prompt is piped through stdin instead of being
 * passed as a positional argv. Most shells comfortably handle far larger
 * argv lists, but Codex's CLI accepts a `-` placeholder for stdin and
 * staying under this bound keeps the spawn portable.
 */
const PROMPT_STDIN_THRESHOLD = 64 * 1024;

/**
 * Codex event-stream record shape. Codex documents
 * `thread.started`, `turn.started`, `item.started`, `item.completed`,
 * `turn.completed`, and `error`. We only consume `item.completed` events
 * whose nested `item.type === 'agent_message'` to recover the final
 * structured answer; everything else is forwarded to `onMessage` / logged
 * but does not influence the return value.
 */
interface CodexEvent extends HeadlessStreamMessage {
  type?: string;
  item?: {
    type?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/**
 * Invokes `codex exec --json` and validates the final agent message as
 * structured JSON against `schema`. Each stdout line is a JSON event;
 * events are mirrored to `opts.logFile` (if given), surfaced via
 * `opts.onMessage`, and used to track the most recent `agent_message`.
 * The final agent message's `text` field is parsed as JSON after the
 * child exits.
 *
 * The recursion guard env var (`KB_BUILDER_INTERNAL=1`) is always set on
 * the child so that capture and drain hooks fired from the spawned process
 * exit silently.
 *
 * Codex-specific knobs (`model`, `reasoningEffort`) live inside the
 * adapter-opaque `harnessOpts` blob and are validated by
 * `CodexHarnessOptsSchema` at the top of the call.
 */
export async function runHeadlessCodex<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: HeadlessRunOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = CodexHarnessOptsSchema.parse(opts.harnessOpts ?? {});

  const usePromptStdin =
    stdin.length > 0 || Buffer.byteLength(promptBody, 'utf8') > PROMPT_STDIN_THRESHOLD;
  const args: string[] = ['exec', '--json', '--sandbox', 'read-only'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.reasoningEffort) {
    args.push('-c', `reasoning.effort=${harnessOpts.reasoningEffort}`);
  }
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

  let lastAgentMessage: string | undefined;
  const stderrChunks: string[] = [];
  const proc = execa('codex', args, {
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
    let parsed: CodexEvent;
    try {
      parsed = JSON.parse(trimmed) as CodexEvent;
    } catch {
      return;
    }
    if (
      parsed.type === 'item.completed' &&
      parsed.item &&
      parsed.item.type === 'agent_message' &&
      typeof parsed.item.text === 'string'
    ) {
      lastAgentMessage = parsed.item.text;
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
    throw new Error(`codex subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    const stderrTail = tailString(stderrChunks.join(''), 2000);
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    throw new Error(
      `codex subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})${suffix}`
    );
  }

  if (typeof lastAgentMessage !== 'string') {
    throw new Error('codex subprocess produced no agent_message event');
  }

  const role = opts.role ?? 'headless';
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(lastAgentMessage));
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

function tailString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}
