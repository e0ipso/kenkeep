// src/hooks/kb-stage2-drain.ts
import { existsSync as existsSync6, readFileSync as readFileSync6 } from "fs";
import { join as join4 } from "path";

// src/lib/headless.ts
import { execa } from "execa";
import { createWriteStream, mkdirSync } from "fs";
import { dirname } from "path";
import "stream";
import split2 from "split2";
var DEFAULT_TIMEOUT_MS = 6e4;
var defaultSpawn = (command, ctx) => {
  const proc = execa(command, ctx.args, {
    input: ctx.stdin,
    env: ctx.env,
    timeout: ctx.timeoutMs,
    stdin: "pipe",
    stdout: "pipe",
    reject: false
  });
  const stdout = proc.stdout;
  const result = proc.then((r) => ({
    exitCode: typeof r.exitCode === "number" ? r.exitCode : void 0,
    failed: r.failed === true,
    timedOut: r.timedOut === true
  }));
  return { stdout, result };
};
async function runHeadlessClaude(promptBody, stdin, schema, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowedTools = opts.allowedTools ?? [];
  const args = [
    "-p",
    promptBody,
    "--allowedTools",
    allowedTools.join(","),
    "--output-format",
    "stream-json",
    "--verbose"
  ];
  const env = {
    ...opts.env ?? process.env,
    KB_BUILDER_INTERNAL: "1"
  };
  const spawn = opts.spawn ?? defaultSpawn;
  let logStream = null;
  if (opts.logFile) {
    mkdirSync(dirname(opts.logFile), { recursive: true });
    logStream = createWriteStream(opts.logFile, { encoding: "utf8", flags: "a" });
  }
  const messages = [];
  const { stdout, result: resultPromise } = spawn("claude", {
    args,
    stdin,
    env,
    timeoutMs
  });
  const splitter = stdout.pipe(split2());
  splitter.on("data", (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    if (logStream) logStream.write(`${trimmed}
`);
    try {
      messages.push(JSON.parse(trimmed));
    } catch {
    }
  });
  const streamDone = new Promise((resolve2, reject) => {
    splitter.once("end", () => resolve2());
    splitter.once("error", (err) => reject(err));
  });
  let runResult;
  try {
    const [r] = await Promise.all([resultPromise, streamDone]);
    runResult = r;
  } finally {
    if (logStream) {
      await new Promise((resolve2) => logStream.end(resolve2));
    }
  }
  if (runResult.timedOut) {
    throw new Error(`claude subprocess timed out after ${timeoutMs}ms`);
  }
  if (runResult.failed || runResult.exitCode !== void 0 && runResult.exitCode !== 0) {
    throw new Error(
      `claude subprocess failed (exit code ${String(runResult.exitCode ?? "unknown")})`
    );
  }
  const finalResult = findFinalResult(messages);
  if (finalResult === null) {
    throw new Error("claude subprocess produced no final result message");
  }
  let parsedJson;
  try {
    parsedJson = JSON.parse(extractJsonBlock(finalResult));
  } catch (err) {
    throw new Error(
      `failed to parse final result as JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const validated = schema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`stage-2 output did not match schema: ${validated.error.message}`);
  }
  return validated.data;
}
function findFinalResult(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.type === "result") {
      if (m.is_error === true) return null;
      if (typeof m.result === "string") return m.result;
    }
  }
  return null;
}
function extractJsonBlock(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence && fence[1]) return fence[1].trim();
  return text.trim();
}

// src/lib/paths.ts
import { existsSync, readFileSync, statSync } from "fs";
import { dirname as dirname2, join, resolve } from "path";
import { fileURLToPath } from "url";
function packageRoot() {
  return resolve(dirname2(fileURLToPath(import.meta.url)), "..");
}
function packageTemplatesDir() {
  return join(packageRoot(), "templates");
}
function findRepoRoot(from = process.cwd()) {
  let cur = resolve(from);
  while (true) {
    if (existsSync(join(cur, ".git")) || existsSync(join(cur, ".ai/knowledge-base/.state/installed-version"))) {
      return cur;
    }
    const parent = dirname2(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = join(root, ".ai");
  const kbDir = join(aiDir, "knowledge-base");
  const stateDir = join(kbDir, ".state");
  const configDir = join(kbDir, ".config");
  const promptsDir = join(configDir, "prompts");
  const claudeDir = join(root, ".claude");
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join(stateDir, "installed-version"),
    projectConfigFile: join(kbDir, "config.yaml"),
    sessionsDir: join(kbDir, "_sessions"),
    logsDir: join(kbDir, "_logs"),
    nodesDir: join(kbDir, "nodes"),
    claudeDir,
    claudeCommandsDir: join(claudeDir, "commands"),
    claudeSkillsDir: join(claudeDir, "skills"),
    claudeHooksDir: join(claudeDir, "hooks"),
    claudeSettingsFile: join(claudeDir, "settings.json"),
    gitignoreFile: join(root, ".gitignore"),
    secretlintrcFile: join(root, ".secretlintrc.json"),
    huskyDir: join(root, ".husky"),
    huskyPreCommitFile: join(root, ".husky", "pre-commit"),
    packageJsonFile: join(root, "package.json"),
    lintstagedrcFile: join(root, ".lintstagedrc.cjs")
  };
}

// src/lib/settings.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "fs";
import { homedir } from "os";
import { join as join2 } from "path";
import yaml from "js-yaml";

// src/lib/schemas.ts
import { z } from "zod";
var CaptureTriggerSchema = z.enum(["stop", "session_end", "pre_compact", "manual"]);
var SecretScanStatusSchema = z.enum(["clean", "redacted", "blocked", "skipped"]);
var Stage2StatusSchema = z.enum(["pending", "done", "failed", "skipped"]);
var SessionLogFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  session_id: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  transcript_hash: z.string(),
  stage_2_status: Stage2StatusSchema,
  stage_2_completed_at: z.string().nullable(),
  stage_2_error: z.string().nullable(),
  stage_2_log: z.string().nullable(),
  secret_scan_status: SecretScanStatusSchema,
  topics: z.array(z.string()),
  proposals: z.object({
    practice: z.array(z.unknown()),
    map: z.array(z.unknown())
  })
});
var QueueEntrySchema = z.object({
  session_id: z.string(),
  session_log: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  attempts: z.number().int().nonnegative()
});
var QueueFileSchema = z.object({
  schema_version: z.literal(1),
  entries: z.array(QueueEntrySchema)
});
var DedupCacheEntrySchema = z.object({
  hash: z.string(),
  expires_at: z.string()
});
var DedupCacheFileSchema = z.object({
  schema_version: z.literal(1),
  entries: z.array(DedupCacheEntrySchema)
});
var ConfidenceSchema = z.enum(["low", "medium", "high"]);
var Stage2CandidateSchema = z.object({
  kind: z.enum(["practice", "map"]),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable()
});
var Stage2OutputSchema = z.object({
  practice: z.array(Stage2CandidateSchema),
  map: z.array(Stage2CandidateSchema)
});
var StateLockSchema = z.object({
  name: z.string(),
  pid: z.number().int(),
  acquired_at: z.string(),
  ttl_ms: z.number().int().positive()
});
var StateFileSchema = z.object({
  schema_version: z.literal(1),
  lock: StateLockSchema.nullable().optional(),
  last_nudged_at: z.string().nullable().optional()
});
var NodeKindSchema = z.enum(["practice", "map"]);
var NodeFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  updated: z.string(),
  supersedes: z.string().nullable(),
  superseded_by: z.string().nullable(),
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  depends_on: z.array(z.string()),
  confidence: ConfidenceSchema,
  summary: z.string()
});
var CuratorProposedNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  supersedes: z.string().nullable(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  superseded_by: z.string().nullable()
});
var CuratorActionSchema = z.object({
  action: z.enum(["add", "modify", "contradict", "drop"]),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: z.string(),
  suggested_resolution: z.enum(["supersede", "keep_both", "reject"]).nullable()
});
var CuratorOutputSchema = z.array(CuratorActionSchema);
var IndexFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string(),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
  budget_tokens: z.number().int().positive()
});
var GraphFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  generated_at: z.string(),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative()
});
var BootstrapCandidateSchema = z.object({
  kind: z.enum(["practice", "map"]),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  derived_from: z.array(z.string()),
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable()
});
var BootstrapOutputSchema = z.object({
  practice: z.array(BootstrapCandidateSchema),
  map: z.array(BootstrapCandidateSchema)
});
var BootstrapDocEntrySchema = z.object({
  content_sha256: z.string(),
  last_processed_at: z.string(),
  produced_nodes: z.array(z.string())
});
var ConflictReportSchema = z.object({
  id: z.string(),
  detected_at: z.string(),
  run_id: z.string(),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  rationale: z.string(),
  proposed_node: CuratorProposedNodeSchema.nullable()
});
var PendingConflictsFileSchema = z.object({
  schema_version: z.literal(1),
  conflicts: z.array(ConflictReportSchema)
});
var FailureReportSchema = z.object({
  reason: z.enum(["add_collision", "modify_missing_target"]),
  candidate_origin: z.string(),
  node_id: z.string(),
  detail: z.string()
});
var SettingsSchema = z.object({
  schema_version: z.literal(1),
  drainBound: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().optional(),
  stage2Timeout: z.number().int().positive().optional(),
  lockTtlMs: z.number().int().positive().optional(),
  indexBudgetTokens: z.number().int().positive().optional(),
  curationThreshold: z.number().int().positive().optional(),
  bootstrapTokenBudget: z.number().int().positive().optional(),
  logsRetentionDays: z.number().int().positive().optional()
}).strict();
var BootstrapStateSchema = z.object({
  schema_version: z.literal(1),
  last_full_bootstrap_at: z.string().nullable().optional(),
  last_incremental_at: z.string().nullable().optional(),
  docs: z.record(BootstrapDocEntrySchema)
});

// src/lib/settings.ts
var SETTINGS_DEFAULTS = {
  drainBound: 5,
  maxAttempts: 3,
  stage2Timeout: 6e4,
  lockTtlMs: 30 * 60 * 1e3,
  indexBudgetTokens: 2e3,
  curationThreshold: 5,
  bootstrapTokenBudget: 1e4,
  logsRetentionDays: 30
};
function resolveSettings(opts = {}) {
  const projectFile = opts.projectFile ?? null;
  const userFile = opts.userFile ?? defaultUserConfigPath();
  const warnings = [];
  const user = loadFile(userFile, warnings);
  const project = projectFile ? loadFile(projectFile, warnings) : null;
  const effective = { ...SETTINGS_DEFAULTS };
  applyOverrides(effective, user);
  applyOverrides(effective, project);
  return {
    settings: effective,
    projectFile: projectFile ?? null,
    userFile: existsSync2(userFile) ? userFile : null,
    warnings
  };
}
function applyOverrides(target, src) {
  if (!src) return;
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    const value = src[key];
    if (value !== void 0) {
      target[key] = value;
    }
  }
}
function loadFile(file, warnings) {
  if (!existsSync2(file)) return null;
  let raw;
  try {
    raw = readFileSync2(file, "utf8");
  } catch (err) {
    warnings.push(`settings file unreadable (${file}): ${err.message}`);
    return null;
  }
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    warnings.push(`settings file is not valid YAML (${file}): ${err.message}`);
    return null;
  }
  const result = SettingsSchema.safeParse(parsed);
  if (!result.success) {
    warnings.push(`settings file failed schema validation (${file}): ${result.error.message}`);
    return null;
  }
  return result.data;
}
function defaultUserConfigPath(env = process.env) {
  const xdg = env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join2(homedir(), ".config");
  return join2(base, "ai-knowledge-base", "config.yaml");
}

// src/lib/stage2-drain.ts
import matter from "gray-matter";
import { existsSync as existsSync5, readFileSync as readFileSync5, renameSync as renameSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";

// src/lib/queue.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, renameSync, writeFileSync } from "fs";
function readQueue(file) {
  if (!existsSync3(file)) return { schema_version: 1, entries: [] };
  try {
    const raw = JSON.parse(readFileSync3(file, "utf8"));
    const parsed = QueueFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { schema_version: 1, entries: [] };
  } catch {
    return { schema_version: 1, entries: [] };
  }
}

// src/lib/state.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync4, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname3 } from "path";
var DEFAULT_LOCK_TTL_MS = 30 * 60 * 1e3;
function readState(file) {
  if (!existsSync4(file)) return { schema_version: 1 };
  try {
    const raw = JSON.parse(readFileSync4(file, "utf8"));
    const parsed = StateFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { schema_version: 1 };
  } catch {
    return { schema_version: 1 };
  }
}
function writeState(file, state) {
  mkdirSync2(dirname3(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync2(tmp, `${JSON.stringify(state, null, 2)}
`);
  renameSync2(tmp, file);
}
function acquireLock(file, opts) {
  const state = readState(file);
  const existing = state.lock ?? null;
  const ttlMs = opts.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const nowMs = opts.now.getTime();
  if (existing) {
    const acquiredMs = Date.parse(existing.acquired_at);
    const age = Number.isFinite(acquiredMs) ? nowMs - acquiredMs : Number.POSITIVE_INFINITY;
    const expired = age > existing.ttl_ms;
    if (!expired && existing.pid !== opts.pid) {
      return false;
    }
  }
  const lock = {
    name: opts.name,
    pid: opts.pid,
    acquired_at: opts.now.toISOString(),
    ttl_ms: ttlMs
  };
  writeState(file, { ...state, lock });
  return true;
}
function releaseLock(file, name, pid) {
  const state = readState(file);
  if (!state.lock) return;
  if (state.lock.name !== name || state.lock.pid !== pid) return;
  const next = { ...state, lock: null };
  writeState(file, next);
}

// src/lib/stage2-drain.ts
var DEFAULT_MAX_ENTRIES = 5;
var DEFAULT_MAX_ATTEMPTS = 3;
var DEFAULT_TIMEOUT_MS2 = 6e4;
var STAGE2_LOCK_NAME = "stage2-drain";
var TRANSCRIPT_PLACEHOLDER = "[TRANSCRIPT PLACEHOLDER \u2014 substituted at runtime]";
async function drainStage2Queue(ctx) {
  const now = ctx.now ?? (() => /* @__PURE__ */ new Date());
  const queueFile = join3(ctx.sessionsDir, ".queue.json");
  const maxEntries = ctx.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS2;
  const pid = ctx.pid ?? process.pid;
  const lockHeld = acquireLock(ctx.stateFile, {
    name: STAGE2_LOCK_NAME,
    pid,
    now: now(),
    ...ctx.lockTtlMs !== void 0 ? { ttlMs: ctx.lockTtlMs } : {}
  });
  if (!lockHeld) {
    return { status: "locked", processed: [], remaining: readQueue(queueFile).entries.length };
  }
  const processed = [];
  try {
    for (let i = 0; i < maxEntries; i += 1) {
      const queue = readQueue(queueFile);
      if (queue.entries.length === 0) break;
      const entry = queue.entries[0];
      const result = await processEntry({
        entry,
        sessionsDir: ctx.sessionsDir,
        logsDir: ctx.logsDir,
        promptTemplate: ctx.promptTemplate,
        runner: ctx.runner,
        now,
        timeoutMs,
        maxAttempts
      });
      processed.push(result);
      if (result.status === "done" || result.status === "skipped" || result.status === "missing-log") {
        removeFromQueueHead(queueFile, entry.session_id);
      } else {
        bumpAndRotate(queueFile, entry.session_id, result.attempts);
      }
    }
  } finally {
    releaseLock(ctx.stateFile, STAGE2_LOCK_NAME, pid);
  }
  const remaining = readQueue(queueFile).entries.length;
  return { status: "completed", processed, remaining };
}
async function processEntry(args) {
  const { entry, sessionsDir, logsDir, promptTemplate, runner, now, timeoutMs, maxAttempts } = args;
  const sessionLogPath = join3(sessionsDir, entry.session_log);
  if (!existsSync5(sessionLogPath)) {
    return {
      sessionId: entry.session_id,
      status: "missing-log",
      attempts: entry.attempts,
      error: `session log not found: ${entry.session_log}`
    };
  }
  const parsed = matter(readFileSync5(sessionLogPath, "utf8"));
  const transcript = extractStage1Transcript(parsed.content);
  const prompt = buildStage2Prompt(promptTemplate, transcript);
  const attemptIndex = entry.attempts + 1;
  const startedAt = now();
  const logFile = stage2LogPath(logsDir, entry.session_id, startedAt);
  try {
    const out = await runner(prompt, "", Stage2OutputSchema, {
      timeoutMs,
      allowedTools: [],
      logFile
    });
    writeSessionLogFrontmatter(sessionLogPath, parsed, {
      stage_2_status: "done",
      stage_2_completed_at: now().toISOString(),
      stage_2_error: null,
      stage_2_log: relativeLogPath(sessionsDir, logFile),
      topics: collectTopics(out),
      proposals: { practice: out.practice, map: out.map }
    });
    return {
      sessionId: entry.session_id,
      status: "done",
      attempts: attemptIndex,
      logFile
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = attemptIndex >= maxAttempts;
    writeSessionLogFrontmatter(sessionLogPath, parsed, {
      stage_2_status: exhausted ? "skipped" : "failed",
      stage_2_completed_at: exhausted ? now().toISOString() : null,
      stage_2_error: message,
      stage_2_log: relativeLogPath(sessionsDir, logFile)
    });
    return {
      sessionId: entry.session_id,
      status: exhausted ? "skipped" : "failed",
      attempts: attemptIndex,
      error: message,
      logFile
    };
  }
}
function extractStage1Transcript(body) {
  const startMatch = body.match(/## Stage 1: redacted transcript slice\s*\n+/);
  if (!startMatch || startMatch.index === void 0) return body.trim();
  const start = startMatch.index + startMatch[0].length;
  const rest = body.slice(start);
  const endMatch = rest.match(/\n## Stage 2:/);
  if (!endMatch) return rest.trim();
  return rest.slice(0, endMatch.index).trim();
}
function buildStage2Prompt(template, transcript) {
  if (template.includes(TRANSCRIPT_PLACEHOLDER)) {
    return template.replace(TRANSCRIPT_PLACEHOLDER, transcript);
  }
  return `${template.trimEnd()}

${transcript}
`;
}
function stage2LogPath(logsDir, sessionId, when) {
  const stamp = isoToCompactStamp(when);
  const safe = sessionId.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "session";
  return join3(logsDir, "stage-2", `${safe}__${stamp}.jsonl`);
}
function isoToCompactStamp(d) {
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function relativeLogPath(sessionsDir, logFile) {
  const kbRoot = join3(sessionsDir, "..");
  const rel = logFile.startsWith(kbRoot) ? logFile.slice(kbRoot.length).replace(/^[\\/]/, "") : logFile;
  return rel;
}
function collectTopics(out) {
  const all = /* @__PURE__ */ new Set();
  for (const c of out.practice) for (const t of c.tags) all.add(t);
  for (const c of out.map) for (const t of c.tags) all.add(t);
  return [...all];
}
function writeSessionLogFrontmatter(file, parsed, patch) {
  const data = { ...parsed.data };
  data["stage_2_status"] = patch.stage_2_status;
  data["stage_2_completed_at"] = patch.stage_2_completed_at;
  data["stage_2_error"] = patch.stage_2_error;
  data["stage_2_log"] = patch.stage_2_log;
  if (patch.topics) data["topics"] = patch.topics;
  if (patch.proposals) data["proposals"] = patch.proposals;
  const body = updateStage2Body(parsed.content, patch);
  const serialized = matter.stringify(body, data);
  writeFileSync3(file, serialized);
}
function updateStage2Body(content, patch) {
  if (patch.stage_2_status !== "done") return content;
  return content.replace(
    /\(populated by stage-2 worker\)/,
    `_Extraction complete \u2014 see proposals in frontmatter._`
  );
}
function removeFromQueueHead(queueFile, sessionId) {
  const queue = readQueue(queueFile);
  const next = {
    schema_version: 1,
    entries: queue.entries.filter((e) => e.session_id !== sessionId)
  };
  atomicWriteJson(queueFile, next);
}
function bumpAndRotate(queueFile, sessionId, attempts) {
  const queue = readQueue(queueFile);
  const matchIdx = queue.entries.findIndex((e) => e.session_id === sessionId);
  if (matchIdx < 0) return;
  const [entry] = queue.entries.splice(matchIdx, 1);
  if (!entry) return;
  const updated = { ...entry, attempts };
  queue.entries.push(updated);
  atomicWriteJson(queueFile, queue);
}
function atomicWriteJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync3(tmp, `${JSON.stringify(data, null, 2)}
`);
  renameSync3(tmp, file);
}

// src/hooks/kb-stage2-drain.ts
var PACKAGE_TAG = "[ai-knowledge-base]";
async function main() {
  if (process.env["KB_BUILDER_INTERNAL"] === "1") return;
  const raw = await readStdin();
  let input = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw);
    } catch {
      input = {};
    }
  }
  const startCwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync6(paths.installedVersionFile)) return;
  const promptTemplate = loadStage2Prompt(paths.promptsDir);
  if (!promptTemplate) {
    process.stderr.write(`${PACKAGE_TAG} stage-2 prompt template not found; skipping drain
`);
    return;
  }
  const runner = async (prompt, stdin, schema, opts) => runHeadlessClaude(prompt, stdin, schema, opts);
  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const summary = await drainStage2Queue({
      sessionsDir: paths.sessionsDir,
      logsDir: paths.logsDir,
      stateFile: join4(paths.stateDir, "state.json"),
      promptTemplate,
      runner,
      maxEntries: settings.drainBound,
      maxAttempts: settings.maxAttempts,
      timeoutMs: settings.stage2Timeout,
      lockTtlMs: settings.lockTtlMs
    });
    if (summary.status === "locked") {
      return;
    }
    const failed = summary.processed.filter((p) => p.status === "failed" || p.status === "skipped");
    if (failed.length > 0) {
      process.stderr.write(
        `${PACKAGE_TAG} stage-2 drain: ${failed.length} session(s) failed or skipped; see _logs/stage-2/
`
      );
    }
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} stage-2 drain error: ${err instanceof Error ? err.message : String(err)}
`
    );
  }
}
function loadStage2Prompt(promptsDir) {
  const override = join4(promptsDir, "stage-2-extract.md");
  if (existsSync6(override)) return readFileSync6(override, "utf8");
  const bundled = join4(packageTemplatesDir(), "prompts/stage-2-extract.md");
  if (existsSync6(bundled)) return readFileSync6(bundled, "utf8");
  return null;
}
function readStdin() {
  return new Promise((resolve2) => {
    if (process.stdin.isTTY) {
      resolve2("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve2(data));
    process.stdin.on("error", () => resolve2(""));
  });
}
void main().catch(() => process.exit(0));
