import { describe, expect, it } from 'vitest';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import { codexAdapter } from '../../src/harnesses/codex/index.js';
import { copilotAdapter } from '../../src/harnesses/copilot/index.js';
import { cursorAdapter } from '../../src/harnesses/cursor/index.js';
import { openCodeAdapter } from '../../src/harnesses/opencode/index.js';
import { getHarness, hasHarness, listHarnessIds } from '../../src/harnesses/registry.js';

describe('harness registry', () => {
  it('maps every registered id to its adapter and lists them deterministically', () => {
    expect(getHarness('claude')).toBe(claudeAdapter);
    expect(getHarness('codex')).toBe(codexAdapter);
    expect(getHarness('copilot')).toBe(copilotAdapter);
    expect(getHarness('cursor')).toBe(cursorAdapter);
    expect(getHarness('opencode')).toBe(openCodeAdapter);
    expect(listHarnessIds()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'opencode']);
  });

  it('hasHarness recognizes registered ids and getHarness throws for unregistered ones', () => {
    expect(hasHarness('claude')).toBe(true);
    expect(hasHarness('not-a-real-harness')).toBe(false);
    expect(() => getHarness('not-a-real-harness')).toThrow(
      /Unsupported harness 'not-a-real-harness'/
    );
  });
});

describe('opencode adapter shape', () => {
  it('exposes pluginsDir/skillsDir (no hooksDir/settingsFile), declares its events, and has no detector', () => {
    const paths = openCodeAdapter.paths('/repo');
    expect(paths.pluginsDir).toBe('/repo/.opencode/plugins');
    expect(paths.skillsDir).toBe('/repo/.opencode/skills');
    expect(paths.hooksDir).toBeUndefined();
    expect(paths.settingsFile).toBeUndefined();
    const events = new Set(openCodeAdapter.hooks.map(h => h.event));
    expect(events.has('session.idle')).toBe(true);
    expect(events.has('session.created')).toBe(true);
    expect(openCodeAdapter.detectFromEnv).toBeUndefined();
  });
});

describe('cursor adapter shape', () => {
  it('exposes documented paths, declares camelCase events, and detects CURSOR_VERSION', () => {
    const paths = cursorAdapter.paths('/repo');
    expect(paths.hooksDir).toBe('/repo/.cursor/hooks');
    expect(paths.settingsFile).toBe('/repo/.cursor/hooks.json');
    const events = new Set(cursorAdapter.hooks.map(h => h.event));
    expect(events.has('stop')).toBe(true);
    expect(events.has('sessionEnd')).toBe(true);
    expect(events.has('preCompact')).toBe(true);
    expect(cursorAdapter.detectFromEnv?.({ CURSOR_VERSION: '1.0.0' })).toBe(true);
    expect(cursorAdapter.detectFromEnv?.({})).toBe(false);
  });
});

describe('codex adapter shape', () => {
  it('exposes documented paths and declares Stop/SessionStart only', () => {
    const paths = codexAdapter.paths('/repo');
    expect(paths.hooksDir).toBe('/repo/.codex/hooks');
    expect(paths.skillsDir).toBe('/repo/.agents/skills');
    const events = new Set(codexAdapter.hooks.map(h => h.event));
    expect(events.has('Stop')).toBe(true);
    expect(events.has('SessionStart')).toBe(true);
    expect(events.has('SessionEnd')).toBe(false);
    expect(events.has('PreCompact')).toBe(false);
  });
});

describe('copilot adapter shape', () => {
  it('exposes documented paths and declares its events with command payloads', () => {
    const paths = copilotAdapter.paths('/repo');
    expect(paths.hooksDir).toBe('/repo/.copilot/hooks');
    expect(paths.skillsDir).toBe('/repo/.github/skills');
    // settingsFile resolves under the user-level Copilot home, not the repo.
    expect(paths.settingsFile?.endsWith('/hooks/kk.json')).toBe(true);
    expect(paths.settingsFile?.startsWith('/repo/')).toBe(false);
    const events = new Set(copilotAdapter.hooks.map(h => h.event));
    expect(events.has('sessionStart')).toBe(true);
    expect(events.has('sessionEnd')).toBe(true);
    expect(events.has('agentStop')).toBe(true);
    for (const hook of copilotAdapter.hooks) {
      expect(hook.payload).toMatchObject({
        type: 'command',
        timeoutSec: 30,
        env: { KENKEEP_BUILDER_INTERNAL: '1' },
      });
    }
  });
});
