import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { log } from '../lib/log.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';

interface QueueFile {
  entries?: Array<{ session_id: string; attempts?: number }>;
}

export async function runStatus(): Promise<void> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  ensureStateLayout(paths);

  if (!existsSync(paths.installedVersionFile)) {
    log.warn(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.',
    );
    return;
  }

  const installed = JSON.parse(readFileSync(paths.installedVersionFile, 'utf8')) as {
    version: string;
    installed_at: string;
  };

  const queueFile = join(paths.sessionsDir, '.queue.json');
  const queue = existsSync(queueFile)
    ? (JSON.parse(readFileSync(queueFile, 'utf8')) as QueueFile)
    : { entries: [] };

  const sessionStats = scanSessions(paths.sessionsDir);
  const proposalCounts = countProposals(paths.proposedDir);
  const nodeCounts = countNodes(paths.nodesDir);

  log.plain(
    `@e0ipso/ai-knowledge-base v${installed.version} (installed ${installed.installed_at})`,
  );
  log.plain('');
  log.plain('Knowledge base');
  log.plain(`  Practice nodes: ${nodeCounts.practice}`);
  log.plain(`  Map nodes:      ${nodeCounts.map}`);
  log.plain('');
  log.plain('Pending work');
  log.plain(`  Stage-2 queue:           ${queue.entries?.length ?? 0}`);
  log.plain(`  Session logs (pending):  ${sessionStats.pending}`);
  log.plain(`  Session logs (done):     ${sessionStats.done}`);
  log.plain(`  Session logs (failed):   ${sessionStats.failed}`);
  log.plain('');
  log.plain('Proposals awaiting review');
  log.plain(`  Additions:       ${proposalCounts.additions}`);
  log.plain(`  Modifications:   ${proposalCounts.modifications}`);
  log.plain(`  Contradictions:  ${proposalCounts.contradictions}`);
}

function scanSessions(dir: string): { pending: number; done: number; failed: number } {
  const out = { pending: 0, done: 0, failed: 0 };
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const file = join(dir, name);
    try {
      const fm = matter(readFileSync(file, 'utf8')).data as { stage_2_status?: string };
      switch (fm.stage_2_status) {
        case 'done':
          out.done += 1;
          break;
        case 'failed':
          out.failed += 1;
          break;
        default:
          out.pending += 1;
      }
    } catch {
      out.pending += 1;
    }
  }
  return out;
}

function countProposals(dir: string): {
  additions: number;
  modifications: number;
  contradictions: number;
} {
  return {
    additions: countMarkdown(join(dir, 'additions')),
    modifications: countMarkdown(join(dir, 'modifications')),
    contradictions: countMarkdown(join(dir, 'contradictions')),
  };
}

function countNodes(dir: string): { practice: number; map: number } {
  return {
    practice: countMarkdown(join(dir, 'practice')),
    map: countMarkdown(join(dir, 'map')),
  };
}

function countMarkdown(dir: string): number {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
}
