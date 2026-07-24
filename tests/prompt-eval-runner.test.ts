import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPromptEvaluation } from '../src/commands/prompt-eval.js';
import type { ProposalOutput } from '../src/lib/schemas.js';

const temporaryDirectories: string[] = [];

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'kenkeep-prompt-eval-runner-'));
  temporaryDirectories.push(root);
  const fixturesDir = join(root, 'fixtures');
  mkdirSync(join(fixturesDir, 'sessions'), { recursive: true });
  mkdirSync(join(fixturesDir, 'expected'), { recursive: true });
  for (const [id, body] of [
    ['fixture-a', '[USER]: Alpha teaching\n[AGENT]: Alpha result'],
    ['fixture-b', '[USER]: Beta teaching\n[AGENT]: Beta result'],
  ]) {
    writeFileSync(
      join(fixturesDir, 'sessions', `${id}.md`),
      `---\nschema_version: 1\nsession_id: 10000000-0000-4000-8000-000000000001\nharness: claude\ncaptured_at: '2026-01-15T10:00:00.000Z'\n---\n${body}\n`
    );
  }
  writeFileSync(
    join(root, 'prompt.md'),
    '<!-- Version: 5 -->\nBefore\n[TRANSCRIPT PLACEHOLDER, substituted at runtime]\nAfter\n'
  );
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('prompt eval harness runner', () => {
  it('runs isolated fixtures, writes valid results, and returns a consolidated report', async () => {
    const root = createFixtureRoot();
    const prompts: string[] = [];
    const empty: ProposalOutput = { practice: [], map: [] };

    const result = await runPromptEvaluation(
      {
        concurrency: 2,
        fixturesDir: join(root, 'fixtures'),
        harnessId: 'codex',
        modelLabel: '{"harness":"codex","model":"test-model"}',
        outputDir: join(root, 'output'),
        promptFile: join(root, 'prompt.md'),
        runs: 1,
        timeoutMs: 1_000,
      },
      {
        now: () => new Date('2026-07-20T12:00:00.000Z'),
        onProgress: () => undefined,
        runHeadless: async prompt => {
          prompts.push(prompt);
          return empty;
        },
        scoreResults: (_fixturesDir, resultsDir) => {
          expect(readFileSync(join(resultsDir, 'fixture-a.json'), 'utf8')).toContain('"practice"');
          expect(readFileSync(join(resultsDir, 'fixture-b.json'), 'utf8')).toContain('"map"');
          return 'Prompt eval score\n\nFixtures:\nPASS fixture-a\nPASS fixture-b\n';
        },
      }
    );

    expect(result.exitCode).toBe(0);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toContain('schema_version');
    expect(prompts.join('\n')).toContain('[USER]: Alpha teaching');
    expect(prompts.join('\n')).toContain('[USER]: Beta teaching');
    expect(result.report).toContain('# Proposal extraction evaluation report');
    expect(result.report).toContain('Prompt version: 5');
    expect(result.report).toContain('Valid results: 2/2');
    expect(readFileSync(join(root, 'output', 'REPORT.md'), 'utf8')).toBe(result.report);
  });

  it('continues after a harness failure and returns nonzero for an incomplete run', async () => {
    const root = createFixtureRoot();

    const result = await runPromptEvaluation(
      {
        concurrency: 1,
        fixturesDir: join(root, 'fixtures'),
        harnessId: 'claude',
        modelLabel: 'harness default',
        outputDir: join(root, 'output'),
        promptFile: join(root, 'prompt.md'),
        runs: 1,
        timeoutMs: 1_000,
      },
      {
        now: () => new Date('2026-07-20T12:00:00.000Z'),
        onProgress: () => undefined,
        runHeadless: async prompt => {
          if (prompt.includes('Alpha')) throw new Error('provider unavailable');
          return { practice: [], map: [] };
        },
        scoreResults: () =>
          'Prompt eval score\n\nFixtures:\nFAIL fixture-a: result file missing\nPASS fixture-b\n',
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.report).toContain('Valid results: 1/2');
    expect(result.report).toContain('fixture-a: provider unavailable');
    expect(result.report).toContain('FAIL fixture-a: result file missing');
  });

  it('refuses a non-empty output directory so stale results cannot contaminate a run', async () => {
    const root = createFixtureRoot();
    const outputDir = join(root, 'output');
    mkdirSync(outputDir);
    writeFileSync(join(outputDir, 'stale.json'), '{}');

    await expect(
      runPromptEvaluation(
        {
          concurrency: 1,
          fixturesDir: join(root, 'fixtures'),
          harnessId: 'codex',
          modelLabel: 'harness default',
          outputDir,
          promptFile: join(root, 'prompt.md'),
          runs: 1,
          timeoutMs: 1_000,
        },
        {
          now: () => new Date('2026-07-20T12:00:00.000Z'),
          onProgress: () => undefined,
          runHeadless: async () => ({ practice: [], map: [] }),
          scoreResults: () => 'unreachable',
        }
      )
    ).rejects.toThrow(/output directory is not empty/i);
  });
});
