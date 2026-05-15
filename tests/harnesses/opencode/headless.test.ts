import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { execa } from 'execa';
import { runHeadlessOpenCode } from '../../../src/harnesses/opencode/headless.js';

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
  stdoutLines: string[],
  opts: { exitCode?: number; timedOut?: boolean; stderr?: string } = {}
): { result: FakeExecaResult & { stdout: Readable; stderr: Readable } } {
  const stdout = Readable.from(stdoutLines.map(l => `${l}\n`));
  const stderr = Readable.from([opts.stderr ?? '']);
  const result: FakeExecaResult = {
    exitCode: opts.exitCode ?? 0,
    failed: opts.exitCode !== undefined && opts.exitCode !== 0,
    timedOut: opts.timedOut === true,
  };
  const thenable = Object.assign(Promise.resolve(result), { stdout, stderr });
  return {
    result: thenable as unknown as FakeExecaResult & { stdout: Readable; stderr: Readable },
  };
}

function mockExecaOnce(
  stdoutLines: string[],
  opts: { exitCode?: number; timedOut?: boolean; stderr?: string } = {}
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
    return fakeExeca(stdoutLines, opts).result;
  }) as unknown as typeof execa);
  return { captured };
}

const Schema = z.object({ ok: z.boolean(), n: z.number() });

describe('runHeadlessOpenCode', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accumulates message.part.updated text deltas and validates the final JSON', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'session.created' }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm1', part: { type: 'text', text: '{"ok":' } },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm1', part: { type: 'text', text: 'true,"n":' } },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm1', part: { type: 'text', text: '42}' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    const out = await runHeadlessOpenCode('hello', '', Schema, {
      harnessOpts: { model: 'anthropic/claude-sonnet-4' },
    });
    expect(out).toEqual({ ok: true, n: 42 });
  });

  it('passes --model and --agent when set', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm', part: { type: 'text', text: '{"ok":true,"n":1}' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    await runHeadlessOpenCode('hello', '', Schema, {
      harnessOpts: { model: 'anthropic/claude-sonnet-4', agent: 'build' },
    });
    expect(captured.command).toBe('opencode');
    expect(captured.args).toEqual([
      'run',
      '--format',
      'json',
      '--model',
      'anthropic/claude-sonnet-4',
      '--agent',
      'build',
      'hello',
    ]);
  });

  it('sets KB_BUILDER_INTERNAL=1 on the child env', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm', part: { type: 'text', text: '{"ok":true,"n":1}' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    await runHeadlessOpenCode('hello', '', Schema);
    const env = (captured.options as { env: Record<string, string> }).env;
    expect(env['KB_BUILDER_INTERNAL']).toBe('1');
  });

  it('throws when the child fails (non-zero exit)', async () => {
    mockExecaOnce([JSON.stringify({ type: 'session.idle' })], {
      exitCode: 1,
      stderr: 'boom',
    });
    await expect(runHeadlessOpenCode('hello', '', Schema)).rejects.toThrow(
      /opencode subprocess failed/
    );
  });

  it('throws when no assistant text was produced', async () => {
    mockExecaOnce([JSON.stringify({ type: 'session.idle' })]);
    await expect(runHeadlessOpenCode('hello', '', Schema)).rejects.toThrow(
      /no assistant text/
    );
  });

  it('throws when the accumulated text is not valid JSON', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm', part: { type: 'text', text: 'not json at all' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    await expect(runHeadlessOpenCode('hello', '', Schema)).rejects.toThrow(
      /Could not parse opencode output as JSON/
    );
  });

  it('resets the accumulator when a new assistant message id appears', async () => {
    // First assistant message has stale partial data; runner should drop
    // it when a new messageID's deltas start arriving.
    mockExecaOnce([
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm1', part: { type: 'text', text: 'stale' } },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm2', part: { type: 'text', text: '{"ok":true,"n":7}' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    const out = await runHeadlessOpenCode('hello', '', Schema);
    expect(out).toEqual({ ok: true, n: 7 });
  });
});
