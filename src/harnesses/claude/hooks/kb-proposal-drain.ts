/**
 * SessionStart hook (async) for the Claude Code adapter.
 *
 * Drains the proposal queue without blocking session start. For each queued
 * entry it spawns `claude -p --output-format stream-json --verbose`, parses
 * the final result, validates against the Zod schema, and updates the
 * session log frontmatter.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';
import { drainProposalQueue, type ProposalRunner } from '../../../lib/proposal-drain.js';
import { runHeadlessClaude } from '../headless.js';
import { buildClaudeHarnessOpts } from '../opts.js';

const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  // Recursion guard: the drain itself spawns `claude -p`, which fires
  // SessionStart again inside the child. KB_BUILDER_INTERNAL=1 is set on
  // every child by runHeadlessClaude.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('claude:kb-proposal-drain', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  const promptTemplate = loadProposalPrompt(paths.promptsDir);
  if (!promptTemplate) {
    process.stderr.write(`${PACKAGE_TAG} proposal prompt template not found; skipping drain\n`);
    return;
  }

  const runner: ProposalRunner = async (prompt, stdin, schema, opts) =>
    runHeadlessClaude(prompt, stdin, schema, opts);

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const summary = await drainProposalQueue({
      paths,
      promptTemplate,
      runner,
      harnessOpts: buildClaudeHarnessOpts(settings, 'proposal'),
    });
    if (summary.status === 'locked') {
      // Another drain is in flight; nothing to do.
      return;
    }
    // Async hook stdout is not injected into the parent session, so log to
    // stderr only on failures the user should know about.
    const failed = summary.processed.filter(p => p.status === 'failed');
    if (failed.length > 0) {
      process.stderr.write(
        `${PACKAGE_TAG} proposal drain: ${failed.length} session(s) failed; see _logs/proposal/\n`
      );
    }
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} proposal drain error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

function loadProposalPrompt(promptsDir: string): string | null {
  // Prefer the per-repo override written by `init`; fall back to the
  // template bundled with the npm package.
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
    appendHookDiagnostic('claude:kb-proposal-drain', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
