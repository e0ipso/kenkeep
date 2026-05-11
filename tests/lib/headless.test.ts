import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runHeadlessClaude, type SpawnContext, type SpawnFn } from '../../src/lib/headless.js';

function makeSpawn(
  lines: string[],
  opts: { exitCode?: number; timedOut?: boolean } = {},
): {
  spawn: SpawnFn;
  captured: { ctx?: SpawnContext };
} {
  const captured: { ctx?: SpawnContext } = {};
  const spawn: SpawnFn = (_command, ctx) => {
    captured.ctx = ctx;
    const stdout = Readable.from(lines.map((l) => `${l}\n`));
    const result = Promise.resolve({
      exitCode: opts.exitCode ?? 0,
      failed: opts.exitCode !== undefined && opts.exitCode !== 0,
      timedOut: opts.timedOut === true,
    });
    return { stdout, result };
  };
  return { spawn, captured };
}

const Schema = z.object({ ok: z.boolean(), n: z.number() });

describe('runHeadlessClaude', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kb-headless-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('parses the final result message and validates against the schema', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({ type: 'assistant', message: { content: 'thinking' } }),
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 42 }),
      }),
    ]);
    const out = await runHeadlessClaude('prompt body', 'stdin payload', Schema, { spawn });
    expect(out).toEqual({ ok: true, n: 42 });
  });

  it('extracts JSON when the result is wrapped in a fenced code block', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: '```json\n{"ok": true, "n": 7}\n```',
      }),
    ]);
    const out = await runHeadlessClaude('prompt', '', Schema, { spawn });
    expect(out).toEqual({ ok: true, n: 7 });
  });

  it('writes the raw stream to logFile when provided', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    const logFile = join(dir, 'logs', 'stage-2', 'a.jsonl');
    await runHeadlessClaude('prompt', '', Schema, { spawn, logFile });
    const lines = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).type).toBe('system');
    expect(JSON.parse(lines[1]!).type).toBe('result');
  });

  it('forces KB_BUILDER_INTERNAL=1 in the child env and passes -p arguments', async () => {
    const { spawn, captured } = makeSpawn([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    await runHeadlessClaude('hello prompt', 'stdin', Schema, {
      spawn,
      allowedTools: ['Read'],
      env: { FOO: 'bar' },
    });
    expect(captured.ctx?.env['KB_BUILDER_INTERNAL']).toBe('1');
    expect(captured.ctx?.env['FOO']).toBe('bar');
    expect(captured.ctx?.args).toEqual([
      '-p',
      'hello prompt',
      '--allowedTools',
      'Read',
      '--output-format',
      'stream-json',
      '--verbose',
    ]);
    expect(captured.ctx?.stdin).toBe('stdin');
  });

  it('throws when the subprocess returns a non-zero exit code', async () => {
    const { spawn } = makeSpawn([], { exitCode: 1 });
    await expect(runHeadlessClaude('p', '', Schema, { spawn })).rejects.toThrow(/exit code/);
  });

  it('throws when the subprocess times out', async () => {
    const { spawn } = makeSpawn([], { timedOut: true });
    await expect(runHeadlessClaude('p', '', Schema, { spawn })).rejects.toThrow(/timed out/);
  });

  it('throws when no final result message is present', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({ type: 'assistant', message: { content: 'hi' } }),
    ]);
    await expect(runHeadlessClaude('p', '', Schema, { spawn })).rejects.toThrow(
      /no final result message/,
    );
  });

  it('throws when the result message is flagged as an error', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({ type: 'result', is_error: true, result: 'oops' }),
    ]);
    await expect(runHeadlessClaude('p', '', Schema, { spawn })).rejects.toThrow();
  });

  it('throws when result JSON does not match the schema', async () => {
    const { spawn } = makeSpawn([
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: JSON.stringify({ ok: 'yes please' }),
      }),
    ]);
    await expect(runHeadlessClaude('p', '', Schema, { spawn })).rejects.toThrow(/schema/);
  });
});
