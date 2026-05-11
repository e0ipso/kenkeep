import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { confirm, select } from '@inquirer/prompts';
import { log } from '../lib/log.js';
import { listProposalFiles, readProposalFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { ProposalFrontmatterSchema, type ProposalFrontmatter } from '../lib/schemas.js';

export interface ProposalsReviewOptions {
  /** When true, do not prompt — just print a summary and return. */
  list?: boolean;
  /** Test seam: pre-recorded actions per proposal (in order). */
  actions?: ReviewAction[];
}

export type ReviewAction =
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'set_resolution'; value: 'supersede' | 'keep_both' | 'reject' }
  | { type: 'skip' };

interface DiscoveredProposal {
  path: string;
  bucket: 'additions' | 'modifications' | 'contradictions';
  frontmatter: ProposalFrontmatter;
  body: string;
}

export async function runProposalsReview(opts: ProposalsReviewOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  const discovered = discoverProposals(paths.proposedDir);
  if (discovered.length === 0) {
    log.success('No proposals awaiting review.');
    return 0;
  }

  if (opts.list) {
    printSummary(discovered);
    return 0;
  }

  log.plain(`Reviewing ${discovered.length} proposal(s).`);
  const actions = opts.actions ?? [];
  let actionIdx = 0;
  let accepted = 0;
  let rejected = 0;
  let skipped = 0;

  for (const proposal of discovered) {
    printProposalHeader(proposal);
    const action: ReviewAction =
      actionIdx < actions.length ? actions[actionIdx++]! : await promptForAction(proposal);

    if (action.type === 'skip') {
      skipped += 1;
      continue;
    }
    if (action.type === 'reject') {
      rmSync(proposal.path);
      rejected += 1;
      log.warn(`Rejected ${basename(proposal.path)}`);
      continue;
    }
    if (action.type === 'set_resolution') {
      writeBack(proposal, { suggested_resolution: action.value });
      log.info(`Set suggested_resolution=${action.value} on ${basename(proposal.path)}`);
      const next: ReviewAction =
        actionIdx < actions.length
          ? actions[actionIdx++]!
          : (await confirm({ message: 'Accept this proposal now?', default: true }))
            ? { type: 'accept' }
            : { type: 'skip' };
      if (next.type === 'accept') {
        accepted += promote(proposal, paths.nodesDir) ? 1 : 0;
      } else {
        skipped += 1;
      }
      continue;
    }
    // accept
    accepted += promote(proposal, paths.nodesDir) ? 1 : 0;
  }

  log.plain('');
  log.success(`Done. accepted=${accepted} rejected=${rejected} skipped=${skipped}`);
  if (accepted > 0) {
    log.plain(
      'Run `ai-knowledge-base curate` (or restart Claude Code) to refresh INDEX/GRAPH after acceptance.',
    );
  }
  return 0;
}

function discoverProposals(proposedDir: string): DiscoveredProposal[] {
  const out: DiscoveredProposal[] = [];
  const grouped = listProposalFiles(proposedDir);
  const buckets: Array<['additions' | 'modifications' | 'contradictions', string[]]> = [
    ['additions', grouped.additions],
    ['modifications', grouped.modifications],
    ['contradictions', grouped.contradictions],
  ];
  for (const [bucket, files] of buckets) {
    for (const file of files) {
      const parsed = readProposalFile(file);
      if (!parsed) continue;
      out.push({ path: file, bucket, frontmatter: parsed.frontmatter, body: parsed.body });
    }
  }
  return out;
}

function printSummary(discovered: DiscoveredProposal[]): void {
  for (const p of discovered) {
    log.plain(`[${p.bucket}] ${p.frontmatter.id} — ${p.frontmatter.title}`);
  }
}

function printProposalHeader(p: DiscoveredProposal): void {
  log.plain('');
  log.plain('────────────────────────────────────────────────────────');
  log.plain(`[${p.bucket}] ${p.frontmatter.id}`);
  log.plain(`title:        ${p.frontmatter.title}`);
  log.plain(`kind:         ${p.frontmatter.kind}`);
  log.plain(`confidence:   ${p.frontmatter.confidence}`);
  log.plain(`tags:         ${p.frontmatter.tags.join(', ') || '(none)'}`);
  log.plain(`rationale:    ${p.frontmatter.proposal.rationale}`);
  if (p.frontmatter.proposal.target_node) {
    log.plain(`target_node:  ${p.frontmatter.proposal.target_node}`);
  }
  if (p.bucket === 'contradictions') {
    log.plain(
      `suggested_resolution: ${p.frontmatter.proposal.suggested_resolution ?? '(unset — choose one)'}`,
    );
  }
  log.plain(`file:         ${p.path}`);
  log.plain('────────────────────────────────────────────────────────');
}

async function promptForAction(p: DiscoveredProposal): Promise<ReviewAction> {
  if (p.bucket === 'contradictions') {
    const value = (await select({
      message: 'Action',
      choices: [
        { name: 'set resolution → supersede', value: 'supersede' },
        { name: 'set resolution → keep_both', value: 'keep_both' },
        { name: 'set resolution → reject', value: 'reject' },
        { name: 'reject proposal (delete)', value: '__reject__' },
        { name: 'skip', value: '__skip__' },
      ],
    })) as string;
    if (value === '__reject__') return { type: 'reject' };
    if (value === '__skip__') return { type: 'skip' };
    return { type: 'set_resolution', value: value as 'supersede' | 'keep_both' | 'reject' };
  }
  const choice = (await select({
    message: 'Action',
    choices: [
      { name: 'accept (move into nodes/)', value: 'accept' },
      { name: 'reject (delete)', value: 'reject' },
      { name: 'skip', value: 'skip' },
    ],
  })) as 'accept' | 'reject' | 'skip';
  return { type: choice } as ReviewAction;
}

function writeBack(
  proposal: DiscoveredProposal,
  patch: Partial<ProposalFrontmatter['proposal']>,
): void {
  const next: ProposalFrontmatter = {
    ...proposal.frontmatter,
    proposal: { ...proposal.frontmatter.proposal, ...patch },
  };
  const validated = ProposalFrontmatterSchema.parse(next);
  const serialized = matter.stringify(proposal.body.trimEnd() + '\n', validated);
  writeFileSync(proposal.path, serialized);
  proposal.frontmatter = validated;
}

/**
 * Promote a proposal into nodes/. For additions, strip the `proposal` block
 * and move into `nodes/<kind>/`. For modifications and contradictions we do
 * the same — the reviewer's resolution choice (for contradictions) has
 * already been recorded in the frontmatter, and follow-up node mutations
 * (e.g. setting valid_until on the contradicted node when the resolution is
 * `supersede`) happen here.
 */
function promote(proposal: DiscoveredProposal, nodesDir: string): boolean {
  const fm = proposal.frontmatter;
  const kindDir = join(nodesDir, fm.kind);
  mkdirSync(kindDir, { recursive: true });
  const destFile = join(kindDir, `${fm.id}.md`);

  const { proposal: _ignored, ...nodeFm } = fm;
  void _ignored;
  const nodeContent = matter.stringify(proposal.body.trimEnd() + '\n', nodeFm);
  writeFileSync(destFile, nodeContent);

  if (proposal.bucket === 'contradictions' && fm.proposal.suggested_resolution === 'supersede') {
    applySupersede(proposal, nodesDir);
  }
  rmSync(proposal.path);
  log.success(`Accepted ${basename(proposal.path)} → ${destFile}`);
  return true;
}

function applySupersede(proposal: DiscoveredProposal, nodesDir: string): void {
  const targetId = proposal.frontmatter.proposal.target_node;
  if (!targetId) return;
  const targetFile = join(nodesDir, proposal.frontmatter.kind, `${targetId}.md`);
  let existing: string | null = null;
  try {
    existing = readFileSync(targetFile, 'utf8');
  } catch {
    log.warn(`Target node not found for supersede: ${targetFile}`);
    return;
  }
  const parsed = matter(existing);
  const data = { ...(parsed.data as Record<string, unknown>) };
  const now = new Date().toISOString();
  data['valid_until'] = now;
  data['superseded_by'] = proposal.frontmatter.id;
  data['updated'] = now;
  const next = matter.stringify(parsed.content, data);
  writeFileSync(targetFile + '.tmp', next);
  renameSync(targetFile + '.tmp', targetFile);
}
