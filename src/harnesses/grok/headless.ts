import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { extractJsonPayload } from '../../lib/json-extract.js';
import { GrokHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface GrokHeadlessOptions extends HeadlessRunOptions {
  /** Override the `grok` binary path. Tests point this at a stub. */
  grokCli?: string;
}

/**
 * Invokes `grok -p --output-format json`. The child's final `text` field is
 * treated as the model answer; `extractJsonPayload` recovers a fenced or
 * embedded JSON object. `KENKEEP_BUILDER_INTERNAL=1` is always set so
 * capture/drain hooks in the child no-op.
 *
 * `--yolo` is required for unattended drain (same class as Copilot's
 * `--allow-all-tools`). The parent Node process, not the child, writes
 * session-log updates.
 */
export async function runHeadlessGrok<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: GrokHeadlessOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = GrokHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.grokCli ?? 'grok';
  const fullPrompt = stdin.length > 0 ? `${promptBody}\n\n--- input ---\n${stdin}` : promptBody;

  const args: string[] = ['-p', fullPrompt, '--output-format', 'json', '--yolo'];
  if (harnessOpts.model) args.push('--model', harnessOpts.model);
  if (harnessOpts.effort) args.push('--effort', harnessOpts.effort);

  const env: NodeJS.ProcessEnv = {
    ...(opts.env ?? process.env),
    KENKEEP_BUILDER_INTERNAL: '1',
  };

  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: 'utf8', flags: 'a' });
  }

  const result = await execa(cli, args, {
    env,
    timeout: timeoutMs,
    reject: false,
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
  });

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  if (logStream) {
    logStream.write(stdout);
    await new Promise<void>(resolve => logStream!.end(resolve));
  }

  if (result.timedOut === true) {
    throw new Error(`grok subprocess timed out after ${timeoutMs}ms`);
  }
  const exitCode = typeof result.exitCode === 'number' ? result.exitCode : undefined;
  if (result.failed === true || (exitCode !== undefined && exitCode !== 0)) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const suffix = stderr ? `: ${tailString(stderr, 2000)}` : '';
    throw new Error(`grok subprocess failed (exit code ${String(exitCode ?? 'unknown')})${suffix}`);
  }

  const role = opts.role ?? 'headless';
  if (stdout.trim().length === 0) {
    throw new Error(`${role} output was empty; grok produced no final text.`);
  }

  const answerText = extractGrokAnswerText(stdout);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(answerText));
  } catch (parseError) {
    throw new Error(
      `${role} output did not contain a parseable JSON payload: ${parseError instanceof Error ? parseError.message : String(parseError)}. First 1KB of stdout: ${stdout.slice(0, 1024)}`
    );
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`${role} output did not match schema: ${validated.error.message}`);
  }

  if (opts.onMessage) {
    const message: HeadlessStreamMessage = {
      type: 'result',
      result: answerText,
      is_error: false,
    };
    opts.onMessage(message);
  }

  return validated.data;
}

/**
 * Grok `--output-format json` emits `{ text, stopReason, sessionId, ... }`.
 * Fall back to the raw stdout when that envelope is missing so fenced JSON
 * still parses.
 */
export function extractGrokAnswerText(stdout: string): string {
  const trimmed = stdout.trim();
  try {
    const envelope = JSON.parse(trimmed) as { text?: unknown };
    if (typeof envelope.text === 'string' && envelope.text.length > 0) return envelope.text;
  } catch {
    // not a single JSON object — use extractJsonPayload on the raw stream
  }
  return trimmed;
}

function tailString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}
