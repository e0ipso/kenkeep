import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateGraph, generateIndex } from '../../src/lib/index-gen.js';
import { computeNodesHash } from '../../src/lib/nodes.js';

interface NodeSeed {
  /** Topical folder under nodes/ (POSIX-style; '' = root). */
  dir: string;
  kind: 'practice' | 'map';
  id: string;
  title: string;
  summary: string;
  tags?: string[];
  relates_to?: string[];
}

function seedNodes(root: string, seeds: NodeSeed[]): void {
  for (const s of seeds) {
    const dir = s.dir ? join(root, ...s.dir.split('/')) : root;
    mkdirSync(dir, { recursive: true });
    const body = `# ${s.title}\n\nBody.\n`;
    const fm = matter.stringify(body, {
      schema_version: 2,
      id: s.id,
      title: s.title,
      kind: s.kind,
      tags: s.tags ?? [],
      derived_from: [],
      relates_to: s.relates_to ?? [],
      confidence: 'high',
      summary: s.summary,
    });
    writeFileSync(join(dir, `${s.id}.md`), fm);
  }
}

describe('generateIndex (recursive per-folder)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-index-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('emits one index.md body per folder, including the root and ancestors', () => {
    seedNodes(root, [
      { dir: 'topic-a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'sa' },
      { dir: 'topic-a/sub', kind: 'map', id: 'map-deep', title: 'Deep', summary: 'sd' },
      { dir: 'topic-b', kind: 'map', id: 'map-b', title: 'B', summary: 'sb' },
    ]);
    const out = generateIndex(root);
    expect(out.nodeCount).toBe(3);
    // Root, topic-a, topic-a/sub, topic-b all carry an index node.
    expect([...out.folders.keys()].sort()).toEqual(['', 'topic-a', 'topic-a/sub', 'topic-b']);
    // The root index node lists its immediate subfolders as imperative Load
    // pointers, not its descendants' leaves. (The ENTRY catalog uses ## Branches;
    // the per-folder root index node uses ## Subfolders.)
    // Hrefs resolve as standard markdown relative links from the file that
    // carries them: a folder index links relative to its own directory; the
    // ENTRY catalog (one level above nodes/) links with the nodes/ prefix.
    const rootBody = out.folders.get('')!.content;
    expect(rootBody).toContain('## Subfolders');
    expect(rootBody).toContain('Load [`topic-a/`](topic-a/index.md)');
    expect(rootBody).toContain('Load [`topic-b/`](topic-b/index.md)');
    expect(rootBody).not.toContain('topic-a/sub/index.md'); // not an immediate child of root
    // The ENTRY catalog carries the branch list under ## Branches.
    expect(out.rootCatalog).toContain('## Branches');
    expect(out.rootCatalog).toContain('Load [`topic-a/`](nodes/topic-a/index.md)');
    // topic-a lists its leaf (Open pointer) and its immediate subfolder (Load).
    const aBody = out.folders.get('topic-a')!.content;
    expect(aBody).toContain('Open [**A**](practice-a.md)');
    expect(aBody).toContain('Load [`sub/`](sub/index.md)');
  });

  it('splits leaves by kind facet into Conventions and Components', () => {
    seedNodes(root, [
      { dir: 'topic', kind: 'practice', id: 'practice-x', title: 'X', summary: 's', tags: ['foo'] },
      { dir: 'topic', kind: 'map', id: 'map-y', title: 'Y', summary: 's', tags: ['bar'] },
    ]);
    const body = generateIndex(root).folders.get('topic')!.content;
    expect(body).toContain('## Conventions (how we build)');
    expect(body).toContain('## Components (what exists)');
    expect(body).toContain('## By topic');
    // Imperative leaf pointer carries verb, title, file-relative path, summary, tags.
    expect(body).toContain('- Open [**X**](practice-x.md) to learn about: s #foo');
  });

  it('is byte-identical across two consecutive generations (deterministic)', () => {
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-1', title: 'One', summary: 's' },
      {
        dir: 'b',
        kind: 'map',
        id: 'map-2',
        title: 'Two',
        summary: 's',
        relates_to: ['practice-1'],
      },
    ]);
    const first = generateIndex(root);
    const second = generateIndex(root);
    expect([...second.folders.keys()]).toEqual([...first.folders.keys()]);
    for (const [dir, folder] of first.folders) {
      expect(second.folders.get(dir)!.content).toBe(folder.content);
    }
  });

  it('orders bullets by GLOBAL in-degree, counting cross-folder edges', () => {
    // hub lives in folder-a; two referrers live in folder-b and point at it.
    // Within folder-a, hub must outrank a same-folder zero-in-degree node even
    // though hub has no edges from within folder-a.
    seedNodes(root, [
      { dir: 'folder-a', kind: 'practice', id: 'practice-hub', title: 'Hub', summary: 's' },
      { dir: 'folder-a', kind: 'practice', id: 'practice-alone', title: 'Alone', summary: 's' },
      {
        dir: 'folder-b',
        kind: 'practice',
        id: 'practice-ref-1',
        title: 'Ref 1',
        summary: 's',
        relates_to: ['practice-hub'],
      },
      {
        dir: 'folder-b',
        kind: 'practice',
        id: 'practice-ref-2',
        title: 'Ref 2',
        summary: 's',
        relates_to: ['practice-hub'],
      },
    ]);
    const aBody = generateIndex(root).folders.get('folder-a')!.content;
    const hubIdx = aBody.indexOf('**Hub**');
    const aloneIdx = aBody.indexOf('**Alone**');
    expect(hubIdx).toBeGreaterThan(-1);
    expect(aloneIdx).toBeGreaterThan(-1);
    expect(hubIdx).toBeLessThan(aloneIdx);
  });

  it('renders an empty folder and a singleton folder with well-defined bodies', () => {
    // empty-topic is an explicit folder with no leaves; single-topic has one.
    mkdirSync(join(root, 'empty-topic'), { recursive: true });
    writeFileSync(join(root, 'empty-topic', '.gitkeep'), '');
    seedNodes(root, [
      { dir: 'single-topic', kind: 'map', id: 'map-only', title: 'Only', summary: 's' },
    ]);
    const out = generateIndex(root);
    // The empty folder is not a leaf dir, so it only appears if a leaf or an
    // ancestor chain references it. A truly empty sibling folder with no leaves
    // is not part of the leaf-derived dir set; the singleton folder is.
    const single = out.folders.get('single-topic');
    expect(single).toBeDefined();
    expect(single!.content).toContain('**Only**');
    expect(single!.metrics.occupancy).toBe(1);
    // Root always renders, even with no direct leaves.
    const rootFolder = out.folders.get('')!;
    expect(rootFolder.content).toContain('# kenkeep Index');
    expect(rootFolder.content).toContain('_None yet._');
  });

  it('exposes per-folder metrics (occupancy, tag diversity, leaf size)', () => {
    seedNodes(root, [
      { dir: 'm', kind: 'map', id: 'map-a', title: 'A', summary: 's', tags: ['x', 'y'] },
      { dir: 'm', kind: 'map', id: 'map-b', title: 'B', summary: 's', tags: ['y', 'z'] },
    ]);
    const metrics = generateIndex(root).folders.get('m')!.metrics;
    expect(metrics.occupancy).toBe(2);
    expect(metrics.tagDiversity).toBe(3); // x, y, z
    expect(metrics.leafSize).toBeGreaterThan(0);
  });

  it('renders missing nodes/ as a root-only empty index', () => {
    const out = generateIndex(join(root, 'nope'));
    expect(out.nodeCount).toBe(0);
    expect([...out.folders.keys()]).toEqual(['']);
    expect(out.folders.get('')!.content).toContain('_None yet._');
  });

  it('frontmatter carries the bumped schema_version', () => {
    seedNodes(root, [{ dir: 't', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    expect(generateIndex(root).folders.get('t')!.content).toMatch(/schema_version:\s*2/);
  });
});

/**
 * The folder `summary` is the single non-deterministic input: harvested from the
 * pre-rebuild on-disk index.md / ENTRY.md and re-stamped verbatim, so it
 * survives the otherwise-total rebuild. These tests cover that round-trip and
 * the cross-folder hash localization that keeps it safe.
 */
describe('generateIndex self-preserves the folder summary', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-summary-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Write a folder's index.md to disk with a self-preserve `summary`. */
  function writeFolderIndexWithSummary(dir: string, summary: string): void {
    const d = dir ? join(root, ...dir.split('/')) : root;
    mkdirSync(d, { recursive: true });
    const body = matter.stringify('# placeholder\n', {
      schema_version: 2,
      nodes_hash: 'sha256:placeholder',
      node_count: 0,
      summary,
    });
    writeFileSync(join(d, 'index.md'), body);
  }

  function summaryOf(content: string): string | undefined {
    return matter(content).data.summary as string | undefined;
  }

  it('carries a prior folder summary across a rebuild and emits no key when absent', () => {
    seedNodes(root, [
      { dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 'leaf summary' },
      { dir: 'bare', kind: 'map', id: 'map-b', title: 'B', summary: 'leaf summary' },
    ]);
    // Author a summary into one folder's index.md; leave the other bare.
    writeFolderIndexWithSummary('topic', 'how we cluster topical knowledge');

    const out = generateIndex(root);
    // The authored summary is carried verbatim into the regenerated frontmatter.
    expect(summaryOf(out.folders.get('topic')!.content)).toBe('how we cluster topical knowledge');
    // A folder with no prior index.md emits no summary key (not summary: "").
    const bare = out.folders.get('bare')!.content;
    expect(summaryOf(bare)).toBeUndefined();
    expect(bare).not.toContain('summary:');
  });

  it('treats an empty-string summary as absent (no key emitted)', () => {
    seedNodes(root, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    writeFolderIndexWithSummary('topic', '   ');
    const content = generateIndex(root).folders.get('topic')!.content;
    expect(summaryOf(content)).toBeUndefined();
    expect(content).not.toContain('summary:');
  });

  it('self-preserves the ROOT summary harvested from the entry catalog (entryFile)', () => {
    // ENTRY.md lives OUTSIDE nodesDir (in kkDir) in production; mirror that here
    // by giving generateIndex a dedicated nodes/ subdir and a sibling ENTRY.md.
    const nodesDir = join(root, 'nodes');
    seedNodes(nodesDir, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    const entryFile = join(root, 'ENTRY.md');
    writeFileSync(
      entryFile,
      matter.stringify('# kenkeep\n', {
        schema_version: 2,
        nodes_hash: 'sha256:placeholder',
        node_count: 1,
        summary: 'the whole knowledge base on disk',
      })
    );
    const out = generateIndex(nodesDir, entryFile);
    expect(summaryOf(out.rootCatalog)).toBe('the whole knowledge base on disk');
    // Without the entryFile the root summary cannot be harvested (no key).
    const noEntry = generateIndex(nodesDir);
    expect(summaryOf(noEntry.rootCatalog)).toBeUndefined();
  });

  it('never invents or mutates a summary (carried byte-for-byte)', () => {
    seedNodes(root, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    const authored = 'verbatim text with punctuation: keep it.';
    writeFolderIndexWithSummary('topic', authored);
    expect(summaryOf(generateIndex(root).folders.get('topic')!.content)).toBe(authored);
  });

  it('preserves a hand-authored summary even when other index frontmatter is malformed', () => {
    seedNodes(root, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    // A human hand-edits the folder summary but leaves a malformed nodes_hash and
    // an out-of-schema node_count. The authored summary must still survive: it is
    // harvested independently of the machine-owned fields the rebuild recomputes.
    const d = join(root, 'topic');
    mkdirSync(d, { recursive: true });
    writeFileSync(
      join(d, 'index.md'),
      matter.stringify('# hand edited\n', {
        schema_version: 2,
        nodes_hash: 12345, // wrong type (number, not string)
        node_count: 'lots', // wrong type (string, not number)
        summary: 'hand-authored, must survive',
      })
    );
    const out = generateIndex(root);
    expect(summaryOf(out.folders.get('topic')!.content)).toBe('hand-authored, must survive');
    // ...and the folder is NOT mislabeled as missing a summary on this rebuild.
    expect(out.foldersMissingSummary).not.toContain('topic');
  });

  it('reports non-root folders lacking a summary (warn, never block), excluding the root', () => {
    seedNodes(root, [
      { dir: 'has', kind: 'map', id: 'map-a', title: 'A', summary: 's' },
      { dir: 'missing', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
      { dir: 'also-missing', kind: 'map', id: 'map-c', title: 'C', summary: 's' },
    ]);
    writeFolderIndexWithSummary('has', 'this folder has a summary');
    const out = generateIndex(root);
    // Sorted, only the un-summarized non-root folders; the root is never listed.
    expect(out.foldersMissingSummary).toEqual(['also-missing', 'missing']);
    expect(out.foldersMissingSummary).not.toContain('');
    expect(out.foldersMissingSummary).not.toContain('has');
  });

  it('editing one leaf leaves every unrelated folder summary byte-stable', () => {
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v1', tags: ['x'] },
      { dir: 'b', kind: 'map', id: 'map-b', title: 'B', summary: 'v1', tags: ['y'] },
    ]);
    writeFolderIndexWithSummary('a', 'summary for folder a');
    writeFolderIndexWithSummary('b', 'summary for folder b');

    const before = generateIndex(root);
    const bSummaryBefore = summaryOf(before.folders.get('b')!.content);
    const bHashBefore = matter(before.folders.get('b')!.content).data.nodes_hash;

    // Edit a leaf in folder a only.
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v2', tags: ['x'] },
    ]);

    const after = generateIndex(root);
    // Folder b's summary AND its per-folder nodes_hash are untouched: a leaf edit
    // in folder a perturbs neither (hash localization + self-preserve).
    expect(summaryOf(after.folders.get('b')!.content)).toBe(bSummaryBefore);
    expect(matter(after.folders.get('b')!.content).data.nodes_hash).toBe(bHashBefore);
  });
});

/**
 * The actionable rendering redesign: imperative Load/Open pointers splicing
 * summaries, an embedded descent directive, a parent breadcrumb on non-root
 * indexes, no body statistics, and a proximity-ranked `## By topic`. These
 * assert the custom render logic (the Jaccard ranking and the full body shape),
 * not the Markdown serializer.
 */
describe('generateIndex actionable rendering', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-render-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Count non-overlapping occurrences of a substring. */
  function countOccurrences(haystack: string, needle: string): number {
    let count = 0;
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
      count += 1;
      idx = haystack.indexOf(needle, idx + needle.length);
    }
    return count;
  }

  /** The leading sentence of the embedded descent directive, for occurrence checks. */
  const DIRECTIVE_MARKER = '> kenkeep navigation:';

  function writeFolderIndexWithSummary(dir: string, summary: string): void {
    const d = dir ? join(root, ...dir.split('/')) : root;
    mkdirSync(d, { recursive: true });
    writeFileSync(
      join(d, 'index.md'),
      matter.stringify('# placeholder\n', {
        schema_version: 2,
        nodes_hash: 'sha256:placeholder',
        node_count: 0,
        summary,
      })
    );
  }

  it('splices a child folder summary into a Load pointer and falls back to the Title-cased name', () => {
    seedNodes(root, [
      { dir: 'with-summary', kind: 'map', id: 'map-a', title: 'A', summary: 's' },
      { dir: 'no-summary', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
    ]);
    writeFolderIndexWithSummary('with-summary', 'how summaries are carried');

    const rootBody = generateIndex(root).folders.get('')!.content;
    // Child WITH a summary: spliced verbatim, sentence terminated with a period.
    expect(rootBody).toContain(
      'Load [`with-summary/`](with-summary/index.md) for more information on how summaries are carried.'
    );
    // Child WITHOUT a summary: Title-cased folder-name fallback.
    expect(rootBody).toContain(
      'Load [`no-summary/`](no-summary/index.md) for more information on No Summary.'
    );
  });

  it('embeds the descent directive exactly once per body, in both the root catalog and a folder index', () => {
    seedNodes(root, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    const out = generateIndex(root);
    expect(countOccurrences(out.rootCatalog, DIRECTIVE_MARKER)).toBe(1);
    expect(countOccurrences(out.folders.get('topic')!.content, DIRECTIVE_MARKER)).toBe(1);
  });

  it('requires a relevant leaf read in folder index bodies but not ENTRY.md', () => {
    seedNodes(root, [{ dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    const out = generateIndex(root);
    const leafReadDirective =
      'This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.';

    expect(out.folders.get('')!.content).toContain(leafReadDirective);
    expect(out.folders.get('topic')!.content).toContain(leafReadDirective);
    expect(out.rootCatalog).not.toContain(leafReadDirective);
  });

  it('renders the parent breadcrumb on non-root indexes only', () => {
    seedNodes(root, [
      { dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' },
      { dir: 'topic/sub', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
    ]);
    const out = generateIndex(root);
    // Root catalog and root index node carry no breadcrumb.
    expect(out.rootCatalog).not.toContain('↑ Parent:');
    expect(out.folders.get('')!.content).not.toContain('↑ Parent:');
    // A top-level folder points at the tree root; a nested folder at its parent.
    expect(out.folders.get('topic')!.content).toContain('↑ Parent: [kenkeep](../index.md)');
    expect(out.folders.get('topic/sub')!.content).toContain('↑ Parent: [topic](../index.md)');
  });

  it('emits no body statistics (node counts, token estimates, rollups, branch counts)', () => {
    seedNodes(root, [
      { dir: 'topic', kind: 'map', id: 'map-a', title: 'A', summary: 's' },
      { dir: 'topic/sub', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
    ]);
    const out = generateIndex(root);
    const bodies = [out.rootCatalog, ...[...out.folders.values()].map(f => f.content)];
    for (const body of bodies) {
      // Strip the frontmatter (node_count legitimately lives there).
      const content = matter(body).content;
      expect(content).not.toMatch(/node\(s\)/);
      expect(content).not.toMatch(/estimated tokens/);
      expect(content).not.toMatch(/in subtree/);
    }
  });

  it('reworks ## By topic into <=3 path+summary entries per tag, ranked by whole-tree tag Jaccard', () => {
    // The folder under test (`home`) has one direct `shared` leaf, so `shared`
    // is a bucket for it. Candidates are drawn from the WHOLE tree (cohort of 5)
    // and ranked by summed tag-Jaccard centrality, capped at 3. Two identical
    // multi-tag hubs match each other at Jaccard 1.0 and partially match the
    // spoke, so they out-score the lonely single-tag leaves.
    seedNodes(root, [
      {
        dir: 'home',
        kind: 'map',
        id: 'map-home',
        title: 'Home',
        summary: 'home',
        tags: ['shared'],
      },
      {
        dir: 'a',
        kind: 'map',
        id: 'map-hub1',
        title: 'Hub One',
        summary: 'hub one',
        tags: ['shared', 'x', 'y'],
      },
      {
        dir: 'a',
        kind: 'map',
        id: 'map-hub2',
        title: 'Hub Two',
        summary: 'hub two',
        tags: ['shared', 'x', 'y'],
      },
      { dir: 'a', kind: 'map', id: 'map-x', title: 'X', summary: 'x one', tags: ['shared', 'x'] },
      // A fifth single-tag node so the whole-tree cohort exceeds the cap of 3.
      { dir: 'b', kind: 'map', id: 'map-z', title: 'Z', summary: 'z one', tags: ['shared'] },
    ]);
    const body = generateIndex(root).folders.get('home')!.content;
    // Isolate the `### #shared` subsection of `## By topic`.
    const sharedIdx = body.indexOf('### #shared');
    expect(sharedIdx).toBeGreaterThan(-1);
    const after = body.slice(sharedIdx + '### #shared'.length);
    const nextHeading = after.search(/\n##/);
    const bucket = nextHeading === -1 ? after : after.slice(0, nextHeading);
    const entries = bucket.split('\n').filter(l => l.startsWith('- Open '));
    // Capped at 3, each a followable path+summary Open pointer.
    expect(entries.length).toBe(3);
    for (const e of entries) expect(e).toMatch(/^- Open \[\*\*.+\*\*\]\(.+\) — .+/);
    // The two identical hubs are the most central; the lonely single-tag leaves
    // (Home, Z) fall below the cap. Deterministic tie-break: title asc.
    expect(entries[0]).toContain('[**Hub One**]');
    expect(entries[1]).toContain('[**Hub Two**]');
    expect(entries[2]).toContain('[**X**]');
    expect(bucket).not.toContain('[**Z**]');
  });

  it('escapes structure-breaking markdown when splicing a leaf title and summary', () => {
    seedNodes(root, [
      {
        dir: 'topic',
        kind: 'map',
        id: 'map-tricky',
        title: 'Title [with] `code`',
        summary: 'summary with ] bracket and ` tick',
      },
    ]);
    const content = matter(generateIndex(root).folders.get('topic')!.content).content;
    // Title (inside the link label) and summary (trailing prose) are both escaped
    // so a stray `]`/backtick cannot break the link or the list item.
    expect(content).toContain('Open [**Title \\[with\\] \\`code\\`**](map-tricky.md)');
    expect(content).toContain('to learn about: summary with \\] bracket and \\` tick');
  });

  it('escapes a spliced folder summary in the Load pointer but stores it verbatim', () => {
    seedNodes(root, [{ dir: 'child', kind: 'map', id: 'map-a', title: 'A', summary: 's' }]);
    writeFolderIndexWithSummary('child', 'edge ] cases and `code`');
    const out = generateIndex(root);
    // Parent (root index node) Load pointer: escaped so the bullet stays intact.
    expect(out.folders.get('')!.content).toContain(
      'for more information on edge \\] cases and \\`code\\`.'
    );
    // The folder's own frontmatter keeps the authored summary byte-for-byte.
    expect(matter(out.folders.get('child')!.content).data.summary).toBe('edge ] cases and `code`');
  });
});

describe('computeNodesHash stability (leaves only, excludes index.md)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-hash-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('is unchanged when generated index.md files are (re)written', () => {
    seedNodes(root, [
      { dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 's' },
      { dir: 'b', kind: 'map', id: 'map-b', title: 'B', summary: 's' },
    ]);
    const baseline = computeNodesHash(root);
    // Write index.md into every folder (simulating an index rebuild).
    for (const [dir, folder] of generateIndex(root).folders) {
      const d = dir ? join(root, ...dir.split('/')) : root;
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'index.md'), folder.content);
    }
    expect(computeNodesHash(root)).toBe(baseline);
    // Rewriting index.md again does not perturb the hash.
    for (const [dir, folder] of generateIndex(root).folders) {
      const d = dir ? join(root, ...dir.split('/')) : root;
      writeFileSync(join(d, 'index.md'), folder.content);
    }
    expect(computeNodesHash(root)).toBe(baseline);
  });

  it('changes when a leaf changes', () => {
    seedNodes(root, [{ dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v1' }]);
    const h1 = computeNodesHash(root);
    seedNodes(root, [{ dir: 'a', kind: 'practice', id: 'practice-a', title: 'A', summary: 'v2' }]);
    expect(computeNodesHash(root)).not.toBe(h1);
  });
});

describe('cross references render the current path resolved by id', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-ref-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('renders each leaf at its current path; GRAPH lists edges by id', () => {
    seedNodes(root, [
      {
        dir: 'deep/nested',
        kind: 'map',
        id: 'map-target',
        title: 'Target',
        summary: 's',
        tags: ['shared'],
      },
      {
        dir: 'other',
        kind: 'practice',
        id: 'practice-src',
        title: 'Src',
        summary: 's',
        tags: ['shared'],
        relates_to: ['map-target'],
      },
    ]);
    const out = generateIndex(root);
    // The target leaf renders file-relative in its own folder index, and the
    // cross-tree By-topic pull from another folder climbs with ../ segments.
    expect(out.folders.get('deep/nested')!.content).toContain('Open [**Target**](map-target.md)');
    expect(out.folders.get('other')!.content).toContain('../deep/nested/map-target.md');
    // GRAPH overlay references by id and records the current path.
    const graph = generateGraph(root).content;
    expect(graph).toContain('## map-target');
    expect(graph).toContain('## practice-src');
    expect(graph).toContain('relates_to:** map-target');
    expect(graph).toContain('path:** deep/nested/map-target.md');
  });
});

describe('generateGraph', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-graph-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('emits a per-node block with edges and frontmatter', () => {
    seedNodes(root, [
      { dir: 'x', kind: 'practice', id: 'practice-a', title: 'A', summary: 'a' },
      { dir: 'y', kind: 'map', id: 'map-b', title: 'B', summary: 'b' },
    ]);
    const out = generateGraph(root);
    expect(out.content).toContain('## practice-a');
    expect(out.content).toContain('## map-b');
    expect(out.content).toContain('Total nodes: 2');
    expect(out.content).toMatch(/schema_version:\s*2/);
    // Regression: removed per-node lines must not reappear.
    expect(out.content).not.toContain('**status:**');
    expect(out.content).not.toContain('**supersedes:**');
  });
});
