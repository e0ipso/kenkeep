import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const hookPath = join(repoRoot, 'dist/hooks/kb-capture.mjs');

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
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('compiled hook bundle exists at dist/hooks/kb-capture.mjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KB_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    const transcript = join(sandbox, 't.jsonl');
    writeTranscript(transcript);

    const result = await runHook(
      sandbox,
      {
        session_id: 's1',
        transcript_path: transcript,
        hook_event_name: 'Stop',
      },
      { KB_BUILDER_INTERNAL: '1' }
    );

    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox)).toHaveLength(0);
  });

  it('writes a session log + queue entry when secretlint finds no secrets', async () => {
    const transcript = join(sandbox, 't.jsonl');
    writeTranscript(transcript);

    const result = await runHook(sandbox, {
      session_id: 's1',
      transcript_path: transcript,
      hook_event_name: 'Stop',
      cwd: sandbox,
    });
    expect(result.exitCode).toBe(0);
    expect(sessionLogs(sandbox).length).toBeGreaterThan(0);
    const queueFile = join(sandbox, '.ai/knowledge-base/_sessions/.queue.json');
    expect(existsSync(queueFile)).toBe(true);
  });

  it('exits 0 on missing transcript without throwing', async () => {
    const result = await runHook(sandbox, {
      session_id: 's1',
      transcript_path: join(sandbox, 'does-not-exist.jsonl'),
      hook_event_name: 'Stop',
      cwd: sandbox,
    });
    expect(result.exitCode).toBe(0);
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
