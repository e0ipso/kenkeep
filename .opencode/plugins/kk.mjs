// kenkeep plugin

// src/harnesses/opencode/plugins/kk.ts
import { spawn } from "child_process";
import { join } from "path";
var DISPATCH = {
  "session.created": ["kk-session-start.cjs", "kk-proposal-drain.cjs"],
  "session.idle": ["kk-capture.cjs", "kk-lint-tick.cjs"]
};
var kk_default = async (input) => {
  if (process.env["KENKEEP_BUILDER_INTERNAL"] === "1") return {};
  const projectDir = input.directory ?? input.project?.worktree ?? process.cwd();
  const kkHooks = join(projectDir, ".ai", "kenkeep", "hooks", "opencode");
  return {
    event: async ({ event }) => {
      if (!event.type) return;
      const scripts = DISPATCH[event.type];
      if (!scripts) return;
      const payload = JSON.stringify({
        session_id: event.properties?.sessionID,
        hook_event_name: event.type === "session.created" ? "SessionCreated" : "SessionIdle",
        cwd: projectDir
      });
      for (const script of scripts) {
        const child = spawn("node", [join(kkHooks, script)], {
          env: process.env,
          stdio: ["pipe", "inherit", "inherit"]
        });
        if (child.stdin) {
          child.stdin.write(payload);
          child.stdin.end();
        }
      }
    }
  };
};
export {
  kk_default as default
};
