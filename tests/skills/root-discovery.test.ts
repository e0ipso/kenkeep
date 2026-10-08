import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(fileURLToPath(import.meta.url), '..');
// Assert against the rendered, shipped skills: the active-harness block now
// lives in a build-time partial, so the source files are `.md.hbs` stubs.
const skillsDir = join(here, '../../templates/skills');

const skills = [
  ['kk-add', '8'],
  ['kk-bootstrap', '7'],
  ['kk-curate', '13'],
  ['kk-migrate', '8'],
  ['kk-session-extract', '7'],
] as const;

describe('shipped kk skills root discovery', () => {
  it('resolves the project root via the shipped detector and cds into it', () => {
    for (const [skill, version] of skills) {
      const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

      expect(text, skill).toContain(`<!-- Version: ${version} -->`);
      // Skills invoke the single shipped root detector (no inlined heredoc) and
      // cd into the resolved root before any relative .ai/kenkeep command.
      expect(text, skill).toContain('node .ai/kenkeep/scripts/kk-detect-root.mjs');
      expect(text, skill).toContain('cd "$KK_REPO_ROOT"');
      expect(text, skill).not.toContain('/tmp/kk-detect-root.mjs');
    }
  });
});

describe('shipped kk-curate batch agent prompt', () => {
  it('carries its own Version comment', () => {
    const text = readFileSync(join(skillsDir, 'kk-curate', 'batch-agent-prompt.md'), 'utf8');
    expect(text).toMatch(/^<!--\n {2}Version: 1\n/m);
  });
});
