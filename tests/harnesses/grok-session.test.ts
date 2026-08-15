import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractGrokAnswerText } from '../../src/harnesses/grok/headless.js';
import { isGrokFolderTrusted } from '../../src/harnesses/grok/doctor.js';
import { locateGrokChatHistory } from '../../src/harnesses/grok/session-files.js';
import { assertValidGrokSessionId } from '../../src/harnesses/grok/session-id.js';
import { makeSandbox, cleanSandbox } from '../helpers.js';

describe('assertValidGrokSessionId', () => {
  it('accepts UUID v7 and v4 and rejects garbage', () => {
    expect(assertValidGrokSessionId('01a0079d-d1f1-7212-adaa-75924afc2d7f')).toBe(
      '01a0079d-d1f1-7212-adaa-75924afc2d7f'
    );
    expect(assertValidGrokSessionId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    );
    expect(() => assertValidGrokSessionId('not-a-uuid')).toThrow(/not a UUID/);
    expect(() => assertValidGrokSessionId('')).toThrow(/non-empty/);
  });
});

describe('locateGrokChatHistory', () => {
  it('resolves the encoded-cwd path and rejects a foreign cwd', () => {
    const sandbox = makeSandbox();
    const cwd = join(sandbox, 'repo');
    const other = join(sandbox, 'other');
    mkdirSync(cwd, { recursive: true });
    mkdirSync(other, { recursive: true });
    const sessionId = '01a0079d-d1f1-7212-adaa-75924afc2d7f';
    const group = join(sandbox, 'sessions', encodeURIComponent(cwd), sessionId);
    mkdirSync(group, { recursive: true });
    writeFileSync(join(group, 'chat_history.jsonl'), '{"type":"user"}\n');
    writeFileSync(join(group, 'summary.json'), JSON.stringify({ info: { id: sessionId, cwd } }));
    const env = { GROK_HOME: sandbox };
    expect(locateGrokChatHistory({ sessionId, cwd, env })).toBe(
      realpathSync(join(group, 'chat_history.jsonl'))
    );
    expect(locateGrokChatHistory({ sessionId, cwd: other, env })).toBeNull();
    cleanSandbox(sandbox);
  });
});

describe('isGrokFolderTrusted', () => {
  it('matches an exact path and an ancestor grant', () => {
    const toml = [
      '[folders."/Users/me/Projects"]',
      'trusted = true',
      '',
      '[folders."/tmp/untrusted"]',
      'trusted = false',
      '',
    ].join('\n');
    expect(isGrokFolderTrusted('/Users/me/Projects/App', toml)).toBe(true);
    expect(isGrokFolderTrusted('/Users/me/Projects', toml)).toBe(true);
    expect(isGrokFolderTrusted('/tmp/untrusted', toml)).toBe(false);
    expect(isGrokFolderTrusted('/elsewhere', toml)).toBe(false);
  });
});

describe('extractGrokAnswerText', () => {
  it('pulls text from the json envelope and falls back to raw stdout', () => {
    expect(
      extractGrokAnswerText(JSON.stringify({ text: '{"ok":true}', stopReason: 'end_turn' }))
    ).toBe('{"ok":true}');
    expect(extractGrokAnswerText('{"ok":true}')).toBe('{"ok":true}');
  });
});
