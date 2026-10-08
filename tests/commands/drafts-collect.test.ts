import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDraftsCollectCommand } from '../../src/commands/drafts-collect.js';
import { runCli } from '../helpers.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-drafts-collect-'));
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

function action(origin: string) {
  return {
    action: 'add',
    candidate_origin: origin,
    target_node_id: null,
    proposed_node: {
      title: `T ${origin}`,
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

function curatorFile(root: string, name: string): string {
  return join(root, '.ai/kenkeep/_logs/curator', name);
}

/** A batch draft: the sessions it read plus the actions drafted from them. */
function envelope(sessions: string[], actions: unknown[]): string {
  return JSON.stringify({
    sessions: sessions.map(id => ({
      session_id: id,
      file: `20260523-1000-${id}.md`,
      transcript_hash: `sha256:${id}`,
    })),
    actions,
  });
}

function writeDraft(root: string, runId: string, n: number, content: string): void {
  writeFileSync(curatorFile(root, `${runId}__${n}.draft.json`), content);
}

interface CollectDoc {
  runId: string;
  batches: Array<{ batch: number; status: string; reason?: string }>;
  consumed: Array<{ session_id: string; file: string; transcript_hash: string }>;
  actions: Array<{ candidate_origin: string }>;
}

/**
 * Runs the built CLI and parses its COMPLETE stdout as one JSON document. The
 * skill redirects the whole stdout into the dedup input file, so a status
 * line anywhere in it (from `log.info`, `console.log` or a nested call)
 * breaks the handoff.
 */
async function collect(root: string): Promise<{ code: number; doc: CollectDoc; stderr: string }> {
  const res = await runCli(root, ['drafts', 'collect', '--run-id', RUN]);
  return { code: res.exitCode, doc: JSON.parse(res.stdout) as CollectDoc, stderr: res.stderr };
}

const RUN = 'run-abc';

describe('kk drafts collect', () => {
  let cwd: string;
  let original: string;

  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('aggregates valid drafts in numeric order with their consumed sessions', async () => {
    writeDraft(cwd, RUN, 1, envelope(['s1'], [action('s1:practice:0')]));
    writeDraft(cwd, RUN, 2, envelope(['s2'], [action('s2:practice:0'), action('s2:practice:1')]));
    // Batch 10 must sort after 9/2, not lexicographically before 2.
    writeDraft(cwd, RUN, 10, envelope(['s10', 's11'], [action('s10:practice:0')]));

    const { code, doc } = await collect(cwd);
    expect(code).toBe(0);
    expect(doc.runId).toBe(RUN);
    expect(doc.batches).toEqual([
      { batch: 1, status: 'valid' },
      { batch: 2, status: 'valid' },
      { batch: 10, status: 'valid' },
    ]);
    expect(doc.actions.map(a => a.candidate_origin)).toEqual([
      's1:practice:0',
      's2:practice:0',
      's2:practice:1',
      's10:practice:0',
    ]);
    // s11 had no candidate but is listed by a valid draft, so it is consumed.
    expect(doc.consumed.map(s => s.session_id)).toEqual(['s1', 's2', 's10', 's11']);
    expect(doc.consumed[0]).toEqual({
      session_id: 's1',
      file: '20260523-1000-s1.md',
      transcript_hash: 'sha256:s1',
    });
  });

  it('consumes only valid drafts and reports each invalid one', async () => {
    writeDraft(cwd, RUN, 1, envelope(['s1'], [action('s1:practice:0')]));
    writeDraft(cwd, RUN, 2, 'not json at all');
    // Invalid: extra key in proposed_node is rejected by the strict schema.
    const bad = action('s3:practice:0') as Record<string, unknown>;
    (bad.proposed_node as Record<string, unknown>).extra = 'nope';
    writeDraft(cwd, RUN, 3, envelope(['s3'], [bad]));
    // Invalid: a bare action array that does not say which sessions it consumed.
    writeDraft(cwd, RUN, 4, JSON.stringify([action('s4:practice:0')]));

    const { code, doc, stderr } = await collect(cwd);
    expect(code).toBe(0);
    expect(doc.batches.map(b => [b.batch, b.status])).toEqual([
      [1, 'valid'],
      [2, 'invalid'],
      [3, 'invalid'],
      [4, 'invalid'],
    ]);
    expect(doc.batches[2]!.reason).toContain('extra');
    expect(doc.consumed.map(s => s.session_id)).toEqual(['s1']);
    expect(doc.actions).toHaveLength(1);

    // The count line and each skipped batch are reported on stderr only.
    expect(stderr).toContain('4 draft(s), 1 valid, 3 invalid');
    expect(stderr).toContain('batch 2 produced invalid output');
    expect(stderr).toContain('batch 4 produced invalid output');

    // Each outcome recorded its audit event.
    expect(readFileSync(curatorFile(cwd, `${RUN}__1.jsonl`), 'utf8')).toContain(
      '"event":"validated"'
    );
    expect(readFileSync(curatorFile(cwd, `${RUN}__2.jsonl`), 'utf8')).toContain(
      '"event":"invalid"'
    );
  });

  it('prints exactly one JSON document for a valid empty batch, status on stderr', async () => {
    writeDraft(cwd, RUN, 1, envelope(['s1'], []));
    const { code, doc, stderr } = await collect(cwd);
    expect(code).toBe(0);
    expect(doc.actions).toEqual([]);
    expect(doc.consumed.map(s => s.session_id)).toEqual(['s1']);
    expect(stderr).toContain(
      '1 draft(s), 1 valid, 0 invalid; 0 action(s) aggregated; 1 session(s) consumed.'
    );
  });

  it('errors when no draft files exist for the run-id', async () => {
    const code = await runDraftsCollectCommand({ runId: RUN });
    expect(code).toBe(1);
  });
});
