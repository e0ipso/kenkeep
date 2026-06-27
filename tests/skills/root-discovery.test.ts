import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(fileURLToPath(import.meta.url), '..');
// Assert against the rendered, shipped skills: the active-harness block now
// lives in a build-time partial, so the source files are `.md.hbs` stubs.
const skillsDir = join(here, '../../templates/skills');

const skills = [
  ['kk-add', '6'],
  ['kk-bootstrap', '4'],
  ['kk-curate', '7'],
  ['kk-migrate', '5'],
  ['kk-session-extract', '4'],
] as const;

describe('shipped kk skills root discovery', () => {
  it('enters the project root before using relative .ai/kenkeep paths', () => {
    for (const [skill, version] of skills) {
      const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

      expect(text, skill).toContain(`<!-- Version: ${version} -->`);
      expect(text, skill).toContain('/tmp/kk-detect-root.mjs');
      expect(text, skill).toContain('cd "$KK_REPO_ROOT"');
      expect(text.indexOf('cd "$KK_REPO_ROOT"'), skill).toBeLessThan(
        text.indexOf('.ai/kenkeep/scripts/kk-detect-harness.mjs')
      );
    }
  });
});
