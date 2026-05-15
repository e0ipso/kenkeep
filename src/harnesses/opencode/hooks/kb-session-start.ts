/**
 * session.created handler for the OpenCode adapter.
 *
 * OpenCode plugins have no v1 equivalent of Claude's
 * `{additionalContext}` stdout channel. To get the INDEX.md context in
 * front of the agent at session start, this script writes the context
 * payload to `.opencode/AGENTS.md` (a location OpenCode reads at agent
 * resolution time when the user references it from a parent AGENTS.md).
 * Users opt in by referencing `.opencode/AGENTS.md` from their primary
 * agent doc; the file is overwritten on every session.created firing.
 *
 * The plugin shim runs this child after `KB_BUILDER_INTERNAL=1` is set,
 * which the script honors by exiting silently to avoid recursion when
 * our own headless runner spawns `opencode run`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSessionStartContext } from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[ai-knowledge-base]';
const HARD_DEADLINE_MS = 1000;
const AGENTS_HEADER = `<!-- ${PACKAGE_TAG} auto-generated session-start context. Re-run init to remove. -->\n`;

async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

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
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const result = buildSessionStartContext({
      kbDir: paths.kbDir,
      nodesDir: paths.nodesDir,
      sessionsDir: paths.sessionsDir,
      stateFile: join(paths.stateDir, 'state.json'),
      lintStateFile: lintStateFile(paths.stateDir),
      threshold: settings.curationThreshold,
    });
    const target = join(root, '.opencode', 'AGENTS.md');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${AGENTS_HEADER}${result.additionalContext}`);
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
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

void main().catch(() => process.exit(0));
