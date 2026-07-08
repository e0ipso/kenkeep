import { describe, expect, it } from 'vitest';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import { codexAdapter } from '../../src/harnesses/codex/index.js';
import { copilotAdapter } from '../../src/harnesses/copilot/index.js';
import { cursorAdapter } from '../../src/harnesses/cursor/index.js';
import { kiroAdapter } from '../../src/harnesses/kiro/index.js';
import { openCodeAdapter } from '../../src/harnesses/opencode/index.js';
import { getHarness, hasHarness, listHarnessIds } from '../../src/harnesses/registry.js';

describe('harness registry', () => {
  it('maps every registered id to its adapter and lists them deterministically', () => {
    expect(getHarness('claude')).toBe(claudeAdapter);
    expect(getHarness('codex')).toBe(codexAdapter);
    expect(getHarness('copilot')).toBe(copilotAdapter);
    expect(getHarness('cursor')).toBe(cursorAdapter);
    expect(getHarness('kiro')).toBe(kiroAdapter);
    expect(getHarness('opencode')).toBe(openCodeAdapter);
    expect(listHarnessIds()).toEqual(['claude', 'codex', 'copilot', 'cursor', 'kiro', 'opencode']);
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
  it('exposes pluginsDir/skillsDir/shared hooksDir (no settingsFile), declares its events, and has no detector', () => {
    const paths = openCodeAdapter.paths('/repo');
    expect(paths.pluginsDir).toBe('/repo/.opencode/plugins');
    expect(paths.skillsDir).toBe('/repo/.opencode/skills');
    expect(paths.hooksDir).toBe('/repo/.ai/kenkeep/hooks/opencode');
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
    expect(paths.hooksDir).toBe('/repo/.ai/kenkeep/hooks/cursor');
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
  it('exposes documented paths and declares Stop/PreCompact/SessionStart', () => {
    const paths = codexAdapter.paths('/repo');
    expect(paths.hooksDir).toBe('/repo/.ai/kenkeep/hooks/codex');
    expect(paths.skillsDir).toBe('/repo/.agents/skills');
    const events = new Set(codexAdapter.hooks.map(h => h.event));
    expect(events.has('Stop')).toBe(true);
    expect(events.has('SessionStart')).toBe(true);
    // Codex emits no SessionEnd; PreCompact exists since Codex 0.139 and
    // carries the about-to-compact capture, matching Claude and Cursor.
    expect(events.has('SessionEnd')).toBe(false);
    expect(events.has('PreCompact')).toBe(true);
  });
});

describe('copilot adapter shape', () => {
  it('exposes documented paths and declares its events with command payloads', () => {
    const paths = copilotAdapter.paths('/repo');
    expect(paths.hooksDir).toBe('/repo/.ai/kenkeep/hooks/copilot');
    expect(paths.skillsDir).toBe('/repo/.github/skills');
    // settingsFile resolves to the repo-level .github/hooks/kk.json (Copilot
    // loads repo-level hooks before user-level), never under the user home.
    expect(paths.settingsFile).toBe('/repo/.github/hooks/kk.json');
    const events = new Set(copilotAdapter.hooks.map(h => h.event));
    expect(events.has('sessionStart')).toBe(true);
    expect(events.has('sessionEnd')).toBe(true);
    expect(events.has('agentStop')).toBe(true);
    for (const hook of copilotAdapter.hooks) {
      expect(hook.payload).toMatchObject({
        type: 'command',
        timeoutSec: 30,
      });
      // The payload must NOT carry a static recursion-guard env: the config
      // is user-global and applies to every session, so stamping the guard
      // here turned every hook into a no-op in live sessions. The guard
      // rides the headless runner's child env instead.
      expect(hook.payload).not.toHaveProperty('env');
    }
  });
});

describe('kiro adapter shape', () => {
  it('exposes documented paths, has no hooks (v1), and detects KIRO_SESSION_ID', () => {
    const paths = kiroAdapter.paths('/repo');
    expect(paths.dir).toBe('/repo/.kiro');
    expect(paths.hooksDir).toBe('/repo/.ai/kenkeep/hooks/kiro');
    expect(paths.skillsDir).toBe('/repo/.kiro/skills');
    expect(paths.settingsFile).toBeUndefined();
    // Kiro v1 has no session lifecycle hooks
    expect(kiroAdapter.hooks).toHaveLength(0);
    expect(kiroAdapter.detectFromEnv?.({ KIRO_SESSION_ID: 'ses_abc123' })).toBe(true);
    expect(kiroAdapter.detectFromEnv?.({ KIRO_SESSION_ID: '' })).toBe(false);
    expect(kiroAdapter.detectFromEnv?.({})).toBe(false);
  });
});
