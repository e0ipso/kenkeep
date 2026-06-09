import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { log } from '../lib/log.js';
import { readAllNodes } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export async function runStatus(): Promise<void> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.warn('kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses claude`.');
    return;
  }

  const installed = JSON.parse(readFileSync(paths.installedVersionFile, 'utf8')) as {
    version: string;
    installed_at: string;
  };

  const sessionStats = scanSessions(paths.sessionsDir);
  const nodeCounts = countNodes(paths.nodesDir);

  log.plain(`kenkeep v${installed.version} (installed ${installed.installed_at})`);
  log.plain('');
  log.plain('Knowledge base');
  log.plain(`  Practice nodes: ${nodeCounts.practice}`);
  log.plain(`  Map nodes:      ${nodeCounts.map}`);
  log.plain('');
  log.plain('Pending work');
  log.plain(`  Session logs (pending):  ${sessionStats.pending}`);
  log.plain(`  Session logs (done):     ${sessionStats.done}`);
  log.plain(`  Session logs (failed):   ${sessionStats.failed}`);
}

function scanSessions(dir: string): { pending: number; done: number; failed: number } {
  const out = { pending: 0, done: 0, failed: 0 };
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const file = join(dir, name);
    try {
      const fm = matter(readFileSync(file, 'utf8')).data as { proposal_status?: string };
      switch (fm.proposal_status) {
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

/**
 * Counts nodes by their `kind` frontmatter facet across the whole topical tree.
 * `kind` is a facet, not a directory: leaves live in topical folders at any
 * depth, so we read every leaf and bucket by frontmatter, not by a
 * `nodes/practice` / `nodes/map` directory (which no longer exist). On a
 * malformed or old-layout tree `readAllNodes` throws; `status` is a quick
 * summary, so we degrade to zeros and let `doctor` surface the details.
 */
function countNodes(nodesDir: string): { practice: number; map: number } {
  const out = { practice: 0, map: 0 };
  if (!existsSync(nodesDir)) return out;
  try {
    for (const node of readAllNodes(nodesDir)) {
      if (node.frontmatter.kind === 'practice') out.practice += 1;
      else if (node.frontmatter.kind === 'map') out.map += 1;
    }
  } catch {
    return out;
  }
  return out;
}
