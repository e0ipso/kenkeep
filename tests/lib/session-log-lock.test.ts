import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureSession, type TranscriptParser } from '../../src/lib/capture.js';
import { withSessionLogLock } from '../../src/lib/session-log.js';
import { writeSessionLogFrontmatter } from '../../src/lib/proposal-drain.js';
import type { RoleTaggedTranscript } from '../../src/harnesses/types.js';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const FILLER = 'context that should stay in the capture. '.repeat(12);
const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;
const turnsV1: RoleTaggedTranscript['interleaved'] = [
  { role: 'user', text: `${FILLER} first question` },
  { role: 'agent', text: `first answer. ${FILLER}${FILLER}` },
];
const turnsV2: RoleTaggedTranscript['interleaved'] = [
  ...turnsV1,
  { role: 'user', text: `NEWER-DURABLE-FACT ${FILLER}` },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('session log lock between capture and proposal write-back', () => {
  let dir: string;
  let sessionsDir: string;
  let transcriptFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-session-log-lock-'));
    sessionsDir = join(dir, '_sessions');
    transcriptFile = join(dir, 't.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function capture(turns: RoleTaggedTranscript['interleaved']) {
    writeFileSync(transcriptFile, JSON.stringify({ interleaved: turns }));
    return captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir, parseTranscript: parser }
    );
  }

  const hashOf = (path: string) =>
    matter(readFileSync(path, 'utf8')).data['transcript_hash'] as string;

  it('a capture waits for a write-back holding the log, then lands its newer version', async () => {
    const path = (await capture(turnsV1)).sessionLogPath as string;
    const h1 = hashOf(path);

    // A write-back that already checked h1 holds the log until its rename.
    const release = await lockfile.lock(path, { realpath: false });
    const pending = capture(turnsV2);
    await sleep(150);
    expect(hashOf(path)).toBe(h1);

    await release();
    const result = await pending;
    expect(result.status).toBe('written');
    expect(hashOf(path)).not.toBe(h1);
    expect(readFileSync(path, 'utf8')).toContain('NEWER-DURABLE-FACT');
  });

  it('a write-back re-reads the log under the lock and refuses a version that moved', async () => {
    const path = (await capture(turnsV1)).sessionLogPath as string;
    const h1 = hashOf(path);
    const before = readFileSync(path, 'utf8');

    // A capture holds the log while the write-back for h1 arrives.
    const release = await lockfile.lock(path, { realpath: false });
    const pending = writeSessionLogFrontmatter(path, h1, {
      proposal_status: 'done',
      proposal_completed_at: '2026-06-20T10:05:00.000Z',
      proposal_error: null,
      proposal_log: null,
      proposals: { practice: [], map: [] },
    });
    await sleep(150);
    expect(readFileSync(path, 'utf8')).toBe(before);

    const parsed = matter(before);
    const newer = { ...(parsed.data as Record<string, unknown>), transcript_hash: 'sha256:newer' };
    writeFileSync(path, matter.stringify(`${parsed.content}\nNEWER-DURABLE-FACT\n`, newer));
    await release();

    expect(await pending).toEqual({ ok: false, currentHash: 'sha256:newer' });
    expect(hashOf(path)).toBe('sha256:newer');
    expect(readFileSync(path, 'utf8')).toContain('NEWER-DURABLE-FACT');
  });
});

describe('session log ownership during a stalled writer', () => {
  it('recovers a killed local writer without waiting for a stale heartbeat', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-dead-log-owner-'));
    const log = join(dir, 'session.md');
    const ready = join(dir, 'ready');
    const modulePath = join(dir, 'session-log.cjs');
    buildSync({
      entryPoints: [fileURLToPath(new URL('../../src/lib/session-log.ts', import.meta.url))],
      outfile: modulePath,
      platform: 'node',
      format: 'cjs',
      bundle: true,
      logLevel: 'silent',
    });
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
      const fs = require('node:fs');
      const { withSessionLogLock } = require(process.argv[1]);
      withSessionLogLock(process.argv[2], () => {
        fs.writeFileSync(process.argv[3], 'ready');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
      }).catch(() => process.exitCode = 1);
    `,
        modulePath,
        log,
        ready,
      ],
      { stdio: 'ignore' }
    );
    const finished = new Promise(resolve => child.once('exit', resolve));
    try {
      const until = Date.now() + 3000;
      while (!existsSync(ready) && Date.now() < until) await sleep(10);
      expect(existsSync(ready)).toBe(true);
      child.kill('SIGKILL');
      await finished;
      const started = Date.now();
      await withSessionLogLock(log, () => writeFileSync(log, 'recovered capture'));
      expect(Date.now() - started).toBeLessThan(800);
      expect(readFileSync(log, 'utf8')).toBe('recovered capture');
      expect(existsSync(`${log}.lock`)).toBe(false);
    } finally {
      child.kill('SIGKILL');
      await finished;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves foreign and malformed owner records without entering the write section', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-unknown-log-owner-'));
    const log = join(dir, 'session.md');
    const lockDir = `${log}.lock`;
    const ownerPath = join(lockDir, 'owner-fixture.json');
    try {
      mkdirSync(lockDir);
      writeFileSync(log, 'existing capture');
      for (const record of [
        JSON.stringify({ schema_version: 1, pid: process.pid, host: `${hostname()}-other` }),
        '{broken',
        'null',
      ]) {
        writeFileSync(ownerPath, record);
        await expect(
          withSessionLogLock(log, () => writeFileSync(log, 'unexpected write'))
        ).rejects.toMatchObject({ code: 'ELOCKED' });
        expect(readFileSync(ownerPath, 'utf8')).toBe(record);
        expect(readFileSync(log, 'utf8')).toBe('existing capture');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not reclaim a lock from a live writer after its heartbeat expires', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-live-log-owner-'));
    const log = join(dir, 'session.md');
    const ready = join(dir, 'ready');
    const release = join(dir, 'release');
    const modulePath = join(dir, 'session-log.cjs');
    writeFileSync(log, 'old version');
    buildSync({
      entryPoints: [fileURLToPath(new URL('../../src/lib/session-log.ts', import.meta.url))],
      outfile: modulePath,
      platform: 'node',
      format: 'cjs',
      bundle: true,
      logLevel: 'silent',
    });
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
      const fs = require('node:fs');
      const { withSessionLogLock } = require(process.argv[1]);
      withSessionLogLock(process.argv[2], () => {
        fs.writeFileSync(process.argv[3], 'ready');
        while (!fs.existsSync(process.argv[4])) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
        }
        fs.writeFileSync(process.argv[2], 'write-back finished');
      }).catch(() => process.exitCode = 1);
    `,
        modulePath,
        log,
        ready,
        release,
      ],
      { stdio: 'ignore' }
    );
    const finished = new Promise<number | null>(resolve => child.once('exit', resolve));
    try {
      const until = Date.now() + 3000;
      while (!existsSync(ready) && Date.now() < until) await sleep(10);
      expect(existsSync(ready)).toBe(true);
      await sleep(5200);
      let acquired = false;
      try {
        await withSessionLogLock(log, () => {
          acquired = true;
          writeFileSync(log, 'newer capture');
        });
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe('ELOCKED');
      }
      expect(acquired).toBe(false);
      writeFileSync(release, 'go');
      expect(await finished).toBe(0);
      await withSessionLogLock(log, () => writeFileSync(log, 'newer capture retry'));
      expect(readFileSync(log, 'utf8')).toBe('newer capture retry');
    } finally {
      child.kill('SIGKILL');
      await finished;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
