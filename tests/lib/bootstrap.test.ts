import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ignore from 'ignore';
import { discoverMarkdownFiles, readBootstrapState, sha256Hex } from '../../src/lib/bootstrap.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';

// The finddocs CLI integration test covers the everyday walker semantics
// (basic .gitignore/.kkignore excludes, .git//node_modules short-circuit,
// repo-relative sorted output, content hashing) and node-write covers the
// bootstrap-state write/merge round-trip. What remains here is the tricky pure
// logic an integration test is a poor probe for: the canonical content hash,
// the full STATIC_SKIPS skip-list, ignore negation/union composition, and the
// empty-state read.

interface Harness {
  root: string;
  sourceDir: string;
  paths: RepoPaths;
  bootstrapStateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kk-bootstrap-'));
  const sourceDir = join(root, 'docs');
  const paths = repoPaths(root);
  const bootstrapStateFile = join(paths.stateDir, 'bootstrap-state.json');
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(paths.nodesDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  // Mirror the real `init` setup so discovery reflects realistic use.
  writeFileSync(join(root, '.kkignore'), '.ai/\n');
  return { root, sourceDir, paths, bootstrapStateFile };
}

describe('sha256Hex', () => {
  it('is stable and matches a known value', () => {
    expect(sha256Hex('hello\n')).toBe(
      '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'
    );
  });
});

describe('discoverMarkdownFiles (skip-list and ignore composition)', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('applies STATIC_SKIPS unconditionally across the full skip-list', () => {
    writeFileSync(join(harness.root, 'intro.md'), 'i');
    writeFileSync(join(harness.root, 'LICENSE.md'), 'l');
    writeFileSync(join(harness.root, 'LICENSE'), 'l');
    writeFileSync(join(harness.root, 'COPYING'), 'c');
    writeFileSync(join(harness.root, 'NOTICE.md'), 'n');
    writeFileSync(join(harness.root, 'CODE_OF_CONDUCT.md'), 'c');
    writeFileSync(join(harness.root, 'CONTRIBUTORS.md'), 'c');
    writeFileSync(join(harness.root, 'AUTHORS.md'), 'a');
    writeFileSync(join(harness.root, 'MAINTAINERS.md'), 'm');
    writeFileSync(join(harness.root, 'CHANGELOG.md'), 'c');
    writeFileSync(join(harness.root, 'CHANGES.md'), 'c');
    writeFileSync(join(harness.root, 'HISTORY.md'), 'h');
    writeFileSync(join(harness.root, 'RELEASE_NOTES.md'), 'r');
    writeFileSync(join(harness.root, 'ENTRY.md'), 'e');
    writeFileSync(join(harness.root, 'INDEX.md'), 'i');
    writeFileSync(join(harness.root, 'GRAPH.md'), 'g');
    mkdirSync(join(harness.root, 'releases'), { recursive: true });
    writeFileSync(join(harness.root, 'releases', 'v1.md'), 'v1');
    const got = discoverMarkdownFiles({ repoRoot: harness.root });
    expect(got.files).toEqual(['intro.md']);
  });

  it('does not filter files that only share a prefix with a static skip', () => {
    writeFileSync(join(harness.root, 'CHANGELOG_FORMAT.md'), 'cf');
    writeFileSync(join(harness.root, 'LICENSE_HEADER.md'), 'lh');
    writeFileSync(join(harness.root, 'licensing-policy.md'), 'lp');
    const got = discoverMarkdownFiles({ repoRoot: harness.root });
    expect(got.files).toEqual(['CHANGELOG_FORMAT.md', 'LICENSE_HEADER.md', 'licensing-policy.md']);
  });

  it('honours .gitignore negation and composes .gitignore ∪ .kkignore (either blocks)', () => {
    writeFileSync(join(harness.sourceDir, 'keep.md'), 'k');
    writeFileSync(join(harness.sourceDir, 'drop.md'), 'd');
    writeFileSync(join(harness.sourceDir, 'kkignored.md'), 'b');
    const got = discoverMarkdownFiles({
      repoRoot: harness.root,
      // Negation: ignore all docs/*.md, then re-admit keep.md.
      gitignore: ignore().add('docs/*.md\n!docs/keep.md'),
      kkignore: ignore().add('docs/kkignored.md'),
    });
    expect(got.files).toEqual(['docs/keep.md']);
  });

  it('honours .kkignore un-ignoring a file under a non-excluded parent', () => {
    writeFileSync(join(harness.sourceDir, 'AGENTS.md'), 'a');
    writeFileSync(join(harness.sourceDir, 'other.md'), 'o');
    writeFileSync(join(harness.root, 'intro.md'), 'i');
    const got = discoverMarkdownFiles({
      repoRoot: harness.root,
      kkignore: ignore().add('*\n!docs/\n!docs/AGENTS.md'),
    });
    expect(got.files).toEqual(['docs/AGENTS.md']);
  });
});

describe('readBootstrapState', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns an empty state when the file is missing', () => {
    const s = readBootstrapState(harness.bootstrapStateFile);
    expect(s.schema_version).toBe(1);
    expect(s.docs).toEqual({});
  });
});
