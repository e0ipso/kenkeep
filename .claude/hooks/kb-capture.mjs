// src/lib/capture.ts
import { createHash } from "crypto";
import { existsSync as existsSync4, readFileSync as readFileSync3 } from "fs";
import { join as join3 } from "path";

// src/lib/dedup-cache.ts
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";

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

// src/lib/dedup-cache.ts
var DEDUP_TTL_MS = 5 * 60 * 1e3;
function loadEntries(file) {
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const parsed = DedupCacheFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data.entries;
    return [];
  } catch {
    return [];
  }
}
function pruneExpired(entries, nowMs) {
  return entries.filter((e) => {
    const t = Date.parse(e.expires_at);
    return Number.isFinite(t) && t > nowMs;
  });
}
function isDuplicate(cacheFile, hash, nowMs = Date.now()) {
  const entries = pruneExpired(loadEntries(cacheFile), nowMs);
  return entries.some((e) => e.hash === hash);
}
function recordHash(cacheFile, hash, nowMs = Date.now()) {
  const entries = pruneExpired(loadEntries(cacheFile), nowMs).filter((e) => e.hash !== hash);
  entries.push({ hash, expires_at: new Date(nowMs + DEDUP_TTL_MS).toISOString() });
  const tmp = `${cacheFile}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ schema_version: 1, entries }, null, 2)}
`);
  renameSync(tmp, cacheFile);
}

// src/lib/secret-scan.ts
import { existsSync as existsSync2 } from "fs";
import { join } from "path";
var FALLBACK_CONFIG = {
  rules: [{ id: "@secretlint/secretlint-rule-preset-recommend" }]
};
function redactSecrets(text, findings) {
  const ordered = [...findings].sort((a, b) => (b.secret?.length ?? 0) - (a.secret?.length ?? 0));
  let out = text;
  for (const f of ordered) {
    const secret = f.secret;
    if (typeof secret !== "string" || secret.length === 0) continue;
    out = out.split(secret).join(`[REDACTED:${f.ruleId}]`);
  }
  return out;
}
async function loadResolvedConfig(cwd) {
  const { loadConfig } = await import("@secretlint/config-loader");
  const explicit = join(cwd, ".secretlintrc.json");
  if (existsSync2(explicit)) {
    const loaded2 = await loadConfig({ cwd, configFilePath: explicit });
    if (loaded2.ok) return loaded2.config;
  }
  try {
    const loaded2 = await loadConfig({ cwd });
    if (loaded2.ok) return loaded2.config;
  } catch {
  }
  const { loadPackagesFromConfigDescriptor } = await import("@secretlint/config-loader");
  const loaded = await loadPackagesFromConfigDescriptor({
    configDescriptor: FALLBACK_CONFIG
  });
  return loaded.config;
}
async function scanAndRedact(text, timeoutMs = 1e3) {
  let timer;
  try {
    const cwd = process.cwd();
    const config = await loadResolvedConfig(cwd);
    const { lintSource } = await import("@secretlint/core");
    const linted = await Promise.race([
      lintSource({
        source: {
          filePath: join(cwd, "__transcript__.txt"),
          content: text,
          contentType: "text"
        },
        options: {
          config,
          noPhysicFilePath: true
        }
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`secretlint timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
    const findings = [];
    for (const m of linted.messages) {
      if (m.type !== "message") continue;
      const [start, end] = m.range;
      if (typeof start !== "number" || typeof end !== "number" || end <= start) continue;
      const secret = text.slice(start, end);
      if (secret.length === 0) continue;
      findings.push({
        ruleId: m.ruleId,
        secret,
        startLine: m.loc?.start?.line,
        endLine: m.loc?.end?.line
      });
    }
    if (findings.length === 0) {
      return { status: "clean", redactedText: text, findings: [] };
    }
    return {
      status: "redacted",
      redactedText: redactSecrets(text, findings),
      findings
    };
  } catch (err) {
    const e = err;
    return {
      status: "blocked",
      redactedText: "",
      findings: [],
      error: e.message
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// src/lib/queue.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "fs";
function readQueue(file) {
  if (!existsSync3(file)) return { schema_version: 1, entries: [] };
  try {
    const raw = JSON.parse(readFileSync2(file, "utf8"));
    const parsed = QueueFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { schema_version: 1, entries: [] };
  } catch {
    return { schema_version: 1, entries: [] };
  }
}
function appendToQueue(file, entry) {
  const queue = readQueue(file);
  queue.entries.push(entry);
  const tmp = `${file}.tmp`;
  writeFileSync2(tmp, `${JSON.stringify(queue, null, 2)}
`);
  renameSync2(tmp, file);
}

// src/lib/session-log.ts
import { mkdirSync, writeFileSync as writeFileSync3 } from "fs";
import { join as join2 } from "path";
function renderSessionLog(input) {
  const lines = [
    "---",
    "schema_version: 1",
    `session_id: ${yamlString(input.sessionId)}`,
    `captured_by: ${input.capturedBy}`,
    `captured_at: ${yamlString(input.capturedAt)}`,
    `transcript_hash: ${yamlString(input.transcriptHash)}`,
    "stage_2_status: pending",
    "stage_2_completed_at: null",
    "stage_2_error: null",
    "stage_2_log: null",
    `secret_scan_status: ${input.secretScanStatus}`,
    "topics: []",
    "proposals:",
    "  practice: []",
    "  map: []",
    "---",
    "",
    "## Stage 1: redacted transcript slice",
    "",
    input.body.trimEnd(),
    "",
    "## Stage 2: structured summary",
    "",
    "(populated by stage-2 worker)",
    ""
  ];
  return lines.join("\n");
}
function yamlString(value) {
  return JSON.stringify(value);
}
function writeSessionLog(sessionsDir, filename, contents) {
  mkdirSync(sessionsDir, { recursive: true });
  const path = join2(sessionsDir, filename);
  writeFileSync3(path, contents);
  return path;
}
function buildSessionLogFilename(capturedAt, sessionId) {
  const d = new Date(capturedAt);
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  const short = sessionId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "session";
  return `${stamp}-${short}.md`;
}
function pad(n) {
  return n.toString().padStart(2, "0");
}

// src/lib/transcript.ts
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((c) => !!c && typeof c === "object").filter((c) => (c.type ?? "text") === "text").map((c) => typeof c.text === "string" ? c.text : "").filter((s) => s.length > 0).join("\n");
  }
  return "";
}
function parseTranscriptJsonl(text) {
  const out = { user: [], agent: [], interleaved: [] };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const role = msg.message?.role ?? msg.role ?? msg.type;
    const content = msg.message?.content ?? msg.content;
    if (role === "user") {
      const text2 = extractText(content);
      if (text2) {
        out.user.push(text2);
        out.interleaved.push({ role: "user", text: text2 });
      }
    } else if (role === "assistant" || role === "agent") {
      const text2 = extractText(content);
      if (text2) {
        out.agent.push(text2);
        out.interleaved.push({ role: "agent", text: text2 });
      }
    }
  }
  return out;
}
function renderRoleTagged(t) {
  return t.interleaved.map((seg) => `[${seg.role === "user" ? "USER" : "AGENT"}]: ${seg.text}`).join("\n\n");
}

// src/lib/capture.ts
var HOOK_EVENT_TO_TRIGGER = {
  Stop: "stop",
  SessionEnd: "session_end",
  PreCompact: "pre_compact"
};
function eventToTrigger(event) {
  if (event && HOOK_EVENT_TO_TRIGGER[event]) {
    return HOOK_EVENT_TO_TRIGGER[event];
  }
  return "stop";
}
async function captureSession(input, ctx) {
  const trigger = eventToTrigger(input.hook_event_name);
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync4(transcriptPath)) {
    return {
      status: "no-transcript",
      error: `transcript_path missing or absent: ${transcriptPath ?? "(none)"}`
    };
  }
  const transcriptText = readFileSync3(transcriptPath, "utf8");
  const parsed = parseTranscriptJsonl(transcriptText);
  const slice = renderRoleTagged(parsed);
  if (!slice.trim()) {
    return { status: "no-content" };
  }
  const hash = `sha256:${createHash("sha256").update(slice).digest("hex")}`;
  const dedupCacheFile = join3(ctx.sessionsDir, ".dedup-cache.json");
  const nowMs = (ctx.now?.() ?? /* @__PURE__ */ new Date()).getTime();
  if (isDuplicate(dedupCacheFile, hash, nowMs)) {
    return { status: "duplicate" };
  }
  const scan = ctx.scan ?? ((text) => scanAndRedact(text, ctx.scanTimeoutMs ?? 1e3));
  const scanResult = await scan(slice);
  if (scanResult.status === "blocked") {
    return {
      status: "secret-scan-blocked",
      secretScanStatus: "blocked",
      ...scanResult.error !== void 0 ? { error: scanResult.error } : {}
    };
  }
  const capturedAt = (ctx.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
  const sessionId = typeof input.session_id === "string" && input.session_id.length > 0 ? input.session_id : hash.slice(7, 19);
  const filename = buildSessionLogFilename(capturedAt, sessionId);
  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    secretScanStatus: scanResult.status,
    body: scanResult.status === "redacted" ? scanResult.redactedText : slice
  });
  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);
  recordHash(dedupCacheFile, hash, nowMs);
  appendToQueue(join3(ctx.sessionsDir, ".queue.json"), {
    session_id: sessionId,
    session_log: filename,
    captured_by: trigger,
    captured_at: capturedAt,
    attempts: 0
  });
  return {
    status: "written",
    sessionLogPath,
    secretScanStatus: scanResult.status
  };
}

// src/lib/paths.ts
import { existsSync as existsSync5, readFileSync as readFileSync4, statSync } from "fs";
import { dirname, join as join4, resolve } from "path";
import { fileURLToPath } from "url";
function findRepoRoot(from = process.cwd()) {
  let cur = resolve(from);
  while (true) {
    if (existsSync5(join4(cur, ".git")) || existsSync5(join4(cur, ".ai/knowledge-base/.state/installed-version"))) {
      return cur;
    }
    const parent = dirname(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = join4(root, ".ai");
  const kbDir = join4(aiDir, "knowledge-base");
  const stateDir = join4(kbDir, ".state");
  const configDir = join4(kbDir, ".config");
  const promptsDir = join4(configDir, "prompts");
  const claudeDir = join4(root, ".claude");
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join4(stateDir, "installed-version"),
    projectConfigFile: join4(kbDir, ".config.json"),
    sessionsDir: join4(kbDir, "_sessions"),
    logsDir: join4(kbDir, "_logs"),
    nodesDir: join4(kbDir, "nodes"),
    claudeDir,
    claudeCommandsDir: join4(claudeDir, "commands"),
    claudeSkillsDir: join4(claudeDir, "skills"),
    claudeHooksDir: join4(claudeDir, "hooks"),
    claudeSettingsFile: join4(claudeDir, "settings.json"),
    gitignoreFile: join4(root, ".gitignore"),
    secretlintrcFile: join4(root, ".secretlintrc.json"),
    huskyDir: join4(root, ".husky"),
    huskyPreCommitFile: join4(root, ".husky", "pre-commit"),
    packageJsonFile: join4(root, "package.json"),
    lintstagedrcFile: join4(root, ".lintstagedrc.cjs")
  };
}

// src/hooks/kb-capture.ts
var HARD_DEADLINE_MS = 1e3;
var PACKAGE_TAG = "[ai-knowledge-base]";
async function main() {
  if (process.env["KB_BUILDER_INTERNAL"] === "1") return;
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();
  const raw = await readStdin();
  let input = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw);
    } catch {
      return;
    }
  }
  const startCwd = typeof input.cwd === "string" && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  try {
    const result = await captureSession(input, { sessionsDir: paths.sessionsDir });
    if (result.status === "secret-scan-blocked") {
      process.stderr.write(
        `${PACKAGE_TAG} secret scan blocked stage-1 capture: ${result.error ?? "unknown error"}
`
      );
    }
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}
`
    );
  }
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
