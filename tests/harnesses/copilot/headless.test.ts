import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runHeadlessCopilot } from '../../../src/harnesses/copilot/headless.js';

const Schema = z.object({ ok: z.boolean(), n: z.number() });

/**
 * Writes an executable Node shim that prints a canned final answer with a
 * fenced JSON block on stdout, and dumps its argv and the recursion-guard
 * env var to a side file so the test can assert what the runner spawned.
 */
function writeShim(dir: string, opts: { exitCode?: number; body?: string } = {}): string {
  const shim = join(dir, 'fake-copilot.mjs');
  const dump = join(dir, 'dump.json');
  const body =
    opts.body ??
    'Here is the result you requested.\n\n```json\n{"ok": true, "n": 7}\n```\n';
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

describe('runHeadlessCopilot', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-copilot-headless-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses the fenced JSON payload from final stdout and validates it', async () => {
    const shim = writeShim(dir);
    const out = await runHeadlessCopilot('prompt body', '', Schema, { copilotCli: shim });
    expect(out).toEqual({ ok: true, n: 7 });
  });

  it('sets KENKEEP_BUILDER_INTERNAL=1 and the required flags on the child', async () => {
    const shim = writeShim(dir);
    await runHeadlessCopilot('prompt body', '', Schema, {
      copilotCli: shim,
      repoRoot: '/some/repo',
      harnessOpts: { model: 'claude-sonnet-4.5' },
    });
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

  it('appends the stdin payload to the prompt when stdin is non-empty', async () => {
    const shim = writeShim(dir);
    await runHeadlessCopilot('prompt body', 'EXTRA STDIN', Schema, { copilotCli: shim });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as { argv: string[] };
    const promptArg = dump.argv[dump.argv.indexOf('-p') + 1];
    expect(promptArg).toContain('prompt body');
    expect(promptArg).toContain('EXTRA STDIN');
  });

  it('omits --model when no model is configured', async () => {
    const shim = writeShim(dir);
    await runHeadlessCopilot('p', '', Schema, { copilotCli: shim });
    const dump = JSON.parse(readFileSync(join(dir, 'dump.json'), 'utf8')) as { argv: string[] };
    expect(dump.argv).not.toContain('--model');
  });

  it('throws a precise error when no JSON payload is present', async () => {
    const shim = writeShim(dir, { body: 'No JSON here at all.\n' });
    await expect(runHeadlessCopilot('p', '', Schema, { copilotCli: shim })).rejects.toThrow(
      /did not contain a parseable JSON payload/
    );
  });

  it('throws when the subprocess exits non-zero', async () => {
    const shim = writeShim(dir, { exitCode: 1, body: '' });
    await expect(runHeadlessCopilot('p', '', Schema, { copilotCli: shim })).rejects.toThrow(
      /copilot subprocess failed/
    );
  });

  it('throws when the JSON does not match the schema', async () => {
    const shim = writeShim(dir, { body: '```json\n{"ok":"yes"}\n```\n' });
    await expect(runHeadlessCopilot('p', '', Schema, { copilotCli: shim })).rejects.toThrow(
      /did not match schema/
    );
  });

  it('mirrors raw stdout to logFile when provided', async () => {
    const shim = writeShim(dir);
    const logFile = join(dir, 'logs', 'copilot', 'a.log');
    await runHeadlessCopilot('p', '', Schema, { copilotCli: shim, logFile });
    const logged = readFileSync(logFile, 'utf8');
    expect(logged).toContain('"ok": true');
  });
});
