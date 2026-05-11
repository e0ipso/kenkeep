import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../src/adapters/claude.js';
import { runCurate, type CuratorRunner } from '../../src/lib/curate.js';
import { drainStage2Queue, type Stage2Runner } from '../../src/lib/stage2-drain.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const fixtureTranscriptPath = resolve(here, '../fixtures/transcripts/bravo-insider/transcript.md');

const ENABLED = process.env['KB_RUN_REAL_CLAUDE'] === '1';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Use a project-unique substring that should appear in any reasonable
// extraction or curation of the fixture transcript.
const UNIQUE_TERM = 'Bravo Insider';

describe.skipIf(!ENABLED)('e2e: full capture → drain → curate → review cycle', () => {
  let sandbox: string;
  let origCwd: string;

  beforeEach(async () => {
    origCwd = process.cwd();
    sandbox = makeSandbox('ai-kb-e2e-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    const init = await runCli(sandbox, ['init', '--assistants', 'claude']);
    expect(init.exitCode).toBe(0);
  });

  afterEach(() => {
    try {
      process.chdir(origCwd);
    } catch {
      // ignore
    }
    cleanSandbox(sandbox);
  });

  it(
    'produces a populated node and INDEX.md referencing the fixture term',
    async () => {
      const kbDir = join(sandbox, '.ai/knowledge-base');
      const sessionsDir = join(kbDir, '_sessions');
      const logsDir = join(kbDir, '_logs');
      const proposedDir = join(kbDir, '_proposed');
      const nodesDir = join(kbDir, 'nodes');
      const stateFile = join(sandbox, '.ai/knowledge-base/.state/state.json');

      // 1. Plant a session log + queue entry pointing at the bravo-insider fixture.
      const transcript = readFileSync(fixtureTranscriptPath, 'utf8');
      const sessionId = '2026-05-11-1200-bravo-insider';
      const sessionLogFile = `${sessionId}.md`;
      const sessionLogPath = join(sessionsDir, sessionLogFile);
      mkdirSync(sessionsDir, { recursive: true });

      const sessionFrontmatter = {
        schema_version: 1,
        session_id: sessionId,
        captured_by: 'manual',
        captured_at: new Date().toISOString(),
        transcript_hash: 'sha256:e2e-fixture',
        stage_2_status: 'pending',
        stage_2_completed_at: null,
        stage_2_error: null,
        stage_2_log: null,
        secret_scan_status: 'clean',
        topics: [] as string[],
        proposals: { practice: [] as unknown[], map: [] as unknown[] },
      };
      const sessionBody = [
        '## Stage 1: redacted transcript slice',
        '',
        transcript.trim(),
        '',
        '## Stage 2: structured summary',
        '',
        '(populated by stage-2 worker)',
        '',
      ].join('\n');
      writeFileSync(sessionLogPath, matter.stringify(sessionBody, sessionFrontmatter));

      writeFileSync(
        join(sessionsDir, '.queue.json'),
        JSON.stringify(
          {
            schema_version: 1,
            entries: [
              {
                session_id: sessionId,
                session_log: sessionLogFile,
                captured_by: 'manual',
                captured_at: sessionFrontmatter.captured_at,
                attempts: 0,
              },
            ],
          },
          null,
          2
        ) + '\n'
      );

      // 2. Drain stage-2 with the real Claude adapter.
      const adapter = new ClaudeAdapter();
      const stage2Runner: Stage2Runner = (prompt, stdin, schema, opts) =>
        adapter.runHeadless(prompt, stdin, schema, opts);

      const stage2Prompt = readFileSync(
        join(sandbox, '.ai/knowledge-base/.config/prompts/stage-2-extract.md'),
        'utf8'
      );

      const drainSummary = await drainStage2Queue({
        sessionsDir,
        logsDir,
        stateFile,
        promptTemplate: stage2Prompt,
        runner: stage2Runner,
        timeoutMs: FIVE_MINUTES_MS,
      });

      expect(drainSummary.status).toBe('completed');
      expect(drainSummary.processed.length).toBeGreaterThan(0);
      const drainEntry = drainSummary.processed[0]!;
      expect(drainEntry.status).toBe('done');

      const sessionAfter = matter(readFileSync(sessionLogPath, 'utf8'));
      expect((sessionAfter.data as { stage_2_status?: string }).stage_2_status).toBe('done');

      // 3. Run curate with the real Claude adapter.
      const curatorRunner: CuratorRunner = (prompt, stdin, schema, opts) =>
        adapter.runHeadless(prompt, stdin, schema, opts);
      const curatorPrompt = readFileSync(
        join(sandbox, '.ai/knowledge-base/.config/prompts/curator.md'),
        'utf8'
      );

      const curateResult = await runCurate({
        kbDir,
        sessionsDir,
        nodesDir,
        proposedDir,
        logsDir,
        stateFile,
        promptTemplate: curatorPrompt,
        runner: curatorRunner,
        timeoutMs: FIVE_MINUTES_MS,
      });

      expect(curateResult.status).toBe('completed');
      expect(curateResult.proposalsWritten).toBeGreaterThan(0);

      // 4. Promote every pending proposal into nodes/. Review is now an
      // out-of-tree concern (e.g. e0ipso/self-review); for the e2e test we
      // simulate "accept all" inline.
      const totalProposals = promoteAllProposals(proposedDir, nodesDir);

      // 5. Assert: at least one node was written, and INDEX.md mentions the
      // fixture term. INDEX is not regenerated by the review command (that's
      // the curate / index-rebuild step) — but the curate run we already
      // performed wrote one fresh. Run index rebuild to be deterministic.
      const rebuildResult = await runCli(sandbox, ['index', 'rebuild']);
      expect(rebuildResult.exitCode).toBe(0);

      const allNodeFiles = collectNodes(nodesDir);
      expect(allNodeFiles.length).toBeGreaterThan(0);

      const indexFile = join(kbDir, 'INDEX.md');
      expect(existsSync(indexFile)).toBe(true);
      const indexBody = readFileSync(indexFile, 'utf8');

      // The unique-term assertion must match against the combined node bodies
      // OR the INDEX itself — different models may put it in different places.
      const haystacks = [indexBody, ...allNodeFiles.map(f => readFileSync(f, 'utf8'))];
      const found = haystacks.some(h => h.toLowerCase().includes(UNIQUE_TERM.toLowerCase()));
      expect(
        found,
        `expected at least one node or INDEX.md to mention '${UNIQUE_TERM}'. Got ${totalProposals} proposal(s), ${allNodeFiles.length} node(s).`
      ).toBe(true);
    },
    FIVE_MINUTES_MS * 3 + 60_000
  );
});

function collectNodes(nodesDir: string): string[] {
  const out: string[] = [];
  for (const kind of ['practice', 'map']) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.md')) out.push(join(dir, name));
    }
  }
  return out;
}

function promoteAllProposals(proposedDir: string, nodesDir: string): number {
  let promoted = 0;
  for (const bucket of ['additions', 'modifications', 'contradictions']) {
    const dir = join(proposedDir, bucket);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const file = join(dir, name);
      const parsed = matter(readFileSync(file, 'utf8'));
      const data = { ...(parsed.data as Record<string, unknown>) };
      delete data['proposal'];
      const kind = data['kind'] as string;
      const id = data['id'] as string;
      const kindDir = join(nodesDir, kind);
      mkdirSync(kindDir, { recursive: true });
      writeFileSync(
        join(kindDir, `${id}.md`),
        matter.stringify(parsed.content.trimEnd() + '\n', data)
      );
      rmSync(file);
      promoted += 1;
    }
  }
  return promoted;
}
