import { describe, expect, it } from 'vitest';
import {
  detectHarnessFromEnv,
  resolveActiveHarness,
  resolveWithHint,
} from '../../src/harnesses/detect.js';
import { claudeAdapter } from '../../src/harnesses/claude/index.js';
import { cursorAdapter } from '../../src/harnesses/cursor/index.js';

describe('detectHarnessFromEnv', () => {
  it('detects claude from CLAUDECODE=1 and prefers it over cursor when both are present', () => {
    expect(detectHarnessFromEnv({ CLAUDECODE: '1' })?.id).toBe('claude');
    expect(detectHarnessFromEnv({ CLAUDECODE: '1', CURSOR_VERSION: '1.0.0' })?.id).toBe('claude');
  });

  it('detects cursor from CURSOR_VERSION when CLAUDECODE is absent', () => {
    const adapter = detectHarnessFromEnv({ CURSOR_VERSION: '1.0.0', CLAUDE_PROJECT_DIR: '/repo' });
    expect(adapter?.id).toBe('cursor');
  });

  it('returns null for no signal, a bare CLAUDE_PROJECT_DIR, or CLAUDECODE other than "1"', () => {
    expect(detectHarnessFromEnv({ HOME: '/root', PATH: '/usr/bin' })).toBeNull();
    expect(detectHarnessFromEnv({ CLAUDE_PROJECT_DIR: '/repo' })).toBeNull();
    expect(detectHarnessFromEnv({ CLAUDECODE: '0' })).toBeNull();
  });
});

describe('resolveActiveHarness', () => {
  it('the --harness flag wins over env detection and names the adapter', () => {
    expect(resolveActiveHarness({ flag: 'cursor', env: {} })).toBe(cursorAdapter);
    expect(resolveActiveHarness({ flag: 'claude', env: { CLAUDECODE: '1' } })).toBe(claudeAdapter);
  });

  it('throws when --harness names an unregistered adapter', () => {
    expect(() => resolveActiveHarness({ flag: 'not-real', env: {} })).toThrow(
      /Unsupported harness 'not-real'/
    );
  });

  it('prefers env detection over the CLI default, then falls back to the CLI default', () => {
    expect(
      resolveActiveHarness({ env: { CLAUDECODE: '1' }, cliDefault: 'definitely-not-registered' })
    ).toBe(claudeAdapter);
    expect(resolveActiveHarness({ env: {}, cliDefault: 'cursor' })).toBe(cursorAdapter);
  });

  it('falls back to the first registered harness when nothing else matches', () => {
    expect(resolveActiveHarness({ env: {} }).id).toBe('claude');
  });
});

describe('resolveWithHint', () => {
  it('resolves in precedence order: hint, then env, then configDefault', () => {
    expect(resolveWithHint({ CLAUDECODE: '1' }, 'codex').id).toBe('codex');
    expect(resolveWithHint({ CLAUDECODE: '1' }).id).toBe('claude');
    expect(resolveWithHint({}, undefined, 'codex').id).toBe('codex');
  });

  it('a bogus hint falls through to env, and otherwise throws naming --hint and cliDefaultHarness', () => {
    expect(resolveWithHint({ CLAUDECODE: '1' }, 'definitely-not-registered').id).toBe('claude');
    expect(() => resolveWithHint({})).toThrow(/--hint <id>/);
    expect(() => resolveWithHint({})).toThrow(/cliDefaultHarness/);
  });
});
