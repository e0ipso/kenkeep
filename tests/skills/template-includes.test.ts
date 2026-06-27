import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(fileURLToPath(import.meta.url), '..');
const root = resolve(here, '../..');
const sourceSkillsDir = join(root, 'src/templates-source/skills');
const templatesDir = join(root, 'templates');
const renderedSkillsDir = join(templatesDir, 'skills');

const includeMarker = '<!-- kk-include: _partials/resolve-active-harness.md -->';
const indexRebuildCommand = 'npx --yes kenkeep@latest index rebuild --harness "$HARNESS"';
const skillsWithHarnessPartial = [
  'kk-add',
  'kk-bootstrap',
  'kk-curate',
  'kk-migrate',
  'kk-session-extract',
] as const;
const skillsWithIndexRebuildPartial = [
  'kk-bootstrap',
  'kk-curate',
  'kk-migrate',
  'kk-session-extract',
] as const;

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

describe('template partial includes', () => {
  it('keeps active-harness resolution as a shared source partial', () => {
    const partial = readFileSync(
      join(root, 'src/templates-source/_partials/resolve-active-harness.md'),
      'utf8'
    );

    expect(partial).toContain('## Resolve the active harness');
    expect(partial).toContain('/tmp/kk-detect-root.mjs');
    expect(partial).toContain('cd "$KK_REPO_ROOT"');
    expect(partial).toContain('.ai/kenkeep/scripts/kk-detect-harness.mjs');

    for (const skill of skillsWithHarnessPartial) {
      const source = readFileSync(join(sourceSkillsDir, skill, 'SKILL.md'), 'utf8');
      expect(source, skill).toContain(includeMarker);
    }
  });

  it('renders shipped skill templates without unresolved include markers', () => {
    expect(existsSync(join(templatesDir, '_partials'))).toBe(false);

    for (const skill of skillsWithHarnessPartial) {
      const rendered = readFileSync(join(renderedSkillsDir, skill, 'SKILL.md'), 'utf8');
      expect(rendered, skill).not.toContain('kk-include:');
      expect(rendered, skill).toContain('## Resolve the active harness');
      expect(rendered, skill).toContain('/tmp/kk-detect-root.mjs');
      expect(rendered, skill).toContain('cd "$KK_REPO_ROOT"');
      expect(rendered, skill).toContain('.ai/kenkeep/scripts/kk-detect-harness.mjs');
    }
  });

  it('renders parameterized index-rebuild partials into shipped skill templates', () => {
    const sectionPartial = readFileSync(
      join(root, 'src/templates-source/_partials/index-rebuild-section.md'),
      'utf8'
    );

    expect(sectionPartial).toContain('{{heading}}');
    expect(sectionPartial).toContain('{{lead}}');
    expect(sectionPartial).toContain(indexRebuildCommand);

    for (const skill of skillsWithIndexRebuildPartial) {
      const source = readFileSync(join(sourceSkillsDir, skill, 'SKILL.md'), 'utf8');
      const rendered = readFileSync(join(renderedSkillsDir, skill, 'SKILL.md'), 'utf8');

      expect(source, skill).toContain('kk-include: _partials/index-rebuild');
      expect(rendered, skill).toContain(indexRebuildCommand);
      expect(rendered, skill).not.toMatch(/\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}/);
    }
  });

  it('ships no markdown files with unresolved include markers', () => {
    for (const file of walkFiles(templatesDir).filter(path => path.endsWith('.md'))) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toContain('kk-include:');
      expect(text, file).not.toMatch(/\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}/);
    }
  });
});
