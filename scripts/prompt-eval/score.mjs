import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import yaml from 'js-yaml';

const plainSort = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const candidateKeys = ['body', 'description', 'kk_confidence', 'tags', 'title', 'type'];
const outputKeys = ['map', 'practice'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).sort(plainSort).join('\n') === [...keys].sort(plainSort).join('\n')
  );
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isFacet(value) {
  return (
    hasExactKeys(value, ['criterion', 'id']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.criterion)
  );
}

function isExpectedPoint(value) {
  if (!isRecord(value)) return false;
  const allowedKeys = ['claim', 'forbidden_substrings', 'id', 'preferred_type', 'required_facets'];
  return (
    Object.keys(value).every(key => allowedKeys.includes(key)) &&
    isNonEmptyString(value.id) &&
    (value.preferred_type === 'practice' || value.preferred_type === 'map') &&
    isNonEmptyString(value.claim) &&
    Array.isArray(value.required_facets) &&
    value.required_facets.length > 0 &&
    value.required_facets.every(isFacet) &&
    new Set(value.required_facets.map(facet => facet.id)).size === value.required_facets.length &&
    (value.forbidden_substrings === undefined ||
      (Array.isArray(value.forbidden_substrings) &&
        value.forbidden_substrings.every(isNonEmptyString)))
  );
}

function isSidecar(value) {
  if (!isRecord(value)) return false;
  const allowedKeys = [
    'category',
    'expect_empty',
    'expected_points',
    'fixture_id',
    'max_unexpected_proposals',
    'notes',
  ];
  return (
    Object.keys(value).every(key => allowedKeys.includes(key)) &&
    isNonEmptyString(value.fixture_id) &&
    isNonEmptyString(value.category) &&
    typeof value.expect_empty === 'boolean' &&
    Array.isArray(value.expected_points) &&
    value.expected_points.every(isExpectedPoint) &&
    value.expect_empty === (value.expected_points.length === 0) &&
    Number.isInteger(value.max_unexpected_proposals) &&
    value.max_unexpected_proposals >= 0 &&
    typeof value.notes === 'string'
  );
}

function isProposalCandidate(value) {
  return (
    hasExactKeys(value, candidateKeys) &&
    (value.type === 'practice' || value.type === 'map') &&
    Array.isArray(value.tags) &&
    value.tags.every(tag => typeof tag === 'string') &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.body === 'string' &&
    (value.kk_confidence === 'low' ||
      value.kk_confidence === 'medium' ||
      value.kk_confidence === 'high')
  );
}

function isProposalOutput(value) {
  return (
    hasExactKeys(value, outputKeys) &&
    Array.isArray(value.practice) &&
    Array.isArray(value.map) &&
    value.practice.every(isProposalCandidate) &&
    value.map.every(isProposalCandidate)
  );
}

function readSidecars(fixturesDir) {
  const expectedDir = join(fixturesDir, 'expected');
  return readdirSync(expectedDir)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map(file => {
      const fallbackId = basename(file, file.endsWith('.yaml') ? '.yaml' : '.yml');
      try {
        const value = yaml.load(readFileSync(join(expectedDir, file), 'utf8'));
        if (!isSidecar(value)) {
          return {
            fixtureId:
              isRecord(value) && isNonEmptyString(value.fixture_id) ? value.fixture_id : fallbackId,
            category:
              isRecord(value) && isNonEmptyString(value.category) ? value.category : 'unknown',
            sidecar: undefined,
          };
        }
        return { fixtureId: value.fixture_id, category: value.category, sidecar: value };
      } catch {
        return { fixtureId: fallbackId, category: 'unknown', sidecar: undefined };
      }
    })
    .sort((left, right) => plainSort(left.fixtureId, right.fixtureId));
}

function readResult(resultsDir, fixtureId) {
  const resultFile = join(resultsDir, `${fixtureId}.json`);
  if (!existsSync(resultFile)) return { error: 'result file missing' };
  try {
    const value = JSON.parse(readFileSync(resultFile, 'utf8'));
    return isProposalOutput(value) ? { value } : { error: 'result schema-invalid' };
  } catch {
    return { error: 'result schema-invalid' };
  }
}

function normalizeForEvidence(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function flattenProposals(value) {
  return [
    ...value.practice.map((proposal, index) => ({ id: `practice:${index}`, ...proposal })),
    ...value.map.map((proposal, index) => ({ id: `map:${index}`, ...proposal })),
  ];
}

function readJudgments(judgmentsDir, fixtureId, points, proposals) {
  const judgmentFile = join(judgmentsDir, `${fixtureId}.json`);
  if (!existsSync(judgmentFile)) return { error: 'judgment file missing' };

  let value;
  try {
    value = JSON.parse(readFileSync(judgmentFile, 'utf8'));
  } catch {
    return { error: 'judgment schema-invalid' };
  }
  if (!hasExactKeys(value, ['comparisons']) || !Array.isArray(value.comparisons)) {
    return { error: 'judgment schema-invalid' };
  }

  const expectedPairs = new Set();
  for (const point of points) {
    for (const proposal of proposals) expectedPairs.add(`${point.id}\n${proposal.id}`);
  }
  const observedPairs = new Set();
  const fullMatches = [];
  // Comparisons where the proposal entailed some but not all of a point's
  // facets. An unassigned proposal that partially covered a point the fixture
  // went on to miss is a near miss, not an unexpected proposal.
  const partialMatches = [];

  for (const comparison of value.comparisons) {
    if (
      !hasExactKeys(comparison, ['expected_point_id', 'facets', 'proposal_id']) ||
      !isNonEmptyString(comparison.expected_point_id) ||
      !isNonEmptyString(comparison.proposal_id) ||
      !Array.isArray(comparison.facets)
    ) {
      return { error: 'judgment schema-invalid' };
    }
    const pairKey = `${comparison.expected_point_id}\n${comparison.proposal_id}`;
    if (!expectedPairs.has(pairKey) || observedPairs.has(pairKey)) {
      return { error: 'judgment coverage-invalid' };
    }
    observedPairs.add(pairKey);

    const pointIndex = points.findIndex(point => point.id === comparison.expected_point_id);
    const proposalIndex = proposals.findIndex(proposal => proposal.id === comparison.proposal_id);
    const point = points[pointIndex];
    const proposal = proposals[proposalIndex];
    const expectedFacetIds = new Set(point.required_facets.map(facet => facet.id));
    const observedFacetIds = new Set();
    let full = true;
    let entailedCount = 0;
    const proposalText = normalizeForEvidence(
      `${proposal.title}\n${proposal.description}\n${proposal.body}`
    );

    for (const facet of comparison.facets) {
      if (
        !hasExactKeys(facet, ['evidence', 'facet_id', 'verdict']) ||
        !expectedFacetIds.has(facet.facet_id) ||
        observedFacetIds.has(facet.facet_id) ||
        !['entailed', 'not_entailed', 'contradicted'].includes(facet.verdict) ||
        !(facet.evidence === null || isNonEmptyString(facet.evidence))
      ) {
        return { error: 'judgment schema-invalid' };
      }
      observedFacetIds.add(facet.facet_id);
      if (facet.verdict !== 'entailed') full = false;
      if (facet.verdict === 'entailed') entailedCount += 1;
      if (facet.verdict === 'not_entailed' && facet.evidence !== null) {
        return { error: 'judgment evidence-invalid' };
      }
      if (facet.verdict !== 'not_entailed') {
        if (
          facet.evidence === null ||
          !proposalText.includes(normalizeForEvidence(facet.evidence))
        ) {
          return { error: 'judgment evidence-invalid' };
        }
      }
    }
    if (
      observedFacetIds.size !== expectedFacetIds.size ||
      [...expectedFacetIds].some(id => !observedFacetIds.has(id))
    ) {
      return { error: 'judgment coverage-invalid' };
    }
    if (full) fullMatches.push({ pointIndex, proposalIndex });
    else if (entailedCount > 0) partialMatches.push({ pointIndex, proposalIndex });
  }

  if (
    observedPairs.size !== expectedPairs.size ||
    [...expectedPairs].some(pair => !observedPairs.has(pair))
  ) {
    return { error: 'judgment coverage-invalid' };
  }
  return { fullMatches, partialMatches };
}

function addFlowEdge(graph, from, to, capacity, cost) {
  const forward = { to, reverse: graph[to].length, capacity, cost };
  const reverse = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

function assignExpectedPoints(points, proposals, eligibleMatches) {
  const source = 0;
  const pointOffset = 1;
  const proposalOffset = pointOffset + points.length;
  const sink = proposalOffset + proposals.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const matchEdges = [];

  for (const pointIndex of points.keys()) {
    addFlowEdge(graph, source, pointOffset + pointIndex, 1, 0);
  }
  for (const { pointIndex, proposalIndex } of eligibleMatches) {
    const edge = addFlowEdge(
      graph,
      pointOffset + pointIndex,
      proposalOffset + proposalIndex,
      1,
      proposals[proposalIndex].type === points[pointIndex].preferred_type ? 0 : 1
    );
    matchEdges.push({ pointIndex, proposalIndex, edge });
  }
  for (const proposalIndex of proposals.keys()) {
    addFlowEdge(graph, proposalOffset + proposalIndex, sink, 1, 0);
  }

  while (true) {
    const distance = Array(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array(graph.length).fill(-1);
    const previousEdge = Array(graph.length).fill(-1);
    distance[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass += 1) {
      let changed = false;
      for (const [node, edges] of graph.entries()) {
        if (!Number.isFinite(distance[node])) continue;
        for (const [edgeIndex, edge] of edges.entries()) {
          if (edge.capacity === 0 || distance[node] + edge.cost >= distance[edge.to]) continue;
          distance[edge.to] = distance[node] + edge.cost;
          previousNode[edge.to] = node;
          previousEdge[edge.to] = edgeIndex;
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (previousNode[sink] === -1) break;
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }
  }

  return matchEdges
    .filter(match => match.edge.capacity === 0)
    .sort((left, right) => left.pointIndex - right.pointIndex);
}

function emptyScore(entry, expectedTotal, gateTotal, reason) {
  return {
    ...entry,
    passed: false,
    reasons: [reason],
    expectedMatched: 0,
    expectedTotal,
    phantomCount: 0,
    nearMissCount: 0,
    gateCorrect: false,
    gateTotal,
    kindMismatches: [],
  };
}

function scoreFixture(entry, resultsDir, judgmentsDir) {
  if (!entry.sidecar) return emptyScore(entry, 0, 0, 'sidecar schema-invalid');

  const points = entry.sidecar.expected_points;
  const expectedTotal = points.length;
  const gateTotal = entry.sidecar.expect_empty ? 1 : 0;
  const result = readResult(resultsDir, entry.fixtureId);
  if (result.error) return emptyScore(entry, expectedTotal, gateTotal, result.error);

  const proposals = flattenProposals(result.value);
  let eligibleMatches = [];
  let partialMatches = [];
  if (points.length > 0) {
    const judgments = readJudgments(judgmentsDir, entry.fixtureId, points, proposals);
    if (judgments.error) return emptyScore(entry, expectedTotal, gateTotal, judgments.error);
    eligibleMatches = judgments.fullMatches;
    partialMatches = judgments.partialMatches;
  }

  const leakedPointIds = new Set();
  for (const [pointIndex, point] of points.entries()) {
    const proposalText = proposals.map(proposal =>
      normalizeForEvidence(`${proposal.title}\n${proposal.description}\n${proposal.body}`)
    );
    if (
      (point.forbidden_substrings ?? []).some(term =>
        proposalText.some(text => text.includes(normalizeForEvidence(term)))
      )
    ) {
      leakedPointIds.add(point.id);
      eligibleMatches = eligibleMatches.filter(match => match.pointIndex !== pointIndex);
    }
  }

  const assignments = assignExpectedPoints(points, proposals, eligibleMatches);
  const assignedPointIndexes = new Set(assignments.map(assignment => assignment.pointIndex));
  const assignedProposalIndexes = new Set(assignments.map(assignment => assignment.proposalIndex));
  const missedPoints = points.filter((_point, index) => !assignedPointIndexes.has(index));
  const kindMismatches = assignments
    .filter(
      assignment =>
        points[assignment.pointIndex].preferred_type !== proposals[assignment.proposalIndex].type
    )
    .map(assignment => ({
      id: points[assignment.pointIndex].id,
      expected: points[assignment.pointIndex].preferred_type,
      actual: proposals[assignment.proposalIndex].type,
    }));

  // An unassigned proposal that partially covered a point the fixture went on
  // to miss is a near miss: the shortfall is already charged as that missed
  // point, so counting it again as an unexpected proposal double-penalizes one
  // underlying failure. Everything else unassigned is unexpected, including a
  // duplicate that fully matched an already-satisfied point.
  const missedPointIndexes = new Set(
    points.map((_point, index) => index).filter(index => !assignedPointIndexes.has(index))
  );
  const nearMissProposalIndexes = new Set(
    partialMatches
      .filter(match => missedPointIndexes.has(match.pointIndex))
      .map(match => match.proposalIndex)
      .filter(index => !assignedProposalIndexes.has(index))
  );
  const unassignedCount = proposals.length - assignedProposalIndexes.size;
  const nearMissCount = nearMissProposalIndexes.size;
  const phantomCount = unassignedCount - nearMissCount;
  const reasons = missedPoints.map(point => `missed expected point "${point.id}"`);
  for (const id of leakedPointIds) reasons.push(`forbidden content for "${id}"`);
  if (entry.sidecar.expect_empty && proposals.length > 0) {
    reasons.push('non-empty where empty expected');
  }
  if (phantomCount > entry.sidecar.max_unexpected_proposals) {
    reasons.push(
      `phantom over budget (${phantomCount} > ${entry.sidecar.max_unexpected_proposals})`
    );
  }

  return {
    ...entry,
    passed: reasons.length === 0,
    reasons,
    expectedMatched: expectedTotal - missedPoints.length,
    expectedTotal,
    phantomCount,
    nearMissCount,
    gateCorrect: entry.sidecar.expect_empty && proposals.length === 0,
    gateTotal,
    kindMismatches,
  };
}

function renderReport(scores) {
  const categoryTotals = new Map();
  let expectedMatched = 0;
  let expectedTotal = 0;
  let phantomCount = 0;
  let nearMissCount = 0;
  let gatesCorrect = 0;
  let gatesTotal = 0;
  let kindMismatchCount = 0;

  for (const score of scores) {
    const current = categoryTotals.get(score.category) ?? { passed: 0, total: 0 };
    current.total += 1;
    if (score.passed) current.passed += 1;
    categoryTotals.set(score.category, current);
    expectedMatched += score.expectedMatched;
    expectedTotal += score.expectedTotal;
    phantomCount += score.phantomCount;
    nearMissCount += score.nearMissCount;
    gatesCorrect += score.gateCorrect ? 1 : 0;
    gatesTotal += score.gateTotal;
    kindMismatchCount += score.kindMismatches.length;
  }

  const lines = ['Prompt eval score', '', 'Fixtures:'];
  for (const score of scores) {
    lines.push(
      score.passed
        ? `PASS ${score.fixtureId}`
        : `FAIL ${score.fixtureId}: ${score.reasons.join('; ')}`
    );
  }
  lines.push('', 'Categories:');
  for (const category of [...categoryTotals.keys()].sort(plainSort)) {
    const total = categoryTotals.get(category);
    lines.push(`${category}: ${total.passed}/${total.total}`);
  }
  lines.push(
    '',
    'Aggregate:',
    `Expected-point recall: ${expectedMatched}/${expectedTotal}`,
    `Phantom count: ${phantomCount}`,
    `Near misses (advisory): ${nearMissCount}`,
    `Gate accuracy: ${gatesCorrect}/${gatesTotal}`,
    `Kind mismatches (advisory): ${kindMismatchCount}`
  );
  const kindMismatches = scores.flatMap(score =>
    score.kindMismatches.map(
      mismatch =>
        `${score.fixtureId} "${mismatch.id}": expected ${mismatch.expected}, got ${mismatch.actual}`
    )
  );
  if (kindMismatches.length > 0) {
    lines.push('', 'Kind diagnostics:', ...kindMismatches);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const [fixturesDir, resultsDir, judgmentsDir] = process.argv.slice(2);
  if (!fixturesDir || !resultsDir || !judgmentsDir) {
    process.stdout.write(
      'Usage: node scripts/prompt-eval/score.mjs <fixtures-dir> <results-dir> <judgments-dir>\n'
    );
    return;
  }
  try {
    const scores = readSidecars(fixturesDir).map(entry =>
      scoreFixture(entry, resultsDir, judgmentsDir)
    );
    process.stdout.write(renderReport(scores));
  } catch {
    process.stdout.write('Scorer error: unable to read prompt-eval artifacts\n');
  }
}

main();
