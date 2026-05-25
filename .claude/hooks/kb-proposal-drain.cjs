"use strict";

// src/lib/paths.ts
var import_node_fs = require("fs");
var import_node_path = require("path");
var import_node_url = require("url");
function findRepoRoot(from = process.cwd()) {
  let cur = (0, import_node_path.resolve)(from);
  while (true) {
    if ((0, import_node_fs.existsSync)((0, import_node_path.join)(cur, ".git")) || (0, import_node_fs.existsSync)((0, import_node_path.join)(cur, ".ai/knowledge-base/.state/installed-version"))) {
      return cur;
    }
    const parent = (0, import_node_path.dirname)(cur);
    if (parent === cur) return (0, import_node_path.resolve)(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = (0, import_node_path.join)(root, ".ai");
  const kbDir = (0, import_node_path.join)(aiDir, "knowledge-base");
  const stateDir = (0, import_node_path.join)(kbDir, ".state");
  const configDir = (0, import_node_path.join)(kbDir, ".config");
  const promptsDir = (0, import_node_path.join)(configDir, "prompts");
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: (0, import_node_path.join)(stateDir, "installed-version"),
    projectConfigFile: (0, import_node_path.join)(kbDir, "config.yaml"),
    sessionsDir: (0, import_node_path.join)(kbDir, "_sessions"),
    logsDir: (0, import_node_path.join)(kbDir, "_logs"),
    nodesDir: (0, import_node_path.join)(kbDir, "nodes"),
    conflictsDir: (0, import_node_path.join)(kbDir, "conflicts"),
    gitignoreFile: (0, import_node_path.join)(root, ".gitignore"),
    memoryLedgerFile: (0, import_node_path.join)(stateDir, "memory-ledger.json")
  };
}

// src/lib/hook-diagnostic.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
function appendHookDiagnostic(hook, phase, error, logsDir) {
  try {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const ts = now.toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const line = JSON.stringify({ ts, hook, phase, error: errorMessage }) + "\n";
    (0, import_node_fs2.mkdirSync)(logsDir, { recursive: true });
    (0, import_node_fs2.appendFileSync)((0, import_node_path2.join)(logsDir, `hook-errors-${dateStr}.log`), line, "utf8");
  } catch {
  }
}

// src/harnesses/claude/hooks/kb-proposal-drain.ts
async function main() {
  if (process.env["KB_BUILDER_INTERNAL"] === "1") return;
}
void main().catch((err) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic("claude:kb-proposal-drain", "uncaught", err, paths.logsDir);
  } catch {
  }
  process.exit(0);
});
