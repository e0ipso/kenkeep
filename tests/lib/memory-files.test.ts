import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverHarnessMemoryFiles, loadMemoryLedger } from '../../src/lib/memory-files.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import type { HarnessAdapter } from '../../src/harnesses/types.js';

interface Sandbox {
  root: string;
  paths: RepoPaths;
  memoryDir: string;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'kb-memory-files-'));
  const paths = repoPaths(root);
  mkdirSync(paths.stateDir, { recursive: true });
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
    listMemoryFiles: async () => iris,
  } as unknown as HarnessAdapter;
}

describe('discoverHarnessMemoryFiles', () => {
  let box: Sandbox;
  beforeEach(() => {
    box = makeSandbox();
  });
  afterEach(() => {
    rmSync(box.root, { recursive: true, force: true });
  });

  it('returns an empty result and writes nothing when the adapter lists no files', async () => {
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toEqual([]);
    expect(result.curateCandidates).toEqual([]);
    await result.commit('run-1', true);
    expect(() => readFileSync(box.paths.memoryLedgerFile, 'utf8')).toThrow();
  });

  it('skips files whose sha256 matches the ledger (unchanged) and reprocesses on hash change', async () => {
    const iri = writeMemoryFile(box, 'memory_a.md', 'original body\n');

    let result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    await result.commit('run-1', true);
    const firstLedger = JSON.parse(readFileSync(box.paths.memoryLedgerFile, 'utf8'));
    const firstSha = firstLedger.entries[iri].sha256;
    expect(typeof firstSha).toBe('string');

    result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toEqual([]);
    expect(result.curateCandidates).toEqual([]);

    writeFileSync(join(box.memoryDir, 'memory_a.md'), 'updated body\n', 'utf8');
    result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    await result.commit('run-3', true);
    const updatedLedger = JSON.parse(readFileSync(box.paths.memoryLedgerFile, 'utf8'));
    expect(updatedLedger.entries[iri].sha256).not.toBe(firstSha);
    expect(updatedLedger.entries[iri].lastSeenRunId).toBe('run-3');
  });

  it('warns and skips IRIs the harness lists but disk does not have', async () => {
    const missing = pathToFileURL(join(box.memoryDir, 'never-existed.md')).href;
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([missing]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toEqual([]);
    await result.commit('run-1', true);
    expect(() => readFileSync(box.paths.memoryLedgerFile, 'utf8')).toThrow();
  });

  it('de-duplicates IRIs the harness lists multiple times in one reply', async () => {
    const iri = writeMemoryFile(box, 'memory_a.md', 'body\n');
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri, iri, iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    expect(result.curateCandidates).toHaveLength(1);
  });

  it('passes file content through as-is', async () => {
    const body = 'contains sensitive secret\n';
    const iri = writeMemoryFile(box, 'memory_dirty.md', body);
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    expect(result.bootstrapCandidates[0]!.content).toBe(body);
    expect(result.curateCandidates[0]!.content).toBe(body);
  });

  it('treats a malformed ledger as empty and overwrites it on the next successful commit', async () => {
    writeFileSync(box.paths.memoryLedgerFile, '{not json at all', 'utf8');
    const iri = writeMemoryFile(box, 'memory_a.md', 'fresh body\n');
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    await result.commit('run-1', true);
    const ledger = JSON.parse(readFileSync(box.paths.memoryLedgerFile, 'utf8'));
    expect(ledger.schema_version).toBe(1);
    expect(ledger.entries[iri]?.lastSeenRunId).toBe('run-1');
  });

  it('does not commit ledger entries when the consumer reports failure', async () => {
    const iri = writeMemoryFile(box, 'memory_a.md', 'body\n');
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toHaveLength(1);
    await result.commit('run-1', false);
    expect(() => readFileSync(box.paths.memoryLedgerFile, 'utf8')).toThrow();
  });

  it('exposes a synthetic memory:// relPath so bootstrap collision logic stays intact', async () => {
    const iri = writeMemoryFile(box, 'user_role.md', 'I am a backend engineer\n');
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([iri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates[0]!.relPath).toBe('memory://user_role.md');
    expect(result.curateCandidates[0]!.source).toBe('harness-memory');
    expect(result.curateCandidates[0]!.iri).toBe(iri);
  });

  it('filters out non-file IRIs the adapter accidentally yields', async () => {
    const httpIri = 'https://example.com/not-a-file.md';
    const result = await discoverHarnessMemoryFiles({
      adapter: stubAdapter([httpIri]),
      paths: box.paths,
    });
    expect(result.bootstrapCandidates).toEqual([]);
  });
});

describe('loadMemoryLedger', () => {
  it('returns an empty ledger when the file does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'kb-memory-ledger-'));
    const paths = repoPaths(root);
    mkdirSync(paths.stateDir, { recursive: true });
    const ledger = loadMemoryLedger(paths);
    expect(ledger).toEqual({ schema_version: 1, entries: {} });
    rmSync(root, { recursive: true, force: true });
  });
});
