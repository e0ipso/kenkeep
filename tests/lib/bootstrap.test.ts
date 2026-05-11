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
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_LOCK_NAME,
  buildChunkString,
  chunkDocs,
  discoverMarkdownFiles,
  globMatch,
  parseGitignore,
  readBootstrapState,
  runBootstrapIncremental,
  sha256Hex,
  writeBootstrapState,
  type BootstrapRunner,
  type DocCandidateFile,
} from '../../src/lib/bootstrap.js';
import type {
  BootstrapCandidate,
  BootstrapOutput,
  ProposalFrontmatter,
} from '../../src/lib/schemas.js';
import { acquireLock, readState } from '../../src/lib/state.js';

interface Harness {
  root: string;
  sourceDir: string;
  kbDir: string;
  proposedDir: string;
  logsDir: string;
  stateFile: string;
  bootstrapStateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-bootstrap-'));
  const sourceDir = join(root, 'docs');
  const kbDir = join(root, '.ai/knowledge-base');
  const proposedDir = join(kbDir, '_proposed');
  const logsDir = join(kbDir, '_logs');
  const stateFile = join(root, '.ai/knowledge-base/.state/state.json');
  const bootstrapStateFile = join(root, '.ai/knowledge-base/.state/bootstrap-state.json');
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(proposedDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return {
    root,
    sourceDir,
    kbDir,
    proposedDir,
    logsDir,
    stateFile,
    bootstrapStateFile,
  };
}

const PROMPT_TEMPLATE = 'Extract.\n\n[CHUNK PLACEHOLDER — substituted at runtime]';

function makeCandidate(
  kind: 'practice' | 'map',
  title: string,
  derivedFrom: string[] = [],
): BootstrapCandidate {
  return {
    kind,
    tags: ['t'],
    title,
    summary: `summary of ${title}`,
    body: `# ${title}\n\nBody for ${title}.`,
    confidence: 'medium',
    derived_from: derivedFrom,
    supports_existing_node: null,
    contradicts_existing_node: null,
  };
}

function runnerOf(output: BootstrapOutput | BootstrapOutput[]): BootstrapRunner {
  const queue: BootstrapOutput[] = Array.isArray(output) ? [...output] : [output];
  return (async () => {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return next!;
  }) as BootstrapRunner;
}

describe('sha256Hex', () => {
  it('is stable and matches a known value', () => {
    expect(sha256Hex('hello\n')).toBe(
      '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03',
    );
  });
});

describe('globMatch', () => {
  it('matches **/*.md against nested paths', () => {
    expect(globMatch('**/*.md', 'docs/foo.md')).toBe(true);
    expect(globMatch('**/*.md', 'README.md')).toBe(true);
    expect(globMatch('**/*.md', 'docs/foo.txt')).toBe(false);
  });
  it('matches dir/** against everything under dir', () => {
    expect(globMatch('docs/legacy/**', 'docs/legacy/a.md')).toBe(true);
    expect(globMatch('docs/legacy/**', 'docs/legacy/sub/b.md')).toBe(true);
    expect(globMatch('docs/legacy/**', 'docs/current/a.md')).toBe(false);
  });
  it('matches single-segment * but not slashes', () => {
    expect(globMatch('docs/*.md', 'docs/a.md')).toBe(true);
    expect(globMatch('docs/*.md', 'docs/sub/a.md')).toBe(false);
  });
});

describe('parseGitignore', () => {
  it('drops comments, blanks, and negation; promotes plain names; expands dir patterns', () => {
    const text = ['# comment', '', 'node_modules', 'dist/', '!keep.md', '/anchored.txt'].join('\n');
    const patterns = parseGitignore(text);
    expect(patterns).toContain('**/node_modules');
    expect(patterns).toContain('**/dist/**');
    expect(patterns).toContain('anchored.txt');
    expect(patterns.some((p) => p.includes('keep.md'))).toBe(false);
  });
});

describe('discoverMarkdownFiles', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns repo-relative posix paths sorted, recursing through directories', () => {
    writeFileSync(join(harness.sourceDir, 'README.md'), '# r');
    mkdirSync(join(harness.sourceDir, 'sub'), { recursive: true });
    writeFileSync(join(harness.sourceDir, 'sub', 'a.md'), 'a');
    writeFileSync(join(harness.sourceDir, 'sub', 'b.txt'), 'ignored'); // non-md
    const got = discoverMarkdownFiles({ sourceDir: harness.sourceDir, repoRoot: harness.root });
    expect(got).toEqual(['docs/README.md', 'docs/sub/a.md']);
  });

  it('applies --include and --exclude globs', () => {
    writeFileSync(join(harness.sourceDir, 'keep.md'), 'k');
    mkdirSync(join(harness.sourceDir, 'legacy'), { recursive: true });
    writeFileSync(join(harness.sourceDir, 'legacy', 'skip.md'), 's');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      include: ['**/*.md'],
      exclude: ['docs/legacy/**'],
    });
    expect(got).toEqual(['docs/keep.md']);
  });

  it('respects gitignore patterns', () => {
    writeFileSync(join(harness.sourceDir, 'keep.md'), 'k');
    mkdirSync(join(harness.sourceDir, 'node_modules'), { recursive: true });
    writeFileSync(join(harness.sourceDir, 'node_modules', 'x.md'), 'x');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      gitignorePatterns: parseGitignore('node_modules'),
    });
    expect(got).toEqual(['docs/keep.md']);
  });
});

describe('chunkDocs', () => {
  it('packs docs into batches sized by approximate token budget', () => {
    const docs: DocCandidateFile[] = Array.from({ length: 4 }, (_, i) => ({
      relPath: `docs/${i}.md`,
      absPath: `/tmp/${i}.md`,
      sha256: 'x',
      content: 'a'.repeat(4000), // ~1000 tokens each
    }));
    const batches = chunkDocs(docs, 2500);
    // First batch can fit 2 docs (≈2000), 3rd would overflow.
    expect(batches.map((b) => b.length)).toEqual([2, 2]);
  });

  it('lets an oversized single doc live in its own batch', () => {
    const docs: DocCandidateFile[] = [
      { relPath: 'big.md', absPath: '/x', sha256: 'x', content: 'a'.repeat(100_000) },
      { relPath: 'small.md', absPath: '/y', sha256: 'y', content: 'a' },
    ];
    const batches = chunkDocs(docs, 1000);
    expect(batches).toHaveLength(2);
    expect(batches[0]!.map((d) => d.relPath)).toEqual(['big.md']);
  });
});

describe('buildChunkString', () => {
  it('emits FILE/END FILE delimited blocks', () => {
    const out = buildChunkString([
      { relPath: 'docs/a.md', absPath: '/x', sha256: 'h', content: '# A\nbody' },
      { relPath: 'docs/b.md', absPath: '/y', sha256: 'h', content: 'B' },
    ]);
    expect(out).toContain('=== FILE: docs/a.md ===');
    expect(out).toContain('=== END FILE ===');
    expect(out).toContain('=== FILE: docs/b.md ===');
  });
});

describe('readBootstrapState / writeBootstrapState', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns an empty state when the file is missing', () => {
    const s = readBootstrapState(harness.bootstrapStateFile);
    expect(s.schema_version).toBe(1);
    expect(s.docs).toEqual({});
  });

  it('round-trips a written state', () => {
    writeBootstrapState(harness.bootstrapStateFile, {
      schema_version: 1,
      last_full_bootstrap_at: null,
      last_incremental_at: '2026-05-11T10:00:00Z',
      docs: {
        'docs/a.md': {
          content_sha256: 'abc',
          last_processed_at: '2026-05-11T10:00:00Z',
          produced_proposals: ['additions/practice-a.md'],
        },
      },
    });
    const got = readBootstrapState(harness.bootstrapStateFile);
    expect(got.docs['docs/a.md']?.content_sha256).toBe('abc');
  });
});

describe('runBootstrapIncremental', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('writes addition proposals for each candidate and updates state', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A\nUse X always.');
    writeFileSync(join(harness.sourceDir, 'b.md'), '# B\nBravo is a service.');
    const runner = runnerOf({
      practice: [makeCandidate('practice', 'Use X', ['docs/a.md'])],
      map: [makeCandidate('map', 'Bravo Service', ['docs/b.md'])],
    });
    const result = await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
      tokenBudget: 1_000_000,
    });
    expect(result.status).toBe('completed');
    expect(result.proposalsWritten).toBe(2);
    const additions = readdirSync(join(harness.proposedDir, 'additions')).sort();
    expect(additions).toEqual(['map-bravo-service.md', 'practice-use-x.md']);

    const propPath = join(harness.proposedDir, 'additions', 'practice-use-x.md');
    const parsed = matter(readFileSync(propPath, 'utf8'));
    const fm = parsed.data as ProposalFrontmatter;
    expect(fm.derived_from).toEqual(['docs/a.md']);
    expect(fm.proposal.kind).toBe('addition');
    expect(fm.proposal.rationale).toBe('bootstrap: docs/a.md');
    expect(fm.confidence).toBe('medium');

    const state = readBootstrapState(harness.bootstrapStateFile);
    expect(state.docs['docs/a.md']?.content_sha256).toBeDefined();
    expect(state.docs['docs/b.md']?.produced_proposals).toContain('additions/map-bravo-service.md');
  });

  it('skips docs whose hash matches the recorded state', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'unchanged');
    const sha = sha256Hex('unchanged');
    writeBootstrapState(harness.bootstrapStateFile, {
      schema_version: 1,
      docs: {
        'docs/a.md': {
          content_sha256: sha,
          last_processed_at: '2026-05-11T09:00:00Z',
          produced_proposals: [],
        },
      },
    });
    let runnerCalled = 0;
    const runner: BootstrapRunner = (async () => {
      runnerCalled += 1;
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });
    expect(result.status).toBe('completed');
    expect(result.unchanged).toBe(1);
    expect(result.proposalsWritten).toBe(0);
    expect(runnerCalled).toBe(0);
  });

  it('dry-run reports what would be processed without invoking the runner or writing proposals', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    writeFileSync(join(harness.sourceDir, 'b.md'), 'b');
    let runnerCalled = 0;
    const runner: BootstrapRunner = (async () => {
      runnerCalled += 1;
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
      dryRun: true,
    });
    expect(result.status).toBe('completed');
    expect(runnerCalled).toBe(0);
    expect(result.proposalsWritten).toBe(0);
    expect(result.processed.filter((p) => p.status === 'skipped-dry-run')).toHaveLength(2);
    // Did not create proposals on disk.
    const additionsDir = join(harness.proposedDir, 'additions');
    const hasProposals = existsSync(additionsDir) && readdirSync(additionsDir).length > 0;
    expect(hasProposals).toBe(false);
    // Did not mutate the bootstrap state.
    expect(existsSync(harness.bootstrapStateFile)).toBe(false);
  });

  it('returns status=locked when another process holds the lock', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    acquireLock(harness.stateFile, {
      name: BOOTSTRAP_LOCK_NAME,
      pid: 999_999,
      now: new Date('2030-01-01T00:00:00Z'),
    });
    const result = await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: runnerOf({ practice: [], map: [] }),
      pid: 12345,
      now: () => new Date('2030-01-01T00:00:01Z'),
    });
    expect(result.status).toBe('locked');
  });

  it('releases the lock after completion', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: runnerOf({ practice: [], map: [] }),
    });
    expect(readState(harness.stateFile).lock ?? null).toBeNull();
  });

  it('records failures but does not update state for the failed doc', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    const failing: BootstrapRunner = (async () => {
      throw new Error('boom');
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: failing,
    });
    expect(result.proposalsWritten).toBe(0);
    expect(result.processed[0]?.status).toBe('failed');
    expect(result.processed[0]?.error).toContain('boom');
    const state = readBootstrapState(harness.bootstrapStateFile);
    expect(state.docs['docs/a.md']).toBeUndefined();
  });

  it('defaults derived_from to the single-doc batch source when the model omits it', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A');
    const runner = runnerOf({
      practice: [makeCandidate('practice', 'Use X', [])], // empty derived_from
      map: [],
    });
    await runBootstrapIncremental({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      kbDir: harness.kbDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      bootstrapStateFile: harness.bootstrapStateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });
    const propPath = join(harness.proposedDir, 'additions', 'practice-use-x.md');
    const fm = matter(readFileSync(propPath, 'utf8')).data as ProposalFrontmatter;
    expect(fm.derived_from).toEqual(['docs/a.md']);
    expect(fm.proposal.rationale).toBe('bootstrap: docs/a.md');
  });
});
