import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { execa } from 'execa';
import { runHeadlessClaude } from '../../src/harnesses/claude/headless.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

interface FakeExecaResult {
  exitCode: number;
  failed: boolean;
  timedOut: boolean;
}

interface CapturedCall {
  command?: string;
  args?: readonly string[];
  options?: Record<string, unknown>;
}

function fakeExeca(
  lines: string[],
  opts: { exitCode?: number; timedOut?: boolean } = {}
): { result: FakeExecaResult & { stdout: Readable } } {
  const stdout = Readable.from(lines.map(l => `${l}\n`));
  const result: FakeExecaResult = {
    exitCode: opts.exitCode ?? 0,
    failed: opts.exitCode !== undefined && opts.exitCode !== 0,
    timedOut: opts.timedOut === true,
  };
  // The production code uses both `proc.stdout` and `proc.then(...)`. We model
  // it as a thenable whose resolved value has the exit-code metadata, and
  // which exposes `stdout` as a direct property.
  const thenable = Object.assign(Promise.resolve(result), { stdout });
  return { result: thenable as unknown as FakeExecaResult & { stdout: Readable } };
}

function mockExecaOnce(
  lines: string[],
  opts: { exitCode?: number; timedOut?: boolean } = {}
): { captured: CapturedCall } {
  const captured: CapturedCall = {};
  vi.mocked(execa).mockImplementationOnce(((
    command: string,
    args: readonly string[],
    options: Record<string, unknown>
  ) => {
    captured.command = command;
    captured.args = args;
    captured.options = options;
    return fakeExeca(lines, opts).result;
  }) as unknown as typeof execa);
  return { captured };
}

const Schema = z.object({ ok: z.boolean(), n: z.number() });

describe('runHeadlessClaude', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kb-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('parses the final result message and validates against the schema', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({ type: 'assistant', message: { content: 'thinking' } }),
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 42 }),
      }),
    ]);
    const out = await runHeadlessClaude('prompt body', 'stdin payload', Schema);
    expect(out).toEqual({ ok: true, n: 42 });
  });

  it('throws when the result is wrapped in a fenced code block (fences no longer stripped)', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: '```json\n{"ok": true, "n": 7}\n```',
      }),
    ]);
    await expect(runHeadlessClaude('prompt', '', Schema)).rejects.toThrow(
      /^curator output was not valid JSON:/
    );
  });

  it('writes the raw stream to logFile when provided', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    const logFile = join(dir, 'logs', 'proposal', 'a.jsonl');
    await runHeadlessClaude('prompt', '', Schema, { logFile });
    const lines = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).type).toBe('system');
    expect(JSON.parse(lines[1]!).type).toBe('result');
  });

  it('forces KB_BUILDER_INTERNAL=1 in the child env and passes -p arguments', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    await runHeadlessClaude('hello prompt', 'stdin', Schema, {
      harnessOpts: { allowedTools: ['Read'] },
      env: { FOO: 'bar' },
    });
    const env = captured.options?.['env'] as NodeJS.ProcessEnv;
    expect(env['KB_BUILDER_INTERNAL']).toBe('1');
    expect(env['FOO']).toBe('bar');
    expect(captured.args).toEqual([
      '-p',
      'hello prompt',
      '--allowedTools',
      'Read',
      '--output-format',
      'stream-json',
      '--verbose',
    ]);
    expect(captured.options?.['input']).toBe('stdin');
    expect(captured.command).toBe('claude');
  });

  it('appends --model and --effort only when set', async () => {
    const resultLine = JSON.stringify({
      type: 'result',
      is_error: false,
      result: JSON.stringify({ ok: true, n: 1 }),
    });
    const both = mockExecaOnce([resultLine]);
    await runHeadlessClaude('p', '', Schema, {
      harnessOpts: { model: 'haiku', effort: 'low' },
    });
    expect(both.captured.args).toContain('--model');
    expect(both.captured.args).toContain('haiku');
    expect(both.captured.args).toContain('--effort');
    expect(both.captured.args).toContain('low');

    const onlyModel = mockExecaOnce([resultLine]);
    await runHeadlessClaude('p', '', Schema, { harnessOpts: { model: 'opus' } });
    expect(onlyModel.captured.args).toContain('--model');
    expect(onlyModel.captured.args).toContain('opus');
    expect(onlyModel.captured.args).not.toContain('--effort');

    const neither = mockExecaOnce([resultLine]);
    await runHeadlessClaude('p', '', Schema);
    expect(neither.captured.args).not.toContain('--model');
    expect(neither.captured.args).not.toContain('--effort');
  });

  it('throws when the subprocess returns a non-zero exit code', async () => {
    mockExecaOnce([], { exitCode: 1 });
    await expect(runHeadlessClaude('p', '', Schema)).rejects.toThrow(/exit code/);
  });

  it('throws when the subprocess times out', async () => {
    mockExecaOnce([], { timedOut: true });
    await expect(runHeadlessClaude('p', '', Schema)).rejects.toThrow(/timed out/);
  });

  it('throws when no final result message is present', async () => {
    mockExecaOnce([JSON.stringify({ type: 'assistant', message: { content: 'hi' } })]);
    await expect(runHeadlessClaude('p', '', Schema)).rejects.toThrow(/no final result message/);
  });

  it('throws when the result message is flagged as an error', async () => {
    mockExecaOnce([JSON.stringify({ type: 'result', is_error: true, result: 'oops' })]);
    await expect(runHeadlessClaude('p', '', Schema)).rejects.toThrow();
  });

  it('invokes onMessage for every parsed stream-json line', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({ type: 'assistant', message: { content: 'hi' } }),
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 5 }),
      }),
    ]);
    const seen: Array<string | undefined> = [];
    await runHeadlessClaude('p', '', Schema, {
      onMessage: msg => seen.push(msg.type),
    });
    expect(seen).toEqual(['system', 'assistant', 'result']);
  });

  it('throws a single-line error referencing the log path when the result JSON is malformed', async () => {
    const broken = '{"action":"add","body":"This is broken\n   no closing quote';
    mockExecaOnce([JSON.stringify({ type: 'result', is_error: false, result: broken })]);
    const logFile = join(dir, 'logs', 'curator', 'bad.jsonl');
    let caught: Error | null = null;
    try {
      await runHeadlessClaude('p', '', Schema, { logFile });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    const msg = caught!.message;
    expect(msg).toMatch(/^curator output was not valid JSON:/);
    expect(msg).toContain(logFile);
    expect(msg).toContain('for the full transcript.');
    expect(msg).not.toContain('\n');
  });

  it('falls back to "log" in the parse-failure message when logFile is unset', async () => {
    mockExecaOnce([JSON.stringify({ type: 'result', is_error: false, result: '{"oops":' })]);
    let caught: Error | null = null;
    try {
      await runHeadlessClaude('p', '', Schema);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught?.message).toMatch(/^curator output was not valid JSON:/);
    expect(caught?.message).toContain('See log for the full transcript.');
  });

  it('throws when result JSON does not match the schema', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: 'yes please' }),
      }),
    ]);
    await expect(runHeadlessClaude('p', '', Schema)).rejects.toThrow(/schema/);
  });
});
