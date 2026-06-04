import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../../helpers.js';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const hookPath = join(repoRoot, 'dist/hooks/copilot/kk-capture.cjs');
const HOOK_SESS = '12345678-1234-4abc-8def-1234567890ab';

async function gitInit(dir: string): Promise<void> {
  await exec('git', ['init', '-q'], { cwd: dir });
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runHook(
  cwd: string,
  hookInput: Record<string, unknown>,
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
        resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      }
    );
    proc.stdin?.write(JSON.stringify(hookInput));
    proc.stdin?.end();
  });
}

function writeEvents(copilotHome: string, sessionId: string): void {
  const dir = join(copilotHome, 'session-state', sessionId);
  mkdirSync(dir, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'sessionStart', data: {}, timestamp: '2026-06-05T00:00:00Z' }),
    JSON.stringify({
      type: 'userMessage',
      data: { role: 'user', content: 'use bravo for the cache' },
      timestamp: '2026-06-05T00:00:01Z',
      parentId: null,
    }),
    JSON.stringify({
      type: 'agentMessage',
      data: { role: 'assistant', content: 'understood' },
      timestamp: '2026-06-05T00:00:02Z',
      parentId: 'a1',
    }),
  ];
  writeFileSync(join(dir, 'events.jsonl'), lines.join('\n'));
}

function sessionLogs(sandbox: string): string[] {
  const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
}

describe('copilot kk-capture hook (spawned)', () => {
  let sandbox: string;
  let copilotHome: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    copilotHome = makeSandbox('ai-kk-copilot-home-');
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'copilot']);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    cleanSandbox(copilotHome);
  });

  it('compiled hook bundle exists at dist/hooks/copilot/kk-capture.cjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KENKEEP_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    writeEvents(copilotHome, HOOK_SESS);
    const result = await runHook(
      sandbox,
      { sessionId: HOOK_SESS, hook_event_name: 'sessionEnd', cwd: sandbox },
      { KENKEEP_BUILDER_INTERNAL: '1', COPILOT_HOME: copilotHome }
    );
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('writes a session log from the events.jsonl transcript on sessionEnd', async () => {
    writeEvents(copilotHome, HOOK_SESS);
    const result = await runHook(
      sandbox,
      { sessionId: HOOK_SESS, hook_event_name: 'sessionEnd', cwd: sandbox },
      { COPILOT_HOME: copilotHome }
    );
    expect(result.exitCode).toBe(0);
    const logs = sessionLogs(sandbox);
    expect(logs.length).toBeGreaterThan(0);
    const log = readFileSync(join(sandbox, '.ai/kenkeep/_sessions', logs[0] as string), 'utf8');
    expect(log).toContain(`session_id: ${HOOK_SESS}`);
    expect(log).toContain('captured_by: session_end');
    expect(log).toMatch(/transcript_hash: sha256:[0-9a-f]{64}/);
    expect(log).toContain('use bravo for the cache');
  });

  it('maps agentStop to the stop capture trigger', async () => {
    writeEvents(copilotHome, HOOK_SESS);
    const result = await runHook(
      sandbox,
      { sessionId: HOOK_SESS, hook_event_name: 'agentStop', cwd: sandbox },
      { COPILOT_HOME: copilotHome }
    );
    expect(result.exitCode).toBe(0);
    const logs = sessionLogs(sandbox);
    expect(logs.length).toBeGreaterThan(0);
    const log = readFileSync(join(sandbox, '.ai/kenkeep/_sessions', logs[0] as string), 'utf8');
    expect(log).toContain('captured_by: stop');
  });

  it('exits 0 and writes nothing when no events.jsonl matches the session', async () => {
    const result = await runHook(
      sandbox,
      { sessionId: HOOK_SESS, hook_event_name: 'sessionEnd', cwd: sandbox },
      { COPILOT_HOME: copilotHome }
    );
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('no-ops when the cwd has no .ai/kenkeep/ project', async () => {
    const bare = makeSandbox('ai-kk-copilot-bare-');
    await gitInit(bare);
    writeEvents(copilotHome, HOOK_SESS);
    const result = await runHook(
      bare,
      { sessionId: HOOK_SESS, hook_event_name: 'sessionEnd', cwd: bare },
      { COPILOT_HOME: copilotHome }
    );
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(bare)).toHaveLength(0);
    cleanSandbox(bare);
  });
});
