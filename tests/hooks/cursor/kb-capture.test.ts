import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../../helpers.js';

const exec = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '../../..');
const hookPath = join(repoRoot, 'dist/hooks/cursor/kb-capture.cjs');
const HOOK_SESS = 'c6b62c6f-7ead-4fd6-9922-e952131177ff';

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

describe('cursor kb-capture hook (spawned)', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await gitInit(sandbox);
    await runCli(sandbox, ['init', '--harnesses', 'cursor']);
  });

  afterEach(() => cleanSandbox(sandbox));

  it('compiled hook bundle exists at dist/hooks/cursor/kb-capture.cjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KB_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    const result = await runHook(
      sandbox,
      { conversation_id: HOOK_SESS, hook_event_name: 'stop' },
      { KB_BUILDER_INTERNAL: '1' }
    );
    expect(result.exitCode).toBe(0);
    expect(readdirSessions(sandbox)).toHaveLength(0);
  });

  it('writes a session log from transcript_path', async () => {
    const transcriptPath = join(sandbox, 'fixture.jsonl');
    writeFileSync(
      transcriptPath,
      [
        '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi there"}]}}',
      ].join('\n') + '\n'
    );
    const result = await runHook(sandbox, {
      conversation_id: HOOK_SESS,
      transcript_path: transcriptPath,
      hook_event_name: 'stop',
      workspace_roots: [sandbox],
    });
    expect(result.exitCode).toBe(0);
    const sessions = readdirSessions(sandbox);
    expect(sessions.length).toBe(1);
    const body = readFileSync(join(sandbox, '.ai/knowledge-base/_sessions', sessions[0]!), 'utf8');
    expect(body).toContain('[USER]:');
    expect(body).toContain('[AGENT]:');
  });

  it('exits 0 on missing transcript without throwing', async () => {
    const result = await runHook(sandbox, {
      conversation_id: HOOK_SESS,
      hook_event_name: 'stop',
      workspace_roots: [sandbox],
    });
    expect(result.exitCode).toBe(0);
    expect(readdirSessions(sandbox)).toHaveLength(0);
  });
});

function readdirSessions(root: string): string[] {
  const dir = join(root, '.ai/knowledge-base/_sessions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => n.endsWith('.md'));
}
