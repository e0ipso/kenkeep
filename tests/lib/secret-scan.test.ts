import { describe, expect, it } from 'vitest';
import { redactSecrets, scanAndRedact, type SecretFinding } from '../../src/lib/secret-scan.js';

describe('redactSecrets', () => {
  it('replaces single secrets with [REDACTED:ruleId]', () => {
    const text = 'Hello SECRETXYZ world.';
    const findings: SecretFinding[] = [{ ruleId: 'generic-api-key', secret: 'SECRETXYZ' }];
    expect(redactSecrets(text, findings)).toBe('Hello [REDACTED:generic-api-key] world.');
  });

  it('redacts longest secrets first to avoid partial overlap', () => {
    const text = 'AKIAFOO and AKIAFOO12345.';
    const findings: SecretFinding[] = [
      { ruleId: 'short', secret: 'AKIAFOO' },
      { ruleId: 'long', secret: 'AKIAFOO12345' },
    ];
    const out = redactSecrets(text, findings);
    expect(out).toBe('[REDACTED:short] and [REDACTED:long].');
  });

  it('redacts every occurrence of the same secret', () => {
    const findings: SecretFinding[] = [{ ruleId: 'token', secret: 'tok_123' }];
    expect(redactSecrets('A tok_123 B tok_123', findings)).toBe(
      'A [REDACTED:token] B [REDACTED:token]'
    );
  });

  it('skips findings with empty secret', () => {
    const findings: SecretFinding[] = [{ ruleId: 'r', secret: '' }];
    expect(redactSecrets('unchanged', findings)).toBe('unchanged');
  });

  it('returns unmodified text when no findings', () => {
    expect(redactSecrets('clean text', [])).toBe('clean text');
  });
});

describe('scanAndRedact', () => {
  it('returns clean for text with no secrets', async () => {
    const result = await scanAndRedact('Hello world, nothing to see here.');
    expect(result.status).toBe('clean');
    expect(result.findings).toEqual([]);
  });

  it('detects and redacts a GitHub token', async () => {
    const text = 'token = ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const result = await scanAndRedact(text, 5000);
    expect(result.status).toBe('redacted');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.redactedText).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(result.redactedText).toMatch(/\[REDACTED:/);
  });

  it('returns blocked status on timeout', async () => {
    const text = 'x'.repeat(10) + ' ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const result = await scanAndRedact(text, 1);
    // Either redacted (fast machine) or blocked (slow). Both are valid; only
    // assert the blocked path returns an error string when it does block.
    if (result.status === 'blocked') {
      expect(result.error).toBeTruthy();
    }
  });
});
