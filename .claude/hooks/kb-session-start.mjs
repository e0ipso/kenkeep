// src/hooks/kb-session-start.ts
import { existsSync as existsSync6 } from 'fs';
import { join as join6 } from 'path';

// src/lib/session-start.ts
import {
  existsSync as existsSync3,
  readFileSync as readFileSync3,
  readdirSync as readdirSync2,
} from 'fs';
import { join as join3 } from 'path';
import matter2 from 'gray-matter';

// src/lib/nodes.ts
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import { join, posix, relative, sep } from 'path';
import matter from 'gray-matter';
import 'zod';

// src/lib/schemas.ts
import { z } from 'zod';
var CaptureTriggerSchema = z.enum(['stop', 'session_end', 'pre_compact', 'manual']);
var SecretScanStatusSchema = z.enum(['clean', 'redacted', 'blocked', 'skipped']);
var ProposalStatusSchema = z.enum(['pending', 'done', 'failed']);
var SessionLogFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  session_id: z.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: z.string(),
  transcript_hash: z.string(),
  proposal_status: ProposalStatusSchema,
  proposal_completed_at: z.string().nullable(),
  proposal_error: z.string().nullable(),
  proposal_log: z.string().nullable(),
  secret_scan_status: SecretScanStatusSchema,
  proposals: z.object({
    practice: z.array(z.unknown()),
    map: z.array(z.unknown()),
  }),
});
var ConfidenceSchema = z.enum(['low', 'medium', 'high']);
var ModelFamilySchema = z.enum(['haiku', 'sonnet', 'opus']);
var EffortLevelSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
var ModelChoiceSchema = z.object({ name: ModelFamilySchema, effort: EffortLevelSchema }).strict();
var ProposalCandidateSchema = z.object({
  kind: z.enum(['practice', 'map']),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable(),
});
var ProposalOutputSchema = z.object({
  practice: z.array(ProposalCandidateSchema),
  map: z.array(ProposalCandidateSchema),
});
var StateFileSchema = z.object({
  schema_version: z.literal(1),
  last_nudged_at: z.string().nullable().optional(),
});
var LintStateFileSchema = z.object({
  schema_version: z.literal(1),
  sessions_since_last_lint: z.number().int().nonnegative(),
  last_lint_at: z.string().nullable(),
  last_errors: z.number().int().nonnegative(),
  last_findings: z.number().int().nonnegative(),
});
var NodeKindSchema = z.enum(['practice', 'map']);
var NodeFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  id: z.string(),
  title: z.string(),
  kind: NodeKindSchema,
  tags: z.array(z.string()),
  derived_from: z.array(z.string()),
  relates_to: z.array(z.string()),
  confidence: ConfidenceSchema,
  summary: z.string(),
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
});
var CuratorActionSchema = z.object({
  action: z.enum(['add', 'modify', 'contradict', 'drop']),
  candidate_origin: z.string(),
  target_node_id: z.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: z.string(),
});
var CuratorOutputSchema = z.array(CuratorActionSchema);
var IndexFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
var GraphFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  nodes_hash: z.string(),
  node_count: z.number().int().nonnegative(),
});
var BootstrapCandidateSchema = z.object({
  kind: z.enum(['practice', 'map']),
  tags: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  confidence: ConfidenceSchema,
  derived_from: z.array(z.string()),
  supports_existing_node: z.string().nullable(),
  contradicts_existing_node: z.string().nullable(),
});
var BootstrapOutputSchema = z.object({
  practice: z.array(BootstrapCandidateSchema),
  map: z.array(BootstrapCandidateSchema),
});
var BootstrapDocEntrySchema = z.object({
  content_sha256: z.string(),
  last_processed_at: z.string(),
  produced_nodes: z.array(z.string()),
});
var SettingsSchema = z
  .object({
    schema_version: z.literal(1),
    curationThreshold: z.number().int().positive().optional(),
    logsRetentionDays: z.number().int().positive().optional(),
    lintEveryNSessions: z.number().int().positive().optional(),
    proposalModel: ModelChoiceSchema.optional(),
    curatorModel: ModelChoiceSchema.optional(),
    bootstrapModel: ModelChoiceSchema.optional(),
  })
  .strict();
var BootstrapStateSchema = z.object({
  schema_version: z.literal(1),
  last_full_bootstrap_at: z.string().nullable().optional(),
  last_incremental_at: z.string().nullable().optional(),
  docs: z.record(BootstrapDocEntrySchema),
});

// src/lib/nodes.ts
function computeNodesHash(nodesDir) {
  const entries = [];
  if (existsSync(nodesDir)) {
    walkMarkdown(nodesDir, nodesDir, entries);
  }
  entries.sort();
  return createHash('sha256').update(entries.join('\n'), 'utf8').digest('hex');
}
function walkMarkdown(rootDir, currentDir, out) {
  for (const name of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, name.name);
    if (name.isDirectory()) {
      walkMarkdown(rootDir, fullPath, out);
      continue;
    }
    if (!name.name.endsWith('.md')) continue;
    const rel = relative(rootDir, fullPath).split(sep).join(posix.sep);
    const sha = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
    out.push(`${rel}	${sha}`);
  }
}

// src/lib/lint-state.ts
import { join as join2 } from 'path';

// src/lib/fs-atomic.ts
import {
  existsSync as existsSync2,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync2,
  renameSync as renameSync2,
  writeFileSync as writeFileSync2,
} from 'fs';
import { dirname } from 'path';
function atomicWriteJson(file, data) {
  mkdirSync2(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync2(
    tmp,
    `${JSON.stringify(data, null, 2)}
`
  );
  renameSync2(tmp, file);
}
function readJsonValidated(file, schema, fallback) {
  if (!existsSync2(file)) return fallback;
  try {
    const raw = JSON.parse(readFileSync2(file, 'utf8'));
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return fallback;
  } catch {
    return fallback;
  }
}

// src/lib/lint-state.ts
var DEFAULT_LINT_STATE = {
  schema_version: 1,
  sessions_since_last_lint: 0,
  last_lint_at: null,
  last_errors: 0,
  last_findings: 0,
};
function lintStateFile(stateDir) {
  return join2(stateDir, 'lint-state.json');
}
function readLintState(file) {
  return readJsonValidated(file, LintStateFileSchema, { ...DEFAULT_LINT_STATE });
}

// src/lib/state.ts
var STATE_LOCK_OPTIONS = { stale: 30 * 60 * 1e3, realpath: false };
function readState(file) {
  return readJsonValidated(file, StateFileSchema, { schema_version: 1 });
}
function writeState(file, state) {
  atomicWriteJson(file, state);
}

// src/lib/session-start.ts
var DEFAULT_NUDGE_THRESHOLD = 5;
var NUDGE_THROTTLE_MS = 60 * 60 * 1e3;
function buildSessionStartContext(ctx) {
  const now = ctx.now ?? (() => /* @__PURE__ */ new Date());
  const threshold = ctx.threshold ?? DEFAULT_NUDGE_THRESHOLD;
  const throttleMs = ctx.throttleMs ?? NUDGE_THROTTLE_MS;
  const { content: indexBody, frontmatterHash, missing } = loadIndex(ctx.kbDir);
  const liveHash = computeNodesHash(ctx.nodesDir);
  const indexStale = !missing && frontmatterHash !== null && frontmatterHash !== liveHash;
  const pending = countPendingSessions(ctx.sessionsDir);
  const state = readState(ctx.stateFile);
  const nowDate = now();
  const lastNudgedAt = parseLastNudgedAt(state.last_nudged_at ?? null);
  const throttled =
    lastNudgedAt !== null && nowDate.getTime() - lastNudgedAt.getTime() < throttleMs;
  const shouldNudge = pending >= threshold && !throttled;
  const lines = [];
  lines.push(indexBody.trim());
  if (indexStale) {
    lines.push('');
    lines.push(
      `> KB index is stale \u2014 run \`ai-knowledge-base index rebuild\` to refresh (live hash differs from INDEX.md \`nodes_hash\`).`
    );
  }
  if (shouldNudge) {
    lines.push('');
    lines.push(
      `> You have ${pending} pending session log(s). Run \`/kb-curate\` (or \`ai-knowledge-base curate\`) when ready.`
    );
  }
  let lintNudged = false;
  if (ctx.lintStateFile !== void 0) {
    const lintState = readLintState(ctx.lintStateFile);
    if (lintState.last_errors > 0 || lintState.last_findings > 0) {
      lines.push('');
      lines.push(
        `> Last KB lint ${lintState.last_lint_at}: ${lintState.last_errors} error(s), ${lintState.last_findings} finding(s). Run \`ai-knowledge-base lint --verbose\` for details.`
      );
      lintNudged = true;
    }
  }
  if (shouldNudge) {
    writeState(ctx.stateFile, { ...state, last_nudged_at: nowDate.toISOString() });
  }
  return {
    additionalContext: lines.join('\n') + '\n',
    nudged: shouldNudge,
    lintNudged,
    indexMissing: missing,
    indexStale,
    pendingSessions: pending,
  };
}
function loadIndex(kbDir) {
  const indexFile = `${kbDir.replace(/[\\/]$/, '')}/INDEX.md`;
  if (!existsSync3(indexFile)) {
    return {
      content: stubIndex(),
      frontmatterHash: null,
      missing: true,
    };
  }
  const raw = readFileSync3(indexFile, 'utf8');
  const parsed = matter2(raw);
  const result = IndexFrontmatterSchema.safeParse(parsed.data);
  const hash = result.success ? normalizeNodesHash(result.data.nodes_hash) : null;
  return {
    content: parsed.content.trimStart(),
    frontmatterHash: hash,
    missing: false,
  };
}
function stubIndex() {
  return [
    '# KB Index',
    '',
    '_The knowledge base is empty. Capture a session (the Stop hook fires automatically) or run `ai-knowledge-base node add` to seed it._',
  ].join('\n');
}
function normalizeNodesHash(value) {
  return value.startsWith('sha256:') ? value.slice(7) : value;
}
function countPendingSessions(sessionsDir) {
  if (!existsSync3(sessionsDir)) return 0;
  let count = 0;
  for (const name of readdirSync2(sessionsDir)) {
    if (!name.endsWith('.md')) continue;
    const file = join3(sessionsDir, name);
    try {
      const parsed = matter2(readFileSync3(file, 'utf8'));
      const fm = SessionLogFrontmatterSchema.safeParse(parsed.data);
      if (!fm.success) continue;
      if (fm.data.proposal_status !== 'done') continue;
      const data = parsed.data;
      if (typeof data.curator_processed_at === 'string') continue;
      count += 1;
    } catch {}
  }
  return count;
}
function parseLastNudgedAt(value) {
  if (value === null) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

// src/lib/paths.ts
import { existsSync as existsSync4, readFileSync as readFileSync4, statSync } from 'fs';
import { dirname as dirname2, join as join4, resolve } from 'path';
import { fileURLToPath } from 'url';
function findRepoRoot(from = process.cwd()) {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync4(join4(cur, '.git')) ||
      existsSync4(join4(cur, '.ai/knowledge-base/.state/installed-version'))
    ) {
      return cur;
    }
    const parent = dirname2(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = join4(root, '.ai');
  const kbDir = join4(aiDir, 'knowledge-base');
  const stateDir = join4(kbDir, '.state');
  const configDir = join4(kbDir, '.config');
  const promptsDir = join4(configDir, 'prompts');
  const claudeDir = join4(root, '.claude');
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join4(stateDir, 'installed-version'),
    projectConfigFile: join4(kbDir, 'config.yaml'),
    sessionsDir: join4(kbDir, '_sessions'),
    logsDir: join4(kbDir, '_logs'),
    nodesDir: join4(kbDir, 'nodes'),
    conflictsDir: join4(kbDir, 'conflicts'),
    claudeDir,
    claudeCommandsDir: join4(claudeDir, 'commands'),
    claudeSkillsDir: join4(claudeDir, 'skills'),
    claudeHooksDir: join4(claudeDir, 'hooks'),
    claudeSettingsFile: join4(claudeDir, 'settings.json'),
    gitignoreFile: join4(root, '.gitignore'),
  };
}

// src/lib/settings.ts
import { existsSync as existsSync5, readFileSync as readFileSync5 } from 'fs';
import { join as join5 } from 'path';
import yaml from 'js-yaml';
var SETTINGS_DEFAULTS = {
  curationThreshold: 5,
  logsRetentionDays: 30,
  lintEveryNSessions: 50,
};
var MODEL_CHOICE_KEYS = ['proposalModel', 'curatorModel', 'bootstrapModel'];
function resolveSettings(opts = {}) {
  const projectFile = opts.projectFile ?? null;
  const project = projectFile ? loadFile(projectFile) : null;
  const effective = { ...SETTINGS_DEFAULTS };
  applyOverrides(effective, project);
  return {
    settings: effective,
    projectFile,
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
  for (const key of MODEL_CHOICE_KEYS) {
    const value = src[key];
    if (value !== void 0) target[key] = value;
  }
}
function loadFile(file) {
  if (!existsSync5(file)) return null;
  const raw = readFileSync5(file, 'utf8');
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`settings file is not valid YAML (${file}): ${err.message}`);
  }
  const result = SettingsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`settings file failed schema validation (${file}): ${result.error.message}`);
  }
  return result.data;
}

// src/hooks/kb-session-start.ts
var PACKAGE_TAG = '[ai-knowledge-base]';
var HARD_DEADLINE_MS = 1e3;
async function main() {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();
  const raw = await readStdin();
  let input = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw);
    } catch {
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync6(paths.installedVersionFile)) return;
  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const result = buildSessionStartContext({
      kbDir: paths.kbDir,
      nodesDir: paths.nodesDir,
      sessionsDir: paths.sessionsDir,
      stateFile: join6(paths.stateDir, 'state.json'),
      lintStateFile: lintStateFile(paths.stateDir),
      threshold: settings.curationThreshold,
    });
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: result.additionalContext,
        },
      })}
`
    );
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}
`
    );
  }
}
function readStdin() {
  return new Promise(resolve2 => {
    if (process.stdin.isTTY) {
      resolve2('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve2(data));
    process.stdin.on('error', () => resolve2(''));
  });
}
void main().catch(() => process.exit(0));
