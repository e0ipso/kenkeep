/**
 * UserPromptSubmit hook (sync) for the Codex CLI adapter.
 *
 * After the user's prompt is known, ranks the current on-disk leaf nodes against
 * it and injects a small, bounded summaries-plus-links block of the most
 * relevant nodes. This is the prompt-time complement to the SessionStart
 * `ENTRY.md` orientation injection; both surfaces coexist.
 *
 * Output format: Codex's `UserPromptSubmit` JSON contract —
 * `{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }`.
 * Registered WITHOUT async so stdout reaches the session.
 *
 * Bounded and fail-open: the scaffold's 1 s deadline is cooperative (it cannot
 * interrupt synchronous work), so retrieval checks the same budget between
 * leaves and between scored nodes and gives up, injecting nothing, with a
 * 'budget' diagnostic, once it is spent; the overrun is at most one leaf
 * read+parse. Any missing prompt, missing/empty/malformed knowledge base, or
 * error likewise yields no injected context (the hook exits 0 with no stdout).
 * The prompt text is never logged or persisted.
 */
import { existsSync } from 'node:fs';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { BudgetExceededError } from '../../../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { buildPromptKnowledgeContext } from '../../../lib/prompt-retrieval.js';

runHookEntry({
  tag: 'codex:kk-prompt-context',
  deadlineMs: 1000,
  invalidJson: 'ignore',
  main: async (payload, _raw, budget) => {
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
      context = buildPromptKnowledgeContext(paths.nodesDir, prompt, {
        deadlineAt: budget.deadlineAt,
      });
    } catch (err) {
      // Fail open; a spent budget is traced so abandonment is distinguishable
      // from an empty result.
      if (err instanceof BudgetExceededError) {
        appendHookDiagnostic('codex:kk-prompt-context', 'budget', err, paths.logsDir);
      }
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
