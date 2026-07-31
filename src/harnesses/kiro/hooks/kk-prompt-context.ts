/**
 * userPromptSubmit hook (sync) for the Kiro CLI adapter.
 *
 * After the user's prompt is known, ranks the on-disk leaf nodes against it
 * and injects a small, bounded summaries-plus-links block of the most
 * relevant nodes into the agent context. Kiro adds stdout to the agent's
 * context when the hook exits 0.
 *
 * Bounded and fail-open: any missing prompt, missing/empty/malformed knowledge
 * base, or error yields no injected context (exit 0, no stdout). The prompt
 * text is never logged or persisted.
 *
 * Payload received on stdin:
 *   { hook_event_name: "userPromptSubmit", cwd: "...", session_id: "...",
 *     prompt: "..." }
 *
 * Output: plain text on stdout (raw; Kiro injects stdout into context at
 * exit 0 for userPromptSubmit hooks).
 */
import { existsSync } from 'node:fs';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { buildPromptKnowledgeContext } from '../../../lib/prompt-retrieval.js';

runHookEntry({
  tag: 'kiro:kk-prompt-context',
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
      return;
    }
    if (context.trim().length === 0) return;
    // Kiro injects raw stdout into the agent context for userPromptSubmit.
    process.stdout.write(`${context}\n`);
  },
});
