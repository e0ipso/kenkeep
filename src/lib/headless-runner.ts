import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions } from '../harnesses/types.js';
import { extractJsonPayload } from './json-extract.js';

/**
 * Harness-neutral mechanics shared by every `src/harnesses/<id>/headless.ts`
 * runner: size-aware prompt transport selection, the
 * recursion-guard env, log mirroring, the execa spawn, line streaming,
 * timeout/exit mapping and JSON validation. Each adapter keeps its own argv
 * shape and result parsing on top of this; adapters never import each other.
 */

export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Set on every spawned child so capture/drain hooks fired from inside the
 * headless session exit silently instead of recursing.
 */
export const RECURSION_GUARD_ENV = 'KENKEEP_BUILDER_INTERNAL';

/**
 * Prompts above this byte length travel through the host's stdin channel.
 * Linux rejects a single argv element above MAX_ARG_STRLEN (32 pages,
 * 128 KiB) with E2BIG; 64 KiB leaves headroom for the rest of argv and the
 * environment, and matches the bound the Codex and Cursor adapters already
 * used.
 */
export const PROMPT_STDIN_THRESHOLD = 64 * 1024;

const STDERR_TAIL_CHARS = 2000;

export type PromptTransport = 'argv' | 'stdin';

/**
 * One prompt text plus the channel it must use. `positional` is the argv
 * element to append (empty for stdin transport) and `input` the child's
 * stdin (empty for argv transport), so an adapter cannot pick a channel
 * that disagrees with `transport`.
 */
export interface HeadlessPrompt {
  transport: PromptTransport;
  text: string;
  positional: string[];
  input: string;
}

export function selectPromptTransport(prompt: string): PromptTransport {
  return Buffer.byteLength(prompt, 'utf8') > PROMPT_STDIN_THRESHOLD ? 'stdin' : 'argv';
}

export function prepareHeadlessPrompt(text: string): HeadlessPrompt {
  const transport = selectPromptTransport(text);
  return transport === 'stdin'
    ? { transport, text, positional: [], input: text }
    : { transport, text, positional: [text], input: '' };
}

export interface HeadlessSpawnSpec {
  command: string;
  args: string[];
  /**
   * Child stdin. Always supplied (possibly empty) and closed after writing:
   * hosts that drain stdin before starting would otherwise wait forever on
   * an open pipe.
   */
  input: string;
  /** Name used in error messages (`claude`, `codex`, the agent CLI path, ...). */
  label: string;
  /**
   * Receives every trimmed, non-empty stdout line after it has been mirrored
   * to `opts.logFile`.
   */
  onLine: (line: string) => void;
}

interface ChildOutcome {
  exitCode: number | undefined;
  failed: boolean;
  timedOut: boolean;
  code: string | undefined;
}

/**
 * Spawns the host CLI with the recursion guard set, streams stdout line by
 * line into `spec.onLine`, mirrors the stream into `opts.logFile` and
 * throws on timeout or non-zero exit (with a stderr tail when available).
 */
export async function spawnHeadless(
  spec: HeadlessSpawnSpec,
  opts: HeadlessRunOptions
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    [RECURSION_GUARD_ENV]: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const stderrChunks: string[] = [];
  const proc = execa(spec.command, spec.args, {
    input: spec.input,
    env,
    timeout: timeoutMs,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    reject: false,
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
  });
  const stdout = proc.stdout as Readable;
  const stderr = proc.stderr as Readable | null;
  if (stderr) {
    stderr.setEncoding('utf8');
    stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
    });
  }

  const outcomePromise: Promise<ChildOutcome> = proc.then(r => ({
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : undefined,
    failed: r.failed === true,
    timedOut: r.timedOut === true,
    code:
      typeof (r as { code?: unknown }).code === 'string' ? (r as { code: string }).code : undefined,
  }));

  const splitter = stdout.pipe(split2());
  splitter.on('data', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (logStream) logStream.write(`${trimmed}\n`);
    spec.onLine(trimmed);
  });
  const streamDone = new Promise<void>((resolve, reject) => {
    splitter.once('end', () => resolve());
    splitter.once('error', err => reject(err));
  });

  let outcome: ChildOutcome;
  try {
    const [r] = await Promise.all([outcomePromise, streamDone]);
    outcome = r;
  } finally {
    if (logStream) {
      await new Promise<void>(resolve => logStream!.end(resolve));
    }
  }

  if (outcome.timedOut) {
    throw new Error(`${spec.label} subprocess timed out after ${timeoutMs}ms`);
  }
  if (outcome.failed || (outcome.exitCode !== undefined && outcome.exitCode !== 0)) {
    const stderrTail = tailString(stderrChunks.join(''), STDERR_TAIL_CHARS);
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    const codeSuffix = outcome.code ? `, ${outcome.code}` : '';
    throw new Error(
      `${spec.label} subprocess failed (exit code ${String(outcome.exitCode ?? 'unknown')}${codeSuffix})${suffix}`
    );
  }
}

/**
 * Parses one stdout line as JSON; non-JSON lines (progress noise, banners)
 * are skipped by returning `null`.
 */
export function parseJsonLine<T extends object>(line: string): T | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/**
 * Recovers the (possibly fenced) JSON payload from the host's final text and
 * validates it against the caller's schema, with role-tagged errors.
 */
export function validateHeadlessJson<T>(
  text: string,
  schema: ZodSchema<T>,
  opts: Pick<HeadlessRunOptions, 'role' | 'logFile'>
): T {
  const role = opts.role ?? 'headless';
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(text));
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
