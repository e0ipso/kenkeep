import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import {
  assertValidSessionId,
  buildSessionLogFilename,
  findSessionLogBySessionId,
  renderSessionLog,
} from '../../src/lib/session-log.js';
import { SessionLogFrontmatterSchema } from '../../src/lib/schemas.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SAMPLE_V4 = '4c59be08-badd-42cd-981c-ff3b80cf091a';

describe('renderSessionLog', () => {
  it('produces frontmatter that validates against the Zod schema', () => {
    const md = renderSessionLog({
      sessionId: SAMPLE_V4,
      capturedBy: 'stop',
      capturedAt: '2026-05-11T12:00:00.000Z',
      transcriptHash: 'sha256:deadbeef',
      body: '[USER]: hi\n\n[AGENT]: hello',
    });
    const parsed = matter(md);
    const result = SessionLogFrontmatterSchema.safeParse(parsed.data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_id).toBe(SAMPLE_V4);
      expect(result.data.captured_by).toBe('stop');
      expect(result.data.proposal_status).toBe('pending');
    }
    expect(parsed.content).toContain('## Transcript');
    expect(parsed.content).toContain('[USER]: hi');
  });
});

describe('buildSessionLogFilename', () => {
  it('embeds the full UUID v4 sessionId after the YYYYMMDD-HHmm stamp', () => {
    expect(buildSessionLogFilename('2026-05-11T12:34:00.000Z', SAMPLE_V4)).toBe(
      `20260511-1234-${SAMPLE_V4}.md`
    );
  });
});

describe('findSessionLogBySessionId', () => {
  it('returns the filename whose suffix matches the full sessionId', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kb-find-sess-'));
    try {
      mkdirSync(dir, { recursive: true });
      const target = `20260511-1234-${SAMPLE_V4}.md`;
      writeFileSync(join(dir, target), '');
      writeFileSync(join(dir, `20260511-1235-${'a'.repeat(8)}-bbbb-4ccc-8ddd-eeeeeeeeeeee.md`), '');
      expect(findSessionLogBySessionId(dir, SAMPLE_V4)).toBe(target);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when the directory does not exist', () => {
    expect(findSessionLogBySessionId(join(tmpdir(), 'kb-find-missing-xyz'), SAMPLE_V4)).toBeNull();
  });
});

describe('assertValidSessionId', () => {
  it('returns the lowercased UUID for a valid v4 input', () => {
    expect(assertValidSessionId(SAMPLE_V4.toUpperCase())).toBe(SAMPLE_V4);
    expect(assertValidSessionId(SAMPLE_V4)).toBe(SAMPLE_V4);
  });

  it('rejects an empty string', () => {
    expect(() => assertValidSessionId('')).toThrow(/non-empty string/);
  });

  it('rejects non-string inputs (null, undefined, number)', () => {
    expect(() => assertValidSessionId(null)).toThrow(/non-empty string/);
    expect(() => assertValidSessionId(undefined)).toThrow(/non-empty string/);
    expect(() => assertValidSessionId(42)).toThrow(/non-empty string/);
  });

  it('rejects a non-UUID string', () => {
    expect(() => assertValidSessionId('not-a-uuid')).toThrow(/not a UUID v4/);
  });

  it('rejects a UUID v7-shaped string (version digit is not 4)', () => {
    // Version nibble is 7 in the third group; everything else matches.
    expect(() => assertValidSessionId('01891234-5678-7abc-8def-0123456789ab')).toThrow(
      /not a UUID v4/
    );
  });
});
