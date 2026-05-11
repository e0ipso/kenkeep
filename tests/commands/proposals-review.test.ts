import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProposalsReview } from '../../src/commands/proposals-review.js';
import type { ProposalFrontmatter } from '../../src/lib/schemas.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kb-review-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/.state'), { recursive: true });
  writeFileSync(
    join(root, '.ai/knowledge-base/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: '@e0ipso/ai-knowledge-base',
      version: '0.0.0-test',
      installed_at: '2026-05-11T10:00:00Z',
      assistants: ['claude'],
    }),
  );
  mkdirSync(join(root, '.ai/knowledge-base/nodes/practice'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/nodes/map'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/_proposed/additions'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/_proposed/modifications'), { recursive: true });
  mkdirSync(join(root, '.ai/knowledge-base/_proposed/contradictions'), { recursive: true });
  return root;
}

function makeProposal(
  bucket: 'additions' | 'modifications' | 'contradictions',
  id: string,
  overrides: Partial<ProposalFrontmatter['proposal']> = {},
): ProposalFrontmatter {
  return {
    schema_version: 1,
    id,
    title: id,
    kind: 'practice',
    tags: [],
    valid_from: '2026-05-11T10:00:00Z',
    valid_until: null,
    updated: '2026-05-11T10:00:00Z',
    supersedes: null,
    superseded_by: null,
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: `summary for ${id}`,
    proposal: {
      kind:
        bucket === 'additions'
          ? 'addition'
          : bucket === 'modifications'
            ? 'modification'
            : 'contradiction',
      source_sessions: [],
      target_node: null,
      rationale: 'r',
      suggested_resolution: null,
      curator_log: null,
      ...overrides,
    },
  };
}

function writeProposal(
  root: string,
  bucket: 'additions' | 'modifications' | 'contradictions',
  fm: ProposalFrontmatter,
  body = '# body\n\nProposal body.\n',
): void {
  const file = join(root, '.ai/knowledge-base/_proposed', bucket, `${fm.id}.md`);
  writeFileSync(file, matter.stringify(body, fm));
}

describe('proposals review', () => {
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

  it('accepts an addition: moves the proposal into nodes/<kind>/ and strips the proposal block', async () => {
    writeProposal(cwd, 'additions', makeProposal('additions', 'practice-foo'));
    const code = await runProposalsReview({ actions: [{ type: 'accept' }] });
    expect(code).toBe(0);
    expect(existsSync(join(cwd, '.ai/knowledge-base/_proposed/additions/practice-foo.md'))).toBe(
      false,
    );
    const moved = join(cwd, '.ai/knowledge-base/nodes/practice/practice-foo.md');
    expect(existsSync(moved)).toBe(true);
    const fm = matter(readFileSync(moved, 'utf8')).data as Record<string, unknown>;
    expect(fm['proposal']).toBeUndefined();
    expect(fm['id']).toBe('practice-foo');
  });

  it('rejects a proposal: deletes the file without writing to nodes/', async () => {
    writeProposal(cwd, 'additions', makeProposal('additions', 'practice-bar'));
    await runProposalsReview({ actions: [{ type: 'reject' }] });
    expect(existsSync(join(cwd, '.ai/knowledge-base/_proposed/additions/practice-bar.md'))).toBe(
      false,
    );
    expect(readdirSync(join(cwd, '.ai/knowledge-base/nodes/practice'))).toHaveLength(0);
  });

  it('sets suggested_resolution and then accepts the contradiction', async () => {
    // Seed an existing target node so supersede can update it.
    const targetFm = {
      schema_version: 1,
      id: 'practice-old',
      title: 'Old',
      kind: 'practice',
      tags: [],
      valid_from: '2026-01-01T00:00:00Z',
      valid_until: null,
      updated: '2026-01-01T00:00:00Z',
      supersedes: null,
      superseded_by: null,
      derived_from: [],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
      summary: 'old',
    };
    writeFileSync(
      join(cwd, '.ai/knowledge-base/nodes/practice/practice-old.md'),
      matter.stringify('# Old\nBody.\n', targetFm),
    );
    writeProposal(
      cwd,
      'contradictions',
      makeProposal('contradictions', 'practice-new', { target_node: 'practice-old' }),
    );
    await runProposalsReview({
      actions: [{ type: 'set_resolution', value: 'supersede' }, { type: 'accept' }],
    });
    const target = matter(
      readFileSync(join(cwd, '.ai/knowledge-base/nodes/practice/practice-old.md'), 'utf8'),
    ).data as Record<string, unknown>;
    expect(target['superseded_by']).toBe('practice-new');
    expect(typeof target['valid_until']).toBe('string');
  });

  it('lists pending proposals with --list and exits 0', async () => {
    writeProposal(cwd, 'additions', makeProposal('additions', 'practice-listed'));
    const code = await runProposalsReview({ list: true });
    expect(code).toBe(0);
    // file is untouched.
    expect(existsSync(join(cwd, '.ai/knowledge-base/_proposed/additions/practice-listed.md'))).toBe(
      true,
    );
  });
});
