import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { afterAll, describe, expect, it } from 'vitest';

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'prompt-eval');
const sessionsDir = join(fixtureRoot, 'sessions');
const expectedDir = join(fixtureRoot, 'expected');

const expectedCategoryCounts = {
  'admit-convention': 2,
  'admit-gotcha': 2,
  'admit-map-feature': 1,
  'admit-map-location': 1,
  'admit-map-vocab': 1,
  'admit-prohibition': 2,
  'admit-rationale': 1,
  'admit-tooling': 1,
  'mixed-salvage': 2,
  'reject-abandoned': 2,
  'reject-exploratory': 2,
  'reject-meta-only': 2,
  'reject-noise': 2,
  'reject-unrelated': 1,
  'trap-phantom': 2,
} as const;

type Category = keyof typeof expectedCategoryCounts;

type Session = {
  file: string;
  fixtureId: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

const categories = Object.keys(expectedCategoryCounts).sort() as Category[];
const passed = new Map<Category, number>(categories.map(category => [category, 0]));
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roleTag = /^\[(USER|AGENT)\]:/gm;
const commandMessage =
  /<command-message>(kk-[a-z-]+)<\/command-message>\s*\n<command-name>\/(kk-[a-z-]+)<\/command-name>/g;
const requiredCommands = ['/kk-add', '/kk-bootstrap', '/kk-curate', '/kk-session-extract'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('\n') === [...keys].sort().join('\n');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function assertRequiredTerms(value: unknown, label: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 4 ||
    value.some(term => !isNonEmptyString(term) || term !== term.toLowerCase())
  ) {
    throw new Error(`${label}: expected 2 to 4 non-empty lowercase substrings`);
  }
}

function assertOptionalTerms(value: unknown, label: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some(term => !isNonEmptyString(term) || term !== term.toLowerCase())
  ) {
    throw new Error(`${label}: expected lowercase substrings`);
  }
}

function listFiles(dir: string, extension: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) {
      throw new Error(`${join(dir, entry.name)}: unexpected corpus entry`);
    }
  }
  return entries.map(entry => entry.name).sort();
}

function parseSession(file: string): Session {
  const source = readFileSync(file, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(source);
  if (!match) throw new Error(`${file}: frontmatter: expected YAML frontmatter and a body`);

  let value: unknown;
  try {
    value = yaml.load(match[1]);
  } catch (error) {
    throw new Error(`${file}: frontmatter: ${(error as Error).message}`);
  }
  if (!isRecord(value)) throw new Error(`${file}: frontmatter: expected a record`);
  if (!hasExactKeys(value, ['captured_at', 'harness', 'schema_version', 'session_id'])) {
    throw new Error(`${file}: frontmatter: unexpected or missing field`);
  }
  if (value.schema_version !== 1) throw new Error(`${file}: frontmatter: schema_version must be 1`);
  if (!isNonEmptyString(value.harness))
    throw new Error(`${file}: frontmatter: harness must be a non-empty string`);
  if (!isNonEmptyString(value.session_id) || !uuidV4.test(value.session_id)) {
    throw new Error(`${file}: frontmatter: session_id must be a UUID v4`);
  }
  if (
    !isNonEmptyString(value.captured_at) ||
    Number.isNaN(Date.parse(value.captured_at)) ||
    new Date(value.captured_at).toISOString() !== value.captured_at
  ) {
    throw new Error(`${file}: frontmatter: captured_at must be a canonical ISO timestamp`);
  }

  return {
    file,
    fixtureId: basename(file, '.md'),
    frontmatter: value,
    body: match[2],
  };
}

function parseSidecar(file: string, fixtureId: string): Category {
  let value: unknown;
  try {
    value = yaml.load(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: sidecar: ${(error as Error).message}`);
  }
  if (!isRecord(value)) throw new Error(`${file}: sidecar: expected a record`);
  if (
    !hasExactKeys(value, [
      'category',
      'expect_empty',
      'expected_points',
      'fixture_id',
      'max_unexpected_proposals',
      'notes',
    ])
  ) {
    throw new Error(`${file}: sidecar: unexpected or missing field`);
  }
  if (value.fixture_id !== fixtureId)
    throw new Error(`${file}: sidecar: fixture_id must be ${fixtureId}`);
  if (!isNonEmptyString(value.category) || !categories.includes(value.category as Category)) {
    throw new Error(`${file}: sidecar: unknown category ${String(value.category)}`);
  }
  if (typeof value.expect_empty !== 'boolean')
    throw new Error(`${file}: sidecar: expect_empty must be boolean`);
  if (!Array.isArray(value.expected_points))
    throw new Error(`${file}: sidecar: expected_points must be an array`);
  if (value.expect_empty !== (value.expected_points.length === 0)) {
    throw new Error(`${file}: sidecar: expect_empty must match whether expected_points is empty`);
  }
  if (
    !Number.isInteger(value.max_unexpected_proposals) ||
    (value.max_unexpected_proposals as number) < 0
  ) {
    throw new Error(`${file}: sidecar: max_unexpected_proposals must be a non-negative integer`);
  }
  if (!isNonEmptyString(value.notes))
    throw new Error(`${file}: sidecar: notes must be a non-empty string`);

  for (const [index, point] of value.expected_points.entries()) {
    const label = `${file}: expected_points[${index}]`;
    if (!isRecord(point)) throw new Error(`${label}: expected a record`);
    const requiredKeys = ['id', 'must_match_all', 'type'];
    const allowedKeys = [...requiredKeys, 'must_not_match'];
    if (
      requiredKeys.some(key => !(key in point)) ||
      Object.keys(point).some(key => !allowedKeys.includes(key))
    ) {
      throw new Error(`${label}: unexpected or missing field`);
    }
    if (!isNonEmptyString(point.id)) throw new Error(`${label}: id must be a non-empty string`);
    if (point.type !== 'practice' && point.type !== 'map') {
      throw new Error(`${label}: type must be practice or map`);
    }
    assertRequiredTerms(point.must_match_all, `${label}: must_match_all`);
    if (point.must_not_match !== undefined) {
      assertOptionalTerms(point.must_not_match, `${label}: must_not_match`);
    }
  }

  return value.category as Category;
}

describe('prompt extraction evaluation corpus', () => {
  const sessionFiles = listFiles(sessionsDir, '.md');
  const sidecarFiles = listFiles(expectedDir, '.yaml');

  it('keeps every valid session paired with one schema-valid sidecar', () => {
    const sessionIds = new Set<string>();
    const sidecarNames = new Set(sidecarFiles);

    for (const sessionName of sessionFiles) {
      const session = parseSession(join(sessionsDir, sessionName));
      const sidecarName = `${session.fixtureId}.yaml`;
      if (!sidecarNames.has(sidecarName)) {
        throw new Error(`${session.file}: pairing: missing expected/${sidecarName}`);
      }
      const sessionId = session.frontmatter.session_id as string;
      if (sessionIds.has(sessionId)) {
        throw new Error(`${session.file}: frontmatter: duplicate session_id ${sessionId}`);
      }
      sessionIds.add(sessionId);

      parseSidecar(join(expectedDir, sidecarName), session.fixtureId);
    }

    const sessionNames = new Set(sessionFiles);
    for (const sidecarName of sidecarFiles) {
      const sessionName = `${basename(sidecarName, '.yaml')}.md`;
      if (!sessionNames.has(sessionName)) {
        throw new Error(
          `${join(expectedDir, sidecarName)}: pairing: missing sessions/${sessionName}`
        );
      }
    }
    expect(sessionFiles).toHaveLength(24);
    expect(sidecarFiles).toHaveLength(24);
    expect(sessionIds.size).toBe(24);
  });

  it('preserves realistic role segments and captured kenkeep command envelopes', () => {
    const observedCommands = new Set<string>();

    for (const sessionName of sessionFiles) {
      const session = parseSession(join(sessionsDir, sessionName));
      const roles = [...session.body.matchAll(roleTag)].map(match => match[1]);
      if (roles.length < 8 || roles.length > 20) {
        throw new Error(`${session.file}: role segments: expected 8 to 20, got ${roles.length}`);
      }
      if (!roles.some((role, index) => role === 'AGENT' && roles[index + 1] === 'AGENT')) {
        throw new Error(`${session.file}: role segments: expected consecutive AGENT segments`);
      }
      if (/^\[USER\]:\s*\/kk-[a-z-]+/m.test(session.body)) {
        throw new Error(`${session.file}: command envelope: bare USER kenkeep invocation`);
      }

      const withoutEnvelopes = session.body.replace(commandMessage, (_envelope, message, name) => {
        if (message !== name) {
          throw new Error(
            `${session.file}: command envelope: command-message and command-name differ`
          );
        }
        observedCommands.add(`/${name}`);
        return '';
      });
      if (/<command-(?:message|name)>/.test(withoutEnvelopes)) {
        throw new Error(`${session.file}: command envelope: incomplete captured invocation`);
      }
    }

    for (const command of requiredCommands) {
      if (!observedCommands.has(command)) {
        throw new Error(`${fixtureRoot}: command coverage: missing ${command}`);
      }
    }
  });

  it('pins the authored category distribution', () => {
    const counts = new Map<Category, number>(categories.map(category => [category, 0]));
    for (const sidecarName of sidecarFiles) {
      const fixtureId = basename(sidecarName, '.yaml');
      const category = parseSidecar(join(expectedDir, sidecarName), fixtureId);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const actual = Object.fromEntries(categories.map(category => [category, counts.get(category)]));
    expect(actual).toEqual(expectedCategoryCounts);
    for (const category of categories) passed.set(category, counts.get(category) ?? 0);
  });
});

afterAll(() => {
  const summary = categories
    .map(category => `${category} ${passed.get(category) ?? 0}/${expectedCategoryCounts[category]}`)
    .join(' | ');
  process.stdout.write(`Prompt eval corpus summary: ${summary}\n`);
});
