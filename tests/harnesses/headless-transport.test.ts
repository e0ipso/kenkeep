import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getHarness } from '../../src/harnesses/registry.js';

const Schema = z.object({ ok: z.boolean(), n: z.number() });

/**
 * Linux caps a single argv element at MAX_ARG_STRLEN (32 pages = 128 KiB).
 * A prompt above that must reach the host through its stdin channel; placing
 * it in argv fails the spawn with E2BIG before the host even starts.
 */
const OVERSIZED_PROMPT_BYTES = 160 * 1024;

interface StubDump {
  argv: string[];
  stdin: string;
  guard: string | null;
}

/**
 * Every adapter is driven through a real stub executable found on PATH under
 * the host's binary name. The stub drains stdin, records argv/stdin/guard to
 * a dump file, and prints that host's native success stream, so the test
 * observes exactly what reached the child instead of what a mocked `execa`
 * was handed.
 */
const hosts: Array<{ id: string; binary: string; body: string }> = [
  {
    id: 'claude',
    binary: 'claude',
    body: `${JSON.stringify({ type: 'result', is_error: false, result: '{"ok":true,"n":1}' })}\n`,
  },
  {
    id: 'codex',
    binary: 'codex',
    body: `${JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: '{"ok":true,"n":1}' },
    })}\n`,
  },
  {
    id: 'cursor',
    binary: 'agent',
    body: `${JSON.stringify({ type: 'result', subtype: 'success', result: '{"ok":true,"n":1}' })}\n`,
  },
  {
    id: 'copilot',
    binary: 'copilot',
    body: 'Done.\n```json\n{"ok":true,"n":1}\n```\n',
  },
  {
    id: 'opencode',
    binary: 'opencode',
    body: `${JSON.stringify({
      type: 'message.part.updated',
      properties: { messageID: 'm', part: { type: 'text', text: '{"ok":true,"n":1}' } },
    })}\n${JSON.stringify({ type: 'session.idle' })}\n`,
  },
];

describe('headless prompt transport through real stub executables', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-headless-transport-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function installStub(binary: string, body: string): { env: NodeJS.ProcessEnv; dump: string } {
    const dump = join(dir, `${binary}.dump.json`);
    const stub = join(dir, binary);
    // CommonJS on purpose: an extensionless script has no package.json
    // "type" to turn it into ESM.
    writeFileSync(
      stub,
      `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
(async () => {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) stdin += chunk;
  writeFileSync(${JSON.stringify(dump)}, JSON.stringify({
    argv: process.argv.slice(2),
    stdin,
    guard: process.env.KENKEEP_BUILDER_INTERNAL ?? null,
  }));
  process.stdout.write(${JSON.stringify(body)});
})();
`
    );
    chmodSync(stub, 0o755);
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${dir}:${process.env['PATH'] ?? ''}` };
    return { env, dump };
  }

  function readDump(file: string): StubDump {
    return JSON.parse(readFileSync(file, 'utf8')) as StubDump;
  }

  it.each(hosts)(
    '$id delivers a prompt above the single-argument limit through stdin, not argv',
    async ({ id, binary, body }) => {
      const { env, dump } = installStub(binary, body);
      const marker = 'END-OF-OVERSIZED-PROMPT';
      const prompt = `${'x'.repeat(OVERSIZED_PROMPT_BYTES)}\n${marker}`;

      const out = await getHarness(id).runHeadless(prompt, Schema, { env });

      expect(out).toEqual({ ok: true, n: 1 });
      const seen = readDump(dump);
      expect(seen.guard).toBe('1');
      expect(seen.argv.some(arg => arg.includes(marker))).toBe(false);
      expect(seen.stdin).toBe(prompt);
    }
  );
});
