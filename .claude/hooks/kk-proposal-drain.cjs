'use strict';

// src/lib/async-launcher.ts
var import_node_child_process = require('child_process');
var LAUNCHER_CHILD_ENV = 'KENKEEP_ASYNC_LAUNCHER_CHILD';
var LAUNCHER_PAYLOAD_ENV = 'KENKEEP_HOOK_PAYLOAD';
var LAUNCHER_STDIN_DEADLINE_MS = 250;
function isLauncherChild(env = process.env) {
  return env[LAUNCHER_CHILD_ENV] === '1';
}
function launcherPayload(env = process.env) {
  return env[LAUNCHER_PAYLOAD_ENV] ?? '';
}
function launchDetachedWorker(rawPayload) {
  const script = process.argv[1];
  if (!script) return false;
  const child = (0, import_node_child_process.spawn)(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, [LAUNCHER_CHILD_ENV]: '1', [LAUNCHER_PAYLOAD_ENV]: rawPayload },
  });
  child.unref();
  return true;
}

// src/lib/hook-diagnostic.ts
var import_node_fs = require('fs');
var import_node_path = require('path');
function appendHookDiagnostic(hook, phase, error, logsDir) {
  try {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const ts = now.toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const line = JSON.stringify({ ts, hook, phase, error: errorMessage }) + '\n';
    (0, import_node_fs.mkdirSync)(logsDir, { recursive: true });
    (0, import_node_fs.appendFileSync)(
      (0, import_node_path.join)(logsDir, `hook-errors-${dateStr}.log`),
      line,
      'utf8'
    );
  } catch {}
}

// src/lib/paths.ts
var import_node_fs2 = require('fs');
var import_node_path2 = require('path');
var import_node_url = require('url');
function findRepoRoot(from = process.cwd()) {
  let cur = (0, import_node_path2.resolve)(from);
  while (true) {
    if (
      (0, import_node_fs2.existsSync)((0, import_node_path2.join)(cur, '.git')) ||
      (0, import_node_fs2.existsSync)(
        (0, import_node_path2.join)(cur, '.ai/kenkeep/.state/installed-version')
      )
    ) {
      return cur;
    }
    const parent = (0, import_node_path2.dirname)(cur);
    if (parent === cur) return (0, import_node_path2.resolve)(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = (0, import_node_path2.join)(root, '.ai');
  const kkDir = (0, import_node_path2.join)(aiDir, 'kenkeep');
  const stateDir = (0, import_node_path2.join)(kkDir, '.state');
  const configDir = (0, import_node_path2.join)(kkDir, '.config');
  const promptsDir = (0, import_node_path2.join)(configDir, 'prompts');
  return {
    root,
    aiDir,
    kkDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: (0, import_node_path2.join)(stateDir, 'installed-version'),
    projectConfigFile: (0, import_node_path2.join)(kkDir, 'config.yaml'),
    sessionsDir: (0, import_node_path2.join)(kkDir, '_sessions'),
    logsDir: (0, import_node_path2.join)(kkDir, '_logs'),
    nodesDir: (0, import_node_path2.join)(kkDir, 'nodes'),
    conflictsDir: (0, import_node_path2.join)(kkDir, 'conflicts'),
    kkGitignoreFile: (0, import_node_path2.join)(kkDir, '.gitignore'),
    memoryLedgerFile: (0, import_node_path2.join)(stateDir, 'memory-ledger.json'),
    usageFile: (0, import_node_path2.join)(stateDir, 'usage.jsonl'),
  };
}

// src/lib/stdin.ts
function readStdin(options = {}) {
  return new Promise(resolve2 => {
    if (process.stdin.isTTY) {
      resolve2('');
      return;
    }
    let data = '';
    let settled = false;
    let timer;
    const finish = value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      process.stdin.pause();
      resolve2(value);
    };
    if (options.deadlineMs !== void 0) {
      timer = setTimeout(() => finish(data), options.deadlineMs);
      timer.unref();
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => finish(data));
    process.stdin.on('error', () => finish(''));
  });
}

// src/lib/hook-entry.ts
function runHookEntry(options) {
  const { tag, deadlineMs, asyncLauncher = false, requirePayload = false, main } = options;
  async function run() {
    if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;
    if (deadlineMs !== void 0) {
      const deadline = setTimeout(() => {
        try {
          const paths = repoPaths(findRepoRoot(process.cwd()));
          appendHookDiagnostic(
            tag,
            'deadline',
            new Error('hook hard deadline reached; work abandoned'),
            paths.logsDir
          );
        } catch {}
        process.exit(0);
      }, deadlineMs);
      deadline.unref();
    }
    let raw;
    if (asyncLauncher) {
      if (isLauncherChild()) {
        raw = launcherPayload();
      } else {
        const captured = await readStdin({ deadlineMs: LAUNCHER_STDIN_DEADLINE_MS });
        if (launchDetachedWorker(captured)) {
          process.exit(0);
        }
        raw = captured;
      }
    } else {
      raw = await readStdin();
    }
    if (requirePayload && raw.trim().length === 0) return;
    let payload = {};
    if (raw.trim().length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        const paths = repoPaths(findRepoRoot(process.cwd()));
        appendHookDiagnostic(tag, 'parse', err, paths.logsDir);
        if (requirePayload) return;
      }
    }
    await main(payload, raw);
  }
  void run().catch(err => {
    try {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic(tag, 'uncaught', err, paths.logsDir);
    } catch {}
    process.exit(0);
  });
}

// src/harnesses/claude/hooks/kk-proposal-drain.ts
runHookEntry({
  tag: 'claude:kk-proposal-drain',
  // No deadline — this hook is async and intentionally a no-op.
  // Recursion guard in the scaffold handles KENKEEP_BUILDER_INTERNAL.
  main: async () => {},
});
