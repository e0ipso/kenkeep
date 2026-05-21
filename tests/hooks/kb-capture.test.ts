import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const hookPath = join(repoRoot, 'dist/hooks/claude/kb-capture.cjs');
const HOOK_SESS = '66666666-6666-4666-8666-666666666666';

async function gitInit(dir: string): Promise<void> {
  await exec('git', ['init', '-q'], { cwd: dir });
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runHook(
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

function writeTranscript(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'use bravo_pii.cache for PII' },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
      }),
    ].join('\n')
  );
}

describe('kb-capture hook (spawned)', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('compiled hook bundle exists at dist/hooks/claude/kb-capture.cjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KB_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    const transcript = join(sandbox, 't.jsonl');
    writeTranscript(transcript);

    const result = await runHook(
      sandbox,
      {
        session_id: HOOK_SESS,
        transcript_path: transcript,
        hook_event_name: 'Stop',
      },
      { KB_BUILDER_INTERNAL: '1' }
    );

    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('writes a session log when secretlint finds no secrets', async () => {
    const transcript = join(sandbox, 't.jsonl');
    writeTranscript(transcript);

    const result = await runHook(sandbox, {
      session_id: HOOK_SESS,
      transcript_path: transcript,
      hook_event_name: 'Stop',
      cwd: sandbox,
    });
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox).length).toBeGreaterThan(0);
  });

  it('exits 0 on missing transcript without throwing', async () => {
    const result = await runHook(sandbox, {
      session_id: HOOK_SESS,
      transcript_path: join(sandbox, 'does-not-exist.jsonl'),
      hook_event_name: 'Stop',
      cwd: sandbox,
    });
    expect(result.exitCode).toBe(0);
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
    const logFile = join(sandbox, '.ai/knowledge-base/_logs', `hook-errors-${dateStr}.log`);
    expect(existsSync(logFile)).toBe(true);
    const lines = readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(l => l.length > 0);
    expect(lines).toHaveLength(1);
    const obj = JSON.parse(lines[0]!) as { hook: string; phase: string; error: string };
    expect(obj.hook).toBe('claude:kb-capture');
    expect(obj.phase).toBe('parse');
    expect(typeof obj.error).toBe('string');
  });

  it('exits 0 on empty stdin without throwing', async () => {
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
      proc.stdin?.end();
    });
    expect(result.exitCode).toBe(0);
  });
});

function sessionLogs(sandbox: string): string[] {
  const sessionsDir = join(sandbox, '.ai/knowledge-base/_sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
}
