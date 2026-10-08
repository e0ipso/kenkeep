import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXPECTED_SKILLS } from '../../src/lib/install-skills.js';

const here = resolve(fileURLToPath(import.meta.url), '..');
// The source is now a `.md.hbs` template; assert against the rendered, shipped skill.
const skillSource = join(here, '../../templates/skills/kk-session-extract/SKILL.md');

describe('kk-session-extract skill contract', () => {
  it('is listed in EXPECTED_SKILLS', () => {
    expect(EXPECTED_SKILLS).toContain('kk-session-extract');
  });

  it('documents the live extraction workflow and scoped dedup path', () => {
    const text = readFileSync(skillSource, 'utf8');
    expect(text).toContain('<!-- Version: 7 -->');
    expect(text).toContain('proposal-extract.md');
    expect(text).toContain('[TRANSCRIPT PLACEHOLDER, substituted at runtime]');
    expect(text).toContain('session-log stage-live');
    expect(text).toContain('--session-id');
    expect(text).toContain('--generate-session-id');
    // The stamp is scoped by the sessions the draft lists, not a dedup flag.
    expect(text).toContain('validate curator-draft "$DRAFT_PATH"');
    expect(text).toContain('drafts collect --run-id "$RUN_ID"');
    expect(text).toContain('--input "$COLLECTED"');
    expect(text).not.toContain('curate-dedup --session-id');
    expect(text).toContain('.ai/kenkeep/_sessions/');
    expect(text).toContain('rebalance trigger');
    expect(text).toMatch(/no durable knowledge was found|no writes/i);
    expect(text).toContain('/kk-add');
    expect(text).toContain('/kk-curate');
  });
});
