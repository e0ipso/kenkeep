import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureStateLayout, migrateLegacyState, repoPaths } from '../../src/lib/paths.js';

describe('paths: state layout migration', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-paths-'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('is a no-op when no legacy directory exists', () => {
    const paths = repoPaths(root);
    const result = ensureStateLayout(paths);
    expect(result.migrated).toBe(false);
    expect(result.movedEntries).toEqual([]);
    expect(existsSync(paths.stateDir)).toBe(false);
  });

  it('moves every legacy entry to the new state dir', () => {
    const paths = repoPaths(root);
    mkdirSync(paths.legacyStateDir, { recursive: true });
    writeFileSync(paths.legacyInstalledVersionFile, '{"version":"x"}');
    writeFileSync(join(paths.legacyStateDir, 'state.json'), '{"schema_version":1}');
    mkdirSync(join(paths.legacyStateDir, 'prompts'), { recursive: true });
    writeFileSync(join(paths.legacyStateDir, 'prompts/curator.md'), '# local\n');

    const result = ensureStateLayout(paths);
    expect(result.migrated).toBe(true);
    expect(result.movedEntries.sort()).toEqual(
      ['installed-version', 'prompts', 'state.json'].sort(),
    );
    expect(existsSync(paths.legacyStateDir)).toBe(false);
    expect(readFileSync(paths.installedVersionFile, 'utf8')).toBe('{"version":"x"}');
    expect(readFileSync(join(paths.stateDir, 'prompts/curator.md'), 'utf8')).toBe('# local\n');
  });

  it('prefers existing entries in the new state dir over legacy duplicates', () => {
    const paths = repoPaths(root);
    mkdirSync(paths.stateDir, { recursive: true });
    writeFileSync(paths.installedVersionFile, '{"version":"new"}');
    mkdirSync(paths.legacyStateDir, { recursive: true });
    writeFileSync(paths.legacyInstalledVersionFile, '{"version":"old"}');

    const result = migrateLegacyState(paths);
    // Nothing was moved because the new file already exists; legacy is dropped.
    expect(result.movedEntries).toEqual([]);
    expect(readFileSync(paths.installedVersionFile, 'utf8')).toBe('{"version":"new"}');
    expect(existsSync(paths.legacyStateDir)).toBe(false);
  });

  it('removes an empty legacy directory', () => {
    const paths = repoPaths(root);
    mkdirSync(paths.legacyStateDir, { recursive: true });
    const result = migrateLegacyState(paths);
    expect(result.migrated).toBe(false);
    expect(existsSync(paths.legacyStateDir)).toBe(false);
  });

  it('is idempotent: running twice is safe', () => {
    const paths = repoPaths(root);
    mkdirSync(paths.legacyStateDir, { recursive: true });
    writeFileSync(paths.legacyInstalledVersionFile, '{"version":"x"}');
    ensureStateLayout(paths);
    const second = ensureStateLayout(paths);
    expect(second.migrated).toBe(false);
    expect(second.movedEntries).toEqual([]);
    expect(existsSync(paths.installedVersionFile)).toBe(true);
  });
});
