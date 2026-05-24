/**
 * sessionStart hook for the Cursor adapter (proposal drain).
 *
 * Drains the proposal queue via `agent -p --output-format json`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';
import { drainProposalQueue, type ProposalRunner } from '../../../lib/proposal-drain.js';
import { runHeadlessCursor } from '../headless.js';
import { buildCursorHarnessOpts } from '../opts.js';

const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  try {
    execFileSync('which', ['agent'], { stdio: 'ignore' });
  } catch {
    return;
  }

  const raw = await readStdin();
  let input: { workspace_roots?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { workspace_roots?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('cursor:kb-proposal-drain', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const roots = input.workspace_roots;
  const startCwd =
    Array.isArray(roots) && typeof roots[0] === 'string' && roots[0].length > 0
      ? (roots[0] as string)
      : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  const promptTemplate = loadProposalPrompt(paths.promptsDir);
  if (!promptTemplate) {
    process.stderr.write(`${PACKAGE_TAG} proposal prompt template not found; skipping drain\n`);
    return;
  }

  const runner: ProposalRunner = async (prompt, stdin, schema, opts) =>
    runHeadlessCursor(prompt, stdin, schema, opts);

  try {
    process.stderr.write('🔄 Proposals: Draining queue…\n');
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const summary = await drainProposalQueue({
      paths,
      promptTemplate,
      runner,
      harnessOpts: buildCursorHarnessOpts(settings, 'proposal'),
    });
    if (summary.status === 'locked') {
      process.stderr.write('🔒 Proposals: Drain already in progress.\n');
      return;
    }
    const failed = summary.processed.filter(p => p.status === 'failed');
    if (failed.length > 0) {
      process.stderr.write(
        `${PACKAGE_TAG} proposal drain: ${failed.length} session(s) failed; see _logs/proposal/\n`
      );
    }
    process.stderr.write('📬 Proposals: Queue drained.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} proposal drain error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

function loadProposalPrompt(promptsDir: string): string | null {
  const override = join(promptsDir, 'proposal-extract.md');
  if (existsSync(override)) return readFileSync(override, 'utf8');
  const bundled = join(packageTemplatesDir(), 'prompts/proposal-extract.md');
  if (existsSync(bundled)) return readFileSync(bundled, 'utf8');
  return null;
}

function readStdin(): Promise<string> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('cursor:kb-proposal-drain', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
