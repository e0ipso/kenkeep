/**
 * SessionStart hook for the GitHub Copilot CLI adapter.
 *
 * Copilot does not document a stdout context-injection channel on
 * `sessionStart` (unlike Claude's `additionalContext`). The v1 strategy is
 * to write the current entry-catalog content into `<root>/.github/copilot-instructions.md`
 * under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block, which
 * Copilot reads on session start. The rewrite is idempotent and preserves
 * any user-authored content outside the block. Errors go to stderr only and
 * the script always exits 0 so a stalled write never blocks the session.
 */
import { join } from 'node:path';
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';
import { writeCopilotInstructionsSentinelWithContent } from '../hooks-config.js';

class CopilotSessionStart extends SessionStartStrategy {
  readonly tag = 'copilot:kk-session-start';

  async emit({ content, root }: SessionStartEmit): Promise<void> {
    await writeCopilotInstructionsSentinelWithContent(
      {
        dir: join(root, '.copilot'),
        hooksDir: join(root, '.copilot', 'hooks'),
        skillsDir: join(root, '.github', 'skills'),
      },
      content
    );
  }

  /** Copilot rewrites an instructions file rather than emitting context. */
  override banner(): string {
    return '📖 kenkeep Index: Refreshing Copilot instructions…';
  }
}

runSessionStartHook(new CopilotSessionStart());
