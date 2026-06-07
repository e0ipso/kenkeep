import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCurateDedupCommand } from '../../src/commands/curate-dedup.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, '../fixtures/curate/proposals');
const inputFixture = join(fixturesDir, 'input.json');
const survivorsGolden = join(fixturesDir, 'survivors.golden.json');
const conflictGolden = join(fixturesDir, 'conflict-FIXED-RUN-ID-1.golden.md');

const FIXED_RUN_ID = 'FIXED-RUN-ID';
const FIXED_NOW = new Date('2026-05-23T12:00:00.000Z');

interface Sandbox {
  root: string;
  sessionsDir: string;
  conflictsDir: string;
  outputPath: string;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'kk-curate-dedup-'));
  const sessionsDir = join(root, '_sessions');
  const conflictsDir = join(root, 'conflicts');
  mkdirSync(sessionsDir, { recursive: true });
  return {
    root,
    sessionsDir,
    conflictsDir,
    outputPath: join(root, 'survivors.json'),
  };
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function seedPendingSession(sessionsDir: string, sessionId: string, capturedAt: string): string {
  const filename = `session-${sessionId}.md`;
  const fm = {
    schema_version: 1,
    session_id: sessionId,
    captured_by: 'stop',
    captured_at: capturedAt,
    transcript_hash: `sha256:${sessionId}`,
    proposal_status: 'done',
    proposal_completed_at: capturedAt,
    proposal_error: null,
    proposal_log: `_logs/proposal/${sessionId}.jsonl`,
    proposals: { practice: [], map: [] },
  };
  const body = matter.stringify('## Proposal\n', fm);
  writeFileSync(join(sessionsDir, filename), body);
  return filename;
}

describe('runCurateDedupCommand (golden + determinism)', () => {
  let sandbox: Sandbox;
  let stdoutChunks: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    sandbox = makeSandbox();
    stdoutChunks = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('dedup output matches the stored golden fixture', async () => {
    const code = await runCurateDedupCommand({
      input: inputFixture,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).toBe(0);

    const survivors = readFileSync(sandbox.outputPath, 'utf8');
    const golden = readFileSync(survivorsGolden, 'utf8');
    expect(survivors).toBe(golden);

    const conflictFile = join(sandbox.conflictsDir, `${FIXED_RUN_ID}-1.md`);
    const conflictActual = readFileSync(conflictFile, 'utf8');
    const conflictExpected = readFileSync(conflictGolden, 'utf8');
    expect(conflictActual).toBe(conflictExpected);

    // Summary on stdout — one-line JSON.
    const stdout = stdoutChunks.join('');
    const trimmed = stdout.trimEnd();
    expect(trimmed.split('\n')).toHaveLength(1);
    expect(JSON.parse(trimmed)).toEqual({
      kept: 3,
      conflicts: 1,
      stamped: 0,
      runId: FIXED_RUN_ID,
    });
  });

  it('three repeated runs with same input + run-id + now produce byte-identical results', async () => {
    const results: Array<{ stdout: string; survivors: string; conflict: string }> = [];
    for (let i = 0; i < 3; i += 1) {
      // Fresh sandbox per iteration so the previous run's writes do not bias.
      const box = makeSandbox();
      stdoutChunks = [];
      const code = await runCurateDedupCommand({
        input: inputFixture,
        output: box.outputPath,
        runId: FIXED_RUN_ID,
        sessionsDir: box.sessionsDir,
        conflictsDir: box.conflictsDir,
        now: FIXED_NOW,
      });
      expect(code).toBe(0);
      results.push({
        stdout: stdoutChunks.join(''),
        survivors: hashFile(box.outputPath),
        conflict: hashFile(join(box.conflictsDir, `${FIXED_RUN_ID}-1.md`)),
      });
      rmSync(box.root, { recursive: true, force: true });
    }
    // All three runs must agree on every observable.
    expect(results[1]!.stdout).toBe(results[0]!.stdout);
    expect(results[2]!.stdout).toBe(results[0]!.stdout);
    expect(results[1]!.survivors).toBe(results[0]!.survivors);
    expect(results[2]!.survivors).toBe(results[0]!.survivors);
    expect(results[1]!.conflict).toBe(results[0]!.conflict);
    expect(results[2]!.conflict).toBe(results[0]!.conflict);
  });
});

describe('runCurateDedupCommand (session stamps)', () => {
  let sandbox: Sandbox;
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    sandbox = makeSandbox();
    originalWrite = process.stdout.write.bind(process.stdout);
    // Silence stdout for this group; we only assert filesystem state.
    process.stdout.write = (() => true) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('stamps curator_processed_at and curator_run_id onto every pending session file', async () => {
    const fileA = seedPendingSession(sandbox.sessionsDir, 'alpha', '2026-05-12T10:00:00Z');
    const fileB = seedPendingSession(sandbox.sessionsDir, 'beta', '2026-05-12T10:01:00Z');

    const code = await runCurateDedupCommand({
      input: inputFixture,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).toBe(0);

    for (const filename of [fileA, fileB]) {
      const parsed = matter(readFileSync(join(sandbox.sessionsDir, filename), 'utf8'));
      const data = parsed.data as Record<string, unknown>;
      expect(data['curator_processed_at']).toBe(FIXED_NOW.toISOString());
      expect(data['curator_run_id']).toBe(FIXED_RUN_ID);
    }
  });

  it('does not stamp sessions that are not in proposal_status=done', async () => {
    // Pending (proposal_status=pending) session — listPendingSessions will
    // skip it, so the stamp must NOT land.
    const notDoneName = 'session-not-done.md';
    const fm = {
      schema_version: 1,
      session_id: 'not-done',
      captured_by: 'stop',
      captured_at: '2026-05-12T10:00:00Z',
      transcript_hash: 'sha256:not-done',
      proposal_status: 'pending',
      proposal_completed_at: null,
      proposal_error: null,
      proposal_log: null,
      proposals: { practice: [], map: [] },
    };
    writeFileSync(
      join(sandbox.sessionsDir, notDoneName),
      matter.stringify('## Proposal\n', fm)
    );

    const code = await runCurateDedupCommand({
      input: inputFixture,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).toBe(0);

    const parsed = matter(readFileSync(join(sandbox.sessionsDir, notDoneName), 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    expect(data['curator_processed_at']).toBeUndefined();
    expect(data['curator_run_id']).toBeUndefined();
  });
});

describe('runCurateDedupCommand (home_folder passthrough)', () => {
  let sandbox: Sandbox;
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    sandbox = makeSandbox();
    originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('carries home_folder on an add through dedup, leaving modify/drop without it unaffected', async () => {
    // Inline input (does not touch the shared golden fixtures): an add with a
    // home_folder, a modify and a drop without one.
    const input = join(sandbox.root, 'placement-input.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          action: 'add',
          candidate_origin: 's1:practice:0',
          target_node_id: null,
          proposed_node: {
            title: 'Placed',
            kind: 'practice',
            tags: ['a'],
            summary: 'has a home folder',
            body: 'body',
            confidence: 'high',
            relates_to: [],
          },
          home_folder: 'practice/sub',
          rationale: 'add with placement',
        },
        {
          action: 'modify',
          candidate_origin: 's1:map:0',
          target_node_id: 'practice-existing',
          proposed_node: {
            title: 'Existing',
            kind: 'practice',
            tags: [],
            summary: 'modified in place',
            body: 'merged body',
            confidence: 'high',
            relates_to: [],
          },
          rationale: 'modify, no placement',
        },
        {
          action: 'drop',
          candidate_origin: 's1:practice:1',
          target_node_id: null,
          proposed_node: null,
          rationale: 'dropped',
        },
      ])
    );

    const code = await runCurateDedupCommand({
      input,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).toBe(0);

    const survivors = JSON.parse(readFileSync(sandbox.outputPath, 'utf8')) as Array<
      Record<string, unknown>
    >;
    const addAction = survivors.find(a => a['action'] === 'add');
    const modifyAction = survivors.find(a => a['action'] === 'modify');
    const dropAction = survivors.find(a => a['action'] === 'drop');

    // The add keeps its home_folder verbatim across dedup.
    expect(addAction?.['home_folder']).toBe('practice/sub');
    // modify and drop survive unaffected and never gain a home_folder.
    expect(modifyAction).toBeDefined();
    expect(modifyAction?.['home_folder']).toBeUndefined();
    expect(dropAction).toBeDefined();
    expect(dropAction?.['home_folder']).toBeUndefined();
  });
});

describe('runCurateDedupCommand (invalid input)', () => {
  let sandbox: Sandbox;
  let originalErr: typeof process.stderr.write;

  beforeEach(() => {
    sandbox = makeSandbox();
    originalErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalErr;
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('returns nonzero and writes nothing when the input is not JSON', async () => {
    const badInput = join(sandbox.root, 'bad.json');
    writeFileSync(badInput, 'not-json-at-all');
    const code = await runCurateDedupCommand({
      input: badInput,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).not.toBe(0);
    expect(existsSync(sandbox.outputPath)).toBe(false);
    expect(existsSync(sandbox.conflictsDir)).toBe(false);
  });

  it('returns nonzero and writes nothing when JSON does not match CuratorOutputSchema', async () => {
    const badInput = join(sandbox.root, 'bad.json');
    writeFileSync(badInput, JSON.stringify([{ action: 'not-an-action' }]));
    const code = await runCurateDedupCommand({
      input: badInput,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).not.toBe(0);
    expect(existsSync(sandbox.outputPath)).toBe(false);
    // The conflicts directory must not have been created when validation fails.
    if (existsSync(sandbox.conflictsDir)) {
      expect(readdirSync(sandbox.conflictsDir)).toEqual([]);
    }
  });
});
