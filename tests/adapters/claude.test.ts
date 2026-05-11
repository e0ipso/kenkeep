import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../../src/adapters/claude.js';

describe('ClaudeAdapter', () => {
  it('skillInstallPath() points at .claude/skills', () => {
    expect(new ClaudeAdapter().skillInstallPath()).toBe('.claude/skills');
  });

  it('hookInstallPath() points at .claude/hooks', () => {
    expect(new ClaudeAdapter().hookInstallPath()).toBe('.claude/hooks');
  });

  it('renderSkill() emits SKILL.md frontmatter with name and description', () => {
    const out = new ClaudeAdapter().renderSkill({
      name: 'kb-add',
      description: 'Capture a knowledge-base node manually.',
      body: '# kb-add\n\nDo the thing.\n',
    });
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('name: kb-add');
    expect(out).toContain(
      'description: "Capture a knowledge-base node manually."',
    );
    expect(out).toContain('# kb-add');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('renderSkill() includes allowed-tools when provided', () => {
    const out = new ClaudeAdapter().renderSkill({
      name: 'kb-curate',
      description: 'Curate.',
      body: 'body',
      allowedTools: 'Bash(ai-knowledge-base curate:*)',
    });
    expect(out).toContain('allowed-tools: Bash(ai-knowledge-base curate:*)');
  });

  it('renderSkill() escapes special characters in description via JSON.stringify', () => {
    const out = new ClaudeAdapter().renderSkill({
      name: 'kb-x',
      description: 'has "quotes" and\nnewlines',
      body: 'b',
    });
    // The description line is a single JSON-encoded string; no raw newline leak.
    const descLine = out.split('\n').find((l) => l.startsWith('description:'));
    expect(descLine).toBeDefined();
    expect(descLine).toContain('\\n');
    expect(descLine).toContain('\\"quotes\\"');
  });
});
