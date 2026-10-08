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

  describe('containment', () => {
    it('never lists the kenkeep root and honors nested .gitignore files at their own scope', async () => {
      // No `.kkignore` entry for `.ai/`: the exclusion must not depend on the
      // user-editable stub. The KB's own `.gitignore` is present (as `init`
      // writes it) but only covers runtime dirs, not nodes/ or conflicts/.
      const kk = join(sandbox, '.ai', 'kenkeep');
      mkdirSync(join(kk, '_sessions'), { recursive: true });
      writeFileSync(join(kk, '.gitignore'), '/_sessions/\n.state/*\n');
      writeFileSync(join(kk, '_sessions', 'private-session.md'), '# private transcript');
      mkdirSync(join(kk, 'nodes', 'conventions'), { recursive: true });
      writeFileSync(join(kk, 'nodes', 'conventions', 'naming.md'), '# existing node');
      mkdirSync(join(kk, 'conflicts'), { recursive: true });
      writeFileSync(join(kk, 'conflicts', 'c-1.md'), '# conflict');
      mkdirSync(join(kk, '.state'), { recursive: true });
      writeFileSync(join(kk, '.state', 'scratch.md'), '# state');
      // Sibling `.ai/` content outside the kenkeep root is ordinary docs.
      writeFileSync(join(sandbox, '.ai', 'notes.md'), '# ai notes');

      // Nested ignore: `pkg/.gitignore` hides `pkg/secret.md` only.
      mkdirSync(join(sandbox, 'pkg'), { recursive: true });
      writeFileSync(join(sandbox, 'pkg', '.gitignore'), 'secret.md\n');
      writeFileSync(join(sandbox, 'pkg', 'secret.md'), '# nested-ignored');
      writeFileSync(join(sandbox, 'pkg', 'README.md'), '# pkg');
      // The nested rule is scoped to `pkg/`: a root-level `secret.md` stays.
      writeFileSync(join(sandbox, 'secret.md'), '# root secret is a doc');

      const result = await runCli(sandbox, ['finddocs']);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(
        [
          '+ .ai/notes.md',
          '+ README.md',
          '+ docs/guide.md',
          '+ pkg/README.md',
          '+ secret.md',
          '',
        ].join('\n')
      );

      // `--from` into the KB root finds nothing rather than leaking it.
      const scoped = await runCli(sandbox, ['finddocs', '--from', '.ai/kenkeep']);
      expect(scoped.exitCode).toBe(0);
      expect(scoped.stdout).toBe('');
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
