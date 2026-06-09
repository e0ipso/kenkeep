import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getHarness } from '../../src/harnesses/registry.js';
import { mockExecaOnce } from '../helpers/execa-mock.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

const Schema = z.object({ ok: z.boolean(), n: z.number() });

/**
 * The execa-backed adapters share a uniform contract: they spawn a child,
 * parse a terminal event into JSON, validate it against the caller's Zod
 * schema, force the recursion-guard env var, and throw when the child
 * produces no terminal result. Each adapter serializes those events
 * differently, so the per-harness `success`/`noResult` builders translate a
 * payload into that adapter's native stdout stream.
 *
 * Copilot is excluded: it has no `--json` stream and the runner buffers
 * stdout from a real child, so it is exercised with a Node shim below.
 */
const execaHeadlessCases: Array<{
  id: string;
  success: (payload: unknown) => string[];
  noResult: string[];
}> = [
  {
    id: 'claude',
    success: payload => [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({ type: 'result', is_error: false, result: JSON.stringify(payload) }),
    ],
    noResult: [JSON.stringify({ type: 'assistant', message: { content: 'hi' } })],
  },
  {
    id: 'codex',
    success: payload => [
      JSON.stringify({ type: 'thread.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify(payload) },
      }),
    ],
    noResult: [JSON.stringify({ type: 'thread.started' })],
  },
  {
    id: 'cursor',
    success: payload => [
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: JSON.stringify(payload),
      }),
    ],
    noResult: [JSON.stringify({ type: 'system', subtype: 'init' })],
  },
  {
    id: 'opencode',
    success: payload => [
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm', part: { type: 'text', text: JSON.stringify(payload) } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ],
    noResult: [JSON.stringify({ type: 'session.idle' })],
  },
];

describe('adapter.runHeadless (parametrized over execa-backed harnesses)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(execaHeadlessCases)(
    '$id parses the terminal result, validates the schema, forces the recursion guard, and throws on no result',
    async ({ id, success, noResult }) => {
      const { captured } = mockExecaOnce(success({ ok: true, n: 42 }));
      const out = await getHarness(id).runHeadless('prompt body', '', Schema);
      expect(out).toEqual({ ok: true, n: 42 });
      const env = captured.options?.['env'] as NodeJS.ProcessEnv;
      expect(env['KENKEEP_BUILDER_INTERNAL']).toBe('1');

      mockExecaOnce(noResult);
      await expect(getHarness(id).runHeadless('prompt body', '', Schema)).rejects.toThrow();
    }
  );
});

describe('claude headless option mapping and error handling', () => {
  const claude = getHarness('claude');
  afterEach(() => vi.clearAllMocks());

  function resultLine(payload: unknown): string {
    return JSON.stringify({ type: 'result', is_error: false, result: JSON.stringify(payload) });
  }

  it('passes -p argv, allowedTools, model/effort, stdin input, and merges extra env', async () => {
    const { captured } = mockExecaOnce([resultLine({ ok: true, n: 1 })]);
    await claude.runHeadless('hello prompt', 'stdin', Schema, {
      harnessOpts: { allowedTools: ['Read'], model: 'haiku', effort: 'low' },
      env: { FOO: 'bar' },
    });
    const env = captured.options?.['env'] as NodeJS.ProcessEnv;
    expect(env['FOO']).toBe('bar');
    expect(captured.command).toBe('claude');
    expect(captured.args).toEqual([
      '-p',
      'hello prompt',
      '--allowedTools',
      'Read',
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      'haiku',
      '--effort',
      'low',
    ]);
    expect(captured.options?.['input']).toBe('stdin');

    const neither = mockExecaOnce([resultLine({ ok: true, n: 1 })]);
    await claude.runHeadless('p', '', Schema);
    expect(neither.captured.args).not.toContain('--model');
    expect(neither.captured.args).not.toContain('--effort');
  });

  it('throws on non-zero exit, timeout, error-flagged result, and role-tagged schema mismatch', async () => {
    mockExecaOnce([], { exitCode: 1 });
    await expect(claude.runHeadless('p', '', Schema)).rejects.toThrow(/exit code/);

    mockExecaOnce([], { timedOut: true });
    await expect(claude.runHeadless('p', '', Schema)).rejects.toThrow(/timed out/);

    mockExecaOnce([JSON.stringify({ type: 'result', is_error: true, result: 'oops' })]);
    await expect(claude.runHeadless('p', '', Schema)).rejects.toThrow();

    mockExecaOnce([resultLine({ ok: 'yes please' })]);
    await expect(claude.runHeadless('p', '', Schema, { role: 'proposal' })).rejects.toThrow(
      /^proposal output did not match schema:/
    );
  });

  it('invokes onMessage for every parsed stream-json line and mirrors raw stream to logFile', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-headless-'));
    try {
      mockExecaOnce([
        JSON.stringify({ type: 'system', subtype: 'init' }),
        JSON.stringify({ type: 'assistant', message: { content: 'hi' } }),
        resultLine({ ok: true, n: 5 }),
      ]);
      const seen: Array<string | undefined> = [];
      const logFile = join(dir, 'logs', 'proposal', 'a.jsonl');
      await claude.runHeadless('p', '', Schema, { onMessage: msg => seen.push(msg.type), logFile });
      expect(seen).toEqual(['system', 'assistant', 'result']);
      const lines = readFileSync(logFile, 'utf8').trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[2]!).type).toBe('result');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('codex headless option mapping and error handling', () => {
  const codex = getHarness('codex');
  afterEach(() => vi.clearAllMocks());

  function agentMessage(payload: unknown): string[] {
    return [
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: JSON.stringify(payload) },
      }),
    ];
  }

  it('maps argv, stdin, model/reasoningEffort, and merges extra env', async () => {
    const shortRun = mockExecaOnce(agentMessage({ ok: true, n: 1 }));
    await codex.runHeadless('hello', '', Schema, {
      harnessOpts: { model: 'gpt-5-codex', reasoningEffort: 'high' },
      env: { FOO: 'bar' },
    });
    const args = shortRun.captured.args ?? [];
    expect(shortRun.captured.command).toBe('codex');
    expect(args).toContain('exec');
    expect(args).toContain('--json');
    expect(args).toContain('--sandbox');
    expect(args).toContain('read-only');
    expect(args).toContain('hello');
    expect(args).not.toContain('-');
    expect(args).toContain('--model');
    expect(args).toContain('gpt-5-codex');
    expect(args).toContain('-c');
    expect(args).toContain('reasoning.effort=high');
    expect((shortRun.captured.options?.['env'] as NodeJS.ProcessEnv)['FOO']).toBe('bar');

    const stdinRun = mockExecaOnce(agentMessage({ ok: true, n: 2 }));
    await codex.runHeadless('hello', 'extra stdin payload', Schema);
    expect(stdinRun.captured.args).toContain('-');
    expect(stdinRun.captured.options?.['input']).toBe('extra stdin payload');
  });

  it('throws on non-zero exit (with stderr tail) and missing agent_message', async () => {
    mockExecaOnce([], { exitCode: 1, stderr: 'codex: something went wrong' });
    await expect(codex.runHeadless('p', '', Schema)).rejects.toThrow(
      /exit code 1.*codex: something went wrong/s
    );

    mockExecaOnce([JSON.stringify({ type: 'thread.started' })]);
    await expect(codex.runHeadless('p', '', Schema)).rejects.toThrow(/no agent_message/);
  });
});

describe('opencode headless option mapping and error handling', () => {
  const opencode = getHarness('opencode');
  afterEach(() => vi.clearAllMocks());

  it('passes --model and --agent in canonical order and accumulates text deltas', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm1', part: { type: 'text', text: 'stale' } },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm2', part: { type: 'text', text: '{"ok":' } },
      }),
      JSON.stringify({
        type: 'message.part.updated',
        properties: { messageID: 'm2', part: { type: 'text', text: 'true,"n":42}' } },
      }),
      JSON.stringify({ type: 'session.idle' }),
    ]);
    const out = await opencode.runHeadless('hello', '', Schema, {
      harnessOpts: { model: 'anthropic/claude-sonnet-4', agent: 'build' },
    });
    expect(out).toEqual({ ok: true, n: 42 });
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

  it('throws on non-zero exit', async () => {
    mockExecaOnce([JSON.stringify({ type: 'session.idle' })], { exitCode: 1, stderr: 'boom' });
    await expect(opencode.runHeadless('hello', '', Schema)).rejects.toThrow(
      /opencode subprocess failed/
    );
  });
});

describe('cursor headless option mapping', () => {
  const cursor = getHarness('cursor');
  afterEach(() => vi.clearAllMocks());

  it('honors agentCli override and passes the documented flags', async () => {
    const { captured } = mockExecaOnce([
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: JSON.stringify({ ok: true, n: 1 }),
      }),
    ]);
    await cursor.runHeadless('prompt', '', Schema, {
      harnessOpts: { agentCli: '/tmp/fake-agent' },
    });
    expect(captured.command).toBe('/tmp/fake-agent');
    expect(captured.args).toContain('-p');
    expect(captured.args).toContain('--output-format');
  });
});
