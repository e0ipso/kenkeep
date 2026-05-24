/**
 * SessionStart hook (async) for the Claude Code adapter.
 *
 * No-op in interactive Claude sessions — proposal extraction runs inline
 * during `/kb-curate` instead of spawning a headless `claude -p` child.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';

async function main(): Promise<void> {
  // Recursion guard: the drain itself spawns `claude -p`, which fires
  // SessionStart again inside the child. KB_BUILDER_INTERNAL=1 is set on
  // every child by runHeadlessClaude.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;
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
