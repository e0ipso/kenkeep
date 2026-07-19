import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { afterAll, describe, expect, it } from 'vitest';
import { readAllNodes, type NodeFile } from '../../src/lib/nodes.js';
import {
  buildPromptKnowledgeContext,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_NODES,
  rankNodes,
} from '../../src/lib/prompt-retrieval.js';

type Category = 'retrieval' | 'refusal' | 'multi-hop';
type GoldenCase = {
  id: string;
  category: Category;
  prompt: string;
  expect_ids_in_top_k?: string[];
  expect_empty?: true;
  expect_id_present_only_via_boost?: string;
};

type Corpus = {
  name: string;
  dir: string;
  nodesDir: string;
  nodes: NodeFile[];
  cases: GoldenCase[];
};

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'retrieval-eval'
);
const categories: Category[] = ['retrieval', 'refusal', 'multi-hop'];
const passed = new Map<Category, number>(categories.map(category => [category, 0]));
const passedNames: string[] = [];

// Every golden window is authored against the production default of 5. If the
// default drifts, this suite must fail loudly (see the guard test below) so the
// windows are re-authored rather than silently evaluating different behavior.
const TOP_K = 5;

function parseCases(file: string): GoldenCase[] {
  const value = yaml.load(readFileSync(file, 'utf8'));
  if (!value || typeof value !== 'object' || !Array.isArray((value as { cases?: unknown }).cases)) {
    throw new Error(`${file}: expected a top-level cases array`);
  }
  return (value as { cases: unknown[] }).cases.map((raw, index) => {
    const label =
      raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string'
        ? (raw as { id: string }).id
        : `case[${index}]`;
    if (!raw || typeof raw !== 'object') throw new Error(`${file}: ${label}: expected a record`);
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || candidate.id.length === 0)
      throw new Error(`${file}: ${label}: id must be a non-empty string`);
    if (!categories.includes(candidate.category as Category))
      throw new Error(`${file}: ${label}: invalid category`);
    if (typeof candidate.prompt !== 'string' || candidate.prompt.length === 0)
      throw new Error(`${file}: ${label}: prompt must be a non-empty string`);
    const expectationKeys = [
      'expect_ids_in_top_k',
      'expect_empty',
      'expect_id_present_only_via_boost',
    ].filter(key => candidate[key] !== undefined);
    if (expectationKeys.length !== 1)
      throw new Error(`${file}: ${label}: expected exactly one supported expectation`);
    if (
      candidate.expect_ids_in_top_k !== undefined &&
      (!Array.isArray(candidate.expect_ids_in_top_k) ||
        candidate.expect_ids_in_top_k.length === 0 ||
        candidate.expect_ids_in_top_k.length > TOP_K ||
        candidate.expect_ids_in_top_k.some(id => typeof id !== 'string'))
    )
      throw new Error(
        `${file}: ${label}: expect_ids_in_top_k must be a string array of 1 to ${TOP_K} ids`
      );
    if (candidate.expect_empty !== undefined && candidate.expect_empty !== true)
      throw new Error(`${file}: ${label}: expect_empty must be true`);
    if (
      candidate.expect_id_present_only_via_boost !== undefined &&
      typeof candidate.expect_id_present_only_via_boost !== 'string'
    )
      throw new Error(`${file}: ${label}: boost expectation must be an id`);
    return candidate as GoldenCase;
  });
}

function loadCorpus(name: string): Corpus {
  const dir = join(fixtureRoot, name);
  const nodesDir = join(dir, 'nodes');
  const nodes = readAllNodes(nodesDir);
  const cases = parseCases(join(dir, 'golden-queries.yaml'));
  const caseIds = new Set<string>();
  for (const golden of cases) {
    if (caseIds.has(golden.id)) throw new Error(`${name}: duplicate case id ${golden.id}`);
    caseIds.add(golden.id);
  }
  const nodeIds = new Set(nodes.map(node => node.frontmatter.kk_id));
  for (const golden of cases) {
    const expectedIds =
      golden.expect_ids_in_top_k ??
      (golden.expect_id_present_only_via_boost ? [golden.expect_id_present_only_via_boost] : []);
    for (const id of expectedIds) {
      if (!nodeIds.has(id)) throw new Error(`${name}: ${golden.id}: unknown expected kk_id ${id}`);
    }
  }
  return { name, dir, nodesDir, nodes, cases };
}

const corpora = ['drupal', 'synthetic'].map(loadCorpus);

function ids(nodes: NodeFile[], prompt: string, maxNodes = DEFAULT_MAX_NODES): string[] {
  return rankNodes(nodes, prompt, { maxNodes }).map(match => match.node.frontmatter.kk_id);
}

describe('golden prompt retrieval', () => {
  for (const corpus of corpora) {
    describe(corpus.name, () => {
      for (const golden of corpus.cases) {
        it(`${golden.category} / ${golden.id}`, () => {
          if (golden.expect_ids_in_top_k) {
            expect(ids(corpus.nodes, golden.prompt)).toEqual(
              expect.arrayContaining(golden.expect_ids_in_top_k)
            );
          } else if (golden.expect_empty) {
            expect(buildPromptKnowledgeContext(corpus.nodesDir, golden.prompt)).toBe('');
          } else {
            const target = golden.expect_id_present_only_via_boost!;
            expect(ids(corpus.nodes, golden.prompt)).toContain(target);
            const isolated = corpus.nodes.filter(node => node.frontmatter.kk_id === target);
            expect(ids(isolated, golden.prompt)).not.toContain(target);
          }
          passed.set(golden.category, (passed.get(golden.category) ?? 0) + 1);
          passedNames.push(`${corpus.name}/${golden.category}/${golden.id}`);
        });
      }
    });
  }

  const synthetic = () => corpora.find(corpus => corpus.name === 'synthetic')!;

  it('redirect-resolved edge boosts the redirected neighbor above its unlinked peer', () => {
    const quasar = ids(synthetic().nodes, 'quasar');
    expect(quasar.indexOf('practice-redirected-quasar-neighbor')).toBeLessThan(
      quasar.indexOf('practice-unlinked-quasar-peer')
    );
  });

  it('breaks equal-score ties by relates_to in-degree, then kk_id', () => {
    expect(ids(synthetic().nodes, 'symmetry').slice(0, 4)).toEqual([
      'practice-symmetry-central',
      'practice-symmetry-low',
      'practice-symmetry-alpha',
      'practice-symmetry-beta',
    ]);
  });

  it('never lets a boost-only node outrank a direct lexical match', () => {
    const cobalt = ids(synthetic().nodes, 'cobalt');
    expect(cobalt.indexOf('practice-direct-cobalt-match')).toBeLessThan(
      cobalt.indexOf('practice-opaque-companion')
    );
  });

  it('golden windows match the production default node cap', () => {
    expect(DEFAULT_MAX_NODES).toBe(TOP_K);
  });

  // The three equality pins below hold only at the exact shipped constants, so
  // ANY nonzero perturbation of a single ranking constant (either direction)
  // breaks at least one pinned tie and reorders a mirrored pair.

  it('pins TITLE_WEIGHT to TAG_WEIGHT plus BODY_WEIGHT in both tie directions', () => {
    // 6 = 5 + 1: both nodes tie, so order falls to kk_id. The mirrored pair
    // reverses which side owns the smaller id, catching drift either way.
    expect(ids(synthetic().nodes, 'argonite')).toEqual([
      'practice-argonite-heading',
      'practice-argonite-tagged',
    ]);
    expect(ids(synthetic().nodes, 'brenite')).toEqual([
      'practice-brenite-anchor',
      'practice-brenite-title',
    ]);
  });

  it('pins two SUMMARY_WEIGHT hits to one TITLE_WEIGHT hit in both tie directions', () => {
    // 3 + 3 = 6 over a two-term prompt, mirrored as above.
    expect(ids(synthetic().nodes, 'corvane duskel')).toEqual([
      'practice-corvane-double',
      'practice-corvane-heading',
    ]);
    expect(ids(synthetic().nodes, 'velune farrow')).toEqual([
      'practice-velune-heading',
      'practice-velune-paired',
    ]);
  });

  it('pins two GRAPH_NEIGHBOR_BOOST hits to one BODY_WEIGHT hit via an interleaved tie', () => {
    // 0.5 + 0.5 = 1: body-only and boost-only members tie and interleave by
    // kk_id; any boost or body drift splits the tie group into blocks.
    expect(ids(synthetic().nodes, 'flux', 10)).toEqual([
      'practice-flux-north',
      'practice-flux-south',
      'practice-flux-alpha',
      'practice-flux-bravo',
      'practice-flux-carol',
      'practice-flux-delta',
    ]);
  });

  it('truncates whole entries mid-list at the default char budget', () => {
    const rendered = buildPromptKnowledgeContext(synthetic().nodesDir, 'overflow');
    expect(rendered.length).toBeLessThanOrEqual(DEFAULT_MAX_CHARS + 1);
    expect(rendered).toContain('practice-overflow-alpha');
    // epsilon is inside the ranked top-5 but past the char budget; its absence
    // proves budget truncation rather than the maxNodes cap.
    expect(rendered).not.toContain('practice-overflow-epsilon');
  });
});

afterAll(() => {
  const summary = categories
    .map(
      category =>
        `${category} ${passed.get(category) ?? 0}/${corpora.reduce((sum, corpus) => sum + corpus.cases.filter(item => item.category === category).length, 0)}`
    )
    .join(' | ');
  process.stdout.write(`Golden retrieval cases passed: ${passedNames.join(', ')}\n`);
  process.stdout.write(`Golden retrieval summary: ${summary}\n`);
});
