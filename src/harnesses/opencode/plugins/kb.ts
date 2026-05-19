// @e0ipso/ai-knowledge-base opencode plugin
/**
 * OpenCode plugin shim. Subscribes to the runtime `event` hook and
 * dispatches each event to the matching per-event Node script under
 * `.opencode/kb-hooks/` via `child_process.spawn`. Children always run
 * with `KB_BUILDER_INTERNAL=1` so any KB CLI they invoke does not
 * recursively re-enter the plugin.
 *
 * Placeholder implementation written by Task 4 (adapter scaffold).
 * Task 5 expands this into the real dispatch handler.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

interface OpenCodePluginInput {
  directory?: string;
  project?: { worktree?: string };
}

interface OpenCodeEvent {
  type?: string;
  properties?: { sessionID?: string };
}

const DISPATCH: Record<string, string[]> = {
  'session.created': ['kb-session-start.cjs', 'kb-proposal-drain.cjs'],
  'session.idle': ['kb-capture.cjs', 'kb-lint-tick.cjs'],
};

export default async (input: OpenCodePluginInput) => {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return {};
  const projectDir = input.directory ?? input.project?.worktree ?? process.cwd();
  const kbHooks = join(projectDir, '.opencode', 'kb-hooks');
  return {
    event: async ({ event }: { event: OpenCodeEvent }) => {
      if (!event.type) return;
      const scripts = DISPATCH[event.type];
      if (!scripts) return;
      const payload = JSON.stringify({
        session_id: event.properties?.sessionID,
        hook_event_name: event.type === 'session.created' ? 'SessionCreated' : 'SessionIdle',
        cwd: projectDir,
      });
      for (const script of scripts) {
        const child = spawn('node', [join(kbHooks, script)], {
          env: { ...process.env, KB_BUILDER_INTERNAL: '1' },
          stdio: ['pipe', 'inherit', 'inherit'],
        });
        if (child.stdin) {
          child.stdin.write(payload);
          child.stdin.end();
        }
      }
    },
  };
};
