import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import { getHarness } from '../../src/harnesses/registry.js';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import {
  discoverHarnessMemoryFiles,
  loadMemoryLedger,
  memorySessionId,
} from '../../src/lib/memory-files.js';
import { assertValidSessionId } from '../../src/lib/session-log.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import type { HarnessAdapter } from '../../src/harnesses/types.js';
import { mockExecaOnce } from '../helpers/execa-mock.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

/**
 * Adapters whose host has no native auto-memory feature return `[]` without
 * ever spawning a child. Claude is the lone adapter that actually queries
 * the host, so its parsing/dedup/error behavior is exercised as a targeted
 * block below.
 */
const noMemoryAdapters = ['codex', 'copilot', 'opencode'];

describe('adapter.listMemoryFiles (parametrized over no-memory harnesses)', () => {
  afterEach(() => vi.clearAllMocks());

  it.each(noMemoryAdapters)('%s returns [] without spawning a child process', async id => {
    const out = await getHarness(id).listMemoryFiles();
    expect(out).toEqual([]);
    expect(vi.mocked(execa)).not.toHaveBeenCalled();
  });
});

describe('claudeAdapter.listMemoryFiles', () => {
  afterEach(() => vi.clearAllMocks());

  function resultLine(payload: unknown): string {
    return JSON.stringify({
      type: 'result',
      is_error: false,
      result: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  it('parses file:// IRIs, filters non-file entries, de-duplicates, and sets the recursion guard', async () => {
    const { captured } = mockExecaOnce([
      resultLine([
        'file:///ok.md',
        'https://example.com/bad',
        's3://nope.md',
        'file:///also.md',
        'file:///ok.md',
      ]),
    ]);
    expect(await claudeAdapter.listMemoryFiles()).toEqual(['file:///ok.md', 'file:///also.md']);
    const env = captured.options?.['env'] as NodeJS.ProcessEnv;
    expect(env['KENKEEP_BUILDER_INTERNAL']).toBe('1');
    expect(captured.command).toBe('claude');
    expect(captured.args).toContain('-p');
  });

  it('returns [] for non-JSON, schema-mismatched, and failed-child responses (never throws)', async () => {
    mockExecaOnce([resultLine('not actually json {')]);
    expect(await claudeAdapter.listMemoryFiles()).toEqual([]);

    mockExecaOnce([resultLine({ unexpected: 'shape' })]);
    expect(await claudeAdapter.listMemoryFiles()).toEqual([]);

    mockExecaOnce([], { exitCode: 1 });
    expect(await claudeAdapter.listMemoryFiles()).toEqual([]);
  });
});

interface Sandbox {
  root: string;
  paths: RepoPaths;
  memoryDir: string;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'kk-memory-files-'));
  const paths = repoPaths(root);
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  writeFileSync(
    paths.installedVersionFile,
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-10-02T10:00:00Z',
      assistants: ['claude'],
    })
  );
  const memoryDir = join(root, 'memories');
  mkdirSync(memoryDir, { recursive: true });
  return { root, paths, memoryDir };
}

function writeMemoryFile(box: Sandbox, name: string, content: string): string {
  const abs = join(box.memoryDir, name);
  writeFileSync(abs, content, 'utf8');
  return pathToFileURL(abs).href;
}

function stubAdapter(iris: string[]): HarnessAdapter {
  return {
    id: 'stub',
    listMemoryFiles: async () => iris,
  } as unknown as HarnessAdapter;
}

describe('discoverHarnessMemoryFiles (shared ledger pipeline)', () => {
  let box: Sandbox;
  beforeEach(() => {
    box = makeSandbox();
  });
  afterEach(() => {
    rmSync(box.root, { recursive: true, force: true });
  });

  it('de-duplicates IRIs, skips non-file and missing entries, and passes content through as-is', async () => {
    const body = 'contains sensitive secret\n';
    const iri = writeMemoryFile(box, 'user_role.md', body);
    const missing = pathToFileURL(join(box.memoryDir, 'gone.md')).href;
    const files = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri, iri, 'https://example.com/x', missing, iri]),
      paths: box.paths,
    });
    expect(files).toHaveLength(1);
    expect(files[0]!.iri).toBe(iri);
    expect(files[0]!.content).toBe(body);
    expect(files[0]!.absPath).toBe(join(box.memoryDir, 'user_role.md'));
    expect(files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(files[0]!.sessionId).toBe(memorySessionId(files[0]!.sha256));
  });

  it('derives a stable UUID v4 session id from the content hash', () => {
    const sha = 'a'.repeat(64);
    const id = memorySessionId(sha);
    expect(assertValidSessionId(id)).toBe(id);
    expect(memorySessionId(sha)).toBe(id);
    expect(memorySessionId('b'.repeat(64))).not.toBe(id);
  });
});

describe('loadMemoryLedger', () => {
  it('returns an empty ledger when the file does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'kk-memory-ledger-'));
    const paths = repoPaths(root);
    mkdirSync(paths.stateDir, { recursive: true });
    expect(loadMemoryLedger(paths)).toEqual({ schema_version: 1, entries: {} });
    rmSync(root, { recursive: true, force: true });
  });
});
