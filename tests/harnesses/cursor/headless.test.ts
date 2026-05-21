import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { execa } from 'execa';
import { runHeadlessCursor } from '../../../src/harnesses/cursor/headless.js';

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

describe('runHeadlessCursor', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kb-cursor-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('parses the terminal result event and validates against the schema', async () => {
    mockExecaOnce([
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 42 }),
        session_id: 'c6b62c6f-7ead-4fd6-9922-e952131177ff',
      }),
    ]);
    const out = await runHeadlessCursor('prompt', '', Schema, {});
    expect(out).toEqual({ ok: true, n: 42 });
  });

  it('sets KB_BUILDER_INTERNAL=1 on the child env', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    await runHeadlessCursor('prompt', '', Schema, {});
    expect(captured.options?.['env']).toMatchObject({ KB_BUILDER_INTERNAL: '1' });
  });

  it('honors agentCli override for tests', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    await runHeadlessCursor('prompt', '', Schema, {
      harnessOpts: { agentCli: '/tmp/fake-agent' },
    });
    expect(captured.command).toBe('/tmp/fake-agent');
    expect(captured.args).toContain('-p');
    expect(captured.args).toContain('--output-format');
  });

  it('throws when no result event is produced', async () => {
    mockExecaOnce([JSON.stringify({ type: 'system', subtype: 'init' })]);
    await expect(runHeadlessCursor('prompt', '', Schema, {})).rejects.toThrow(/no result event/);
  });
});
