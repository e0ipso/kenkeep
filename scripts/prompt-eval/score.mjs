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

function isLowercaseSubstringList(value, allowEmpty = false) {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every(
      item =>
        isNonEmptyString(item) && item === item.toLowerCase() && normalizeForMatch(item).length > 0
    )
  );
}

function isLowercaseSubstringAlternatives(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(alternative => isLowercaseSubstringList(alternative))
  );
}

function isExpectedPoint(value) {
  if (!isRecord(value)) return false;
  const allowedKeys = ['id', 'must_match_all', 'must_match_any', 'must_not_match', 'type'];
  if (Object.keys(value).some(key => !allowedKeys.includes(key))) return false;
  const hasMatchAll = value.must_match_all !== undefined;
  const hasMatchAny = value.must_match_any !== undefined;
  return (
    isNonEmptyString(value.id) &&
    (value.type === 'practice' || value.type === 'map') &&
    hasMatchAll !== hasMatchAny &&
    (hasMatchAll
      ? isLowercaseSubstringList(value.must_match_all)
      : isLowercaseSubstringAlternatives(value.must_match_any)) &&
    (value.must_not_match === undefined || isLowercaseSubstringList(value.must_not_match, true))
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
  if (Object.keys(value).some(key => !allowedKeys.includes(key))) return false;
  return (
    isNonEmptyString(value.fixture_id) &&
    isNonEmptyString(value.category) &&
    typeof value.expect_empty === 'boolean' &&
    Array.isArray(value.expected_points) &&
    value.expected_points.every(isExpectedPoint) &&
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

function normalizeForMatch(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreFixture(entry, resultsDir) {
  if (!entry.sidecar) {
    return {
      ...entry,
      passed: false,
      reasons: ['sidecar schema-invalid'],
      expectedMatched: 0,
      expectedTotal: 0,
      phantomCount: 0,
      gateCorrect: false,
      gateTotal: 0,
    };
  }

  const expectedTotal = entry.sidecar.expected_points.length;
  const gateTotal = entry.sidecar.expect_empty ? 1 : 0;
  const result = readResult(resultsDir, entry.fixtureId);
  if (result.error) {
    return {
      ...entry,
      passed: false,
      reasons: [result.error],
      expectedMatched: 0,
      expectedTotal,
      phantomCount: 0,
      gateCorrect: false,
      gateTotal,
    };
  }

  const proposals = [...result.value.practice, ...result.value.map];
  const proposalText = proposals.map(proposal =>
    normalizeForMatch(`${proposal.title}\n${proposal.body}`)
  );
  const expectedProposalIndexes = new Set();
  const missedPoints = [];

  for (const point of entry.sidecar.expected_points) {
    const forbidden = (point.must_not_match ?? []).map(normalizeForMatch);
    const alternatives = (point.must_match_any ?? [point.must_match_all]).map(terms =>
      terms.map(normalizeForMatch)
    );
    const hasForbiddenText = forbidden.some(term => proposalText.some(text => text.includes(term)));
    const matchingIndexes = [];
    if (!hasForbiddenText) {
      proposals.forEach((proposal, index) => {
        if (
          proposal.type === point.type &&
          alternatives.some(terms => terms.every(term => proposalText[index].includes(term)))
        ) {
          matchingIndexes.push(index);
        }
      });
    }
    if (matchingIndexes.length === 0) {
      missedPoints.push(point.id);
    } else {
      for (const index of matchingIndexes) expectedProposalIndexes.add(index);
    }
  }

  const phantomCount = proposals.length - expectedProposalIndexes.size;
  const reasons = missedPoints.map(id => `missed expected point "${id}"`);
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
    gateCorrect: entry.sidecar.expect_empty && proposals.length === 0,
    gateTotal,
  };
}

function renderReport(scores) {
  const categoryTotals = new Map();
  let expectedMatched = 0;
  let expectedTotal = 0;
  let phantomCount = 0;
  let gatesCorrect = 0;
  let gatesTotal = 0;

  for (const score of scores) {
    const current = categoryTotals.get(score.category) ?? { passed: 0, total: 0 };
    current.total += 1;
    if (score.passed) current.passed += 1;
    categoryTotals.set(score.category, current);
    expectedMatched += score.expectedMatched;
    expectedTotal += score.expectedTotal;
    phantomCount += score.phantomCount;
    gatesCorrect += score.gateCorrect ? 1 : 0;
    gatesTotal += score.gateTotal;
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
    `Gate accuracy: ${gatesCorrect}/${gatesTotal}`
  );
  return `${lines.join('\n')}\n`;
}

function main() {
  const [fixturesDir, resultsDir] = process.argv.slice(2);
  if (!fixturesDir || !resultsDir) {
    process.stdout.write(
      'Usage: node scripts/prompt-eval/score.mjs <fixtures-dir> <results-dir>\n'
    );
    return;
  }
  try {
    const scores = readSidecars(fixturesDir).map(entry => scoreFixture(entry, resultsDir));
    process.stdout.write(renderReport(scores));
  } catch {
    process.stdout.write('Scorer error: unable to read fixture sidecars\n');
  }
}

main();
