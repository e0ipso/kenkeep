import { existsSync } from 'node:fs';
import { text as readStdinText } from 'node:stream/consumers';
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
import { findRepoRoot, repoPaths, type RepoPaths } from '../lib/paths.js';
import {
  ConfidenceSchema,
  NodeKindSchema,
  type Confidence,
  type NodeFrontmatter,
  type NodeKind,
} from '../lib/schemas.js';

export interface NodeAnswers {
  kind: NodeKind;
  title: string;
  summary: string;
  tags: string;
  body: string;
  relatesTo: string;
  confidence: Confidence;
}

export interface NodeAddFlags {
  kind?: string;
  title?: string;
  summary?: string;
  tags?: string;
  body?: string;
  relatesTo?: string;
  confidence?: string;
  yes?: boolean;
}

export interface NodeWriteResult {
  filePath: string;
}

export interface NodeAddDeps {
  readStdin?: () => Promise<string>;
  isTTY?: () => boolean;
}

const STDIN_SENTINEL = '@-';

export async function runNodeAdd(
  flags: NodeAddFlags = {},
  deps: NodeAddDeps = {}
): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `npx @e0ipso/ai-knowledge-base init --harnesses claude`.'
    );
    return 1;
  }

  try {
    const answers = await resolveAnswers(flags, deps);
    await writeNewNode(answers, { paths });
    return 0;
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function resolveAnswers(flags: NodeAddFlags, deps: NodeAddDeps): Promise<NodeAnswers> {
  const yes = Boolean(flags.yes);
  const readStdin = deps.readStdin ?? (() => readStdinText(process.stdin));
  const isTTY = deps.isTTY ?? (() => Boolean(process.stdin.isTTY));

  const partial: Partial<NodeAnswers> = {};
  if (flags.kind !== undefined) partial.kind = parseKind(flags.kind);
  if (flags.title !== undefined) partial.title = flags.title;
  if (flags.summary !== undefined) partial.summary = flags.summary;
  if (flags.tags !== undefined) partial.tags = flags.tags;
  if (flags.relatesTo !== undefined) partial.relatesTo = flags.relatesTo;
  if (flags.confidence !== undefined) partial.confidence = parseConfidence(flags.confidence);
  if (flags.body !== undefined) {
    if (flags.body === STDIN_SENTINEL) {
      if (isTTY()) {
        throw new Error(
          'stdin is a TTY; --body @- requires piped input (e.g. `... --body @- <<EOF ... EOF`).'
        );
      }
      partial.body = await readStdin();
    } else {
      partial.body = flags.body;
    }
  }

  const missing: Array<keyof NodeAnswers> = [];
  if (partial.kind === undefined) missing.push('kind');
  if (!partial.title || !partial.title.trim()) missing.push('title');
  if (!partial.summary || !partial.summary.trim()) missing.push('summary');
  if (partial.body === undefined) missing.push('body');

  if (yes && missing.length > 0) {
    throw new Error(`missing required input: ${missing.join(', ')}`);
  }

  if (missing.length === 0) {
    return {
      kind: partial.kind!,
      title: partial.title!,
      summary: partial.summary!,
      tags: partial.tags ?? '',
      body: partial.body!,
      relatesTo: partial.relatesTo ?? '',
      confidence: partial.confidence ?? 'high',
    };
  }

  return promptForNode(partial);
}

function parseKind(value: string): NodeKind {
  const result = NodeKindSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`--kind must be one of practice|map (got "${value}")`);
  }
  return result.data;
}

function parseConfidence(value: string): Confidence {
  const result = ConfidenceSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`--confidence must be one of low|medium|high (got "${value}")`);
  }
  return result.data;
}

export async function writeNewNode(
  answers: NodeAnswers,
  deps: { paths: RepoPaths }
): Promise<NodeWriteResult> {
  const { paths } = deps;
  const kind = answers.kind;
  const title = answers.title.trim();
  if (!title) {
    throw new Error('Title is required.');
  }
  const summary = answers.summary.trim();
  if (!summary) {
    throw new Error('Summary is required.');
  }
  const body = answers.body.trim() || `# ${title}\n\n${summary}\n`;
  const tags = parseList(answers.tags);
  const relatesTo = parseList(answers.relatesTo);
  const confidence: Confidence = answers.confidence;

  const existingIds = new Set(readAllNodes(paths.nodesDir).map(n => n.frontmatter.id));
  const baseId = deriveNodeId(kind, title);
  if (existingIds.has(baseId) || nodeFileExists(paths.nodesDir, kind, baseId)) {
    throw new Error(
      `A node with id ${baseId} already exists at nodes/${kind}/${baseId}.md. ` +
        'Pick a different title, or edit the existing node directly.'
    );
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
  return { filePath };
}

async function promptForNode(partial: Partial<NodeAnswers> = {}): Promise<NodeAnswers> {
  const kind =
    partial.kind ??
    ((await select({
      message: 'Node kind',
      choices: [
        { name: 'practice — how we build things', value: 'practice' },
        { name: 'map — what exists in the project', value: 'map' },
      ],
    })) as NodeKind);
  const title = partial.title?.trim()
    ? partial.title
    : await input({
        message: 'Title (short, ≤ 80 chars)',
        validate: v => v.trim().length > 0 || 'Required',
      });
  const summary = partial.summary?.trim()
    ? partial.summary
    : await input({
        message: 'Summary (≤ 140 chars)',
        validate: v => v.trim().length > 0 || 'Required',
      });
  const tags = partial.tags ?? (await input({ message: 'Tags (comma-separated, optional)' }));
  const relatesTo =
    partial.relatesTo ??
    (await input({ message: 'relates_to (comma-separated node ids, optional)' }));
  const confidence =
    partial.confidence ??
    ((await select({
      message: 'Confidence',
      choices: [
        { name: 'high', value: 'high' },
        { name: 'medium', value: 'medium' },
        { name: 'low', value: 'low' },
      ],
      default: 'high',
    })) as Confidence);
  const body =
    partial.body ??
    (await input({
      message: 'Body markdown (one line; for longer content, edit the node file after writing)',
    }));
  return { kind, title, summary, tags, body, relatesTo, confidence };
}

function parseList(s: string): string[] {
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}
