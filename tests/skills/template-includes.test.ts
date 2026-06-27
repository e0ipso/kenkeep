import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(fileURLToPath(import.meta.url), '..');
const root = resolve(here, '../..');
const sourceSkillsDir = join(root, 'src/templates-source/skills');
const partialsDir = join(root, 'src/templates-source/_partials');
const templatesDir = join(root, 'templates');
const renderedSkillsDir = join(templatesDir, 'skills');

const indexRebuildCommand = 'npx --yes kenkeep@latest index rebuild';
const resolveRootCommand = 'node .ai/kenkeep/scripts/kk-detect-root.mjs';

// Every skill resolves the project root through shared partials. Four compose
// the full section partial (heading + lead + command); kk-migrate frames its
// own prose and pulls only the command partial.
const skillsWithResolveSection = [
  'kk-add',
  'kk-bootstrap',
  'kk-curate',
  'kk-session-extract',
] as const;
const allSkills = [...skillsWithResolveSection, 'kk-migrate'] as const;
// Three skills compose the parameterized index-rebuild section partial (heading
// + lead + command); kk-session-extract keeps its own heading and pulls only
// the command.
const skillsWithSectionPartial = ['kk-bootstrap', 'kk-curate', 'kk-migrate'] as const;

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

describe('Handlebars prompt template rendering', () => {
  it('keeps project-root resolution in shared partials', () => {
    const command = readFileSync(join(partialsDir, 'resolve-project-root-command.md.hbs'), 'utf8');
    const section = readFileSync(join(partialsDir, 'resolve-project-root-section.md.hbs'), 'utf8');

    expect(command).toContain(resolveRootCommand);
    expect(command).toContain('cd "$KK_REPO_ROOT"');
    // The section reuses the command partial rather than duplicating the block.
    expect(section).toContain('## Resolve the project root');
    expect(section).toContain('{{> resolve-project-root-command}}');
    expect(section).not.toContain(resolveRootCommand);

    for (const skill of skillsWithResolveSection) {
      const source = readFileSync(join(sourceSkillsDir, skill, 'SKILL.md.hbs'), 'utf8');
      expect(source, skill).toContain('{{> resolve-project-root-section}}');
    }
    // kk-migrate frames its own prose around the bare command partial.
    const migrate = readFileSync(join(sourceSkillsDir, 'kk-migrate', 'SKILL.md.hbs'), 'utf8');
    expect(migrate).toContain('{{> resolve-project-root-command}}');
    expect(migrate).not.toContain('{{> resolve-project-root-section}}');
  });

  it('expands the index-rebuild command through a nested partial', () => {
    const command = readFileSync(join(partialsDir, 'index-rebuild-command.md.hbs'), 'utf8');
    const section = readFileSync(join(partialsDir, 'index-rebuild-section.md.hbs'), 'utf8');

    expect(command).toContain(indexRebuildCommand);
    // The section reuses the command partial rather than duplicating the string.
    expect(section).toContain('{{> index-rebuild-command}}');
    expect(section).toContain('{{heading}}');
    expect(section).toContain('{{lead}}');
    expect(section).not.toContain(indexRebuildCommand);
  });

  it('renders shipped skills self-contained with the resolve block inlined', () => {
    for (const skill of allSkills) {
      const rendered = readFileSync(join(renderedSkillsDir, skill, 'SKILL.md'), 'utf8');
      expect(rendered, skill).toContain('## Resolve the project root');
      expect(rendered, skill).toContain(resolveRootCommand);
      expect(rendered, skill).toContain('cd "$KK_REPO_ROOT"');
    }
  });

  it('inlines the index-rebuild command into kk-session-extract', () => {
    const rendered = readFileSync(
      join(renderedSkillsDir, 'kk-session-extract', 'SKILL.md'),
      'utf8'
    );
    expect(rendered).toContain(
      `## 6. Rebuild the indices\n\n\`\`\`bash\n${indexRebuildCommand}\n\`\`\``
    );
  });

  it('renders parameterized section partials with each skill heading and lead', () => {
    const expected: Record<(typeof skillsWithSectionPartial)[number], [string, string]> = {
      'kk-bootstrap': [
        '### 7. Refresh ENTRY.md and GRAPH.md',
        'After all writes, rebuild the indices so the reviewer sees them in sync with the new nodes:',
      ],
      'kk-curate': ['## 6. Rebuild the indices', 'After all writes:'],
      'kk-migrate': [
        '### 4. Rebuild the indices',
        'Regenerate `ENTRY.md`, `GRAPH.md`, and every folder `index.md` from the relocated tree:',
      ],
    };

    for (const skill of skillsWithSectionPartial) {
      const source = readFileSync(join(sourceSkillsDir, skill, 'SKILL.md.hbs'), 'utf8');
      const rendered = readFileSync(join(renderedSkillsDir, skill, 'SKILL.md'), 'utf8');
      const [heading, lead] = expected[skill];

      expect(source, skill).toContain('{{> index-rebuild-section');
      expect(rendered, skill).toContain(
        `${heading}\n\n${lead}\n\n\`\`\`bash\n${indexRebuildCommand}\n\`\`\``
      );
    }
  });

  it('ships no template artifacts: no partials, no .hbs, no unresolved markers', () => {
    expect(existsSync(join(templatesDir, '_partials'))).toBe(false);

    for (const file of walkFiles(templatesDir)) {
      expect(file.endsWith('.hbs'), file).toBe(false);
      if (!file.endsWith('.md')) continue;
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/\{\{.*?\}\}/s);
    }
  });
});
