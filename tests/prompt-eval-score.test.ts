import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';

type ExpectedPoint = {
  id: string;
  preferred_type: 'practice' | 'map';
  claim: string;
  required_facets: Array<{ id: string; criterion: string }>;
  forbidden_substrings?: string[];
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

function point(overrides: Partial<ExpectedPoint> = {}): ExpectedPoint {
  return {
    id: 'cache-tags',
    preferred_type: 'practice',
    claim: 'Cache tags use custom invalidation.',
    required_facets: [{ id: 'custom', criterion: 'Cache tags use the custom invalidation path.' }],
    ...overrides,
  };
}

function judgment(
  expectedPointId = 'cache-tags',
  proposalId = 'practice:0',
  verdict: 'entailed' | 'not_entailed' | 'contradicted' = 'entailed',
  evidence: string | null = 'custom invalidation'
): Record<string, unknown> {
  return {
    comparisons: [
      {
        expected_point_id: expectedPointId,
        proposal_id: proposalId,
        facets: [{ facet_id: 'custom', verdict, evidence }],
      },
    ],
  };
}

function runScenario(
  sidecarOverrides: Partial<Sidecar>,
  result: unknown | undefined,
  judgeResult?: unknown
): string {
  const root = mkdtempSync(join(tmpdir(), 'kenkeep-prompt-eval-'));
  temporaryDirectories.push(root);
  const fixturesDir = join(root, 'fixtures');
  const expectedDir = join(fixturesDir, 'expected');
  const resultsDir = join(root, 'results');
  const judgmentsDir = join(root, 'judgments');
  mkdirSync(expectedDir, { recursive: true });
  mkdirSync(resultsDir, { recursive: true });
  mkdirSync(judgmentsDir, { recursive: true });

  const sidecar: Sidecar = {
    fixture_id: 'fixture-01',
    category: 'admit-convention',
    expect_empty: false,
    expected_points: [point()],
    max_unexpected_proposals: 0,
    notes: 'Tiny scorer fixture.',
    ...sidecarOverrides,
  };
  writeFileSync(join(expectedDir, `${sidecar.fixture_id}.yaml`), yaml.dump(sidecar));
  if (result !== undefined) {
    writeFileSync(join(resultsDir, `${sidecar.fixture_id}.json`), JSON.stringify(result));
  }
  if (judgeResult !== undefined) {
    writeFileSync(join(judgmentsDir, `${sidecar.fixture_id}.json`), JSON.stringify(judgeResult));
  }

  return execFileSync(process.execPath, [scoreScript, fixturesDir, resultsDir, judgmentsDir], {
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('prompt eval semantic scorer', () => {
  it('passes a fully entailed expected point', () => {
    const output = runScenario({}, { practice: [proposal()], map: [] }, judgment());

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('Expected-point recall: 1/1');
    expect(output).toContain('Phantom count: 0');
  });

  it('reports a semantically incomplete point', () => {
    const output = runScenario(
      {},
      { practice: [proposal()], map: [] },
      judgment('cache-tags', 'practice:0', 'not_entailed', null)
    );

    expect(output).toContain('missed expected point "cache-tags"');
    expect(output).toContain('Expected-point recall: 0/1');
    expect(output).toContain('Phantom count: 1');
  });

  it('rejects evidence that is not present in the proposal', () => {
    const output = runScenario(
      {},
      { practice: [proposal()], map: [] },
      judgment('cache-tags', 'practice:0', 'entailed', 'invented evidence')
    );

    expect(output).toContain('FAIL fixture-01: judgment evidence-invalid');
  });

  it('requires complete pair and facet coverage', () => {
    const output = runScenario({}, { practice: [proposal()], map: [] }, { comparisons: [] });

    expect(output).toContain('FAIL fixture-01: judgment coverage-invalid');
  });

  it('treats kind as advisory', () => {
    const output = runScenario(
      { expected_points: [point({ preferred_type: 'map' })] },
      { practice: [proposal()], map: [] },
      judgment()
    );

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('Kind mismatches (advisory): 1');
  });

  it('counts duplicate proposals as phantoms', () => {
    const output = runScenario(
      {},
      { practice: [proposal(), proposal()], map: [] },
      {
        comparisons: [
          ...((judgment().comparisons as unknown[]) ?? []),
          {
            expected_point_id: 'cache-tags',
            proposal_id: 'practice:1',
            facets: [{ facet_id: 'custom', verdict: 'entailed', evidence: 'custom invalidation' }],
          },
        ],
      }
    );

    expect(output).toContain('Expected-point recall: 1/1');
    expect(output).toContain('phantom over budget (1 > 0)');
    expect(output).toContain('Near misses (advisory): 0');
  });

  it('treats a proposal that partially covers a missed point as a near miss, not a phantom', () => {
    const twoFacet = point({
      required_facets: [
        { id: 'custom', criterion: 'Cache tags use the custom invalidation path.' },
        { id: 'scope', criterion: 'The rule applies to every cache tag update.' },
      ],
    });
    const output = runScenario(
      { expected_points: [twoFacet] },
      { practice: [proposal()], map: [] },
      {
        comparisons: [
          {
            expected_point_id: 'cache-tags',
            proposal_id: 'practice:0',
            facets: [
              { facet_id: 'custom', verdict: 'entailed', evidence: 'custom invalidation' },
              { facet_id: 'scope', verdict: 'not_entailed', evidence: null },
            ],
          },
        ],
      }
    );

    // The shortfall is already charged as the missed point; charging it again as
    // an unexpected proposal would double-penalize one underlying failure.
    expect(output).toContain('missed expected point "cache-tags"');
    expect(output).toContain('Phantom count: 0');
    expect(output).toContain('Near misses (advisory): 1');
    expect(output).not.toContain('phantom over budget');
  });

  it('counts a proposal that entails nothing anywhere as a phantom', () => {
    const output = runScenario(
      {},
      { practice: [proposal(), proposal({ title: 'Unrelated node' })], map: [] },
      {
        comparisons: [
          ...((judgment().comparisons as unknown[]) ?? []),
          {
            expected_point_id: 'cache-tags',
            proposal_id: 'practice:1',
            facets: [{ facet_id: 'custom', verdict: 'not_entailed', evidence: null }],
          },
        ],
      }
    );

    expect(output).toContain('Expected-point recall: 1/1');
    expect(output).toContain('phantom over budget (1 > 0)');
    expect(output).toContain('Near misses (advisory): 0');
  });

  it('does not let one proposal satisfy two atomic points', () => {
    const second = point({ id: 'cache-policy' });
    const output = runScenario(
      { expected_points: [point(), second] },
      { practice: [proposal()], map: [] },
      {
        comparisons: [
          ...((judgment().comparisons as unknown[]) ?? []),
          {
            expected_point_id: 'cache-policy',
            proposal_id: 'practice:0',
            facets: [{ facet_id: 'custom', verdict: 'entailed', evidence: 'custom invalidation' }],
          },
        ],
      }
    );

    expect(output).toContain('Expected-point recall: 1/2');
  });

  it('fails when forbidden story text leaks into a proposal', () => {
    const output = runScenario(
      { expected_points: [point({ forbidden_substrings: ['ticket-12'] })] },
      {
        practice: [proposal({ body: 'Ticket-12 uses custom invalidation.' })],
        map: [],
      },
      judgment()
    );

    expect(output).toContain('forbidden content for "cache-tags"');
  });

  it('scores empty reject fixtures without a judge artifact', () => {
    const output = runScenario(
      {
        category: 'reject-meta-only',
        expect_empty: true,
        expected_points: [],
      },
      { practice: [], map: [] }
    );

    expect(output).toContain('PASS fixture-01');
    expect(output).toContain('Gate accuracy: 1/1');
  });

  it('reports missing generation and judgment artifacts', () => {
    expect(runScenario({}, undefined)).toContain('result file missing');
    expect(runScenario({}, { practice: [proposal()], map: [] })).toContain('judgment file missing');
  });
});
