import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXPECTED_SKILLS } from '../../src/lib/install-skills.js';

const here = resolve(fileURLToPath(import.meta.url), '..');
const skillSource = join(here, '../../src/templates-source/skills/kk-session-extract/SKILL.md');

describe('kk-session-extract skill contract', () => {
  it('is listed in EXPECTED_SKILLS', () => {
    expect(EXPECTED_SKILLS).toContain('kk-session-extract');
  });

  it('documents the live extraction workflow and scoped dedup path', () => {
    const text = readFileSync(skillSource, 'utf8');
    expect(text).toContain('<!-- Version: 3 -->');
    expect(text).toContain('proposal-extract.md');
    expect(text).toContain('[TRANSCRIPT PLACEHOLDER, substituted at runtime]');
    expect(text).toContain('session-log stage-live');
    expect(text).toContain('--session-id');
    expect(text).toContain('--generate-session-id');
    expect(text).toContain('.ai/kenkeep/_sessions/');
    expect(text).toContain('rebalance trigger');
    expect(text).toMatch(/no durable knowledge was found|no writes/i);
    expect(text).toContain('/kk-add');
    expect(text).toContain('/kk-curate');
  });
});
