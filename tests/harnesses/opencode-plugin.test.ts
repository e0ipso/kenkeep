import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { normalizeOpenCodeSessionId } from '../../src/harnesses/opencode/session-id.js';

const exec = promisify(execFile);

const RAW_SESS = 'ses_0a1b2c3d4e5f60718293a4b5c6d7e8f9';
const NORMALIZED_SESS = normalizeOpenCodeSessionId(RAW_SESS);
const SUBSTANTIAL_USER = 'use bravo_pii.cache for PII. '.repeat(8);
const SUBSTANTIAL_AGENT = 'understood, here is the detailed reasoning. '.repeat(16);

interface PluginHooks {
  event?: (args: {
    event: { type?: string; properties?: { sessionID?: string } };
  }) => Promise<void>;
}

type PluginFactory = (input: { directory?: string }) => Promise<PluginHooks>;

function writeOpenCodeStub(dir: string): string {
  const binDir = join(dir, 'bin');
  mkdirSync(binDir, { recursive: true });
  const doc = {
    info: { id: RAW_SESS },
    messages: [
      {
        info: { role: 'user', time: { created: 1 } },
        parts: [{ type: 'text', text: SUBSTANTIAL_USER }],
      },
      {
        info: { role: 'assistant', time: { created: 2 } },
        parts: [{ type: 'text', text: SUBSTANTIAL_AGENT }],
      },
    ],
  };
  writeFileSync(join(dir, 'oc-export.json'), JSON.stringify(doc));
  const script = [
    '#!/bin/sh',
    'DIR=$(dirname "$0")',
    'if [ "$1" = "--version" ]; then echo 1.17.3; exit 0; fi',
    'if [ "$1" = "export" ]; then cat "$DIR/../oc-export.json"; exit 0; fi',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(binDir, 'opencode'), script, { mode: 0o755 });
  return binDir;
}

function sessionLogs(sandbox: string): string[] {
  const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return predicate();
}

/**
 * End-to-end test of the production OpenCode wiring: the installed plugin
 * (`.opencode/plugins/kk.mjs`) dispatching a `session.idle` event into the
 * installed `kk-capture.cjs`, which shells out to the stubbed `opencode
 * export` and writes a session log. This is the chain a live OpenCode
 * session exercises; the per-hook suites bypass the plugin entirely.
 */
describe('opencode plugin dispatch (installed artifacts)', () => {
  let sandbox: string;
  let stubDir: string;
  const savedPath = process.env['PATH'];
  const savedGuard = process.env['KENKEEP_BUILDER_INTERNAL'];

  beforeEach(async () => {
    sandbox = makeSandbox();
    stubDir = makeSandbox('ai-kk-opencode-plugin-stub-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'opencode']);
    const binDir = writeOpenCodeStub(stubDir);
    process.env['PATH'] = `${binDir}:${savedPath ?? ''}`;
    delete process.env['KENKEEP_BUILDER_INTERNAL'];
  });

  afterEach(() => {
    process.env['PATH'] = savedPath;
    if (savedGuard === undefined) delete process.env['KENKEEP_BUILDER_INTERNAL'];
    else process.env['KENKEEP_BUILDER_INTERNAL'] = savedGuard;
    cleanSandbox(sandbox);
    cleanSandbox(stubDir);
  });

  it('session.idle reaches kk-capture and a session log lands in _sessions/', async () => {
    const pluginPath = join(sandbox, '.opencode', 'plugins', 'kk.mjs');
    expect(existsSync(pluginPath)).toBe(true);

    const mod = (await import(pathToFileURL(pluginPath).href)) as { default: PluginFactory };
    const hooks = await mod.default({ directory: sandbox });
    expect(typeof hooks.event).toBe('function');

    await hooks.event!({ event: { type: 'session.idle', properties: { sessionID: RAW_SESS } } });

    // The plugin spawns the hook fire-and-forget; poll for the capture result.
    const appeared = await waitFor(() => sessionLogs(sandbox).length > 0, 15_000);
    expect(appeared).toBe(true);

    const log = readFileSync(
      join(sandbox, '.ai/kenkeep/_sessions', sessionLogs(sandbox)[0] as string),
      'utf8'
    );
    expect(log).toContain(`session_id: ${NORMALIZED_SESS}`);
    expect(log).toContain('captured_by: stop');
    expect(log).toContain('proposal_status: pending');
  }, 30_000);

  it('no-ops inside a kenkeep-internal session (host env guard)', async () => {
    const pluginPath = join(sandbox, '.opencode', 'plugins', 'kk.mjs');
    process.env['KENKEEP_BUILDER_INTERNAL'] = '1';
    // Cache-bust the module so the import re-evaluates under the guard env.
    const mod = (await import(`${pathToFileURL(pluginPath).href}?guard=1`)) as {
      default: PluginFactory;
    };
    const hooks = await mod.default({ directory: sandbox });
    expect(hooks.event).toBeUndefined();
  });

  it('init registers the plugin and instructions in .opencode/opencode.json (OpenCode loads only declared entries)', () => {
    const config = JSON.parse(
      readFileSync(join(sandbox, '.opencode', 'opencode.json'), 'utf8')
    ) as { plugin?: string[]; instructions?: string[] };
    expect(config.plugin).toContain('./plugins/kk.mjs');
    expect(config.instructions).toContain('.opencode/AGENTS.md');
  });
});

describe('registerOpenCodePlugin (config merge)', () => {
  let dir: string;
  beforeEach(() => {
    dir = makeSandbox('ai-kk-oc-register-');
  });
  afterEach(() => cleanSandbox(dir));

  async function register(file: string): Promise<void> {
    const { registerOpenCodePlugin } = await import('../../src/harnesses/opencode/install.js');
    registerOpenCodePlugin(file);
  }

  it('creates the config when absent and is idempotent', async () => {
    const file = join(dir, 'opencode.json');
    await register(file);
    await register(file);
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      plugin: string[];
      instructions: string[];
    };
    expect(config.plugin).toEqual(['./plugins/kk.mjs']);
    expect(config.instructions).toEqual(['.opencode/AGENTS.md']);
  });

  it('appends to existing arrays and preserves other keys', async () => {
    const file = join(dir, 'opencode.json');
    writeFileSync(
      file,
      JSON.stringify({ model: 'x/y', plugin: ['safety'], instructions: ['docs/style.md'] }, null, 2)
    );
    await register(file);
    const config = JSON.parse(readFileSync(file, 'utf8')) as {
      model: string;
      plugin: string[];
      instructions: string[];
    };
    expect(config.model).toBe('x/y');
    expect(config.plugin).toEqual(['safety', './plugins/kk.mjs']);
    expect(config.instructions).toEqual(['docs/style.md', '.opencode/AGENTS.md']);
  });

  it('leaves an unparseable config untouched', async () => {
    const file = join(dir, 'opencode.json');
    writeFileSync(file, '{ this is not json');
    await register(file);
    expect(readFileSync(file, 'utf8')).toBe('{ this is not json');
  });
});
