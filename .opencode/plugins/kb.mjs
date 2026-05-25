// @e0ipso/ai-knowledge-base plugin

// src/harnesses/opencode/plugins/kb.ts
import { spawn } from "child_process";
import { join } from "path";
var DISPATCH = {
  "session.created": ["kb-session-start.cjs", "kb-proposal-drain.cjs"],
  "session.idle": ["kb-capture.cjs", "kb-lint-tick.cjs"]
};
var kb_default = async (input) => {
  if (process.env["KB_BUILDER_INTERNAL"] === "1") return {};
  const projectDir = input.directory ?? input.project?.worktree ?? process.cwd();
  const kbHooks = join(projectDir, ".opencode", "kb-hooks");
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
        const child = spawn("node", [join(kbHooks, script)], {
          env: { ...process.env, KB_BUILDER_INTERNAL: "1" },
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
  kb_default as default
};
