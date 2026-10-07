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
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { runCurateDedupCommand } from '../../src/commands/curate-dedup.js';
import { readConsumableSession } from '../../src/lib/curate-manifest.js';
import { atomicWriteJson } from '../../src/lib/fs-atomic.js';

// Pass-through by default; one test narrows the survivors write to inject a
// capture between the consumed-set validation and the session stamp.
vi.mock('../../src/lib/fs-atomic.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/fs-atomic.js')>();
  return { ...actual, atomicWriteJson: vi.fn(actual.atomicWriteJson) };
});

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

/**
 * Builds the dedup input document: the fixture's actions plus the consumed
 * manifest naming the sessions they came from (`s1`/`s2` in the fixture).
 * Written into the sandbox so the shared golden fixtures stay untouched.
 */
function writeDedupInput(
  box: Sandbox,
  actions: unknown,
  consumed: Array<{ session_id: string; file: string; transcript_hash?: string }>,
  name = 'dedup-input.json'
): string {
  const path = join(box.root, name);
  writeFileSync(
    path,
    JSON.stringify({
      actions,
      consumed: consumed.map(c => ({ transcript_hash: `sha256:${c.session_id}`, ...c })),
    })
  );
  return path;
}

const fixtureActions = (): unknown => JSON.parse(readFileSync(inputFixture, 'utf8'));

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
    const fileA = seedPendingSession(sandbox.sessionsDir, 's1', '2026-05-12T10:00:00Z');
    const fileB = seedPendingSession(sandbox.sessionsDir, 's2', '2026-05-12T10:01:00Z');
    const input = writeDedupInput(sandbox, fixtureActions(), [
      { session_id: 's1', file: fileA },
      { session_id: 's2', file: fileB },
    ]);
    const code = await runCurateDedupCommand({
      input,
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
      stamped: 2,
      runId: FIXED_RUN_ID,
    });
  });

  it('three repeated runs with same input + run-id + now produce byte-identical results', async () => {
    const results: Array<{ stdout: string; survivors: string; conflict: string }> = [];
    for (let i = 0; i < 3; i += 1) {
      // Fresh sandbox per iteration so the previous run's writes do not bias.
      const box = makeSandbox();
      stdoutChunks = [];
      const fileA = seedPendingSession(box.sessionsDir, 's1', '2026-05-12T10:00:00Z');
      const fileB = seedPendingSession(box.sessionsDir, 's2', '2026-05-12T10:01:00Z');
      const input = writeDedupInput(box, fixtureActions(), [
        { session_id: 's1', file: fileA },
        { session_id: 's2', file: fileB },
      ]);
      const code = await runCurateDedupCommand({
        input,
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

describe('runCurateDedupCommand (consumed-session entries)', () => {
  let sandbox: Sandbox;
  let originalWrite: typeof process.stdout.write;
  let originalErr: typeof process.stderr.write;

  beforeEach(() => {
    sandbox = makeSandbox();
    originalWrite = process.stdout.write.bind(process.stdout);
    originalErr = process.stderr.write.bind(process.stderr);
    // Silence both streams for this group; we only assert filesystem state.
    process.stdout.write = (() => true) as typeof process.stdout.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    process.stderr.write = originalErr;
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('fails before writes when a consumed session is missing or not a bare filename', async () => {
    // Missing from disk entirely.
    const missing = writeDedupInput(
      sandbox,
      [],
      [{ session_id: 'gone', file: 'session-gone.md' }],
      'missing.json'
    );
    expect(
      await runCurateDedupCommand({
        input: missing,
        output: sandbox.outputPath,
        runId: FIXED_RUN_ID,
        sessionsDir: sandbox.sessionsDir,
        conflictsDir: sandbox.conflictsDir,
        now: FIXED_NOW,
      })
    ).not.toBe(0);
    expect(existsSync(sandbox.outputPath)).toBe(false);

    // A consumed file entry that is not a bare filename is rejected by the schema.
    const traversal = writeDedupInput(
      sandbox,
      [],
      [{ session_id: 's1', file: '../outside.md' }],
      'traversal.json'
    );
    expect(
      await runCurateDedupCommand({
        input: traversal,
        output: sandbox.outputPath,
        runId: FIXED_RUN_ID,
        sessionsDir: sandbox.sessionsDir,
        conflictsDir: sandbox.conflictsDir,
        now: FIXED_NOW,
      })
    ).not.toBe(0);
    expect(existsSync(sandbox.outputPath)).toBe(false);
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
            type: 'practice',
            tags: ['a'],
            description: 'has a home folder',
            body: 'body',
            kk_confidence: 'high',
            kk_relates_to: [],
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
            type: 'practice',
            tags: [],
            description: 'modified in place',
            body: 'merged body',
            kk_confidence: 'high',
            kk_relates_to: [],
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
    const fileA = seedPendingSession(sandbox.sessionsDir, 's1', '2026-05-12T10:00:00Z');
    const doc = writeDedupInput(sandbox, JSON.parse(readFileSync(input, 'utf8')), [
      { session_id: 's1', file: fileA },
    ]);

    const code = await runCurateDedupCommand({
      input: doc,
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

  it('returns nonzero and writes nothing when JSON does not match the dedup input contract', async () => {
    const badInput = join(sandbox.root, 'bad.json');
    writeFileSync(
      badInput,
      JSON.stringify({ actions: [{ action: 'not-an-action' }], consumed: [] })
    );
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

type RawAction = Record<string, unknown>;

function proposed(confidence: 'low' | 'medium' | 'high', body: string): RawAction {
  return {
    title: 'Baz',
    type: 'practice',
    tags: [],
    description: `baz ${confidence}`,
    body,
    kk_confidence: confidence,
    kk_relates_to: [],
  };
}

function readConflicts(
  conflictsDir: string
): Array<{ data: Record<string, unknown>; content: string }> {
  if (!existsSync(conflictsDir)) return [];
  return readdirSync(conflictsDir)
    .sort()
    .map(name => {
      const parsed = matter(readFileSync(join(conflictsDir, name), 'utf8'));
      return { data: parsed.data as Record<string, unknown>, content: parsed.content };
    });
}

describe('runCurateDedupCommand (contradictions survive dedup)', () => {
  let sandbox: Sandbox;
  let originalWrite: typeof process.stdout.write;
  let stdoutChunks: string[];

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

  const TARGET = 'practice-baz';
  const modifyAt = (confidence: 'low' | 'high'): RawAction => ({
    action: 'modify',
    candidate_origin: `s-modify:practice:0`,
    target_node_id: TARGET,
    proposed_node: proposed(confidence, 'modified baz body'),
    rationale: 'refines baz',
  });
  const contradictAt = (confidence: 'low' | 'high'): RawAction => ({
    action: 'contradict',
    candidate_origin: `s-contradict:practice:0`,
    target_node_id: TARGET,
    proposed_node: proposed(confidence, 'negated baz body'),
    rationale: 'negates baz',
  });

  it.each([
    ['modify@high then contradict@low', [modifyAt('high'), contradictAt('low')]],
    ['contradict@low then modify@high', [contradictAt('low'), modifyAt('high')]],
    ['modify@low then contradict@high', [modifyAt('low'), contradictAt('high')]],
    ['contradict@high then modify@low', [contradictAt('high'), modifyAt('low')]],
  ])('%s: the contradiction survives and the modify is held for review', async (_name, actions) => {
    const modifyFile = seedPendingSession(sandbox.sessionsDir, 's-modify', '2026-05-12T10:00:00Z');
    const contradictFile = seedPendingSession(
      sandbox.sessionsDir,
      's-contradict',
      '2026-05-12T10:01:00Z'
    );
    const input = writeDedupInput(sandbox, actions, [
      { session_id: 's-modify', file: modifyFile },
      { session_id: 's-contradict', file: contradictFile },
    ]);
    const code = await runCurateDedupCommand({
      input,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
    expect(code).toBe(0);

    // The target is never silently modified: no modify survives to persist.
    const survivors = JSON.parse(readFileSync(sandbox.outputPath, 'utf8')) as RawAction[];
    expect(survivors).toEqual([]);

    // Both the contradiction and the competing modify become pending conflict
    // records for the same target, so the human decides with full context.
    const conflicts = readConflicts(sandbox.conflictsDir);
    expect(conflicts.map(c => c.data['target_node_id'])).toEqual([TARGET, TARGET]);
    const origins = conflicts.map(c => c.data['candidate_origin']).sort();
    expect(origins).toEqual(['s-contradict:practice:0', 's-modify:practice:0']);

    const contradiction = conflicts.find(
      c => c.data['candidate_origin'] === 's-contradict:practice:0'
    )!;
    expect(contradiction.content).toContain('negates baz');
    expect(contradiction.content).toContain('negated baz body');

    const held = conflicts.find(c => c.data['candidate_origin'] === 's-modify:practice:0')!;
    expect(held.content).toContain('Held for human review');
    expect(held.content).toContain('refines baz');
    expect(held.content).toContain('modified baz body');

    const summary = JSON.parse(stdoutChunks.join('').trim()) as Record<string, unknown>;
    expect(summary).toEqual({ kept: 0, conflicts: 2, stamped: 2, runId: FIXED_RUN_ID });
  });

  it('a contradiction without a proposed node becomes a reviewable conflict record', async () => {
    const contradictFile = seedPendingSession(
      sandbox.sessionsDir,
      's-contradict',
      '2026-05-12T10:01:00Z'
    );
    const input = writeDedupInput(
      sandbox,
      [
        {
          action: 'contradict',
          candidate_origin: 's-contradict:practice:1',
          target_node_id: TARGET,
          rationale: 'the session showed baz is no longer true; no replacement rule emerged',
        },
      ],
      [{ session_id: 's-contradict', file: contradictFile }]
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

    // Not dropped, and not handed to persist (which cannot act on it).
    expect(JSON.parse(readFileSync(sandbox.outputPath, 'utf8'))).toEqual([]);
    const conflicts = readConflicts(sandbox.conflictsDir);
    expect(conflicts).toHaveLength(1);
    const only = conflicts[0]!;
    expect(only.data['status']).toBe('pending');
    expect(only.data['schema_version']).toBe(2);
    expect(only.data['target_node_id']).toBe(TARGET);
    expect(only.data['proposal']).toBeNull();
    expect(only.data['rationale']).toContain('no replacement rule emerged');
    expect(only.content).toContain('## Rationale');
    expect(only.content).toContain('no replacement rule emerged');
    expect(only.content).not.toContain('## Proposed node');
  });
});

describe('runCurateDedupCommand (stamp bound to the consumed transcript version)', () => {
  let sandbox: Sandbox;
  let originalWrite: typeof process.stdout.write;
  let errorSpy: MockInstance<typeof console.error>;
  const stderr = (): string => errorSpy.mock.calls.map(call => call.join(' ')).join('\n');

  beforeEach(() => {
    sandbox = makeSandbox();
    originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    // The machine-output logger routes diagnostics through console.error.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.stdout.write = originalWrite;
    errorSpy.mockRestore();
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  function run(input: string) {
    return runCurateDedupCommand({
      input,
      output: sandbox.outputPath,
      runId: FIXED_RUN_ID,
      sessionsDir: sandbox.sessionsDir,
      conflictsDir: sandbox.conflictsDir,
      now: FIXED_NOW,
    });
  }

  it('stamps the consumed version, not a transcript that grew between validation and the stamp', async () => {
    const file = seedPendingSession(sandbox.sessionsDir, 's1', '2026-05-12T10:00:00Z');
    const path = join(sandbox.sessionsDir, file);
    const seeded = matter(readFileSync(path, 'utf8'));
    writeFileSync(path, matter.stringify(seeded.content, { ...seeded.data, transcript_chars: 42 }));

    // The consumed set validates against H1. The survivors write is the first
    // write of the run; a capture that lands H2 right after it is inside the
    // window before the stamp.
    const actual = await vi.importActual<typeof import('../../src/lib/fs-atomic.js')>(
      '../../src/lib/fs-atomic.js'
    );
    let captureLanded = false;
    vi.mocked(atomicWriteJson).mockImplementationOnce((target, value) => {
      actual.atomicWriteJson(target, value);
      captureLanded = true;
      const current = matter(readFileSync(path, 'utf8'));
      writeFileSync(
        path,
        matter.stringify(`${current.content}\nNEW TURN\n`, {
          ...current.data,
          transcript_hash: 'sha256:s1-v2',
          transcript_chars: 99,
          proposal_status: 'pending',
        })
      );
    });

    expect(await run(writeDedupInput(sandbox, [], [{ session_id: 's1', file }]))).toBe(0);
    expect(captureLanded).toBe(true);
    const stamped = matter(readFileSync(path, 'utf8'));
    // H2's content and identity survive the stamp untouched...
    expect(stamped.data['transcript_hash']).toBe('sha256:s1-v2');
    expect(stamped.data['transcript_chars']).toBe(99);
    expect(stamped.content).toContain('NEW TURN');
    // ...and the stamp names the version the run actually curated.
    expect(stamped.data['curator_run_id']).toBe(FIXED_RUN_ID);
    expect(stamped.data['curated_transcript_hash']).toBe('sha256:s1');
    expect(stamped.data['curated_transcript_chars']).toBe(42);

    // Once H2's extraction is done, the delta is still pending curation.
    const done = matter(readFileSync(path, 'utf8'));
    writeFileSync(path, matter.stringify(done.content, { ...done.data, proposal_status: 'done' }));
    const next = readConsumableSession(path);
    expect(next).toMatchObject({ ok: true, session: { transcript_hash: 'sha256:s1-v2' } });
  });

  it('refuses to stamp a session whose transcript changed since it was drafted, before any write', async () => {
    const fileA = seedPendingSession(sandbox.sessionsDir, 's1', '2026-05-12T10:00:00Z');
    const fileB = seedPendingSession(sandbox.sessionsDir, 's2', '2026-05-12T10:01:00Z');
    const pathB = join(sandbox.sessionsDir, fileB);
    const parsedB = matter(readFileSync(pathB, 'utf8'));
    writeFileSync(
      pathB,
      matter.stringify(parsedB.content, { ...parsedB.data, transcript_hash: 'sha256:s2-newer' })
    );
    const input = writeDedupInput(sandbox, fixtureActions(), [
      { session_id: 's1', file: fileA },
      { session_id: 's2', file: fileB },
    ]);
    expect(await run(input)).toBe(1);
    expect(stderr()).toMatch(/s2 .*changed since/);
    expect(existsSync(sandbox.outputPath)).toBe(false);
    expect(existsSync(sandbox.conflictsDir)).toBe(false);
    for (const f of [fileA, fileB]) {
      const data = matter(readFileSync(join(sandbox.sessionsDir, f), 'utf8')).data;
      expect(data['curator_processed_at']).toBeUndefined();
    }
  });
});
