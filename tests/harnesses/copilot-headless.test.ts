import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runHeadlessCopilot } from '../../src/harnesses/copilot/headless.js';

const Schema = z.object({ ok: z.boolean(), n: z.number() });

/**
 * Copilot's headless runner cannot be exercised through the shared
 * execa-mock matrix: Copilot has no `--json` stream contract, so the runner
 * buffers the raw stdout of a real child and recovers a fenced JSON payload.
 * This file therefore drives a real Node shim instead of mocking `execa`,
 * which is why it lives apart from the parametrized `headless.test.ts`.
 *
 * The shim prints a canned final answer with a fenced JSON block on stdout
 * and dumps its argv plus the recursion-guard env var so the test can assert
 * exactly what the runner spawned.
 */
describe('runHeadlessCopilot', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-copilot-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeShim(opts: { exitCode?: number; body?: string } = {}): string {
    const shim = join(dir, 'fake-copilot.mjs');
    const dump = join(dir, 'dump.json');
    const body =
      opts.body ?? 'Here is the result you requested.\n\n```json\n{"ok": true, "n": 7}\n```\n';
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

  it('parses the fenced JSON payload, sets the guard, and maps the required flags', async () => {
    const shim = writeShim();
    const out = await runHeadlessCopilot('prompt body', Schema, {
      copilotCli: shim,
      repoRoot: '/some/repo',
      harnessOpts: { model: 'claude-sonnet-4.5' },
    });
    expect(out).toEqual({ ok: true, n: 7 });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as {
      argv: string[];
      guard: string | null;
    };
    expect(dump.guard).toBe('1');
    expect(dump.argv).toContain('-p');
    expect(dump.argv).toContain('--no-ask-user');
    expect(dump.argv).toContain('--allow-all-tools');
    expect(dump.argv).toContain('--add-dir');
    expect(dump.argv).toContain('/some/repo');
    expect(dump.argv).toContain('--model');
    expect(dump.argv).toContain('claude-sonnet-4.5');
  });

  it('omits --model when none is configured', async () => {
    const shim = writeShim();
    await runHeadlessCopilot('prompt body', Schema, { copilotCli: shim });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as { argv: string[] };
    expect(dump.argv[dump.argv.indexOf('-p') + 1]).toBe('prompt body');
    expect(dump.argv).not.toContain('--model');
  });

  it('mirrors raw stdout to logFile when provided', async () => {
    const shim = writeShim();
    const logFile = join(dir, 'logs', 'copilot', 'a.log');
    await runHeadlessCopilot('p', Schema, { copilotCli: shim, logFile });
    expect(readFileSync(logFile, 'utf8')).toContain('"ok": true');
  });

  it('throws when no JSON payload is present, on non-zero exit, and on schema mismatch', async () => {
    const noJson = writeShim({ body: 'No JSON here at all.\n' });
    await expect(runHeadlessCopilot('p', Schema, { copilotCli: noJson })).rejects.toThrow(
      /was not valid JSON/
    );

    const failExit = writeShim({ exitCode: 1, body: '' });
    await expect(runHeadlessCopilot('p', Schema, { copilotCli: failExit })).rejects.toThrow(
      /copilot subprocess failed/
    );

    const badSchema = writeShim({ body: '```json\n{"ok":"yes"}\n```\n' });
    await expect(runHeadlessCopilot('p', Schema, { copilotCli: badSchema })).rejects.toThrow(
      /did not match schema/
    );
  });
});
