import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectDanglingDerivedFrom } from '../src/commands/doctor.js';

interface Harness {
  root: string;
  nodesDir: string;
  sessionsDir: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-doctor-dangling-'));
  const nodesDir = join(root, '.ai/knowledge-base/nodes');
  const sessionsDir = join(root, '.ai/knowledge-base/_sessions');
  mkdirSync(join(nodesDir, 'practice'), { recursive: true });
  mkdirSync(sessionsDir, { recursive: true });
  return { root, nodesDir, sessionsDir };
}

function writeNode(harness: Harness, id: string, derivedFrom: string[]): void {
  const fm = {
    schema_version: 1,
    id,
    title: id,
    kind: 'practice',
    tags: [],
    derived_from: derivedFrom,
    relates_to: [],
    confidence: 'high',
    summary: 's',
  };
  writeFileSync(join(harness.nodesDir, 'practice', `${id}.md`), matter.stringify('# x\nBody.', fm));
}

describe('collectDanglingDerivedFrom', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns empty when every reference resolves', () => {
    writeFileSync(join(harness.sessionsDir, 'session-a.md'), 'x');
    mkdirSync(join(harness.root, 'docs'), { recursive: true });
    writeFileSync(join(harness.root, 'docs/auth.md'), 'x');
    writeNode(harness, 'practice-a', ['session-a.md', 'docs/auth.md']);
    expect(collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir)).toEqual(
      []
    );
  });

  it('reports bare filenames that do not exist under _sessions/', () => {
    writeNode(harness, 'practice-b', ['session-missing.md']);
    const out = collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir);
    expect(out).toEqual([{ nodeId: 'practice-b', reference: 'session-missing.md' }]);
  });

  it('reports repo-relative paths that do not exist', () => {
    writeNode(harness, 'practice-c', ['docs/missing.md']);
    const out = collectDanglingDerivedFrom(harness.root, harness.nodesDir, harness.sessionsDir);
    expect(out).toEqual([{ nodeId: 'practice-c', reference: 'docs/missing.md' }]);
  });

  it('aggregates dangling references across multiple nodes', () => {
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
});
