import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  discoverMarkdownFiles,
  loadIgnoreFile,
  type DiscoverOptions,
} from '../../src/lib/bootstrap.js';
import { makeSandbox, cleanSandbox, runCli } from '../helpers.js';

/**
 * Builds a tmp repo with a small fixture: a tracked markdown file, a file
 * excluded by `.gitignore`, a file excluded by `.kkignore`, plus the usual
 * walker short-circuits (`.git/`, `node_modules/`). Returns the absolute
 * sandbox path.
 */
function makeFixture(): string {
  const sandbox = makeSandbox('kk-finddocs-');
  // Static-skip directories the walker should never descend into.
  mkdirSync(join(sandbox, '.git'), { recursive: true });
  writeFileSync(join(sandbox, '.git', 'HEAD.md'), '# do not include');
  mkdirSync(join(sandbox, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(sandbox, 'node_modules', 'pkg', 'README.md'), '# do not include');

  // `.gitignore` excludes the `private/` directory entirely.
  writeFileSync(join(sandbox, '.gitignore'), 'private/\n');
  mkdirSync(join(sandbox, 'private'), { recursive: true });
  writeFileSync(join(sandbox, 'private', 'secret.md'), '# secret');

  // `.kkignore` excludes a specific file at the root.
  writeFileSync(join(sandbox, '.kkignore'), 'ignored.md\n');
  writeFileSync(join(sandbox, 'ignored.md'), '# ignored by kb');

  // The survivors:
  writeFileSync(join(sandbox, 'README.md'), '# project\n\nIntro.');
  mkdirSync(join(sandbox, 'docs'), { recursive: true });
  writeFileSync(join(sandbox, 'docs', 'guide.md'), '# guide');

  return sandbox;
}

describe('finddocs CLI command', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = makeFixture();
  });
  afterEach(() => cleanSandbox(sandbox));

  describe('ignore semantics', () => {
    it('emits exactly the files that discoverMarkdownFiles would have surfaced', async () => {
      const result = await runCli(sandbox, ['finddocs']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');

      // Match what `discoverMarkdownFiles` returns when fed the same ignore
      // files. This is the contract we want to preserve: the CLI primitive
      // is just a textual front end on the library walker.
      const gitignore = loadIgnoreFile(join(sandbox, '.gitignore'));
      const kkignore = loadIgnoreFile(join(sandbox, '.kkignore'));
      const opts: DiscoverOptions = { repoRoot: sandbox };
      if (gitignore) opts.gitignore = gitignore;
      if (kkignore) opts.kkignore = kkignore;
      const expected = discoverMarkdownFiles(opts).files;

      const emittedLines = result.stdout.split('\n').filter(l => l.length > 0);
      const emittedRels = emittedLines.map(l => {
        expect(l.startsWith('+ ')).toBe(true);
        return l.slice(2);
      });
      expect(emittedRels.sort()).toEqual([...expected].sort());

      // Sanity: the ignore semantics actually held.
      expect(emittedRels).toContain('README.md');
      expect(emittedRels).toContain('docs/guide.md');
      expect(emittedRels).not.toContain('ignored.md');
      expect(emittedRels).not.toContain('private/secret.md');
      expect(emittedRels.some(r => r.startsWith('.git/'))).toBe(false);
      expect(emittedRels.some(r => r.startsWith('node_modules/'))).toBe(false);
    });

    it('exits 0 with empty output when --from points at a markdown-free subtree', async () => {
      mkdirSync(join(sandbox, 'empty'), { recursive: true });
      const result = await runCli(sandbox, ['finddocs', '--from', 'empty']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('narrows discovery to --from <scope>', async () => {
      const result = await runCli(sandbox, ['finddocs', '--from', 'docs']);
      expect(result.exitCode).toBe(0);
      const lines = result.stdout.split('\n').filter(l => l.length > 0);
      expect(lines).toEqual(['+ docs/guide.md']);
    });

    it('exits nonzero when --from references a missing directory', async () => {
      const result = await runCli(sandbox, ['finddocs', '--from', 'does/not/exist']);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/does not exist/);
    });
  });

  describe('--with-hashes', () => {
    it('appends a tab-separated SHA-256 digest and is byte-identical across runs', async () => {
      const first = await runCli(sandbox, ['finddocs', '--with-hashes']);
      expect(first.exitCode).toBe(0);
      const second = await runCli(sandbox, ['finddocs', '--with-hashes']);
      expect(second.exitCode).toBe(0);
      // Determinism: same fixture, same output, byte-for-byte.
      expect(first.stdout).toBe(second.stdout);

      const lines = first.stdout.split('\n').filter(l => l.length > 0);
      expect(lines.length).toBeGreaterThan(0);
      // Verify the hash for README.md matches a freshly-computed one.
      const readmeLine = lines.find(l => l.includes('README.md'));
      expect(readmeLine).toBeDefined();
      const parts = readmeLine!.split('\t');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('+ README.md');
      const expectedHash = createHash('sha256').update('# project\n\nIntro.', 'utf8').digest('hex');
      expect(parts[1]).toBe(expectedHash);
    });
  });
});
