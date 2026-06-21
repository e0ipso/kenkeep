import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { normalizeOpenCodeSessionId } from '../../src/harnesses/opencode/session-id.js';
import { UsageRecordSchema } from '../../src/lib/schemas.js';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function gitInit(dir: string): Promise<void> {
  await exec('git', ['init', '-q'], { cwd: dir });
}

function runHook(
  hookPath: string,
  cwd: string,
  hookInput: Record<string, unknown> | null,
  env: NodeJS.ProcessEnv = {}
): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1', ...env } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: code,
        });
      }
    );
    if (hookInput !== null) proc.stdin?.write(JSON.stringify(hookInput));
    proc.stdin?.end();
  });
}

function runHookRaw(
  hookPath: string,
  cwd: string,
  raw: string,
  env: NodeJS.ProcessEnv = {}
): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1', ...env } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: code,
        });
      }
    );
    proc.stdin?.write(raw);
    proc.stdin?.end();
  });
}

function sessionLogs(sandbox: string): string[] {
  const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
}

function readSessionLog(sandbox: string, name: string): string {
  return readFileSync(join(sandbox, '.ai/kenkeep/_sessions', name), 'utf8');
}

/**
 * Per-harness capture descriptor. Each harness reads its transcript from a
 * different source (Claude/Cursor pass a transcript path on the hook input;
 * Codex reads a dated rollout under CODEX_HOME; Copilot reads an events.jsonl
 * under COPILOT_HOME) and uses a different session-id key plus event name. The
 * `seed` callback materializes a substantial (non-cursory) transcript and the
 * `input`/`env` builders adapt the spawn call to the harness contract.
 */
interface HarnessCase {
  id: string;
  sessionId: string;
  hookPath: string;
  capturedBy: string;
  needsInit: boolean;
  seed: (ctx: { sandbox: string; home?: string }) => void;
  /**
   * Materializes a substantial transcript whose ONLY node access is a
   * shell/search command reading `nodeAbs` (no dedicated read tool), so the
   * spawned hook proves command-derived reads reach `usage.jsonl`.
   */
  seedUsageRead: (ctx: { sandbox: string; home?: string; nodeAbs: string }) => void;
  input: (ctx: { sandbox: string }) => Record<string, unknown>;
  env: (ctx: { home?: string }) => NodeJS.ProcessEnv;
  homePrefix?: string;
}

const SUBSTANTIAL_USER = 'use bravo_pii.cache for PII. '.repeat(8);
const SUBSTANTIAL_AGENT = 'understood, here is the detailed reasoning. '.repeat(16);

function writeClaudeTranscript(path: string, userText: string, agentText: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({ type: 'user', message: { role: 'user', content: userText } }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: agentText }] },
      }),
    ].join('\n')
  );
}

function todayUtcDir(codexHome: string): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return join(codexHome, 'sessions', y, m, d);
}

function writeCodexRollout(
  codexHome: string,
  sessionId: string,
  userText: string,
  agentText: string
): void {
  const dir = todayUtcDir(codexHome);
  const path = join(dir, `rollout-2026-05-15T10-00-00-${sessionId}.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({ type: 'session_meta', payload: { id: sessionId } }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: userText }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: agentText }],
        },
      }),
    ].join('\n')
  );
}

function writeCopilotEvents(
  copilotHome: string,
  sessionId: string,
  userText: string,
  agentText: string
): void {
  const dir = join(copilotHome, 'session-state', sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'events.jsonl'),
    [
      JSON.stringify({
        type: 'session.start',
        data: {},
        id: 's1',
        timestamp: '2026-06-05T00:00:00Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'user.message',
        data: { content: userText },
        id: 'u1',
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'assistant.message',
        data: { content: agentText },
        id: 'a1',
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'u1',
      }),
    ].join('\n')
  );
}

/**
 * Anthropic-style transcript (Claude and Cursor share the shape) whose
 * assistant turn carries substantial text plus a shell tool that reads
 * `nodeAbs` via a command — no dedicated read tool. `shellTool` is the
 * harness's shell tool name (`Bash` for Claude, `Shell` for Cursor).
 */
function writeAnthropicUsageTranscript(
  path: string,
  agentText: string,
  nodeAbs: string,
  shellTool: string
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({ type: 'user', message: { role: 'user', content: SUBSTANTIAL_USER } }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: agentText },
            { type: 'tool_use', name: shellTool, input: { command: `sed -n '1,5p' ${nodeAbs}` } },
          ],
        },
      }),
    ].join('\n')
  );
}

function writeCodexUsageRollout(codexHome: string, sessionId: string, nodeAbs: string): void {
  const dir = todayUtcDir(codexHome);
  const path = join(dir, `rollout-2026-05-15T10-00-00-${sessionId}.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({ type: 'session_meta', payload: { id: sessionId } }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: SUBSTANTIAL_USER }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: SUBSTANTIAL_AGENT }],
        },
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: JSON.stringify({ command: ['bash', '-lc', `cat ${nodeAbs}`] }),
        },
      }),
    ].join('\n')
  );
}

function writeCopilotUsageEvents(copilotHome: string, sessionId: string, nodeAbs: string): void {
  const dir = join(copilotHome, 'session-state', sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'events.jsonl'),
    [
      JSON.stringify({
        type: 'user.message',
        data: { content: SUBSTANTIAL_USER },
        id: 'u1',
        timestamp: '2026-06-05T00:00:01Z',
        parentId: null,
      }),
      JSON.stringify({
        type: 'assistant.message',
        data: { content: SUBSTANTIAL_AGENT },
        id: 'a1',
        timestamp: '2026-06-05T00:00:02Z',
        parentId: 'u1',
      }),
      JSON.stringify({
        type: 'tool.execution_start',
        data: { toolName: 'bash', arguments: { command: `cat ${nodeAbs}` } },
        id: 't1',
        timestamp: '2026-06-05T00:00:03Z',
        parentId: 'a1',
      }),
    ].join('\n')
  );
}

function writeOpenCodeUsageStub(home: string, nodeAbs: string): void {
  const binDir = join(home, 'bin');
  mkdirSync(binDir, { recursive: true });
  const doc = {
    info: { id: OPENCODE_RAW_SESS },
    messages: [
      {
        info: { role: 'user', time: { created: 1 } },
        parts: [{ type: 'text', text: SUBSTANTIAL_USER }],
      },
      {
        info: { role: 'assistant', time: { created: 2 } },
        parts: [
          { type: 'text', text: SUBSTANTIAL_AGENT },
          { type: 'tool', tool: 'bash', state: { input: { command: `cat ${nodeAbs}` } } },
        ],
      },
    ],
  };
  writeFileSync(join(home, 'oc-export.json'), JSON.stringify(doc));
  const script = [
    '#!/bin/sh',
    'DIR=$(dirname "$0")',
    'if [ "$1" = "--version" ]; then echo 1.17.3; exit 0; fi',
    'if [ "$1" = "export" ]; then cat "$DIR/../oc-export.json"; exit 0; fi',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(binDir, 'opencode'), script, { mode: 0o755 });
}

const CLAUDE_SESS = '66666666-6666-4666-8666-666666666666';
const CODEX_SESS = '12345678-1234-4abc-8def-1234567890ab';
const CODEX_UUIDV7_SESS = '019ee8e9-5040-77e3-aee3-0ec12bdf93dd';
const COPILOT_SESS = '12345678-1234-4abc-8def-1234567890ab';
const CURSOR_SESS = 'c6b62c6f-7ead-4fd6-9922-e952131177ff';
const OPENCODE_RAW_SESS = 'ses_6f8a2b4c9d1e3f5a7b9c1d2e3f4a5b6c';
const OPENCODE_SESS = normalizeOpenCodeSessionId(OPENCODE_RAW_SESS);

/**
 * Materialize a fake `opencode` binary plus the `opencode export` JSON
 * document it serves. The capture hook probes `opencode --version` and then
 * shells out to `opencode export <ses_id>`; pointing PATH at `<home>/bin`
 * makes the real spawn path run end-to-end without the actual CLI.
 */
function writeOpenCodeStub(home: string, userText: string, agentText: string): void {
  const binDir = join(home, 'bin');
  mkdirSync(binDir, { recursive: true });
  const doc = {
    info: { id: OPENCODE_RAW_SESS },
    messages: [
      {
        info: { role: 'user', time: { created: 1 } },
        parts: [{ type: 'text', text: userText }],
      },
      {
        info: { role: 'assistant', time: { created: 2 } },
        parts: [{ type: 'text', text: agentText }],
      },
    ],
  };
  writeFileSync(join(home, 'oc-export.json'), JSON.stringify(doc));
  const script = [
    '#!/bin/sh',
    'DIR=$(dirname "$0")',
    'if [ "$1" = "--version" ]; then echo 1.17.3; exit 0; fi',
    'if [ "$1" = "export" ]; then cat "$DIR/../oc-export.json"; exit 0; fi',
    'exit 1',
    '',
  ].join('\n');
  const scriptPath = join(binDir, 'opencode');
  writeFileSync(scriptPath, script, { mode: 0o755 });
}

const harnessCases: HarnessCase[] = [
  {
    id: 'claude',
    sessionId: CLAUDE_SESS,
    hookPath: join(repoRoot, 'dist/hooks/claude/kk-capture.cjs'),
    capturedBy: 'stop',
    needsInit: true,
    seed: ({ sandbox }) =>
      writeClaudeTranscript(join(sandbox, 't.jsonl'), SUBSTANTIAL_USER, SUBSTANTIAL_AGENT),
    seedUsageRead: ({ sandbox, nodeAbs }) =>
      writeAnthropicUsageTranscript(join(sandbox, 't.jsonl'), SUBSTANTIAL_AGENT, nodeAbs, 'Bash'),
    input: ({ sandbox }) => ({
      session_id: CLAUDE_SESS,
      transcript_path: join(sandbox, 't.jsonl'),
      hook_event_name: 'Stop',
      cwd: sandbox,
    }),
    env: () => ({}),
  },
  {
    id: 'codex',
    sessionId: CODEX_SESS,
    hookPath: join(repoRoot, 'dist/hooks/codex/kk-capture.cjs'),
    capturedBy: 'stop',
    needsInit: true,
    homePrefix: 'ai-kk-codex-home-',
    seed: ({ home }) =>
      writeCodexRollout(home as string, CODEX_SESS, SUBSTANTIAL_USER, SUBSTANTIAL_AGENT),
    seedUsageRead: ({ home, nodeAbs }) =>
      writeCodexUsageRollout(home as string, CODEX_SESS, nodeAbs),
    input: ({ sandbox }) => ({ session_id: CODEX_SESS, event: 'Stop', cwd: sandbox }),
    env: ({ home }) => ({ CODEX_HOME: home }),
  },
  {
    id: 'copilot',
    sessionId: COPILOT_SESS,
    hookPath: join(repoRoot, 'dist/hooks/copilot/kk-capture.cjs'),
    capturedBy: 'session_end',
    needsInit: true,
    homePrefix: 'ai-kk-copilot-home-',
    seed: ({ home }) =>
      writeCopilotEvents(home as string, COPILOT_SESS, SUBSTANTIAL_USER, SUBSTANTIAL_AGENT),
    seedUsageRead: ({ home, nodeAbs }) =>
      writeCopilotUsageEvents(home as string, COPILOT_SESS, nodeAbs),
    input: ({ sandbox }) => ({
      sessionId: COPILOT_SESS,
      hook_event_name: 'sessionEnd',
      cwd: sandbox,
    }),
    env: ({ home }) => ({ COPILOT_HOME: home }),
  },
  {
    id: 'cursor',
    sessionId: CURSOR_SESS,
    hookPath: join(repoRoot, 'dist/hooks/cursor/kk-capture.cjs'),
    capturedBy: 'stop',
    needsInit: true,
    seed: ({ sandbox }) =>
      writeClaudeTranscript(join(sandbox, 'fixture.jsonl'), SUBSTANTIAL_USER, SUBSTANTIAL_AGENT),
    seedUsageRead: ({ sandbox, nodeAbs }) =>
      writeAnthropicUsageTranscript(
        join(sandbox, 'fixture.jsonl'),
        SUBSTANTIAL_AGENT,
        nodeAbs,
        'Shell'
      ),
    input: ({ sandbox }) => ({
      conversation_id: CURSOR_SESS,
      transcript_path: join(sandbox, 'fixture.jsonl'),
      hook_event_name: 'stop',
      workspace_roots: [sandbox],
    }),
    env: () => ({}),
  },
  {
    id: 'opencode',
    sessionId: OPENCODE_SESS,
    hookPath: join(repoRoot, 'dist/hooks/opencode/kk-capture.cjs'),
    capturedBy: 'stop',
    needsInit: true,
    homePrefix: 'ai-kk-opencode-stub-',
    seed: ({ home }) => writeOpenCodeStub(home as string, SUBSTANTIAL_USER, SUBSTANTIAL_AGENT),
    seedUsageRead: ({ home, nodeAbs }) => writeOpenCodeUsageStub(home as string, nodeAbs),
    input: ({ sandbox }) => ({
      session_id: OPENCODE_RAW_SESS,
      hook_event_name: 'SessionIdle',
      cwd: sandbox,
    }),
    env: ({ home }) => ({ PATH: `${join(home as string, 'bin')}:${process.env['PATH'] ?? ''}` }),
  },
];

describe.each(harnessCases)('kk-capture hook (spawned) [$id]', hc => {
  let sandbox: string;
  let home: string | undefined;

  beforeEach(async () => {
    sandbox = makeSandbox();
    home = hc.homePrefix ? makeSandbox(hc.homePrefix) : undefined;
    await gitInit(sandbox);
    if (hc.needsInit) await runCli(sandbox, ['init', '--harnesses', hc.id]);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    if (home) cleanSandbox(home);
  });

  it('exits silently with KENKEEP_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    hc.seed({ sandbox, home });
    const result = await runHook(hc.hookPath, sandbox, hc.input({ sandbox }), {
      ...hc.env({ home }),
      KENKEEP_BUILDER_INTERNAL: '1',
    });
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('writes a session log on a substantial capture with the harness trigger', async () => {
    hc.seed({ sandbox, home });
    const result = await runHook(hc.hookPath, sandbox, hc.input({ sandbox }), hc.env({ home }));
    expect(result.exitCode).toBe(0);

    const logs = sessionLogs(sandbox);
    expect(logs.length).toBeGreaterThan(0);
    const log = readSessionLog(sandbox, logs[0] as string);
    expect(log).toContain(`session_id: ${hc.sessionId}`);
    expect(log).toContain(`captured_by: ${hc.capturedBy}`);
    expect(log).toMatch(/transcript_hash: sha256:[0-9a-f]{64}/);
    // Substantial transcripts must remain in the proposal queue.
    expect(log).toContain('proposal_status: pending');
  });

  it('exits 0 and writes nothing when no transcript is available', async () => {
    // Intentionally do not seed: the source transcript/rollout/events are absent.
    const result = await runHook(hc.hookPath, sandbox, hc.input({ sandbox }), hc.env({ home }));
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });
});

// Proves the full capture path records a knowledge-base read that the agent
// performed through a shell/search COMMAND (not a dedicated read tool): the
// compiled hook parses the raw transcript/export, the shared extractor surfaces
// the command path candidate, and the usage layer reconciles it into
// `.state/usage.jsonl` as a schema-valid record.
describe.each(harnessCases)('kk-capture hook (spawned) [usage command read: $id]', hc => {
  let sandbox: string;
  let home: string | undefined;

  beforeEach(async () => {
    sandbox = makeSandbox();
    home = hc.homePrefix ? makeSandbox(hc.homePrefix) : undefined;
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', hc.id]);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    if (home) cleanSandbox(home);
  });

  it('records a command-derived node read into usage.jsonl as a valid UsageRecord', async () => {
    const nodeAbs = join(sandbox, '.ai/kenkeep/nodes/topic/practice-foo.md');
    mkdirSync(dirname(nodeAbs), { recursive: true });
    writeFileSync(nodeAbs, '# practice-foo\n');

    hc.seedUsageRead({ sandbox, home, nodeAbs });
    const result = await runHook(hc.hookPath, sandbox, hc.input({ sandbox }), hc.env({ home }));
    expect(result.exitCode).toBe(0);

    const usageFile = join(sandbox, '.ai/kenkeep/.state/usage.jsonl');
    expect(existsSync(usageFile)).toBe(true);
    const records = readFileSync(usageFile, 'utf8')
      .split('\n')
      .filter(l => l.trim().length > 0)
      .map(l => JSON.parse(l) as unknown);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(UsageRecordSchema.safeParse(record).success).toBe(true);
    }
    expect(records).toContainEqual(
      expect.objectContaining({ document: 'practice-foo', type: 'leaf', session_id: hc.sessionId })
    );
  });
});

describe('kk-capture hook (spawned) [codex PreCompact]', () => {
  let sandbox: string;
  let home: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    home = makeSandbox('ai-kk-codex-home-');
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'codex']);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    cleanSandbox(home);
  });

  it('maps the PreCompact event to the pre_compact trigger', async () => {
    writeCodexRollout(home, CODEX_SESS, SUBSTANTIAL_USER, SUBSTANTIAL_AGENT);
    const result = await runHook(
      join(repoRoot, 'dist/hooks/codex/kk-capture.cjs'),
      sandbox,
      { session_id: CODEX_SESS, event: 'PreCompact', cwd: sandbox },
      { CODEX_HOME: home }
    );
    expect(result.exitCode).toBe(0);
    const logs = sessionLogs(sandbox);
    expect(logs.length).toBeGreaterThan(0);
    expect(readSessionLog(sandbox, logs[0] as string)).toContain('captured_by: pre_compact');
  });
});

describe('kk-capture hook (spawned) [codex specifics]', () => {
  const hookPath = join(repoRoot, 'dist/hooks/codex/kk-capture.cjs');
  let sandbox: string;
  let home: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    home = makeSandbox('ai-kk-codex-home-');
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'codex']);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    cleanSandbox(home);
  });

  it('accepts a UUIDv7-like Codex session_id and preserves idempotent filename lookup', async () => {
    writeCodexRollout(home, CODEX_UUIDV7_SESS, SUBSTANTIAL_USER, SUBSTANTIAL_AGENT);
    const first = await runHook(
      hookPath,
      sandbox,
      { session_id: CODEX_UUIDV7_SESS, event: 'Stop', cwd: sandbox },
      { CODEX_HOME: home }
    );
    expect(first.exitCode).toBe(0);

    const afterFirst = sessionLogs(sandbox);
    expect(afterFirst).toHaveLength(1);
    expect(readSessionLog(sandbox, afterFirst[0] as string)).toContain(
      `session_id: ${CODEX_UUIDV7_SESS}`
    );

    const second = await runHook(
      hookPath,
      sandbox,
      { session_id: CODEX_UUIDV7_SESS.toUpperCase(), event: 'Stop', cwd: sandbox },
      { CODEX_HOME: home }
    );
    expect(second.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toEqual(afterFirst);
  });

  it('exits silently on malformed stdin without writing a parse diagnostic', async () => {
    const result = await runHookRaw(hookPath, sandbox, 'not json', { CODEX_HOME: home });
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);

    const dateStr = new Date().toISOString().slice(0, 10);
    const logFile = join(sandbox, '.ai/kenkeep/_logs', `hook-errors-${dateStr}.log`);
    expect(existsSync(logFile)).toBe(false);
  });
});

// Behaviors specific to the Claude entrypoint: stdin robustness and the
// cursory pre-filter that the per-harness suites left to the lib unit. These
// exercise the shared capture pipeline through the spawned hook so the lib
// duplicate can be removed.
describe('kk-capture hook (spawned) [claude specifics]', () => {
  const hookPath = join(repoRoot, 'dist/hooks/claude/kk-capture.cjs');
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('marks a cursory (short) session as skipped with cursory_session', async () => {
    const transcript = join(sandbox, 't.jsonl');
    writeClaudeTranscript(transcript, 'hello', 'ok');
    const result = await runHook(hookPath, sandbox, {
      session_id: CLAUDE_SESS,
      transcript_path: transcript,
      hook_event_name: 'Stop',
      cwd: sandbox,
    });
    expect(result.exitCode).toBe(0);

    const logs = sessionLogs(sandbox);
    expect(logs).toHaveLength(1);
    const log = readSessionLog(sandbox, logs[0] as string);
    expect(log).toContain('proposal_status: skipped');
    expect(log).toContain('proposal_error: cursory_session');
  });

  it('records a parse-failure diagnostic when stdin is invalid JSON', async () => {
    const result = await new Promise<SpawnResult>(resolveFn => {
      const proc = execFile(
        'node',
        [hookPath],
        { cwd: sandbox, env: { ...process.env, NO_COLOR: '1' } },
        (err, stdout, stderr) => {
          const code =
            err && typeof (err as NodeJS.ErrnoException).code === 'number'
              ? ((err as { code: number }).code as number)
              : 0;
          resolveFn({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: code,
          });
        }
      );
      proc.stdin?.write('not json');
      proc.stdin?.end();
    });
    expect(result.exitCode).toBe(0);

    const dateStr = new Date().toISOString().slice(0, 10);
    const logFile = join(sandbox, '.ai/kenkeep/_logs', `hook-errors-${dateStr}.log`);
    expect(existsSync(logFile)).toBe(true);
    const lines = readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(l => l.length > 0);
    expect(lines).toHaveLength(1);
    const obj = JSON.parse(lines[0]!) as { hook: string; phase: string; error: string };
    expect(obj.hook).toBe('claude:kk-capture');
    expect(obj.phase).toBe('parse');
    expect(typeof obj.error).toBe('string');
  });

  it('exits 0 on empty stdin without throwing', async () => {
    const result = await runHook(hookPath, sandbox, null);
    expect(result.exitCode).toBe(0);
  });
});
