import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnHeadless } from '../../src/lib/headless-runner.js';

/**
 * The log mirror is a real file stream next to a real child, so these tests
 * spawn a Node stub rather than mocking `execa`: a stream error is emitted
 * asynchronously and only a real stream shows whether it escapes the runner.
 */
describe('spawnHeadless log mirror failures', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-headless-runner-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function stub(body: string): string {
    const file = join(dir, 'host');
    writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
    chmodSync(file, 0o755);
    return file;
  }

  it('rejects without spawning the host when the log file cannot be opened', async () => {
    const marker = join(dir, 'spawned');
    const command = stub(
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '');\nconsole.log('{}');`
    );
    const logFile = join(dir, 'log.jsonl');
    mkdirSync(logFile);

    await expect(
      spawnHeadless(
        { command, args: [], input: '', label: 'host', onLine: () => undefined },
        { logFile, timeoutMs: 10_000 }
      )
    ).rejects.toThrow(/host log file could not be opened.*EISDIR/);
    expect(existsSync(marker)).toBe(false);
  });

  it.runIf(existsSync('/dev/full'))(
    'rejects and stops the host when a mirrored write fails mid-stream',
    async () => {
      // The host prints one line and would then run for the whole timeout.
      const command = stub(`console.log('{"line":1}');\nsetTimeout(() => {}, 60_000);`);
      const started = Date.now();

      await expect(
        spawnHeadless(
          { command, args: [], input: '', label: 'host', onLine: () => undefined },
          { logFile: '/dev/full', timeoutMs: 30_000 }
        )
      ).rejects.toThrow(/host log mirror failed.*ENOSPC/);
      expect(Date.now() - started).toBeLessThan(15_000);
    },
    20_000
  );
});
