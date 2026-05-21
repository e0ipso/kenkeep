import { describe, expect, it } from 'vitest';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import { codexAdapter } from '../../src/harnesses/codex/index.js';
import { cursorAdapter } from '../../src/harnesses/cursor/index.js';
import { openCodeAdapter } from '../../src/harnesses/opencode/index.js';
import { getHarness, hasHarness, listHarnessIds } from '../../src/harnesses/registry.js';

describe('harness registry', () => {
  it('returns the codex adapter from getHarness("codex")', () => {
    expect(getHarness('codex')).toBe(codexAdapter);
  });

  it('returns the claude adapter from getHarness("claude")', () => {
    expect(getHarness('claude')).toBe(claudeAdapter);
  });

  it('returns the opencode adapter from getHarness("opencode")', () => {
    expect(getHarness('opencode')).toBe(openCodeAdapter);
  });

  it('returns the cursor adapter from getHarness("cursor")', () => {
    expect(getHarness('cursor')).toBe(cursorAdapter);
  });

  it('lists claude, codex, cursor, and opencode harness ids', () => {
    expect(listHarnessIds()).toEqual(['claude', 'codex', 'cursor', 'opencode']);
  });

  it('hasHarness recognizes every registered id', () => {
    expect(hasHarness('claude')).toBe(true);
    expect(hasHarness('codex')).toBe(true);
    expect(hasHarness('cursor')).toBe(true);
    expect(hasHarness('opencode')).toBe(true);
    expect(hasHarness('not-a-real-harness')).toBe(false);
  });

  it('throws a helpful error for unregistered harnesses', () => {
    expect(() => getHarness('not-a-real-harness')).toThrow(/Unsupported harness 'not-a-real-harness'/);
  });
});

describe('opencode adapter shape', () => {
  it('exposes pluginsDir and skillsDir (no hooksDir, no settingsFile)', () => {
    const paths = openCodeAdapter.paths('/repo');
    expect(paths.dir).toBe('/repo/.opencode');
    expect(paths.pluginsDir).toBe('/repo/.opencode/plugins');
    expect(paths.skillsDir).toBe('/repo/.opencode/skills');
    expect(paths.hooksDir).toBeUndefined();
    expect(paths.settingsFile).toBeUndefined();
    expect(paths.commandsDir).toBeUndefined();
  });

  it('declares session.idle and session.created events', () => {
    const events = new Set(openCodeAdapter.hooks.map(h => h.event));
    expect(events.has('session.idle')).toBe(true);
    expect(events.has('session.created')).toBe(true);
  });

  it('does not implement detectFromEnv (selection via hint or cliDefaultHarness)', () => {
    expect(openCodeAdapter.detectFromEnv).toBeUndefined();
  });
});

describe('cursor adapter shape', () => {
  it('exposes the documented paths under the repo root', () => {
    const paths = cursorAdapter.paths('/repo');
    expect(paths.dir).toBe('/repo/.cursor');
    expect(paths.hooksDir).toBe('/repo/.cursor/hooks');
    expect(paths.skillsDir).toBe('/repo/.cursor/skills');
    expect(paths.settingsFile).toBe('/repo/.cursor/hooks.json');
    expect(paths.commandsDir).toBeUndefined();
  });

  it('declares native Cursor camelCase hook events', () => {
    const events = new Set(cursorAdapter.hooks.map(h => h.event));
    expect(events.has('stop')).toBe(true);
    expect(events.has('sessionEnd')).toBe(true);
    expect(events.has('preCompact')).toBe(true);
    expect(events.has('sessionStart')).toBe(true);
  });

  it('detects Cursor from CURSOR_VERSION', () => {
    expect(cursorAdapter.detectFromEnv?.({ CURSOR_VERSION: '1.0.0' })).toBe(true);
    expect(cursorAdapter.detectFromEnv?.({})).toBe(false);
  });
});

describe('codex adapter shape', () => {
  it('exposes the documented paths under the repo root', () => {
    const paths = codexAdapter.paths('/repo');
    expect(paths.dir).toBe('/repo/.codex');
    expect(paths.hooksDir).toBe('/repo/.codex/hooks');
    expect(paths.skillsDir).toBe('/repo/.agents/skills');
    expect(paths.settingsFile).toBe('/repo/.codex/hooks.json');
    expect(paths.commandsDir).toBeUndefined();
  });

  it('declares Stop and SessionStart hooks only (no SessionEnd or PreCompact)', () => {
    const events = new Set(codexAdapter.hooks.map(h => h.event));
    expect(events.has('Stop')).toBe(true);
    expect(events.has('SessionStart')).toBe(true);
    expect(events.has('SessionEnd')).toBe(false);
    expect(events.has('PreCompact')).toBe(false);
  });
});
