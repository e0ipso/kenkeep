/**
 * sessionStart hook for the Cursor adapter.
 *
 * Emits entry-catalog context using Cursor's native `{ "additional_context": "..." }`
 * stdout envelope.
 */
import {
  runSessionStartHook,
  SessionStartStrategy,
  type SessionStartEmit,
} from '../../../lib/session-start-hook.js';

class CursorSessionStart extends SessionStartStrategy {
  readonly tag = 'cursor:kk-session-start';

  emit({ content }: SessionStartEmit): void {
    process.stdout.write(JSON.stringify({ additional_context: content }));
  }

  /** Cursor reports the session's directory as a `workspace_roots` array. */
  override cwdKeys(): string[] {
    return ['workspace_roots'];
  }
}

runSessionStartHook(new CursorSessionStart());
