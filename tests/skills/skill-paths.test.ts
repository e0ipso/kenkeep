import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repoPaths } from '../../src/lib/paths.js';
import { cleanSandbox, makeSandbox, repoRoot, runCli } from '../helpers.js';

const exec = promisify(execFile);

const SKILLS = ['kk-add', 'kk-bootstrap', 'kk-curate', 'kk-migrate', 'kk-session-extract'] as const;

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

/** Body of the first fenced bash block following `heading`. */
function bashBlockAfter(text: string, heading: string): string {
  const start = text.indexOf(heading);
  expect(start, `heading ${heading}`).toBeGreaterThanOrEqual(0);
  const match = /```bash\n([\s\S]*?)\n```/.exec(text.slice(start));
  expect(match, `bash block after ${heading}`).not.toBeNull();
  return match![1]!;
}

describe('shipped skill session paths', () => {
  it('every session-directory reference in shipped templates is repoPaths().sessionsDir', () => {
    const root = '/repo';
    const expected = `${relative(root, repoPaths(root).sessionsDir)}/`;
    const templateFiles = walkFiles(join(repoRoot, 'templates')).filter(f => f.endsWith('.md'));
    const seen: string[] = [];
    for (const file of templateFiles) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\.ai\/kenkeep\/([^/\s`'"]*sessions?[^/\s`'"]*)\//gi)) {
        seen.push(`${relative(repoRoot, file)}: ${m[0]}`);
        expect(m[0], relative(repoRoot, file)).toBe(expected);
      }
    }
    // Guard against the regex silently matching nothing (kk-curate enumerates sessions).
    expect(seen.some(s => s.startsWith('templates/skills/kk-curate/SKILL.md'))).toBe(true);
  });
});

describe('installed skills from a fixture repo', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = realpathSync(makeSandbox('ai-kk-skill-paths-'));
    await exec('git', ['init', '-q'], { cwd: sandbox });
    const init = await runCli(sandbox, ['init', '--harnesses', 'claude']);
    expect(init.exitCode, init.stderr).toBe(0);
  });

  afterEach(() => cleanSandbox(sandbox));

  it('resolves the project root from a nested package directory', () => {
    const nested = join(sandbox, 'pkg', 'sub');
    mkdirSync(nested, { recursive: true });
    for (const skill of SKILLS) {
      const text = readFileSync(join(sandbox, '.claude/skills', skill, 'SKILL.md'), 'utf8');
      const preamble = bashBlockAfter(text, '## Resolve the project root');
      // POSIX sh, not bash: the preamble must stay portable across harnesses.
      const result = spawnSync('sh', ['-c', preamble], { cwd: nested, encoding: 'utf8' });
      expect(result.stderr, skill).not.toContain('MODULE_NOT_FOUND');
      expect(result.status, `${skill}: ${result.stderr}`).toBe(0);
      // The preamble's only stdout is the resolved root; nothing may precede it.
      expect(result.stdout, skill).toBe(`${sandbox}\n`);
    }
  });
});
