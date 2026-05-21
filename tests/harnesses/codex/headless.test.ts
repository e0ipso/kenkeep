import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { execa } from 'execa';
import { runHeadlessCodex } from '../../../src/harnesses/codex/headless.js';

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

describe('runHeadlessCodex', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kb-codex-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('parses the last agent_message item.completed event and validates against the schema', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'thread.started' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 42 }) },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ]);
    const out = await runHeadlessCodex('prompt body', '', Schema);
    expect(out).toEqual({ ok: true, n: 42 });
  });

  it('uses positional argv for short prompts and stdin when stdin is non-empty', async () => {
    const shortRun = mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 1 }) },
      }),
    ]);
    await runHeadlessCodex('hello', '', Schema);
    expect(shortRun.captured.command).toBe('codex');
    expect(shortRun.captured.args).toContain('exec');
    expect(shortRun.captured.args).toContain('--json');
    expect(shortRun.captured.args).toContain('--sandbox');
    expect(shortRun.captured.args).toContain('read-only');
    expect(shortRun.captured.args).toContain('hello');
    expect(shortRun.captured.args).not.toContain('-');
    expect(shortRun.captured.options?.['input']).toBe('');

    const stdinRun = mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 2 }) },
      }),
    ]);
    await runHeadlessCodex('hello', 'extra stdin payload', Schema);
    expect(stdinRun.captured.args).toContain('-');
    expect(stdinRun.captured.options?.['input']).toBe('extra stdin payload');
  });

  it('honors harnessOpts.model and harnessOpts.reasoningEffort', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 1 }) },
      }),
    ]);
    await runHeadlessCodex('p', '', Schema, {
      harnessOpts: { model: 'gpt-5-codex', reasoningEffort: 'high' },
    });
    const args = captured.args ?? [];
    expect(args).toContain('--model');
    expect(args).toContain('gpt-5-codex');
    expect(args).toContain('-c');
    expect(args).toContain('reasoning.effort=high');
  });

  it('forces KB_BUILDER_INTERNAL=1 in the child env', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 1 }) },
      }),
    ]);
    await runHeadlessCodex('p', '', Schema, { env: { FOO: 'bar' } });
    const env = captured.options?.['env'] as NodeJS.ProcessEnv;
    expect(env['KB_BUILDER_INTERNAL']).toBe('1');
    expect(env['FOO']).toBe('bar');
  });

  it('writes the raw stream to logFile when provided', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'thread.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 3 }) },
      }),
    ]);
    const logFile = join(dir, 'logs', 'codex', 'a.jsonl');
    await runHeadlessCodex('p', '', Schema, { logFile });
    const lines = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).type).toBe('thread.started');
    expect(JSON.parse(lines[1]!).type).toBe('item.completed');
  });

  it('invokes onMessage for every parsed stream-json event', async () => {
    mockExecaOnce([
      JSON.stringify({ type: 'thread.started' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: true, n: 5 }) },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ]);
    const seen: Array<string | undefined> = [];
    await runHeadlessCodex('p', '', Schema, {
      onMessage: msg => seen.push(msg['type'] as string | undefined),
    });
    expect(seen).toEqual(['thread.started', 'turn.started', 'item.completed', 'turn.completed']);
  });

  it('throws when the subprocess returns a non-zero exit code, including a stderr tail', async () => {
    mockExecaOnce([], { exitCode: 1, stderr: 'codex: something went wrong' });
    await expect(runHeadlessCodex('p', '', Schema)).rejects.toThrow(
      /exit code 1.*codex: something went wrong/s
    );
  });

  it('throws when the subprocess times out', async () => {
    mockExecaOnce([], { timedOut: true });
    await expect(runHeadlessCodex('p', '', Schema)).rejects.toThrow(/timed out/);
  });

  it('throws when no agent_message event is present', async () => {
    mockExecaOnce([JSON.stringify({ type: 'thread.started' })]);
    await expect(runHeadlessCodex('p', '', Schema)).rejects.toThrow(/no agent_message/);
  });

  it('throws when the agent_message text is not valid JSON', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '{"oops":' },
      }),
    ]);
    await expect(runHeadlessCodex('p', '', Schema)).rejects.toThrow(
      /curator output was not valid JSON/
    );
  });

  it('throws when the agent_message JSON does not match the schema', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify({ ok: 'yes' }) },
      }),
    ]);
    await expect(runHeadlessCodex('p', '', Schema)).rejects.toThrow(/schema/);
  });
});
