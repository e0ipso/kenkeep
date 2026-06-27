import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDraftsCollectCommand } from '../../src/commands/drafts-collect.js';

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
      kind: 'practice',
      tags: ['t'],
      summary: 's',
      body: 'b',
      confidence: 'high',
      relates_to: [],
      depends_on: [],
    },
    rationale: 'r',
  };
}

function writeDraft(root: string, runId: string, n: number, content: string): void {
  writeFileSync(join(root, `.ai/kenkeep/_logs/curator/${runId}__${n}.draft.json`), content);
}

async function capture(
  fn: () => Promise<number>
): Promise<{ code: number; actions: unknown[] }> {
  let stdout = '';
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    });
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const code = await fn();
    return { code, actions: JSON.parse(stdout) };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
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

  it('aggregates all valid batches in numeric order, preserving total count', async () => {
    writeDraft(cwd, RUN, 1, JSON.stringify([action('s1:practice:0')]));
    writeDraft(cwd, RUN, 2, JSON.stringify([action('s2:practice:0'), action('s2:practice:1')]));
    // Batch 10 must sort after 9/2, not lexicographically before 2.
    writeDraft(cwd, RUN, 10, JSON.stringify([action('s10:practice:0')]));
    const { code, actions } = await capture(() => runDraftsCollectCommand({ runId: RUN }));
    expect(code).toBe(0);
    expect(actions).toHaveLength(4);
    const origins = (actions as Array<{ candidate_origin: string }>).map(a => a.candidate_origin);
    expect(origins).toEqual(['s1:practice:0', 's2:practice:0', 's2:practice:1', 's10:practice:0']);
  });

  it('skips a malformed batch, keeps the others, and reports it', async () => {
    writeDraft(cwd, RUN, 1, JSON.stringify([action('s1:practice:0')]));
    writeDraft(cwd, RUN, 2, 'not json at all');
    // Invalid: extra key in proposed_node is rejected by the strict schema.
    const bad = action('s3:practice:0') as Record<string, unknown>;
    (bad.proposed_node as Record<string, unknown>).extra = 'nope';
    writeDraft(cwd, RUN, 3, JSON.stringify([bad]));
    const { code, actions } = await capture(() => runDraftsCollectCommand({ runId: RUN }));
    expect(code).toBe(0);
    expect(actions).toHaveLength(1);
    // The skipped batches recorded an `invalid` audit event.
    const jsonl2 = readFileSync(join(cwd, `.ai/kenkeep/_logs/curator/${RUN}__2.jsonl`), 'utf8');
    expect(jsonl2).toContain('"event":"invalid"');
    const jsonl1 = readFileSync(join(cwd, `.ai/kenkeep/_logs/curator/${RUN}__1.jsonl`), 'utf8');
    expect(jsonl1).toContain('"event":"validated"');
  });

  it('errors when no draft files exist for the run-id', async () => {
    const code = await runDraftsCollectCommand({ runId: 'missing-run' });
    expect(code).toBe(1);
  });

  it('errors on an unknown schema name', async () => {
    writeDraft(cwd, RUN, 1, JSON.stringify([action('s1:practice:0')]));
    const code = await runDraftsCollectCommand({ runId: RUN, schema: 'nope' });
    expect(code).toBe(1);
  });
});
