import matter from 'gray-matter';
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSessionLog } from '../../src/lib/session-log.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const hookPath = join(repoRoot, 'dist/hooks/kb-stage2-drain.mjs');

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runHook(cwd: string, input: object, env: NodeJS.ProcessEnv = {}): Promise<SpawnResult> {
  return new Promise((resolveFn) => {
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
      },
    );
    proc.stdin?.write(JSON.stringify(input));
    proc.stdin?.end();
  });
}

function seedSession(sandbox: string, sessionId: string): string {
  const sessionsDir = join(sandbox, '.ai/knowledge-base/_sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const filename = `${sessionId}.md`;
  writeFileSync(
    join(sessionsDir, filename),
    renderSessionLog({
      sessionId,
      capturedBy: 'stop',
      capturedAt: '2026-05-11T10:00:00Z',
      transcriptHash: 'sha256:abc',
      gitleaksStatus: 'clean',
      body: '[USER]: use bravo_pii.cache for PII\n[AGENT]: ok',
    }),
  );
  writeFileSync(
    join(sessionsDir, '.queue.json'),
    JSON.stringify(
      {
        schema_version: 1,
        entries: [
          {
            session_id: sessionId,
            session_log: filename,
            captured_by: 'stop',
            captured_at: '2026-05-11T10:00:00Z',
            attempts: 0,
          },
        ],
      },
      null,
      2,
    ),
  );
  return filename;
}

function writeFakeClaude(sandbox: string, resultJson: string): string {
  const binDir = join(sandbox, 'fake-bin');
  mkdirSync(binDir, { recursive: true });
  const fakeClaude = join(binDir, 'claude');
  const stream = [
    JSON.stringify({ type: 'system', subtype: 'init' }),
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: resultJson,
    }),
  ].join('\n');
  // POSIX shell shim: print canned stream-json and exit 0 regardless of args.
  writeFileSync(fakeClaude, `#!/bin/sh\ncat <<'EOF'\n${stream}\nEOF\n`);
  chmodSync(fakeClaude, 0o755);
  return binDir;
}

describe('kb-stage2-drain hook (spawned)', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    const { execFile: ef } = await import('node:child_process');
    await new Promise<void>((res, rej) =>
      ef('git', ['init', '-q'], { cwd: sandbox }, (err) => (err ? rej(err) : res())),
    );
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('compiled hook bundle exists at dist/hooks/kb-stage2-drain.mjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('exits silently with KB_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    seedSession(sandbox, 'guarded');
    const result = await runHook(sandbox, { cwd: sandbox }, { KB_BUILDER_INTERNAL: '1' });
    expect(result.exitCode).toBe(0);
    const queue = JSON.parse(
      readFileSync(join(sandbox, '.ai/knowledge-base/_sessions/.queue.json'), 'utf8'),
    );
    expect(queue.entries).toHaveLength(1);
  });

  it('drains a queued entry using a stubbed claude binary on PATH', async () => {
    if (process.platform === 'win32') return;
    const file = seedSession(sandbox, 'drained');
    const result = JSON.stringify({
      practice: [
        {
          kind: 'practice',
          tags: ['pii'],
          title: 'Use bravo_pii.cache',
          summary: 'Use the project PII cache backend',
          body: 'Encrypts at rest.',
          confidence: 'high',
          supports_existing_node: null,
          contradicts_existing_node: null,
        },
      ],
      map: [],
    });
    const fakeBin = writeFakeClaude(sandbox, result);

    const hookResult = await runHook(
      sandbox,
      { cwd: sandbox },
      { PATH: `${fakeBin}:${process.env['PATH'] ?? ''}` },
    );
    expect(hookResult.exitCode).toBe(0);

    const after = matter(readFileSync(join(sandbox, '.ai/knowledge-base/_sessions', file), 'utf8'));
    expect(after.data['stage_2_status']).toBe('done');
    const proposals = after.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);

    const queueAfter = JSON.parse(
      readFileSync(join(sandbox, '.ai/knowledge-base/_sessions/.queue.json'), 'utf8'),
    );
    expect(queueAfter.entries).toHaveLength(0);

    const logFile = after.data['stage_2_log'] as string;
    expect(existsSync(join(sandbox, '.ai/knowledge-base', logFile))).toBe(true);
  });

  it('exits 0 when the repo has no installed-version marker', async () => {
    const empty = makeSandbox();
    try {
      const result = await runHook(empty, { cwd: empty });
      expect(result.exitCode).toBe(0);
    } finally {
      cleanSandbox(empty);
    }
  });
});
