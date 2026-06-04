// kenkeep opencode plugin
/**
 * OpenCode plugin shim. Subscribes to the runtime `event` hook and
 * dispatches each event to the matching per-event Node script under
 * `.opencode/kk-hooks/` via `child_process.spawn`. Children always run
 * with `KENKEEP_BUILDER_INTERNAL=1` so any kk CLI they invoke does not
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
  'session.created': ['kk-session-start.cjs', 'kk-proposal-drain.cjs'],
  'session.idle': ['kk-capture.cjs', 'kk-lint-tick.cjs'],
};

export default async (input: OpenCodePluginInput) => {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return {};
  const projectDir = input.directory ?? input.project?.worktree ?? process.cwd();
  const kkHooks = join(projectDir, '.opencode', 'kk-hooks');
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
        const child = spawn('node', [join(kkHooks, script)], {
          env: { ...process.env, KENKEEP_BUILDER_INTERNAL: '1' },
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
