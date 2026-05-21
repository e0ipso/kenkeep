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
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ignore from 'ignore';
import {
  buildChunkString,
  buildPrompt,
  CHUNK_PLACEHOLDER,
  discoverMarkdownFiles,
  readBootstrapState,
  runBootstrapIncremental,
  sha256Hex,
  writeBootstrapState,
  type BootstrapRunner,
} from '../../src/lib/bootstrap.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import type {
  BootstrapCandidate,
  BootstrapOutput,
  NodeFrontmatter,
} from '../../src/lib/schemas.js';
import { STATE_LOCK_OPTIONS } from '../../src/lib/state.js';

interface Harness {
  root: string;
  sourceDir: string;
  paths: RepoPaths;
  nodesDir: string;
  stateFile: string;
  bootstrapStateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-bootstrap-'));
  const sourceDir = join(root, 'docs');
  const paths = repoPaths(root);
  const stateFile = join(paths.stateDir, 'state.json');
  const bootstrapStateFile = join(paths.stateDir, 'bootstrap-state.json');
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(paths.nodesDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  return {
    root,
    sourceDir,
    paths,
    nodesDir: paths.nodesDir,
    stateFile,
    bootstrapStateFile,
  };
}

const PROMPT_TEMPLATE = 'Extract.\n\n[CHUNK PLACEHOLDER, substituted at runtime]';

function makeCandidate(kind: 'practice' | 'map', title: string): BootstrapCandidate {
  return {
    kind,
    tags: ['t'],
    title,
    summary: `summary of ${title}`,
    body: `# ${title}\n\nBody for ${title}.`,
    confidence: 'medium',
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

function ctxFor(harness: Harness, runner: BootstrapRunner) {
  return {
    sourceDir: harness.sourceDir,
    paths: harness.paths,
    promptTemplate: PROMPT_TEMPLATE,
    runner,
  };
}

describe('sha256Hex', () => {
  it('is stable and matches a known value', () => {
    expect(sha256Hex('hello\n')).toBe(
      '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
    );
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
      gitignore: ignore().add('node_modules'),
    });
    expect(got).toEqual(['docs/keep.md']);
  });

  it('honours .gitignore negation patterns', () => {
    writeFileSync(join(harness.sourceDir, 'keep.md'), 'k');
    writeFileSync(join(harness.sourceDir, 'drop.md'), 'd');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      gitignore: ignore().add('docs/*.md\n!docs/keep.md'),
    });
    expect(got).toEqual(['docs/keep.md']);
  });

  it('skips static deny patterns by default', () => {
    writeFileSync(join(harness.sourceDir, 'intro.md'), 'i');
    writeFileSync(join(harness.sourceDir, 'LICENSE.md'), 'l');
    writeFileSync(join(harness.sourceDir, 'LICENSE'), 'l');
    writeFileSync(join(harness.sourceDir, 'COPYING'), 'c');
    writeFileSync(join(harness.sourceDir, 'NOTICE.md'), 'n');
    writeFileSync(join(harness.sourceDir, 'CODE_OF_CONDUCT.md'), 'c');
    writeFileSync(join(harness.sourceDir, 'CONTRIBUTORS.md'), 'c');
    writeFileSync(join(harness.sourceDir, 'AUTHORS.md'), 'a');
    writeFileSync(join(harness.sourceDir, 'MAINTAINERS.md'), 'm');
    writeFileSync(join(harness.sourceDir, 'CHANGELOG.md'), 'c');
    writeFileSync(join(harness.sourceDir, 'CHANGES.md'), 'c');
    writeFileSync(join(harness.sourceDir, 'HISTORY.md'), 'h');
    writeFileSync(join(harness.sourceDir, 'RELEASE_NOTES.md'), 'r');
    writeFileSync(join(harness.sourceDir, 'INDEX.md'), 'i');
    writeFileSync(join(harness.sourceDir, 'GRAPH.md'), 'g');
    mkdirSync(join(harness.sourceDir, 'releases'), { recursive: true });
    writeFileSync(join(harness.sourceDir, 'releases', 'v1.md'), 'v1');
    const got = discoverMarkdownFiles({ sourceDir: harness.sourceDir, repoRoot: harness.root });
    expect(got).toEqual(['docs/intro.md']);
  });

  it('admits a statically-skipped path when --include matches it explicitly', () => {
    writeFileSync(join(harness.sourceDir, 'intro.md'), 'i');
    writeFileSync(join(harness.sourceDir, 'LICENSE.md'), 'l');
    writeFileSync(join(harness.sourceDir, 'CHANGELOG.md'), 'c');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      include: ['docs/LICENSE.md', 'docs/intro.md'],
    });
    expect(got).toEqual(['docs/LICENSE.md', 'docs/intro.md']);
  });

  it('exclude still wins when --include opts a statically-skipped path in', () => {
    writeFileSync(join(harness.sourceDir, 'intro.md'), 'i');
    mkdirSync(join(harness.sourceDir, 'legacy'), { recursive: true });
    writeFileSync(join(harness.sourceDir, 'legacy', 'LICENSE.md'), 'l');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      include: ['docs/legacy/LICENSE.md', 'docs/intro.md'],
      exclude: ['docs/legacy/**'],
    });
    expect(got).toEqual(['docs/intro.md']);
  });

  it('gitignore still wins when --include opts a statically-skipped path in', () => {
    writeFileSync(join(harness.sourceDir, 'intro.md'), 'i');
    writeFileSync(join(harness.sourceDir, 'LICENSE.md'), 'l');
    const got = discoverMarkdownFiles({
      sourceDir: harness.sourceDir,
      repoRoot: harness.root,
      include: ['docs/LICENSE.md', 'docs/intro.md'],
      gitignore: ignore().add('docs/LICENSE.md'),
    });
    expect(got).toEqual(['docs/intro.md']);
  });

  it('skips static deny patterns inside dot-prefixed directories', () => {
    writeFileSync(join(harness.sourceDir, 'intro.md'), 'i');
    mkdirSync(join(harness.sourceDir, '.ai', 'knowledge-base'), { recursive: true });
    writeFileSync(join(harness.sourceDir, '.ai', 'knowledge-base', 'INDEX.md'), 'i');
    writeFileSync(join(harness.sourceDir, '.ai', 'knowledge-base', 'GRAPH.md'), 'g');
    const got = discoverMarkdownFiles({ sourceDir: harness.sourceDir, repoRoot: harness.root });
    expect(got).toEqual(['docs/intro.md']);
  });

  it('does not filter files that only share a prefix with a static skip', () => {
    writeFileSync(join(harness.sourceDir, 'CHANGELOG_FORMAT.md'), 'cf');
    writeFileSync(join(harness.sourceDir, 'LICENSE_HEADER.md'), 'lh');
    writeFileSync(join(harness.sourceDir, 'licensing-policy.md'), 'lp');
    const got = discoverMarkdownFiles({ sourceDir: harness.sourceDir, repoRoot: harness.root });
    expect(got).toEqual([
      'docs/CHANGELOG_FORMAT.md',
      'docs/LICENSE_HEADER.md',
      'docs/licensing-policy.md',
    ]);
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
      last_incremental_at: '2026-05-12T10:00:00Z',
      docs: {
        'docs/a.md': {
          content_sha256: 'abc',
          last_processed_at: '2026-05-12T10:00:00Z',
          produced_nodes: ['practice/practice-a.md'],
        },
      },
    });
    const got = readBootstrapState(harness.bootstrapStateFile);
    expect(got.docs['docs/a.md']?.content_sha256).toBe('abc');
    expect(got.docs['docs/a.md']?.produced_nodes).toEqual(['practice/practice-a.md']);
  });
});

describe('runBootstrapIncremental', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('writes new nodes for each candidate and updates state', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A\nUse X always.');
    writeFileSync(join(harness.sourceDir, 'b.md'), '# B\nBravo is a service.');
    const queue: BootstrapOutput[] = [
      { practice: [makeCandidate('practice', 'Use X')], map: [] },
      { practice: [], map: [makeCandidate('map', 'Bravo Service')] },
    ];
    const runner: BootstrapRunner = (async () => queue.shift()!) as BootstrapRunner;
    const result = await runBootstrapIncremental(ctxFor(harness, runner));
    expect(result.status).toBe('completed');
    expect(result.batches).toBe(2);
    expect(result.nodesWritten).toBe(2);
    expect(result.skippedCollisions).toBe(0);
    expect(readdirSync(join(harness.nodesDir, 'practice'))).toEqual(['practice-use-x.md']);
    expect(readdirSync(join(harness.nodesDir, 'map'))).toEqual(['map-bravo-service.md']);

    const nodeFile = join(harness.nodesDir, 'practice', 'practice-use-x.md');
    const parsed = matter(readFileSync(nodeFile, 'utf8'));
    const fm = parsed.data as NodeFrontmatter;
    expect(fm.derived_from).toEqual(['docs/a.md']);
    expect(fm.confidence).toBe('medium');
    // No proposal: block in the new architecture.
    expect(parsed.data).not.toHaveProperty('proposal');

    const state = readBootstrapState(harness.bootstrapStateFile);
    expect(state.docs['docs/a.md']?.content_sha256).toBeDefined();
    expect(state.docs['docs/b.md']?.produced_nodes).toContain('map/map-bravo-service.md');
  });

  it('skips a candidate whose target node already exists on disk', async () => {
    // Pre-create the node bootstrap would otherwise write.
    mkdirSync(join(harness.nodesDir, 'practice'), { recursive: true });
    writeFileSync(
      join(harness.nodesDir, 'practice', 'practice-use-x.md'),
      matter.stringify('# old\n', {
        schema_version: 1,
        id: 'practice-use-x',
        title: 'Use X',
        kind: 'practice',
        tags: [],
        derived_from: [],
        relates_to: [],
        confidence: 'high',
        summary: 's',
      })
    );
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A');
    const runner = runnerOf({
      practice: [makeCandidate('practice', 'Use X')],
      map: [],
    });
    const result = await runBootstrapIncremental(ctxFor(harness, runner));
    expect(result.nodesWritten).toBe(0);
    expect(result.skippedCollisions).toBe(1);
    // Existing node not overwritten.
    expect(readFileSync(join(harness.nodesDir, 'practice', 'practice-use-x.md'), 'utf8')).toContain(
      'old'
    );
  });

  it('skips docs whose hash matches the recorded state', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'unchanged');
    const sha = sha256Hex('unchanged');
    writeBootstrapState(harness.bootstrapStateFile, {
      schema_version: 1,
      docs: {
        'docs/a.md': {
          content_sha256: sha,
          last_processed_at: '2026-05-12T09:00:00Z',
          produced_nodes: [],
        },
      },
    });
    let runnerCalled = 0;
    const runner: BootstrapRunner = (async () => {
      runnerCalled += 1;
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental(ctxFor(harness, runner));
    expect(result.status).toBe('completed');
    expect(result.unchanged).toBe(1);
    expect(result.nodesWritten).toBe(0);
    expect(runnerCalled).toBe(0);
  });

  it('dry-run reports what would be processed without invoking the runner or writing nodes', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    writeFileSync(join(harness.sourceDir, 'b.md'), 'b');
    let runnerCalled = 0;
    const runner: BootstrapRunner = (async () => {
      runnerCalled += 1;
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental({
      ...ctxFor(harness, runner),
      dryRun: true,
    });
    expect(result.status).toBe('completed');
    expect(runnerCalled).toBe(0);
    expect(result.nodesWritten).toBe(0);
    expect(result.processed.filter(p => p.status === 'skipped-dry-run')).toHaveLength(2);
    // Did not create nodes on disk.
    const practiceDir = join(harness.nodesDir, 'practice');
    const hasNodes = existsSync(practiceDir) && readdirSync(practiceDir).length > 0;
    expect(hasNodes).toBe(false);
    // Did not mutate the bootstrap state.
    expect(existsSync(harness.bootstrapStateFile)).toBe(false);
  });

  it('returns status=locked when another process holds the lock', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    mkdirSync(join(harness.paths.stateDir), { recursive: true });
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    try {
      const result = await runBootstrapIncremental(
        ctxFor(harness, runnerOf({ practice: [], map: [] }))
      );
      expect(result.status).toBe('locked');
    } finally {
      await release();
    }
  });

  it('releases the lock after completion', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    await runBootstrapIncremental(ctxFor(harness, runnerOf({ practice: [], map: [] })));
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    await release();
  });

  it('records failures but does not update state for the failed doc', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), 'a');
    const failing: BootstrapRunner = (async () => {
      throw new Error('boom');
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental(ctxFor(harness, failing));
    expect(result.nodesWritten).toBe(0);
    expect(result.processed[0]?.status).toBe('failed');
    expect(result.processed[0]?.error).toContain('boom');
    const state = readBootstrapState(harness.bootstrapStateFile);
    expect(state.docs['docs/a.md']).toBeUndefined();
  });

  it('attributes derived_from to the single-file batch source', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A');
    const runner = runnerOf({
      practice: [makeCandidate('practice', 'Use X')],
      map: [],
    });
    await runBootstrapIncremental(ctxFor(harness, runner));
    const nodeFile = join(harness.nodesDir, 'practice', 'practice-use-x.md');
    const fm = matter(readFileSync(nodeFile, 'utf8')).data as NodeFrontmatter;
    expect(fm.derived_from).toEqual(['docs/a.md']);
  });

  it('produces one batch per file (single-file batching)', async () => {
    for (let i = 0; i < 3; i += 1) {
      writeFileSync(join(harness.sourceDir, `doc-${i}.md`), `# ${i}\n`);
    }
    const batchSizes: number[] = [];
    const filePaths: string[][] = [];
    const runner: BootstrapRunner = (async (prompt: string) => {
      const matches = prompt.match(/=== FILE: ([^=]+?) ===/g) ?? [];
      batchSizes.push(matches.length);
      filePaths.push(matches.map(m => m.replace(/=== FILE: | ===/g, '').trim()));
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental(ctxFor(harness, runner));
    expect(result.batches).toBe(3);
    expect(batchSizes).toEqual([1, 1, 1]);
    expect(filePaths.flat().sort()).toEqual(['docs/doc-0.md', 'docs/doc-1.md', 'docs/doc-2.md']);
  });

  it('attributes derived_from deterministically per file across N single-file batches', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A');
    writeFileSync(join(harness.sourceDir, 'b.md'), '# B');
    writeFileSync(join(harness.sourceDir, 'c.md'), '# C');
    let call = 0;
    const titles = ['From A', 'From B', 'From C'];
    const runner: BootstrapRunner = (async () => {
      const title = titles[call++]!;
      return { practice: [makeCandidate('practice', title)], map: [] };
    }) as BootstrapRunner;
    const result = await runBootstrapIncremental(ctxFor(harness, runner));
    expect(result.batches).toBe(3);
    expect(result.nodesWritten).toBe(3);
    const byTitle: Record<string, string[]> = {};
    for (const f of readdirSync(join(harness.nodesDir, 'practice'))) {
      const fm = matter(readFileSync(join(harness.nodesDir, 'practice', f), 'utf8'))
        .data as NodeFrontmatter;
      byTitle[fm.title] = fm.derived_from;
    }
    expect(byTitle['From A']).toEqual(['docs/a.md']);
    expect(byTitle['From B']).toEqual(['docs/b.md']);
    expect(byTitle['From C']).toEqual(['docs/c.md']);
  });

  it('forwards harnessOpts to the runner when set, omits them otherwise', async () => {
    writeFileSync(join(harness.sourceDir, 'a.md'), '# A');
    let captured: Record<string, unknown> | undefined;
    const runner: BootstrapRunner = (async (_p, _s, _schema, opts) => {
      captured = opts.harnessOpts;
      return { practice: [], map: [] };
    }) as BootstrapRunner;
    await runBootstrapIncremental({
      ...ctxFor(harness, runner),
      harnessOpts: { model: 'sonnet', effort: 'high' },
    });
    expect(captured).toEqual({ model: 'sonnet', effort: 'high' });

    writeFileSync(join(harness.sourceDir, 'b.md'), '# B');
    captured = undefined;
    await runBootstrapIncremental(ctxFor(harness, runner));
    expect(captured).toBeUndefined();
  });
});

describe('buildPrompt', () => {
  it('substitutes the chunk placeholder when present', () => {
    const out = buildPrompt(`prefix ${CHUNK_PLACEHOLDER} suffix`, 'CHUNK');
    expect(out).toBe('prefix CHUNK suffix');
  });

  it('throws when the placeholder is missing, naming the placeholder and the bootstrap prompt', () => {
    expect(() => buildPrompt('no placeholder here', 'CHUNK')).toThrowError(
      new RegExp(
        `bootstrap prompt is missing the ${CHUNK_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      )
    );
  });
});
