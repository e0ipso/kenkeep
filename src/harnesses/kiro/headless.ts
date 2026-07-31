import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { extractJsonPayload } from '../../lib/json-extract.js';
import { KiroHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface KiroHeadlessOptions extends HeadlessRunOptions {
  /**
   * Override the `kiro-cli-chat` binary path. Defaults to `'kiro-cli-chat'`
   * on PATH; tests point this at a stub script that prints a canned final
   * answer.
   */
  kiroCli?: string;
  /**
   * Repository root passed as the working directory of the headless child so
   * Kiro's file-system tools (`read`, `write`, shell commands) operate on the
   * correct project root regardless of the CWD the hook was invoked from.
   * Defaults to `process.cwd()`.
   */
  repoRoot?: string;
}

/**
 * Invokes `kiro-cli-chat chat <prompt> --no-interactive --trust-all-tools` in
 * programmatic mode and validates the embedded fenced JSON payload from the
 * agent's final stdout text against `schema`.
 *
 * Kiro CLI has no `--json` programmatic-output flag, so the runner relies on
 * the same embedded-JSON contract the other adapters fall back to: the prompt
 * instructs the model to emit a JSON object (typically fenced) at the end of
 * its answer, and `extractJsonPayload` recovers it from the buffered stdout.
 * `--no-interactive` and `--trust-all-tools` are both required for fully
 * autonomous non-interactive operation.
 *
 * The recursion guard env var `KENKEEP_BUILDER_INTERNAL=1` is always set on
 * the child so capture and drain hooks fired from the spawned process exit
 * silently.
 *
 * stdout is consumed as a streaming line buffer (consistent with the other
 * adapters) so the mock execa helper works correctly in tests.
 */
export async function runHeadlessKiro<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: KiroHeadlessOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = KiroHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.kiroCli ?? 'kiro-cli-chat';
  const repoRoot = opts.repoRoot ?? process.cwd();

  const fullPrompt = stdin.length > 0 ? `${promptBody}\n\n--- input ---\n${stdin}` : promptBody;

  const args: string[] = ['chat', fullPrompt, '--no-interactive', '--trust-all-tools'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);

  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KENKEEP_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const proc = execa(cli, args, {
    env,
    cwd: repoRoot,
    timeout: timeoutMs,
    stdout: 'pipe',
    reject: false,
  });
  const stdout = proc.stdout as Readable;
  const stderrChunks: string[] = [];
  const stderrStream = proc.stderr as Readable | null;
  if (stderrStream) {
    stderrStream.setEncoding('utf8');
    stderrStream.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
    });
  }

  const resultPromise = proc.then(r => ({
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : undefined,
    failed: r.failed === true,
    timedOut: r.timedOut === true,
  }));

  const outputLines: string[] = [];
  const splitter = stdout.pipe(split2());
  splitter.on('data', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (logStream) logStream.write(`${trimmed}\n`);
    outputLines.push(trimmed);
  });

  const streamDone = new Promise<void>((resolve, reject) => {
    splitter.once('end', () => resolve());
    splitter.once('error', (err: Error) => reject(err));
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
    throw new Error(`kiro-cli-chat subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || (runResult.exitCode !== undefined && runResult.exitCode !== 0)) {
    const stderrTail = tailString(stderrChunks.join(''), 2000);
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    throw new Error(
      `kiro-cli-chat subprocess failed (exit code ${String(runResult.exitCode ?? 'unknown')})${suffix}`
    );
  }

  const combinedOutput = outputLines.join('\n');
  const role = opts.role ?? 'headless';

  if (combinedOutput.trim().length === 0) {
    throw new Error(`${role} output was empty; kiro-cli-chat produced no final text.`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(combinedOutput));
  } catch (parseError) {
    throw new Error(
      `${role} output did not contain a parseable JSON payload: ${parseError instanceof Error ? parseError.message : String(parseError)}. First 1KB of stdout: ${combinedOutput.slice(0, 1024)}`
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`${role} output did not match schema: ${validated.error.message}`);
  }

  if (opts.onMessage) {
    const message: HeadlessStreamMessage = {
      type: 'result',
      result: combinedOutput,
      is_error: false,
    };
    opts.onMessage(message);
  }

  return validated.data;
}

function tailString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}
