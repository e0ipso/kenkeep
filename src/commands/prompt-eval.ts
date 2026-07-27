import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getHarness, hasHarness, listHarnessIds } from '../harnesses/registry.js';
import { atomicWriteFile, atomicWriteJson } from '../lib/fs-atomic.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { buildProposalPrompt } from '../lib/proposal-drain.js';
import {
  PromptEvalJudgeOutputSchema,
  ProposalOutputSchema,
  type PromptEvalJudgeOutput,
  type ProposalOutput,
} from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';
import { compactStamp } from '../lib/time.js';

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_RUNS = 1;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ERROR_LENGTH = 500;
// One retry: judge failures are dominated by one-off shape drift, and a single
// malformed key discards the whole fixture's judgment in the scorer.
const JUDGE_ATTEMPTS = 2;

export interface PromptEvaluationOptions {
  concurrency: number;
  fixturesDir: string;
  harnessId: string;
  judgePromptFile: string;
  judgePromptLabel?: string;
  modelLabel: string;
  outputDir: string;
  outputLabel?: string;
  promptFile: string;
  promptLabel?: string;
  runs: number;
  timeoutMs: number;
}

export interface PromptEvaluationDeps {
  now(): Date;
  onProgress(message: string): void;
  runHeadless(
    prompt: string,
    opts: { fixtureId: string; logFile: string; timeoutMs: number }
  ): Promise<ProposalOutput>;
  runJudge(
    prompt: string,
    opts: { fixtureId: string; logFile: string; timeoutMs: number }
  ): Promise<PromptEvalJudgeOutput>;
  scoreResults(fixturesDir: string, resultsDir: string, judgmentsDir: string): string;
}

export interface PromptEvaluationResult {
  exitCode: number;
  outputDir: string;
  report: string;
}

interface Fixture {
  expectedPoints: ExpectedPoint[];
  id: string;
  transcript: string;
}

interface ExpectedPoint {
  claim: string;
  id: string;
  preferred_type: 'practice' | 'map';
  required_facets: Array<{ criterion: string; id: string }>;
}

interface FixtureFailure {
  fixtureId: string;
  message: string;
}

interface RunReport {
  failures: FixtureFailure[];
  runNumber: number;
  score: string;
  validJudgments: number;
  validResults: number;
}

export interface PromptEvalCommandOptions {
  concurrency?: string;
  fixturesDir?: string;
  harness: string;
  judgePromptFile?: string;
  outputDir?: string;
  promptFile?: string;
  runs?: string;
  timeoutMs?: string;
}

export async function runPromptEvaluation(
  opts: PromptEvaluationOptions,
  deps: PromptEvaluationDeps
): Promise<PromptEvaluationResult> {
  validatePositiveInteger('runs', opts.runs);
  validatePositiveInteger('concurrency', opts.concurrency);
  validatePositiveInteger('timeoutMs', opts.timeoutMs);
  if (existsSync(opts.outputDir) && readdirSync(opts.outputDir).length > 0) {
    throw new Error(
      `Prompt evaluation output directory is not empty: ${opts.outputDir}. Choose a fresh directory.`
    );
  }

  const promptTemplate = readFileSync(opts.promptFile, 'utf8');
  const promptVersion = parsePromptVersion(promptTemplate);
  const judgePromptTemplate = readFileSync(opts.judgePromptFile, 'utf8');
  const judgePromptVersion = parsePromptVersion(judgePromptTemplate);
  const fixtures = readFixtures(opts.fixturesDir);
  if (fixtures.length === 0) {
    throw new Error(`No session fixtures found in ${join(opts.fixturesDir, 'sessions')}.`);
  }

  const startedAt = deps.now();
  const runs: RunReport[] = [];
  for (let runIndex = 0; runIndex < opts.runs; runIndex += 1) {
    const runNumber = runIndex + 1;
    const runDir = join(opts.outputDir, `run-${String(runNumber).padStart(3, '0')}`);
    const resultsDir = join(runDir, 'results');
    const judgmentsDir = join(runDir, 'judgments');
    const logsDir = join(runDir, 'logs');
    const judgeLogsDir = join(runDir, 'judge-logs');
    const failures: FixtureFailure[] = [];

    await mapWithConcurrency(fixtures, opts.concurrency, async fixture => {
      deps.onProgress(`run ${runNumber}/${opts.runs}: ${fixture.id} (${opts.harnessId})`);
      const prompt = buildProposalPrompt(promptTemplate, fixture.transcript);
      try {
        const output = await deps.runHeadless(prompt, {
          fixtureId: fixture.id,
          logFile: join(logsDir, `${fixture.id}.jsonl`),
          timeoutMs: opts.timeoutMs,
        });
        atomicWriteJson(join(resultsDir, `${fixture.id}.json`), output);
        if (fixture.expectedPoints.length > 0) {
          if (output.practice.length === 0 && output.map.length === 0) {
            atomicWriteJson(join(judgmentsDir, `${fixture.id}.json`), { comparisons: [] });
            return;
          }
          try {
            const judgment = await runJudgeWithRetry(
              deps,
              buildJudgePrompt(judgePromptTemplate, fixture.expectedPoints, output),
              {
                fixtureId: fixture.id,
                judgeLogsDir,
                timeoutMs: opts.timeoutMs,
              }
            );
            atomicWriteJson(join(judgmentsDir, `${fixture.id}.json`), judgment);
          } catch (error) {
            failures.push({
              fixtureId: `${fixture.id} (judge)`,
              message: cleanError(error),
            });
          }
        }
      } catch (error) {
        failures.push({
          fixtureId: fixture.id,
          message: cleanError(error),
        });
      }
    });

    failures.sort((left, right) => plainSort(left.fixtureId, right.fixtureId));
    let score: string;
    try {
      score = deps.scoreResults(opts.fixturesDir, resultsDir, judgmentsDir).trimEnd();
    } catch (error) {
      score = `Scorer failed: ${cleanError(error)}`;
      failures.push({ fixtureId: '(scorer)', message: cleanError(error) });
    }
    runs.push({
      failures,
      runNumber,
      score,
      validJudgments: fixtures.filter(
        fixture =>
          fixture.expectedPoints.length > 0 &&
          !failures.some(
            failure =>
              failure.fixtureId === fixture.id || failure.fixtureId === `${fixture.id} (judge)`
          )
      ).length,
      validResults:
        fixtures.length -
        failures.filter(
          failure => failure.fixtureId !== '(scorer)' && !failure.fixtureId.endsWith(' (judge)')
        ).length,
    });
  }

  const report = renderEvaluationReport({
    concurrency: opts.concurrency,
    fixtureCount: fixtures.length,
    harnessId: opts.harnessId,
    judgeFixtureCount: fixtures.filter(fixture => fixture.expectedPoints.length > 0).length,
    judgePromptFile: opts.judgePromptLabel ?? opts.judgePromptFile,
    judgePromptVersion,
    modelLabel: opts.modelLabel,
    outputDir: opts.outputLabel ?? opts.outputDir,
    promptFile: opts.promptLabel ?? opts.promptFile,
    promptVersion,
    runCount: opts.runs,
    runs,
    startedAt,
    timeoutMs: opts.timeoutMs,
  });
  atomicWriteFile(join(opts.outputDir, 'REPORT.md'), report);
  const exitCode = runs.some(run => run.failures.length > 0) ? 1 : 0;
  return { exitCode, outputDir: opts.outputDir, report };
}

export async function runPromptEvalCommand(opts: PromptEvalCommandOptions): Promise<number> {
  if (!hasHarness(opts.harness)) {
    throw new Error(
      `Unsupported harness '${opts.harness}'. Supported: ${listHarnessIds().join(', ')}.`
    );
  }

  const root = findRepoRoot();
  const paths = repoPaths(root);
  const fixturesDir = resolve(root, opts.fixturesDir ?? 'tests/fixtures/prompt-eval');
  const promptFile = resolve(root, opts.promptFile ?? 'templates/prompts/proposal-extract.md');
  const judgePromptFile = resolve(
    root,
    opts.judgePromptFile ?? 'templates/prompts/prompt-eval-judge.md'
  );
  const runs = parsePositiveIntegerFlag('--runs', opts.runs, DEFAULT_RUNS);
  const concurrency = parsePositiveIntegerFlag(
    '--concurrency',
    opts.concurrency,
    DEFAULT_CONCURRENCY
  );
  const timeoutMs = parsePositiveIntegerFlag('--timeout-ms', opts.timeoutMs, DEFAULT_TIMEOUT_MS);

  if (!existsSync(promptFile)) {
    throw new Error(`Prompt template not found: ${promptFile}. Run npm run build first.`);
  }
  if (!existsSync(judgePromptFile)) {
    throw new Error(`Prompt evaluation judge template not found: ${judgePromptFile}.`);
  }
  if (!existsSync(join(fixturesDir, 'sessions'))) {
    throw new Error(`Prompt evaluation fixtures not found: ${fixturesDir}.`);
  }

  const adapter = getHarness(opts.harness);
  const doctorChecks = await adapter.doctorChecks(paths);
  const cliCheck = doctorChecks.find(check => /cli.*path/i.test(check.name));
  if (cliCheck && !cliCheck.result.ok) {
    throw new Error(`${adapter.id} harness is not runnable: ${cliCheck.result.detail}`);
  }
  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const harnessOpts = adapter.buildHarnessOpts(settings, 'proposal');
  const now = new Date();
  const outputDir = opts.outputDir
    ? resolve(root, opts.outputDir)
    : join(
        paths.stateDir,
        'prompt-eval',
        `${compactStamp(now)}-${adapter.id}-${randomUUID().slice(0, 8)}`
      );
  const scorer = join(root, 'scripts', 'prompt-eval', 'score.mjs');
  if (!existsSync(scorer)) {
    throw new Error(`Prompt evaluation scorer not found: ${scorer}.`);
  }

  const result = await runPromptEvaluation(
    {
      concurrency,
      fixturesDir,
      harnessId: adapter.id,
      judgePromptFile,
      judgePromptLabel: relative(root, judgePromptFile),
      modelLabel:
        Object.keys(harnessOpts).length > 0 ? JSON.stringify(harnessOpts) : 'harness default',
      outputDir,
      outputLabel: relative(root, outputDir),
      promptFile,
      promptLabel: relative(root, promptFile),
      runs,
      timeoutMs,
    },
    {
      now: () => now,
      onProgress: message => process.stderr.write(`[prompt-eval] ${message}\n`),
      runHeadless: (prompt, runOpts) =>
        adapter.runHeadless(prompt, '', ProposalOutputSchema, {
          harnessOpts,
          logFile: runOpts.logFile,
          role: `prompt-eval ${runOpts.fixtureId}`,
          timeoutMs: runOpts.timeoutMs,
        }),
      runJudge: (prompt, runOpts) =>
        adapter.runHeadless(prompt, '', PromptEvalJudgeOutputSchema, {
          harnessOpts,
          logFile: runOpts.logFile,
          role: `prompt-eval judge ${runOpts.fixtureId}`,
          timeoutMs: runOpts.timeoutMs,
        }),
      scoreResults: (fixturePath, resultsPath, judgmentsPath) =>
        execFileSync(process.execPath, [scorer, fixturePath, resultsPath, judgmentsPath], {
          encoding: 'utf8',
        }),
    }
  );

  process.stdout.write(result.report);
  process.stderr.write(`[prompt-eval] artifacts: ${result.outputDir}\n`);
  return result.exitCode;
}

function readFixtures(fixturesDir: string): Fixture[] {
  const sessionsDir = join(fixturesDir, 'sessions');
  return readdirSync(sessionsDir)
    .filter(name => name.endsWith('.md') && !name.startsWith('.'))
    .sort(plainSort)
    .map(name => ({
      expectedPoints: readExpectedPoints(
        join(fixturesDir, 'expected', `${basename(name, '.md')}.yaml`)
      ),
      id: basename(name, '.md'),
      transcript: matter(readFileSync(join(sessionsDir, name), 'utf8')).content.trim(),
    }));
}

function readExpectedPoints(file: string): ExpectedPoint[] {
  const value = yaml.load(readFileSync(file, 'utf8'));
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Array.isArray((value as Record<string, unknown>).expected_points)
  ) {
    throw new Error(`Invalid prompt evaluation sidecar: ${file}`);
  }
  return (value as { expected_points: ExpectedPoint[] }).expected_points;
}

function buildJudgePrompt(
  template: string,
  expectedPoints: ExpectedPoint[],
  output: ProposalOutput
): string {
  const proposals = [
    ...output.practice.map((proposal, index) => ({ id: `practice:${index}`, ...proposal })),
    ...output.map.map((proposal, index) => ({ id: `map:${index}`, ...proposal })),
  ];
  const input = JSON.stringify({ expected_points: expectedPoints, proposals }, null, 2);
  const inputPlaceholder = '[JUDGE INPUT PLACEHOLDER]';
  const schemaPlaceholder = '[JUDGE SCHEMA PLACEHOLDER]';
  // Derived from Zod so the contract the judge is shown can never drift from
  // the one `runJudge` validates against.
  const schema = JSON.stringify(
    zodToJsonSchema(PromptEvalJudgeOutputSchema, 'PromptEvalJudgeOutput'),
    null,
    2
  );
  const withSchema = template.includes(schemaPlaceholder)
    ? template.replace(schemaPlaceholder, schema)
    : template;
  return withSchema.includes(inputPlaceholder)
    ? withSchema.replace(inputPlaceholder, input)
    : `${withSchema.trimEnd()}\n\n${input}`;
}

async function runJudgeWithRetry(
  deps: PromptEvaluationDeps,
  prompt: string,
  input: { fixtureId: string; judgeLogsDir: string; timeoutMs: number }
): Promise<PromptEvalJudgeOutput> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt += 1) {
    // Keep every attempt's transcript; a retried failure is the interesting one.
    const suffix = attempt === 1 ? '' : `.retry-${attempt}`;
    try {
      return await deps.runJudge(prompt, {
        fixtureId: input.fixtureId,
        logFile: join(input.judgeLogsDir, `${input.fixtureId}${suffix}.jsonl`),
        timeoutMs: input.timeoutMs,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function mapWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const value = values[currentIndex];
      if (value !== undefined) await operation(value);
    }
  });
  await Promise.all(workers);
}

function parsePromptVersion(prompt: string): string {
  return prompt.match(/\bVersion:\s*([^\s<]+)/)?.[1] ?? 'unknown';
}

function cleanError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH);
}

function renderEvaluationReport(input: {
  concurrency: number;
  fixtureCount: number;
  harnessId: string;
  judgeFixtureCount: number;
  judgePromptFile: string;
  judgePromptVersion: string;
  modelLabel: string;
  outputDir: string;
  promptFile: string;
  promptVersion: string;
  runCount: number;
  runs: RunReport[];
  startedAt: Date;
  timeoutMs: number;
}): string {
  const lines = [
    '# Proposal extraction evaluation report',
    '',
    `- Started: ${input.startedAt.toISOString()}`,
    `- Harness: ${input.harnessId}`,
    `- Model options: ${input.modelLabel}`,
    `- Prompt: ${input.promptFile}`,
    `- Prompt version: ${input.promptVersion}`,
    `- Judge: ${input.judgePromptFile}`,
    `- Judge prompt version: ${input.judgePromptVersion}`,
    `- Fixtures: ${input.fixtureCount}`,
    `- Runs: ${input.runCount}`,
    `- Concurrency: ${input.concurrency}`,
    `- Timeout per fixture: ${input.timeoutMs}ms`,
    `- Artifacts: ${input.outputDir}`,
  ];

  for (const run of input.runs) {
    lines.push(
      '',
      `## Run ${run.runNumber}`,
      '',
      `Valid results: ${run.validResults}/${input.fixtureCount}`,
      `Valid judgments: ${run.validJudgments}/${input.judgeFixtureCount}`
    );
    if (run.failures.length > 0) {
      lines.push('', 'Harness or validation failures:');
      for (const failure of run.failures) {
        lines.push(`- ${failure.fixtureId}: ${failure.message}`);
      }
    }
    lines.push('', '```text', run.score, '```');
  }

  lines.push(
    '',
    'Scores are advisory. A nonzero process exit means the evaluator was incomplete, not that prompt quality missed a threshold.',
    ''
  );
  return lines.join('\n');
}

function parsePositiveIntegerFlag(
  name: string,
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

const plainSort = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
