import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { cleanSandbox, makeSandbox } from '../helpers.js';
import { lintStateFile, readLintState } from '../../src/lib/lint-state.js';
import type { NodeFrontmatter, NodeKind } from '../../src/lib/schemas.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const hookPath = join(repoRoot, 'dist/hooks/kb-lint-tick.mjs');

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runHook(cwd: string, input: object = {}): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1' } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      }
    );
    proc.stdin?.write(JSON.stringify(input));
    proc.stdin?.end();
  });
}

function seedSandbox(sandbox: string, lintEveryNSessions: number): { stateDir: string } {
  const kbDir = join(sandbox, '.ai/knowledge-base');
  const stateDir = join(kbDir, '.state');
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(join(kbDir, 'nodes', 'practice'), { recursive: true });
  mkdirSync(join(kbDir, 'nodes', 'map'), { recursive: true });
  writeFileSync(
    join(stateDir, 'installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: '@e0ipso/ai-knowledge-base',
      version: '0.0.0-test',
      installed_at: '2026-05-13T10:00:00Z',
      assistants: ['claude'],
    })
  );
  writeFileSync(
    join(kbDir, 'config.yaml'),
    `schema_version: 1\nlintEveryNSessions: ${lintEveryNSessions}\n`
  );
  return { stateDir };
}

function writeNode(
  sandbox: string,
  kind: NodeKind,
  filenameBase: string,
  overrides: Partial<NodeFrontmatter>
): void {
  const id = overrides.id ?? `${kind}-${filenameBase}`;
  const fm: NodeFrontmatter = {
    schema_version: 1,
    id,
    title: overrides.title ?? id,
    kind,
    tags: overrides.tags ?? [],
    derived_from: overrides.derived_from ?? [],
    relates_to: overrides.relates_to ?? [],
    confidence: overrides.confidence ?? 'high',
    summary: overrides.summary ?? 's',
  };
  writeFileSync(
    join(sandbox, '.ai/knowledge-base/nodes', kind, `${filenameBase}.md`),
    matter.stringify(`# ${id}\nBody.`, fm)
  );
}

describe('kb-lint-tick hook (spawned)', () => {
  let sandbox: string;

  beforeEach(() => {
    sandbox = makeSandbox();
  });
  afterEach(() => cleanSandbox(sandbox));

  it('compiled hook bundle exists at dist/hooks/kb-lint-tick.mjs', () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it('with lintEveryNSessions:1 and an orphan tree, one invocation persists last_findings>=1 and resets the counter', async () => {
    const { stateDir } = seedSandbox(sandbox, 1);
    writeNode(sandbox, 'practice', 'practice-orphan', { id: 'practice-orphan' });

    const result = await runHook(sandbox, { cwd: sandbox });
    expect(result.exitCode).toBe(0);

    const state = readLintState(lintStateFile(stateDir));
    expect(state.sessions_since_last_lint).toBe(0);
    expect(state.last_findings).toBeGreaterThanOrEqual(1);
    expect(typeof state.last_lint_at).toBe('string');
  });

  it('with lintEveryNSessions:3, requires three invocations to fire; intermediate ticks only increment', async () => {
    const { stateDir } = seedSandbox(sandbox, 3);
    writeNode(sandbox, 'practice', 'practice-a', {
      id: 'practice-a',
      relates_to: ['practice-b'],
    });
    writeNode(sandbox, 'practice', 'practice-b', {
      id: 'practice-b',
      relates_to: ['practice-a'],
    });

    await runHook(sandbox, { cwd: sandbox });
    let state = readLintState(lintStateFile(stateDir));
    expect(state.sessions_since_last_lint).toBe(1);
    expect(state.last_lint_at).toBeNull();

    await runHook(sandbox, { cwd: sandbox });
    state = readLintState(lintStateFile(stateDir));
    expect(state.sessions_since_last_lint).toBe(2);
    expect(state.last_lint_at).toBeNull();

    await runHook(sandbox, { cwd: sandbox });
    state = readLintState(lintStateFile(stateDir));
    expect(state.sessions_since_last_lint).toBe(0);
    expect(typeof state.last_lint_at).toBe('string');
    expect(state.last_errors).toBe(0);
    expect(state.last_findings).toBe(0);
  });
});

// Verify reading state JSON directly to double-check the bytes on disk match
// what readLintState reports. This catches a silent re-stamp regression.
describe('kb-lint-tick on-disk state', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = makeSandbox();
  });
  afterEach(() => cleanSandbox(sandbox));

  it('writes a JSON file that round-trips through readLintState', async () => {
    const { stateDir } = seedSandbox(sandbox, 1);
    writeNode(sandbox, 'practice', 'practice-only', { id: 'practice-only' });

    await runHook(sandbox, { cwd: sandbox });
    const file = lintStateFile(stateDir);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    expect(raw['schema_version']).toBe(1);
    expect(raw['sessions_since_last_lint']).toBe(0);
  });
});
