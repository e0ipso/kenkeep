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
const hookPath = join(repoRoot, 'dist/hooks/codex/kb-capture.cjs');
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
        resolveFn({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: code,
        });
      }
    );
    proc.stdin?.write(JSON.stringify(hookInput));
    proc.stdin?.end();
  });
}

function todayUtcDir(codexHome: string): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return join(codexHome, 'sessions', y, m, d);
}

function writeRollout(path: string, sessionId: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [
    JSON.stringify({ type: 'session_meta', payload: { id: sessionId } }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'use bravo_pii.cache for PII' }],
      },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'understood' }],
      },
    }),
  ];
  writeFileSync(path, lines.join('\n'));
}

function sessionLogs(sandbox: string): string[] {
  const sessionsDir = join(sandbox, '.ai/knowledge-base/_sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
}

describe('codex kb-capture hook (spawned)', () => {
  let sandbox: string;
  let codexHome: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    codexHome = makeSandbox('ai-kb-codex-home-');
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'codex']);
  });
  afterEach(() => {
    cleanSandbox(sandbox);
    cleanSandbox(codexHome);
  });

  it('compiled hook bundle exists at dist/hooks/codex/kb-capture.cjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KB_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    const dir = todayUtcDir(codexHome);
    writeRollout(join(dir, `rollout-2026-05-15T10-00-00-${HOOK_SESS}.jsonl`), HOOK_SESS);

    const result = await runHook(
      sandbox,
      { session_id: HOOK_SESS, event: 'Stop', cwd: sandbox },
      { KB_BUILDER_INTERNAL: '1', CODEX_HOME: codexHome }
    );

    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('writes a session log from the dated rollout when secretlint finds nothing', async () => {
    const dir = todayUtcDir(codexHome);
    writeRollout(join(dir, `rollout-2026-05-15T10-00-00-${HOOK_SESS}.jsonl`), HOOK_SESS);

    const result = await runHook(
      sandbox,
      { session_id: HOOK_SESS, event: 'Stop', cwd: sandbox },
      { CODEX_HOME: codexHome }
    );

    expect(result.exitCode).toBe(0);
    const logs = sessionLogs(sandbox);
    expect(logs.length).toBeGreaterThan(0);
    const log = readFileSync(
      join(sandbox, '.ai/knowledge-base/_sessions', logs[0] as string),
      'utf8'
    );
    expect(log).toContain(`session_id: ${HOOK_SESS}`);
    expect(log).toContain('captured_by: stop');
    expect(log).toMatch(/transcript_hash: sha256:[0-9a-f]{64}/);
    expect(log).toContain('secret_scan_status: clean');
  });

  it('exits 0 when no rollout matches the session_id', async () => {
    const result = await runHook(
      sandbox,
      { session_id: HOOK_SESS, event: 'Stop', cwd: sandbox },
      { CODEX_HOME: codexHome }
    );
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('exits 0 on empty stdin without throwing', async () => {
    const result = await new Promise<SpawnResult>(resolveFn => {
      const proc = execFile(
        'node',
        [hookPath],
        { cwd: sandbox, env: { ...process.env, NO_COLOR: '1', CODEX_HOME: codexHome } },
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
      proc.stdin?.end();
    });
    expect(result.exitCode).toBe(0);
  });
});

