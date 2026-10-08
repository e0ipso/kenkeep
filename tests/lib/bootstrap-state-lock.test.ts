import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { recordWrittenNode, updateBootstrapStateLocked } from '../../src/lib/bootstrap.js';
import type { BootstrapState } from '../../src/lib/schemas.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('bootstrap-state.json first creation across processes', () => {
  it('keeps a concurrent writer record when the file did not exist yet', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kk-bootstrap-state-init-'));
    const stateDir = join(dir, '.state');
    const file = join(stateDir, 'bootstrap-state.json');
    const ready = join(dir, 'ready');
    const release = join(dir, 'release');
    const modulePath = join(dir, 'bootstrap.cjs');
    mkdirSync(stateDir, { recursive: true });
    buildSync({
      entryPoints: [fileURLToPath(new URL('../../src/lib/bootstrap.ts', import.meta.url))],
      outfile: modulePath,
      platform: 'node',
      format: 'cjs',
      bundle: true,
      logLevel: 'silent',
    });
    // The child pauses on its first rename over the state file, wherever that
    // happens, so the parent can write while the child is mid-update.
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
      const fs = require('node:fs');
      const [modulePath, file, ready, release] = process.argv.slice(1);
      const rename = fs.renameSync;
      let paused = false;
      fs.renameSync = function (from, to) {
        if (to === file && !paused) {
          paused = true;
          fs.writeFileSync(ready, 'ready');
          while (!fs.existsSync(release)) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
          }
        }
        return rename.call(this, from, to);
      };
      const { recordWrittenNode, updateBootstrapStateLocked } = require(modulePath);
      updateBootstrapStateLocked(file, state => ({
        next: recordWrittenNode(state, {
          doc: 'a.md', hash: 'a'.repeat(64), derivedId: 'practice-use-a',
          nodeId: 'practice-use-a', now: new Date().toISOString(),
        }),
        result: null,
      })).catch(() => { process.exitCode = 1; });
    `,
        modulePath,
        file,
        ready,
        release,
      ],
      { stdio: 'ignore' }
    );
    const finished = new Promise<number | null>(resolve => child.once('exit', resolve));
    try {
      const until = Date.now() + 5000;
      while (!existsSync(ready) && Date.now() < until) await sleep(10);
      expect(existsSync(ready)).toBe(true);

      const second = updateBootstrapStateLocked(file, state => ({
        next: recordWrittenNode(state, {
          doc: 'b.md',
          hash: 'b'.repeat(64),
          derivedId: 'practice-use-b',
          nodeId: 'practice-use-b',
          now: new Date().toISOString(),
        }),
        result: null,
      }));
      await sleep(150);
      writeFileSync(release, 'go');
      await second;
      expect(await finished).toBe(0);

      const state = JSON.parse(readFileSync(file, 'utf8')) as BootstrapState;
      expect(state.in_progress?.['a.md']?.written).toEqual({ 'practice-use-a': 'practice-use-a' });
      expect(state.in_progress?.['b.md']?.written).toEqual({ 'practice-use-b': 'practice-use-b' });
    } finally {
      child.kill('SIGKILL');
      await finished;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
