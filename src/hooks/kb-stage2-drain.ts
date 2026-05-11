/**
 * SessionStart hook (async).
 *
 * Drains the stage-2 queue without blocking session start. For each queued
 * entry it spawns `claude -p --output-format stream-json --verbose`, parses
 * the final result, validates against the Zod schema, and updates the
 * session log frontmatter.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadlessClaude } from '../lib/headless.js';
import { ensureStateLayout, findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';
import { drainStage2Queue, type Stage2Runner } from '../lib/stage2-drain.js';

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
    } catch {
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  ensureStateLayout(paths);
  if (!existsSync(paths.installedVersionFile)) return;

  const promptTemplate = loadStage2Prompt(paths.stateDir);
  if (!promptTemplate) {
    process.stderr.write(`${PACKAGE_TAG} stage-2 prompt template not found; skipping drain\n`);
    return;
  }

  const runner: Stage2Runner = async (prompt, stdin, schema, opts) =>
    runHeadlessClaude(prompt, stdin, schema, opts);

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const summary = await drainStage2Queue({
      sessionsDir: paths.sessionsDir,
      logsDir: paths.logsDir,
      stateFile: join(paths.stateDir, 'state.json'),
      promptTemplate,
      runner,
      maxEntries: settings.drainBound,
      maxAttempts: settings.maxAttempts,
      timeoutMs: settings.stage2Timeout,
      lockTtlMs: settings.lockTtlMs,
    });
    if (summary.status === 'locked') {
      // Another drain is in flight; nothing to do.
      return;
    }
    // Async hook stdout is not injected into the parent session, so log to
    // stderr only on failures the user should know about.
    const failed = summary.processed.filter((p) => p.status === 'failed' || p.status === 'skipped');
    if (failed.length > 0) {
      process.stderr.write(
        `${PACKAGE_TAG} stage-2 drain: ${failed.length} session(s) failed or skipped; see _logs/stage-2/\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} stage-2 drain error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function loadStage2Prompt(stateDir: string): string | null {
  // Prefer the per-repo override written by `init`; fall back to the
  // template bundled with the npm package.
  const override = join(stateDir, 'prompts/stage-2-extract.md');
  if (existsSync(override)) return readFileSync(override, 'utf8');
  const bundled = join(packageTemplatesDir(), 'prompts/stage-2-extract.md');
  if (existsSync(bundled)) return readFileSync(bundled, 'utf8');
  return null;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
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

void main().catch(() => process.exit(0));
