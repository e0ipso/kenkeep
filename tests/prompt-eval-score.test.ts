import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';

type ExpectedPoint = {
  id: string;
  type: 'practice' | 'map';
  must_match_all?: string[];
  must_match_any?: string[][];
  must_not_match?: string[];
};

type Sidecar = {
  fixture_id: string;
  category: string;
  expect_empty: boolean;
  expected_points: ExpectedPoint[];
  max_unexpected_proposals: number;
  notes: string;
};

const scoreScript = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'prompt-eval',
  'score.mjs'
);
const temporaryDirectories: string[] = [];

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'practice',
    tags: ['cache'],
    title: 'Invalidate cache tags',
    description: 'How cache invalidation works.',
    body: 'Use custom invalidation for every cache tag update.',
    kk_confidence: 'high',
    ...overrides,
  };
}

function runScenario(sidecarOverrides: Partial<Sidecar>, result: unknown | undefined): string {
  const root = mkdtempSync(join(tmpdir(), 'kenkeep-prompt-eval-'));
  temporaryDirectories.push(root);
  const fixturesDir = join(root, 'fixtures');
  const expectedDir = join(fixturesDir, 'expected');
  const resultsDir = join(root, 'results');
  mkdirSync(expectedDir, { recursive: true });
  mkdirSync(resultsDir, { recursive: true });

  const sidecar: Sidecar = {
    fixture_id: 'fixture-01',
    category: 'admit-convention',
    expect_empty: false,
    expected_points: [],
    max_unexpected_proposals: 0,
    notes: 'Tiny scorer fixture.',
    ...sidecarOverrides,
  };
  writeFileSync(join(expectedDir, `${sidecar.fixture_id}.yaml`), yaml.dump(sidecar));
  if (result !== undefined) {
    writeFileSync(join(resultsDir, `${sidecar.fixture_id}.json`), JSON.stringify(result));
  }

  return execFileSync(process.execPath, [scoreScript, fixturesDir, resultsDir], {
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('prompt eval scorer', () => {
  it('passes a matched expected point', () => {
    const output = runScenario(
      {
        expected_points: [
          {
            id: 'cache-tags',
            type: 'practice',
            must_match_all: ['cache tag', 'custom invalidation'],
            must_not_match: ['plan 12'],
          },
        ],
      },
      { practice: [proposal()], map: [] }
    );

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('admit-convention: 1/1');
    expect(output).toContain('Expected-point recall: 1/1');
    expect(output).toContain('Phantom count: 0');
  });

  it('ignores punctuation differences when matching expected points', () => {
    const output = runScenario(
      {
        expected_points: [
          {
            id: 'cache-tags',
            type: 'practice',
            must_match_all: ['cache-tag', 'custom invalidation'],
          },
        ],
      },
      {
        practice: [
          proposal({
            title: 'Invalidate cache tags',
            body: 'Use custom invalidation for every cache_tag update.',
          }),
        ],
        map: [],
      }
    );

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('Expected-point recall: 1/1');
  });

  it('accepts any complete alternative substring set', () => {
    const output = runScenario(
      {
        expected_points: [
          {
            id: 'cache-tags',
            type: 'practice',
            must_match_any: [
              ['cache tags', 'invalidate them'],
              ['cache tag', 'custom invalidation'],
            ],
          },
        ],
      },
      { practice: [proposal()], map: [] }
    );

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('Expected-point recall: 1/1');
  });

  it('requires every substring in one alternative set', () => {
    const output = runScenario(
      {
        expected_points: [
          {
            id: 'cache-tags',
            type: 'practice',
            must_match_any: [
              ['cache tags', 'invalidate them'],
              ['custom invalidation', 'revision token'],
            ],
          },
        ],
      },
      { practice: [proposal()], map: [] }
    );

    expect(output).toContain('FAIL fixture-01: missed expected point "cache-tags"');
  });

  it('reports a missed expected point', () => {
    const output = runScenario(
      {
        expected_points: [
          {
            id: 'cache-tags',
            type: 'practice',
            must_match_all: ['cache tag'],
          },
        ],
      },
      { practice: [], map: [] }
    );

    expect(output).toContain('FAIL fixture-01: missed expected point "cache-tags"');
    expect(output).toContain('Expected-point recall: 0/1');
  });

  it('reports a phantom over budget', () => {
    const output = runScenario({}, { practice: [proposal()], map: [] });

    expect(output).toContain('FAIL fixture-01: phantom over budget (1 > 0)');
    expect(output).toContain('Phantom count: 1');
  });

  it('reports a non-empty result where empty was expected', () => {
    const output = runScenario(
      {
        category: 'reject-meta-only',
        expect_empty: true,
        max_unexpected_proposals: 1,
      },
      { practice: [proposal()], map: [] }
    );

    expect(output).toContain('FAIL fixture-01: non-empty where empty expected');
    expect(output).toContain('Gate accuracy: 0/1');
  });

  it('reports a missing result file', () => {
    const output = runScenario({}, undefined);

    expect(output).toContain('FAIL fixture-01: result file missing');
  });

  it('reports a schema-invalid result', () => {
    const output = runScenario({}, { practice: [], map: 'invalid' });

    expect(output).toContain('FAIL fixture-01: result schema-invalid');
  });
});
