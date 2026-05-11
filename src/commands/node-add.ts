import { existsSync } from 'node:fs';
import { input, select } from '@inquirer/prompts';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import {
  deriveNodeId,
  ensureUniqueId,
  proposalFilename,
  readAllNodes,
  writeProposalFile,
} from '../lib/nodes.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';
import type { Confidence, NodeKind, ProposalFrontmatter } from '../lib/schemas.js';

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
  now?: Date;
}

export async function runNodeAdd(opts: NodeAddOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  ensureStateLayout(paths);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.',
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

  const existingIds = new Set(readAllNodes(paths.nodesDir).map((n) => n.frontmatter.id));
  const id = ensureUniqueId(existingIds, deriveNodeId(kind, title));
  const now = (opts.now ?? new Date()).toISOString();

  const frontmatter: ProposalFrontmatter = {
    schema_version: 1,
    id,
    title,
    kind,
    tags,
    valid_from: now,
    valid_until: null,
    updated: now,
    supersedes: null,
    superseded_by: null,
    derived_from: [],
    relates_to: relatesTo,
    depends_on: [],
    confidence,
    summary,
    proposal: {
      kind: 'addition',
      source_sessions: [],
      target_node: null,
      rationale: 'manual',
      suggested_resolution: null,
      curator_log: null,
    },
  };

  const filename = proposalFilename(kind, id);
  const filePath = writeProposalFile({
    proposedDir: paths.proposedDir,
    proposalKind: 'additions',
    filename,
    frontmatter,
    body,
  });

  // INDEX/GRAPH reflect committed nodes, not proposals — but the curator
  // step is what wires that up. Regenerate here for consistency with the
  // curate command (which regenerates on every run); this also exercises the
  // generator path so manual `node add` doesn't silently leave a stale index.
  const index = generateIndex(paths.nodesDir, { now: new Date(now) });
  writeIndex(`${paths.kbDir}/INDEX.md`, index);
  const graph = generateGraph(paths.nodesDir, { now: new Date(now) });
  writeGraph(`${paths.kbDir}/GRAPH.md`, graph);

  log.success(`Wrote proposal: ${filePath}`);
  log.plain('Review with `ai-knowledge-base proposals review`.');
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
    validate: (v) => v.trim().length > 0 || 'Required',
  });
  const summary = await input({
    message: 'Summary (≤ 140 chars)',
    validate: (v) => v.trim().length > 0 || 'Required',
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
    message: 'Body markdown (one line; for longer content, edit the proposal after writing)',
  });
  return { kind, title, summary, tags, body, relatesTo, confidence };
}

function parseList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
