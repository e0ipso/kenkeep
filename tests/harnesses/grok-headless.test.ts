import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runHeadlessGrok } from '../../src/harnesses/grok/headless.js';

const Schema = z.object({ ok: z.boolean(), n: z.number() });

describe('runHeadlessGrok', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-grok-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeShim(opts: { exitCode?: number; body?: string } = {}): string {
    const shim = join(dir, 'fake-grok.mjs');
    const dump = join(dir, 'dump.json');
    const body =
      opts.body ?? JSON.stringify({ text: '{"ok": true, "n": 7}', stopReason: 'end_turn' });
    const exitCode = opts.exitCode ?? 0;
    writeFileSync(
      shim,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(dump)}, JSON.stringify({
  argv: process.argv.slice(2),
  guard: process.env.KENKEEP_BUILDER_INTERNAL ?? null,
}));
process.stdout.write(${JSON.stringify(body)});
process.exit(${exitCode});
`
    );
    chmodSync(shim, 0o755);
    return shim;
  }

  it('parses the json envelope text, sets the guard, and maps flags', async () => {
    const shim = writeShim();
    const out = await runHeadlessGrok('prompt body', '', Schema, {
      grokCli: shim,
      harnessOpts: { model: 'grok-4.6', effort: 'low' },
    });
    expect(out).toEqual({ ok: true, n: 7 });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as {
      argv: string[];
      guard: string | null;
    };
    expect(dump.guard).toBe('1');
    expect(dump.argv).toEqual([
      '-p',
      'prompt body',
      '--output-format',
      'json',
      '--yolo',
      '--model',
      'grok-4.6',
      '--effort',
      'low',
    ]);
  });

  it('appends stdin to the prompt and omits model/effort when unset', async () => {
    const shim = writeShim();
    await runHeadlessGrok('prompt body', 'EXTRA STDIN', Schema, { grokCli: shim });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as { argv: string[] };
    const promptArg = dump.argv[dump.argv.indexOf('-p') + 1];
    expect(promptArg).toContain('prompt body');
    expect(promptArg).toContain('EXTRA STDIN');
    expect(dump.argv).not.toContain('--model');
    expect(dump.argv).not.toContain('--effort');
  });

  it('throws on empty/non-json stdout, non-zero exit, and schema mismatch', async () => {
    const empty = writeShim({ body: '' });
    await expect(runHeadlessGrok('p', '', Schema, { grokCli: empty })).rejects.toThrow(/empty/);

    const failExit = writeShim({ exitCode: 1, body: '{}' });
    await expect(runHeadlessGrok('p', '', Schema, { grokCli: failExit })).rejects.toThrow(
      /grok subprocess failed/
    );

    const badSchema = writeShim({
      body: JSON.stringify({ text: '{"ok":"yes"}', stopReason: 'end_turn' }),
    });
    await expect(runHeadlessGrok('p', '', Schema, { grokCli: badSchema })).rejects.toThrow(
      /did not match schema/
    );
  });
});
