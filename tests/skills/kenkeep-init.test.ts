import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const skillDir = resolve(fileURLToPath(import.meta.url), '../../../skills/kenkeep-init');
const initRepo = join(skillDir, 'scripts', 'init-repo.sh');
const cliJs = resolve(skillDir, '../../dist/cli.js');

describe('kenkeep-init scripts', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('init-repo.sh inits git, kenkeep claude+codex+grok, and CLAUDE.md pointer', () => {
    dir = mkdtempSync(join(tmpdir(), 'kk-init-skill-'));
    mkdirSync(dir, { recursive: true });
    execFileSync('sh', [initRepo, dir], {
      cwd: '/tmp',
      env: { ...process.env, KENKEEP_BIN: cliJs, PATH: process.env.PATH },
      stdio: 'pipe',
    });
    expect(existsSync(join(dir, '.git'))).toBe(true);
    expect(existsSync(join(dir, '.ai/kenkeep/.state/installed-version'))).toBe(true);
    expect(existsSync(join(dir, '.grok/hooks/kk.json'))).toBe(true);
    expect(existsSync(join(dir, '.codex/hooks.json'))).toBe(true);
    expect(existsSync(join(dir, '.claude/skills/kk-curate/SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.agents/skills/kk-curate/SKILL.md'))).toBe(true);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toContain('AGENTS.md');
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('kenkeep:kk-index');
  });
});
