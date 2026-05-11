import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { buildSessionLogFilename, renderSessionLog } from '../../src/lib/session-log.js';
import { SessionLogFrontmatterSchema } from '../../src/lib/schemas.js';

describe('renderSessionLog', () => {
  it('produces frontmatter that validates against the Zod schema', () => {
    const md = renderSessionLog({
      sessionId: 'abc',
      capturedBy: 'stop',
      capturedAt: '2026-05-11T12:00:00.000Z',
      transcriptHash: 'sha256:deadbeef',
      secretScanStatus: 'clean',
      body: '[USER]: hi\n\n[AGENT]: hello',
    });
    const parsed = matter(md);
    const result = SessionLogFrontmatterSchema.safeParse(parsed.data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_id).toBe('abc');
      expect(result.data.captured_by).toBe('stop');
      expect(result.data.secret_scan_status).toBe('clean');
      expect(result.data.stage_2_status).toBe('pending');
    }
    expect(parsed.content).toContain('## Stage 1: redacted transcript slice');
    expect(parsed.content).toContain('[USER]: hi');
  });
});

describe('buildSessionLogFilename', () => {
  it('uses YYYYMMDD-HHmm prefix and sanitized id', () => {
    expect(buildSessionLogFilename('2026-05-11T12:34:00.000Z', 'sess-abc/123')).toBe(
      '20260511-1234-sessabc123.md'
    );
  });

  it('falls back to "session" when id has no alphanumerics', () => {
    expect(buildSessionLogFilename('2026-05-11T12:34:00.000Z', '___')).toBe(
      '20260511-1234-session.md'
    );
  });
});
