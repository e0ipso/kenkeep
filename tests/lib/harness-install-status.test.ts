import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getHarness, listHarnessIds } from '../../src/harnesses/registry.js';
import { registeredHarnesses, registrationEvidence } from '../../src/lib/harness-install-status.js';
import { sharedHookScriptPath } from '../../src/lib/shared-hooks.js';
import { cleanSandbox, makeSandbox, repoRoot } from '../helpers.js';

// `packageTemplatesDir()` resolves to `src/templates` when imported from
// source, so point at the built templates directory the package ships.
const templatesDir = join(repoRoot, 'templates');

function writeSettings(root: string, id: string, content: string): string {
  const file = getHarness(id).paths(root).settingsFile;
  if (!file) throw new Error(`${id} has no settings file`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

function registerHookScript(root: string, id: string): string {
  const command = sharedHookScriptPath(id, 'kk-x.sh');
  return writeSettings(root, id, JSON.stringify({ hooks: { command } }));
}

function installOpenCodePlugin(root: string): string {
  const src = join(templatesDir, 'opencode', 'plugins');
  const name = readdirSync(src).sort()[0];
  if (!name) throw new Error('no shipped opencode plugin');
  const pluginsDir = getHarness('opencode').paths(root).pluginsDir;
  if (!pluginsDir) throw new Error('opencode has no plugins dir');
  mkdirSync(pluginsDir, { recursive: true });
  copyFileSync(join(src, name), join(pluginsDir, name));
  return join(pluginsDir, name);
}

describe('registeredHarnesses', () => {
  let sb: string;
  beforeEach(() => {
    sb = makeSandbox('kk-harness-status-');
  });
  afterEach(() => cleanSandbox(sb));

  it('returns [] for a repo with no host registrations', () => {
    expect(registeredHarnesses(sb, templatesDir)).toEqual([]);
  });

  it('detects every adapter from its committed registration, in registry order', () => {
    for (const id of ['claude', 'codex', 'cursor', 'copilot']) registerHookScript(sb, id);
    const plugin = installOpenCodePlugin(sb);

    const ids = registeredHarnesses(sb, templatesDir);
    expect([...ids].sort()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'opencode']);
    expect(ids).toEqual(listHarnessIds().filter(id => ids.includes(id)));
    expect(registrationEvidence(sb, templatesDir, getHarness('opencode'))).toBe(plugin);
  });

  it('returns only the registered subset', () => {
    registerHookScript(sb, 'codex');
    installOpenCodePlugin(sb);
    expect(registeredHarnesses(sb, templatesDir)).toEqual(['codex', 'opencode']);
  });
});

describe('registrationEvidence', () => {
  let sb: string;
  beforeEach(() => {
    sb = makeSandbox('kk-harness-evidence-');
  });
  afterEach(() => cleanSandbox(sb));

  it('returns the settings file when it names the shared hook-script path', () => {
    const file = registerHookScript(sb, 'claude');
    expect(registrationEvidence(sb, templatesDir, getHarness('claude'))).toBe(file);
  });

  it('gives no evidence, without throwing, when the settings path is a directory', () => {
    const file = getHarness('claude').paths(sb).settingsFile;
    if (!file) throw new Error('claude has no settings file');
    mkdirSync(file, { recursive: true });
    expect(registrationEvidence(sb, templatesDir, getHarness('claude'))).toBeNull();
    expect(registeredHarnesses(sb, templatesDir)).toEqual([]);
  });

  it('gives no evidence when the settings file does not name the hook path', () => {
    writeSettings(sb, 'claude', JSON.stringify({ hooks: { command: 'echo other' } }));
    expect(registrationEvidence(sb, templatesDir, getHarness('claude'))).toBeNull();
  });
});
