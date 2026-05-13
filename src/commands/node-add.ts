import { existsSync } from 'node:fs';
import { input, select } from '@inquirer/prompts';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import {
  deriveNodeId,
  ensureUniqueId,
  nodeFileExists,
  readAllNodes,
  writeNodeFile,
} from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import type { Confidence, NodeFrontmatter, NodeKind } from '../lib/schemas.js';

export interface NodeAddOptions {
  yes?: boolean;
  // Test seam: supply answers programmatically instead of prompting.
  preset?: {
    kind: NodeKind;
    title: string;
    summary: string;
    tags: string;
    body: string;
    relatesTo?: string;
    confidence?: Confidence;
  };
}

export async function runNodeAdd(opts: NodeAddOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.'
    );
    return 1;
  }

  const answers = opts.preset ? opts.preset : await promptForNode();

  const kind = answers.kind;
  const title = answers.title.trim();
  if (!title) {
    log.error('Title is required.');
    return 1;
  }
  const summary = answers.summary.trim();
  if (!summary) {
    log.error('Summary is required.');
    return 1;
  }
  const body = answers.body.trim() || `# ${title}\n\n${summary}\n`;
  const tags = parseList(answers.tags);
  const relatesTo = parseList(answers.relatesTo ?? '');
  const confidence: Confidence = answers.confidence ?? 'high';

  const existingIds = new Set(readAllNodes(paths.nodesDir).map(n => n.frontmatter.id));
  const baseId = deriveNodeId(kind, title);
  if (existingIds.has(baseId) || nodeFileExists(paths.nodesDir, kind, baseId)) {
    log.error(
      `A node with id ${baseId} already exists at nodes/${kind}/${baseId}.md. ` +
        'Pick a different title, or edit the existing node directly.'
    );
    return 1;
  }
  const id = ensureUniqueId(existingIds, baseId);

  const frontmatter: NodeFrontmatter = {
    schema_version: 1,
    id,
    title,
    kind,
    tags,
    derived_from: [],
    relates_to: relatesTo,
    confidence,
    summary,
  };

  const filePath = writeNodeFile({ nodesDir: paths.nodesDir, frontmatter, body });

  // Refresh INDEX/GRAPH so the manual write doesn't leave a stale index. The
  // pre-commit hook will also do this via `index rebuild --stage` when
  // committing, but this keeps things consistent for read-only tooling.
  const index = generateIndex(paths.nodesDir);
  writeIndex(`${paths.kbDir}/INDEX.md`, index);
  const graph = generateGraph(paths.nodesDir);
  writeGraph(`${paths.kbDir}/GRAPH.md`, graph);

  log.success(`Wrote node: ${filePath}`);
  log.plain('Review with `git diff` and `git commit` to accept, or `git restore` to reject.');
  return 0;
}

async function promptForNode(): Promise<{
  kind: NodeKind;
  title: string;
  summary: string;
  tags: string;
  body: string;
  relatesTo: string;
  confidence: Confidence;
}> {
  const kind = (await select({
    message: 'Node kind',
    choices: [
      { name: 'practice — how we build things', value: 'practice' },
      { name: 'map — what exists in the project', value: 'map' },
    ],
  })) as NodeKind;
  const title = await input({
    message: 'Title (short, ≤ 80 chars)',
    validate: v => v.trim().length > 0 || 'Required',
  });
  const summary = await input({
    message: 'Summary (≤ 140 chars)',
    validate: v => v.trim().length > 0 || 'Required',
  });
  const tags = await input({ message: 'Tags (comma-separated, optional)' });
  const relatesTo = await input({
    message: 'relates_to (comma-separated node ids, optional)',
  });
  const confidence = (await select({
    message: 'Confidence',
    choices: [
      { name: 'high', value: 'high' },
      { name: 'medium', value: 'medium' },
      { name: 'low', value: 'low' },
    ],
    default: 'high',
  })) as Confidence;
  const body = await input({
    message: 'Body markdown (one line; for longer content, edit the node file after writing)',
  });
  return { kind, title, summary, tags, body, relatesTo, confidence };
}

function parseList(s: string): string[] {
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}
