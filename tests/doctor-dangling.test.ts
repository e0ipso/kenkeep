import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectDanglingDerivedFrom } from '../src/commands/doctor.js';
import { markSessionsProcessed } from '../src/lib/curate.js';
import { buildSessionLogFilename, renderSessionLog } from '../src/lib/session-log.js';
import { cliPath, runCli } from './helpers.js';

const SESSION_ID = 'b2225129-5ef2-4f05-a52f-c5e72c04d34c';
const CAPTURED_AT = '2026-05-11T10:00:00Z';
const PROPOSALS = {
  practice: [
    {
      type: 'practice',
      tags: [],
      title: 'Practice',
      description: 's',
      body: 'b',
      kk_confidence: 'high',
    },
  ],
  map: [
    { type: 'map', tags: [], title: 'Map', description: 's', body: 'b', kk_confidence: 'high' },
  ],
};

function writeSession(harness: Harness): string {
  const file = join(harness.sessionsDir, buildSessionLogFilename(CAPTURED_AT, SESSION_ID));
  writeFileSync(
    file,
    renderSessionLog({
      sessionId: SESSION_ID,
      capturedBy: 'stop',
      capturedAt: CAPTURED_AT,
      transcriptHash: 'sha256:abc',
      body: 'Transcript',
      proposalStatus: 'done',
      proposals: PROPOSALS,
    })
  );
  return file;
}

interface Harness {
  root: string;
  nodesDir: string;
  sessionsDir: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kk-doctor-dangling-'));
  const nodesDir = join(root, '.ai/kenkeep/nodes');
  const sessionsDir = join(root, '.ai/kenkeep/_sessions');
  mkdirSync(nodesDir, { recursive: true });
  mkdirSync(sessionsDir, { recursive: true });
  return { root, nodesDir, sessionsDir };
}

// Leaves live directly under nodes/ (topical tree; placement is not keyed by
// kind).
function writeNode(harness: Harness, id: string, derivedFrom: string[]): void {
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    description: 's',
    tags: [],
    kk_derived_from: derivedFrom,
    kk_relates_to: [],
    kk_confidence: 'high',
  };
  writeFileSync(join(harness.nodesDir, `${id}.md`), matter.stringify('# x\nBody.', fm));
}

describe('collectDanglingDerivedFrom', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns empty when every reference resolves', () => {
    writeFileSync(join(harness.sessionsDir, 'session-a.md'), 'x');
    mkdirSync(join(harness.root, 'docs'), { recursive: true });
    writeFileSync(join(harness.root, 'docs/auth.md'), 'x');
    writeNode(harness, 'practice-a', [
      'session-a.md',
      'docs/auth.md',
      join(harness.root, 'docs/auth.md'),
      'https://example.com/source',
      'file:///external/source.md',
    ]);
    expect(collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir)).toEqual(
      []
    );
  });

  // Covers both dangling reference kinds in one pass: a dangling repo-relative
  // path (`docs/missing.md`) and a dangling bare filename resolved against
  // `_sessions/` (`session-missing.md`), aggregated across multiple nodes,
  // while a resolving reference (`session-a.md`) is correctly skipped.
  it('aggregates dangling repo-relative and bare-filename references across nodes', () => {
    writeFileSync(join(harness.sessionsDir, 'session-a.md'), 'x');
    writeNode(harness, 'practice-a', ['session-a.md', 'docs/missing.md']);
    writeNode(harness, 'practice-b', ['session-missing.md']);
    const out = collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir);
    expect(out).toEqual([
      { nodeId: 'practice-a', reference: 'docs/missing.md' },
      { nodeId: 'practice-b', reference: 'session-missing.md' },
    ]);
  });

  it('returns empty when nodes dir is missing', () => {
    const out = collectDanglingDerivedFrom(
      harness.root,
      join(harness.root, 'no-nodes'),
      harness.sessionsDir
    );
    expect(out).toEqual([]);
  });

  it.each([false, true])(
    'resolves practice/map candidates in a session, processed=%s',
    async processed => {
      const file = writeSession(harness);
      if (processed) {
        await markSessionsProcessed(
          [{ path: file, transcript_hash: 'sha256:abc' }],
          'run',
          new Date(CAPTURED_AT)
        );
      }
      writeNode(harness, 'practice-a', [`${SESSION_ID}:practice:0`, `${SESSION_ID}:map:0`]);
      const nodePath = join(harness.nodesDir, 'practice-a.md');
      const before = [readFileSync(nodePath, 'utf8'), readFileSync(file, 'utf8')];

      expect(
        collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir)
      ).toEqual([]);
      expect([readFileSync(nodePath, 'utf8'), readFileSync(file, 'utf8')]).toEqual(before);
    }
  );

  it('reports missing sessions, missing proposals, invalid indices and malformed identities', () => {
    const file = writeSession(harness);
    const parsed = matter(readFileSync(file, 'utf8'));
    parsed.data['proposals'] = { practice: PROPOSALS.practice, map: [] };
    writeFileSync(file, matter.stringify(parsed.content, parsed.data));
    const refs = [
      '11111111-2222-4333-8444-555555555555:practice:0',
      `${SESSION_ID}:map:0`,
      `${SESSION_ID}:practice:1`,
      `${SESSION_ID}:practice:-1`,
      `${SESSION_ID}:practice:01`,
      `${SESSION_ID}:practice:0.5`,
      `${SESSION_ID}:practice:9007199254740992`,
      `${SESSION_ID}:practice:`,
      `${SESSION_ID}:practice:0:extra`,
      `${SESSION_ID}:unknown:0`,
      ':practice:0',
    ];
    writeNode(harness, 'practice-a', [`${SESSION_ID}:practice:0`, ...refs]);
    expect(collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir)).toEqual(
      refs.map(reference => ({ nodeId: 'practice-a', reference }))
    );
  });

  it('does not resolve an identity from a filename alone or an invalid proposal', () => {
    const file = writeSession(harness);
    writeNode(harness, 'practice-a', [`${SESSION_ID}:practice:0`]);
    const original = readFileSync(file, 'utf8');
    const { data, content } = matter(original);
    for (const contents of [
      '---\nbroken: [\n---\n',
      matter.stringify(content, { ...data, session_id: 'another-session' }),
      matter.stringify(content, { ...data, proposals: { practice: [null], map: [] } }),
      matter.stringify(content, { ...data, proposals: { practice: PROPOSALS.map, map: [] } }),
    ]) {
      writeFileSync(file, contents);
      expect(
        collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir)
      ).toEqual([{ nodeId: 'practice-a', reference: `${SESSION_ID}:practice:0` }]);
    }
  });

  it('resolves a processed stage-live session in the built CLI and warns after its removal', async () => {
    const staged = spawnSync(
      process.execPath,
      [cliPath, 'session-log', 'stage-live', '--session-id', SESSION_ID],
      {
        cwd: harness.root,
        input: JSON.stringify(PROPOSALS),
        encoding: 'utf8',
      }
    );
    expect(staged.status, staged.stderr).toBe(0);
    const { path } = JSON.parse(staged.stdout) as { path: string };
    const parsed = matter(readFileSync(path, 'utf8'));
    await markSessionsProcessed(
      [{ path, transcript_hash: parsed.data['transcript_hash'] as string }],
      'run',
      new Date(CAPTURED_AT)
    );
    const refs = [`${SESSION_ID}:practice:0`, `${SESSION_ID}:map:0`];
    writeNode(harness, 'practice-a', refs);
    const nodePath = join(harness.nodesDir, 'practice-a.md');
    const before = readFileSync(nodePath, 'utf8');
    const result = await runCli(harness.root, ['doctor', '--verbose']);
    expect(result.stdout + result.stderr).toContain(
      'derived_from references resolve: no dangling references'
    );
    expect(readFileSync(nodePath, 'utf8')).toBe(before);

    rmSync(path);
    const missing = await runCli(harness.root, ['doctor', '--verbose']);
    expect(missing.stdout + missing.stderr).toContain(
      'derived_from references resolve: 2 dangling reference(s)'
    );
    for (const ref of refs)
      expect(missing.stdout + missing.stderr).toContain(`  - practice-a: ${ref}`);
    expect(readFileSync(nodePath, 'utf8')).toBe(before);
  });
});
