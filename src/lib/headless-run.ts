/**
 * Strategy base for the adapters' headless LLM runners.
 *
 * Every harness runs the same algorithm: spawn the CLI with the recursion
 * guard on its env, tee each non-empty stdout line to an optional log file,
 * hand that line to an adapter-specific parser, buffer stderr, wait for BOTH
 * process exit and stream end, classify timeout vs non-zero exit, then recover
 * a JSON payload from the agent's final text and validate it against the
 * caller's schema. That algorithm used to be copy-pasted into all six
 * runners, along with five verbatim copies of `tailString`.
 *
 * `runHeadlessStrategy` owns the algorithm. `HeadlessStrategy` names each
 * point where a harness legitimately differs and supplies the majority
 * behaviour as an overridable default, so an override is a positive statement
 * about that harness rather than a flag threaded through shared code. Every
 * adapter implements `consumeLine`/`finalText`/`noOutputError`; beyond that:
 *
 *   Claude    failureIncludesStderr — its stderr carries no diagnostics
 *   Codex     stdin — routes a large prompt through `-` instead of argv
 *   Cursor    stdin, harnessName — same routing, caller-overridable binary
 *   OpenCode  timeoutDetail — reports the partial answer on timeout
 *   Copilot   stdin: ignore, onValidated — argv prompt, synthesized event
 *   Kiro      stdin: ignore, onValidated, cwd — same, plus a pinned repo root
 */
import { execa } from 'execa';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import split2 from 'split2';
import type { ZodSchema } from 'zod';
import type { HeadlessRunOptions, HeadlessStreamMessage } from '../harnesses/types.js';
import { extractJsonPayload } from './json-extract.js';

/** How the child's stdin is wired. */
export type ChildStdin =
  /** Write `input` (possibly empty) then close. For CLIs that read a prompt or payload from stdin. */
  | { mode: 'write'; input: string }
  /**
   * Give the child `/dev/null`. For CLIs whose whole prompt travels in argv:
   * execa's default is an open pipe that is never written to nor ended, so a
   * CLI that reads stdin would block until the timeout fires.
   */
  | { mode: 'ignore' };

/** How much of the stderr tail a failure message carries. */
const STDERR_TAIL_CHARS = 2000;

/**
 * Last `maxChars` characters of `s`, trimmed. Bounds the stderr tail quoted in
 * subprocess failure messages.
 */
export function tailString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s.trim();
  return s.slice(s.length - maxChars).trim();
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Byte threshold above which a prompt is piped through stdin rather than
 * passed as a positional argv element.
 *
 * This is a correctness guard, not a style preference: Linux caps a *single*
 * argv element at MAX_ARG_STRLEN (128 KiB) independently of the total ARG_MAX,
 * so a large transcript embedded in one argument fails the spawn outright with
 * E2BIG. 64 KiB leaves generous headroom.
 */
const PROMPT_STDIN_THRESHOLD = 64 * 1024;

export interface RoutedPrompt {
  /** The argv element to append: the prompt itself, or `-` when it goes via stdin. */
  promptArg: string;
  /** What to write to the child's stdin (empty when the prompt is in argv). */
  childStdin: string;
}

/**
 * Decides whether a prompt travels in argv or through stdin, for CLIs that
 * accept a `-` placeholder (Codex, Cursor). Routing through stdin whenever the
 * caller supplied stdin content or the prompt is large keeps the spawn under
 * the single-argument length limit.
 */
export function routePrompt(promptBody: string, stdin: string): RoutedPrompt {
  if (stdin.length > 0 || Buffer.byteLength(promptBody, 'utf8') > PROMPT_STDIN_THRESHOLD) {
    return { promptArg: '-', childStdin: stdin.length > 0 ? stdin : promptBody };
  }
  return { promptArg: promptBody, childStdin: '' };
}

export abstract class HeadlessStrategy {
  /** Executable to spawn. Also names the harness in subprocess error messages. */
  abstract readonly cli: string;
  /** argv after the executable. */
  abstract readonly args: readonly string[];
  /** Child environment, already carrying `KENKEEP_BUILDER_INTERNAL=1`. */
  abstract readonly env: NodeJS.ProcessEnv;
  /** Wall-clock budget for the child. */
  abstract readonly timeoutMs: number;
  /** Role label used in output-validation error messages (`curator`, ...). */
  abstract readonly role: string;

  /**
   * Consumes one non-empty, trimmed stdout line, accumulating whatever
   * `finalText` will return. Called in arrival order.
   */
  abstract consumeLine(line: string): void;

  /**
   * The agent's final text, or `undefined` when the child produced none —
   * in which case `noOutputError` explains what was missing.
   */
  abstract finalText(): string | undefined;

  /** Message thrown when `finalText()` yields nothing usable. */
  abstract noOutputError(): string;

  // --- overridable defaults ---

  /**
   * Harness name quoted in subprocess error messages. Defaults to `cli`, which
   * is right when the executable name is fixed. Adapters whose `cli` is a
   * caller-supplied path (test shims, custom install locations) override this
   * so a failure names the harness rather than a temp file.
   */
  harnessName(): string {
    return this.cli;
  }

  /** Where each stdout line is mirrored, if anywhere. */
  logFile(): string | undefined {
    return undefined;
  }

  /** Working directory for the child. Default inherits the current process's. */
  cwd(): string | undefined {
    return undefined;
  }

  /** How stdin is wired. Default writes nothing and closes immediately. */
  stdin(): ChildStdin {
    return { mode: 'write', input: '' };
  }

  /** Extra detail appended to the timeout message. */
  timeoutDetail(): string {
    return '';
  }

  /**
   * Whether the non-zero-exit message quotes the stderr tail. Override to
   * `false` on harnesses whose stderr carries no useful diagnostics.
   */
  failureIncludesStderr(): boolean {
    return true;
  }

  /** Message thrown when the final text carries no parseable JSON payload. */
  jsonParseError(err: unknown, _finalText: string): string {
    return `${this.role} output was not valid JSON: ${errorText(err)}. See ${this.logFile() ?? 'log'} for the full transcript.`;
  }

  /** Called after successful validation, for harnesses that synthesize events. */
  onValidated(_finalText: string): void {}
}

/**
 * Strategy for harnesses with no structured output stream: the whole prompt
 * goes in argv, stdout is collected as-is, and the agent's final answer is the
 * accumulated text carrying an embedded (usually fenced) JSON payload. Copilot
 * and Kiro share this contract exactly, so the accumulation, the stdin
 * contract, the diagnostic message, and the synthetic completion event live
 * here rather than in both.
 *
 * Subclasses supply the spawn identity (`cli`, `args`, `env`, `timeoutMs`,
 * `role`, `harnessName`, `noOutputError`) and override anything else their
 * host needs.
 */
export abstract class BufferedAnswerStrategy extends HeadlessStrategy {
  private readonly lines: string[] = [];

  protected constructor(protected readonly runOpts: HeadlessRunOptions) {
    super();
  }

  consumeLine(line: string): void {
    this.lines.push(line);
  }

  finalText(): string | undefined {
    const combined = this.lines.join('\n');
    return combined.trim().length > 0 ? combined : undefined;
  }

  /** The whole prompt travels in argv, so the child has nothing to read. */
  override stdin(): ChildStdin {
    return { mode: 'ignore' };
  }

  override logFile(): string | undefined {
    return this.runOpts.logFile;
  }

  override jsonParseError(err: unknown, finalText: string): string {
    return `${this.role} output did not contain a parseable JSON payload: ${errorText(err)}. First 1KB of stdout: ${finalText.slice(0, 1024)}`;
  }

  /** These harnesses emit no intermediate events, so synthesize a final one. */
  override onValidated(finalText: string): void {
    if (!this.runOpts.onMessage) return;
    const message: HeadlessStreamMessage = { type: 'result', result: finalText, is_error: false };
    this.runOpts.onMessage(message);
  }
}

interface ChildOutcome {
  exitCode: number | undefined;
  failed: boolean;
  timedOut: boolean;
  stderr: string;
}

/**
 * Spawns the strategy's CLI and resolves once the process has exited *and*
 * stdout has ended. Never rejects on a non-zero exit — the outcome is
 * classified by the caller. The log stream is always closed, including when
 * the stdout stream errors.
 */
async function spawnChild(strategy: HeadlessStrategy): Promise<ChildOutcome> {
  const logFile = strategy.logFile();
  let logStream: ReturnType<typeof createWriteStream> | null = null;
  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true });
    logStream = createWriteStream(logFile, { encoding: 'utf8', flags: 'a' });
  }

  const stdinSpec = strategy.stdin();
  const cwd = strategy.cwd();
  const stderrChunks: string[] = [];
  const proc = execa(strategy.cli, [...strategy.args], {
    ...(stdinSpec.mode === 'write'
      ? { input: stdinSpec.input, stdin: 'pipe' as const }
      : { stdin: 'ignore' as const }),
    ...(cwd !== undefined ? { cwd } : {}),
    env: strategy.env,
    timeout: strategy.timeoutMs,
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
    strategy.consumeLine(trimmed);
  });
  const streamDone = new Promise<void>((resolve, reject) => {
    splitter.once('end', () => resolve());
    splitter.once('error', (err: Error) => reject(err));
  });

  try {
    const [outcome] = await Promise.all([resultPromise, streamDone]);
    return { ...outcome, stderr: stderrChunks.join('') };
  } finally {
    if (logStream) {
      await new Promise<void>(resolve => logStream.end(resolve));
    }
  }
}

/**
 * Runs `strategy` to completion and returns the agent's final text.
 *
 * Throws on timeout, on non-zero exit, and when the child produced no final
 * text. Callers that need a validated payload use `runHeadlessStrategy`;
 * this layer exists for callers that consume the raw answer (Claude's
 * `listMemoryFiles` asks for a plain JSON array, not a curated schema).
 */
export async function runHeadlessStrategyRaw(strategy: HeadlessStrategy): Promise<string> {
  const outcome = await spawnChild(strategy);

  if (outcome.timedOut) {
    throw new Error(
      `${strategy.harnessName()} subprocess timed out after ${strategy.timeoutMs}ms${strategy.timeoutDetail()}`
    );
  }
  if (outcome.failed || (outcome.exitCode !== undefined && outcome.exitCode !== 0)) {
    const stderrTail = strategy.failureIncludesStderr()
      ? tailString(outcome.stderr, STDERR_TAIL_CHARS)
      : '';
    const suffix = stderrTail ? `: ${stderrTail}` : '';
    throw new Error(
      `${strategy.harnessName()} subprocess failed (exit code ${String(outcome.exitCode ?? 'unknown')})${suffix}`
    );
  }

  const finalText = strategy.finalText();
  if (finalText === undefined) throw new Error(strategy.noOutputError());
  return finalText;
}

/**
 * Runs `strategy` to completion and returns its validated structured output.
 *
 * Adds to `runHeadlessStrategyRaw`: recovering the JSON payload embedded in
 * the agent's final text and validating it against `schema`.
 */
export async function runHeadlessStrategy<T>(
  strategy: HeadlessStrategy,
  schema: ZodSchema<T>
): Promise<T> {
  const finalText = await runHeadlessStrategyRaw(strategy);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(finalText));
  } catch (parseError) {
    throw new Error(strategy.jsonParseError(parseError, finalText));
  }

  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`${strategy.role} output did not match schema: ${validated.error.message}`);
  }

  strategy.onValidated(finalText);
  return validated.data;
}
