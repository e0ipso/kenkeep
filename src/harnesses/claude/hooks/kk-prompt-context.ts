/**
 * UserPromptSubmit hook (sync) for the Claude Code adapter.
 *
 * After the user's prompt is known, ranks the current on-disk leaf nodes against
 * it and injects a small, bounded summaries-plus-links block of the most
 * relevant nodes. This is the prompt-time complement to the SessionStart
 * `ENTRY.md` orientation injection (which fires before any task is known); both
 * surfaces coexist.
 *
 * Output format: Claude Code's `UserPromptSubmit` JSON contract —
 * `{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }`.
 * Configured WITHOUT `async: true` so stdout flows back into the session.
 *
 * Bounded and fail-open: a short hard deadline guards the prompt path, and any
 * missing prompt, missing/empty/malformed knowledge base, or error yields no
 * injected context (the hook exits 0 with no stdout). The prompt text is never
 * logged or persisted.
 */
import { existsSync } from 'node:fs';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { buildPromptKnowledgeContext } from '../../../lib/prompt-retrieval.js';

runHookEntry({
  tag: 'claude:kk-prompt-context',
  deadlineMs: 1000,
  main: async payload => {
    const prompt = typeof payload['prompt'] === 'string' ? (payload['prompt'] as string) : '';
    if (prompt.trim().length === 0) return;
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    const paths = repoPaths(findRepoRoot(startCwd));
    if (!existsSync(paths.installedVersionFile)) return;

    let context: string;
    try {
      context = buildPromptKnowledgeContext(paths.nodesDir, prompt);
    } catch {
      // Fail open: a missing, empty, or malformed knowledge base never blocks
      // or perturbs the user's prompt.
      return;
    }
    if (context.trim().length === 0) return;
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: context,
        },
      })}\n`
    );
  },
});
