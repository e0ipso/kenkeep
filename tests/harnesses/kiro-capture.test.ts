import { describe, expect, it } from 'vitest';
import { isValidSessionId } from '../../src/harnesses/kiro/hooks/kk-capture.js';

/**
 * The Kiro capture hook interpolates the payload's `session_id` into
 * `~/.kiro/sessions/cli/<id>.json`, so the value has to be validated before it
 * reaches `join`. Two failure modes matter and they pull in opposite
 * directions: too permissive lets a hostile payload escape the sessions
 * directory, too strict silently disables capture forever the first time Kiro
 * changes its id format. These tests pin both edges.
 */
describe('kiro isValidSessionId', () => {
  it('rejects every value that could escape the sessions directory', () => {
    for (const bad of [
      '',
      '.',
      '..',
      '../../etc/passwd',
      'a/../../b',
      'a/b',
      'a\\b',
      '/absolute',
      '.hidden',
      'has space',
      'null\0byte',
      'quote"quote',
      'semi;colon',
      '~/other',
      'x'.repeat(129),
    ]) {
      expect(isValidSessionId(bad), `expected ${JSON.stringify(bad)} to be rejected`).toBe(false);
    }
  });

  it('accepts opaque ids regardless of UUID version, so a format change cannot silently disable capture', () => {
    for (const good of [
      '3f2a1c4e-8b7d-4e9a-9c1f-2d6b5a0e7c31', // UUID v4
      '019715f4-9d7c-7c3e-b2a1-4f5e6d7c8b9a', // UUID v7
      'ses_01HQ8ZK3M4N5P6Q7R8S9T0',
      'kiro-cli-session-42',
      'a',
      'x'.repeat(128),
    ]) {
      expect(isValidSessionId(good), `expected ${JSON.stringify(good)} to be accepted`).toBe(true);
    }
  });
});
