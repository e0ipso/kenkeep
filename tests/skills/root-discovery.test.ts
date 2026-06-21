import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(fileURLToPath(import.meta.url), '..');
const skillsDir = join(here, '../../src/templates-source/skills');

const skills = [
  ['kk-add', '5'],
  ['kk-bootstrap', '3'],
  ['kk-curate', '6'],
  ['kk-migrate', '3'],
  ['kk-session-extract', '3'],
] as const;

describe('shipped kk skills root discovery', () => {
  it('enters the project root before using relative .ai/kenkeep paths', () => {
    for (const [skill, version] of skills) {
      const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

      expect(text, skill).toContain(`<!-- Version: ${version} -->`);
      expect(text, skill).toContain('## Enter the project root');
      expect(text, skill).toContain('while [ "$KK_ROOT" != "/" ]');
      expect(text, skill).toContain('[ ! -d "$KK_ROOT/.ai/kenkeep" ]');
      expect(text, skill).toContain('cd "$KK_ROOT"');
      expect(text.indexOf('## Enter the project root'), skill).toBeLessThan(
        text.indexOf('## Resolve the active harness')
      );
    }
  });
});
