import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../types.js';
import { extractJsonPayload } from '../../lib/json-extract.js';
import { CopilotHarnessOptsSchema } from './opts.js';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface CopilotHeadlessOptions extends HeadlessRunOptions {
  /**
   * Override the `copilot` binary path. Defaults to `'copilot'` on PATH;
   * tests point this at a stub script that prints a canned final answer.
   */
  copilotCli?: string;
  /**
   * Repository root passed to `copilot --add-dir` so the agent can read
   * project files. Defaults to `process.cwd()`.
   */
  repoRoot?: string;
}

/**
 * Invokes `copilot -p` in programmatic mode and validates the embedded
 * fenced JSON payload from the agent's final stdout text against `schema`.
 *
 * Copilot has no `--json` programmatic-output flag, so the runner relies on
 * the same embedded-JSON contract the other adapters fall back to: the
 * prompt instructs the model to emit a JSON object (typically fenced) at the
 * end of its answer, and `extractJsonPayload` recovers it from the buffered
 * stdout. `--no-ask-user` and `--allow-all-tools` are both required for
 * fully autonomous non-interactive operation and are never optional.
 *
 * The recursion guard env var `KENKEEP_BUILDER_INTERNAL=1` is always set on
 * the child so capture and drain hooks fired from the spawned process exit
 * silently. Copilot emits no intermediate stream events, so `opts.onMessage`
 * receives one synthetic message carrying the final result at completion.
 */
export async function runHeadlessCopilot<T>(
  promptBody: string,
  stdin: string,
  schema: ZodSchema<T>,
  opts: CopilotHeadlessOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const harnessOpts = CopilotHarnessOptsSchema.parse(opts.harnessOpts ?? {});
  const cli = opts.copilotCli ?? 'copilot';
  const repoRoot = opts.repoRoot ?? process.cwd();

  const fullPrompt = stdin.length > 0 ? `${promptBody}\n\n--- input ---\n${stdin}` : promptBody;

  const args: string[] = [
    '-p',
    fullPrompt,
    '--no-ask-user',
    '--allow-all-tools',
    '--add-dir',
    repoRoot,
  ];
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

  const result = await execa(cli, args, {
    env,
    timeout: timeoutMs,
    reject: false,
  });

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  if (logStream) {
    logStream.write(stdout);
    await new Promise<void>(resolve => logStream!.end(resolve));
  }

  if (result.timedOut === true) {
    throw new Error(`copilot subprocess timed out after ${timeoutMs}ms`);
  }
  const exitCode = typeof result.exitCode === 'number' ? result.exitCode : undefined;
  if (result.failed === true || (exitCode !== undefined && exitCode !== 0)) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const suffix = stderr ? `: ${tailString(stderr, 2000)}` : '';
    throw new Error(
      `copilot subprocess failed (exit code ${String(exitCode ?? 'unknown')})${suffix}`
    );
  }

  const role = opts.role ?? 'headless';
  if (stdout.trim().length === 0) {
    throw new Error(`${role} output was empty; copilot produced no final text.`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(stdout));
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
      result: stdout,
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
