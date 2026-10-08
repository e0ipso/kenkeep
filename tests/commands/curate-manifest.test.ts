import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repoPaths } from '../../src/lib/paths.js';
import {
  buildSessionLogFilename,
  renderSessionLog,
  writeSessionLog,
} from '../../src/lib/session-log.js';
import { runCli } from '../helpers.js';

/**
 * End-to-end contract for the consumed-session set: each batch draft lists
 * the session versions it read, `drafts collect` emits the consumed set from
 * valid drafts only, and `curate-dedup` stamps exactly that set. Every
 * scenario drives the built CLI and reads the whole stdout.
 */

const RUN = 'run-manifest';
const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';
const SESSION_C = '33333333-3333-4333-8333-333333333333';

interface CollectOutput {
  runId: string;
  batches: Array<{ batch: number; status: string; reason?: string }>;
  consumed: Array<{ session_id: string; file: string; transcript_hash: string }>;
  actions: Array<{ candidate_origin: string }>;
}

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-curate-manifest-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/_logs/curator'), { recursive: true });
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-05-23T10:00:00Z',
      harnesses: ['claude'],
    })
  );
  return root;
}

const candidate = {
  type: 'practice',
  tags: ['t'],
  title: 'Pin node',
  description: 'always pin node',
  body: 'pin node 22',
  kk_confidence: 'high',
};

function seedDoneSession(
  root: string,
  sessionId: string,
  capturedAt: string,
  withCandidate = false
): string {
  const sessionsDir = repoPaths(root).sessionsDir;
  const filename = buildSessionLogFilename(capturedAt, sessionId);
  return writeSessionLog(
    sessionsDir,
    filename,
    renderSessionLog({
      sessionId,
      capturedBy: 'stop',
      capturedAt,
      transcriptHash: `sha256:${sessionId}`,
      body: 'user: we always pin node 22',
      proposalStatus: 'done',
      proposals: { practice: withCandidate ? [candidate] : [], map: [] },
    })
  );
}

function addAction(origin: string, title = `T ${origin}`) {
  return {
    action: 'add',
    candidate_origin: origin,
    target_node_id: null,
    proposed_node: {
      title,
      type: 'practice',
      tags: ['t'],
      description: 's',
      body: 'b',
      kk_confidence: 'high',
      kk_relates_to: [],
      kk_depends_on: [],
    },
    rationale: 'r',
  };
}

function stampOf(path: string): { processedAt: unknown; runId: unknown } {
  const data = matter(readFileSync(path, 'utf8')).data as Record<string, unknown>;
  return { processedAt: data['curator_processed_at'], runId: data['curator_run_id'] };
}

function draftPath(root: string, batch: number): string {
  return join(repoPaths(root).logsDir, 'curator', `${RUN}__${batch}.draft.json`);
}

/** Writes batch `batch`'s draft the way a drafter does: each log as read, plus its actions. */
function writeDraft(root: string, batch: number, files: string[], actions: unknown[]): void {
  const sessions = files.map(file => {
    const data = matter(readFileSync(file, 'utf8')).data as Record<string, unknown>;
    return {
      session_id: data['session_id'],
      file: basename(file),
      transcript_hash: data['transcript_hash'],
    };
  });
  writeFileSync(draftPath(root, batch), JSON.stringify({ sessions, actions }));
}

async function collect(
  root: string
): Promise<{ code: number; doc: CollectOutput; stderr: string; file: string }> {
  const res = await runCli(root, ['drafts', 'collect', '--run-id', RUN]);
  const file = join(root, 'collected.json');
  writeFileSync(file, res.stdout);
  return {
    code: res.exitCode,
    doc: JSON.parse(res.stdout) as CollectOutput,
    stderr: res.stderr,
    file,
  };
}

async function dedup(
  root: string,
  input: string
): Promise<{ code: number; summary: Record<string, unknown>; stderr: string; survivors: string }> {
  const survivors = join(root, 'survivors.json');
  const res = await runCli(root, [
    'curate-dedup',
    '--input',
    input,
    '--output',
    survivors,
    '--run-id',
    RUN,
  ]);
  const summary =
    res.stdout.trim() === '' ? {} : (JSON.parse(res.stdout) as Record<string, unknown>);
  return { code: res.exitCode, summary, stderr: res.stderr, survivors };
}

describe('consumed-session set: draft -> collect -> dedup', () => {
  let root: string;

  beforeEach(() => {
    root = sandbox();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('(a) an empty action array from a valid draft covering one of two done logs stamps only that one', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    const fileB = seedDoneSession(root, SESSION_B, '2026-05-12T10:01:00Z');
    writeDraft(root, 1, [fileA], []);

    const collected = await collect(root);
    expect(collected.code).toBe(0);
    expect(collected.doc.batches).toEqual([{ batch: 1, status: 'valid' }]);
    expect(collected.doc.consumed).toEqual([
      { session_id: SESSION_A, file: basename(fileA), transcript_hash: `sha256:${SESSION_A}` },
    ]);
    expect(collected.doc.actions).toEqual([]);

    const deduped = await dedup(root, collected.file);
    expect(deduped.code, deduped.stderr).toBe(0);
    expect(deduped.summary).toEqual({ kept: 0, conflicts: 0, stamped: 1, runId: RUN });
    expect(stampOf(fileA).runId).toBe(RUN);
    expect(stampOf(fileB).processedAt).toBeUndefined();
  });

  it('(b) sessions in an invalid draft stay unprocessed while the valid draft is stamped', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z', true);
    const fileB = seedDoneSession(root, SESSION_B, '2026-05-12T10:01:00Z', true);
    writeDraft(root, 1, [fileA], [addAction(`${SESSION_A}:practice:0`)]);
    writeFileSync(draftPath(root, 2), 'not json at all');

    const collected = await collect(root);
    expect(collected.code).toBe(0);
    expect(collected.doc.batches.map(b => [b.batch, b.status])).toEqual([
      [1, 'valid'],
      [2, 'invalid'],
    ]);
    expect(collected.doc.batches[1]!.reason).toMatch(/JSON/);
    expect(collected.doc.consumed.map(s => s.session_id)).toEqual([SESSION_A]);
    expect(collected.doc.actions.map(a => a.candidate_origin)).toEqual([`${SESSION_A}:practice:0`]);
    expect(collected.stderr).toContain('batch 2');

    const deduped = await dedup(root, collected.file);
    expect(deduped.code, deduped.stderr).toBe(0);
    expect(deduped.summary).toEqual({ kept: 1, conflicts: 0, stamped: 1, runId: RUN });
    expect(stampOf(fileA).runId).toBe(RUN);
    expect(stampOf(fileB).processedAt).toBeUndefined();
  });

  it('(c) sessions of a batch that wrote no draft stay unprocessed', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    const fileB = seedDoneSession(root, SESSION_B, '2026-05-12T10:01:00Z');
    // Batch 2 (fileB) was dispatched but its drafter never wrote a draft.
    writeDraft(root, 1, [fileA], []);

    const collected = await collect(root);
    expect(collected.code).toBe(0);
    expect(collected.doc.batches).toEqual([{ batch: 1, status: 'valid' }]);
    expect(collected.doc.consumed.map(s => s.session_id)).toEqual([SESSION_A]);

    const deduped = await dedup(root, collected.file);
    expect(deduped.code, deduped.stderr).toBe(0);
    expect(deduped.summary['stamped']).toBe(1);
    expect(stampOf(fileA).runId).toBe(RUN);
    expect(stampOf(fileB).processedAt).toBeUndefined();
  });

  it('(d) a done log that arrives after the batches were drafted stays pending', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    writeDraft(root, 1, [fileA], []);
    // Arrives between drafting and dedup: no draft lists it.
    const fileC = seedDoneSession(root, SESSION_C, '2026-05-12T10:02:00Z', true);

    const collected = await collect(root);
    expect(collected.doc.consumed.map(s => s.session_id)).toEqual([SESSION_A]);
    const deduped = await dedup(root, collected.file);
    expect(deduped.code, deduped.stderr).toBe(0);
    expect(deduped.summary['stamped']).toBe(1);
    expect(stampOf(fileA).runId).toBe(RUN);
    expect(stampOf(fileC).processedAt).toBeUndefined();
  });

  it('(e) a valid zero-candidate session is stamped even though it yields no action', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z', true);
    const fileB = seedDoneSession(root, SESSION_B, '2026-05-12T10:01:00Z', false);
    // The drafting agent dropped A's only candidate; B had nothing to draft.
    writeDraft(
      root,
      1,
      [fileA, fileB],
      [{ action: 'drop', candidate_origin: `${SESSION_A}:practice:0`, rationale: 'noise' }]
    );

    const collected = await collect(root);
    expect(collected.code).toBe(0);
    expect(collected.doc.consumed.map(s => s.session_id)).toEqual([SESSION_A, SESSION_B]);
    const deduped = await dedup(root, collected.file);
    expect(deduped.code, deduped.stderr).toBe(0);
    expect(deduped.summary).toEqual({ kept: 1, conflicts: 0, stamped: 2, runId: RUN });
    expect(stampOf(fileB).runId).toBe(RUN);
    expect(stampOf(fileA).runId).toBe(RUN);
  });

  it('collect exits non-zero with an empty consumed set when no draft survived', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    writeFileSync(draftPath(root, 1), '{"not":"a draft"}');

    const collected = await collect(root);
    expect(collected.code).toBe(1);
    expect(collected.doc.batches.map(b => b.status)).toEqual(['invalid']);
    expect(collected.doc.consumed).toEqual([]);
    expect(collected.doc.actions).toEqual([]);
    expect(stampOf(fileA).processedAt).toBeUndefined();
  });

  it('collect marks a draft invalid when an action origin is not one of its sessions', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    writeDraft(root, 1, [fileA], [addAction(`${SESSION_B}:practice:0`)]);

    const collected = await collect(root);
    expect(collected.code).toBe(1);
    expect(collected.doc.batches[0]!.status).toBe('invalid');
    expect(collected.doc.batches[0]!.reason).toContain(SESSION_B);
    expect(collected.doc.consumed).toEqual([]);
  });

  it('dedup rejects an input whose origins do not resolve within the consumed set, before any write', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    const fileB = seedDoneSession(root, SESSION_B, '2026-05-12T10:01:00Z');
    writeDraft(root, 1, [fileA], []);
    const collected = await collect(root);

    // Hand-edit the document: an action from B sneaks in without B being consumed.
    const tampered = { ...collected.doc, actions: [addAction(`${SESSION_B}:practice:0`)] };
    const input = join(root, 'tampered.json');
    writeFileSync(input, JSON.stringify(tampered));

    const deduped = await dedup(root, input);
    expect(deduped.code).toBe(1);
    expect(deduped.stderr).toContain(SESSION_B);
    expect(existsSync(deduped.survivors)).toBe(false);
    expect(stampOf(fileA).processedAt).toBeUndefined();
    expect(stampOf(fileB).processedAt).toBeUndefined();
  });

  it('dedup rejects a consumed session that is no longer pending, before any write', async () => {
    const fileA = seedDoneSession(root, SESSION_A, '2026-05-12T10:00:00Z');
    writeDraft(root, 1, [fileA], []);
    const collected = await collect(root);

    // Another run stamped A in the meantime.
    const first = await dedup(root, collected.file);
    expect(first.code, first.stderr).toBe(0);
    rmSync(first.survivors);
    const res = await runCli(root, [
      'curate-dedup',
      '--input',
      collected.file,
      '--output',
      join(root, 'again.json'),
      '--run-id',
      'run-second',
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain(SESSION_A);
    expect(existsSync(join(root, 'again.json'))).toBe(false);
    expect(stampOf(fileA).runId).toBe(RUN);
  });
});
