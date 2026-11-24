import { readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installedVersionRecord,
  readInstalledVersion,
  writeInstalledVersionIfChanged,
} from '../../src/lib/installed-version.js';
import { cleanSandbox, makeSandbox } from '../helpers.js';

// `packageRoot()` resolves from the bundled `dist/cli.js`; under vitest the
// source module sits in `src/lib/`, where no package.json exists.
vi.mock('../../src/lib/version.js', () => ({ packageVersion: () => '1.2.3' }));

describe('installed-version marker', () => {
  let sandbox: string;
  let file: string;

  beforeEach(() => {
    sandbox = makeSandbox('kk-installed-version-');
    file = join(sandbox, 'installed-version');
  });

  afterEach(() => {
    cleanSandbox(sandbox);
  });

  const legacy = {
    schema_version: 1,
    package: 'kenkeep',
    version: '0.9.0',
    installed_at: '2026-05-23T10:00:00Z',
    harnesses: ['claude'],
  };

  it('reads a legacy marker and drops installed_at and harnesses', () => {
    writeFileSync(file, JSON.stringify(legacy));
    expect(readInstalledVersion(file)).toStrictEqual({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.9.0',
    });
  });

  it('rejects a marker whose version is not a string', () => {
    writeFileSync(file, JSON.stringify({ schema_version: 1, package: 'kenkeep', version: 5 }));
    expect(() => readInstalledVersion(file)).toThrow(/Malformed/);
  });

  it('builds the same three-field record on every call', () => {
    const record = installedVersionRecord();
    expect(record).toStrictEqual({ schema_version: 1, package: 'kenkeep', version: '1.2.3' });
    expect(installedVersionRecord()).toStrictEqual(record);
  });

  it('rewrites a legacy marker once and leaves identical content untouched', () => {
    writeFileSync(file, JSON.stringify(legacy));
    const record = installedVersionRecord();

    expect(writeInstalledVersionIfChanged(file, record)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toStrictEqual(record);

    // Backdate the file so a rewrite would be visible in the mtime.
    const past = new Date('2020-01-01T00:00:00Z');
    utimesSync(file, past, past);
    expect(writeInstalledVersionIfChanged(file, record)).toBe(false);
    expect(statSync(file).mtimeMs).toBe(past.getTime());
  });
});
