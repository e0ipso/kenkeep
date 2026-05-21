// src/hooks/kb-lint-tick.ts
import { existsSync as existsSync5 } from 'fs';

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
var InvalidNodeFrontmatterError = class extends Error {
  failures;
  constructor(failures) {
    super(formatFailures(failures));
    this.name = 'InvalidNodeFrontmatterError';
    this.failures = failures;
  }
};
var KINDS = ['practice', 'map'];
function readAllNodes(nodesDir) {
  const out = [];
  const failures = [];
  for (const kind of KINDS) {
    const dir = join(nodesDir, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const filePath = join(dir, name);
      const raw = readFileSync(filePath, 'utf8');
      let parsed;
      try {
        parsed = matter(raw);
      } catch (err) {
        failures.push({
          file: filePath,
          reason: `YAML frontmatter parse error: ${err.message}`,
          issues: [],
        });
        continue;
      }
      const result = NodeFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        failures.push({
          file: filePath,
          reason: 'frontmatter does not match NodeFrontmatterSchema',
          issues: result.error.issues,
        });
        continue;
      }
      out.push({
        path: filePath,
        filename: name,
        frontmatter: result.data,
        body: parsed.content,
      });
    }
  }
  if (failures.length > 0) {
    throw new InvalidNodeFrontmatterError(failures);
  }
  return out;
}
function formatFailures(failures) {
  const lines = [`Invalid node frontmatter in ${failures.length} file(s):`];
  for (const f of failures) {
    lines.push(`  ${f.file}: ${f.reason}`);
    for (const issue of f.issues) {
      lines.push(`    - ${formatIssue(issue)}`);
    }
  }
  return lines.join('\n');
}
function formatIssue(issue) {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `${path}: ${issue.message}`;
}
function slugify(input) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

// src/lib/lint.ts
function runLint(opts) {
  const nodes = readAllNodes(opts.nodesDir);
  const errors = [];
  const findings = [];
  const idSet = new Set(nodes.map(n => n.frontmatter.id));
  const incomingRefs = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const refs = node.frontmatter.relates_to;
    for (const ref of refs) {
      let set = incomingRefs.get(ref);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        incomingRefs.set(ref, set);
      }
      set.add(node.frontmatter.id);
    }
  }
  for (const node of nodes) {
    const refs = node.frontmatter.relates_to;
    for (const ref of refs) {
      if (!idSet.has(ref)) {
        errors.push({
          rule: 'dangling-edge',
          file: node.path,
          message: `references unknown node ${ref}`,
          action: 'Remove the broken reference from the frontmatter or create the missing node.',
        });
      }
    }
  }
  for (const node of nodes) {
    const mismatch = checkSlugId(node);
    if (mismatch) {
      errors.push({
        rule: 'slug-id-mismatch',
        file: node.path,
        message: mismatch,
        action:
          'Rename the file and fix the id so id == <kind>-<slug> and filename == <id>.md under nodes/<kind>/.',
      });
    }
  }
  const clusters = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    for (const tag of node.frontmatter.tags) {
      const key = normalizeTag(tag);
      if (!key) continue;
      let entry = clusters.get(key);
      if (!entry) {
        entry = { original: /* @__PURE__ */ new Set(), nodeIds: /* @__PURE__ */ new Set() };
        clusters.set(key, entry);
      }
      entry.original.add(tag);
      entry.nodeIds.add(node.frontmatter.id);
    }
  }
  for (const entry of clusters.values()) {
    if (entry.original.size >= 2) {
      const members = [...entry.original].sort().join(', ');
      findings.push({
        rule: 'tag-near-duplicate',
        file: '',
        message: `tag cluster {${members}} affects ${entry.nodeIds.size} node(s)`,
        action: 'Pick a canonical tag and normalize the affected nodes.',
      });
    }
  }
  for (const node of nodes) {
    const outgoing = node.frontmatter.relates_to.length;
    const incoming = incomingRefs.get(node.frontmatter.id);
    const incomingFromOthers = incoming
      ? [...incoming].filter(src => src !== node.frontmatter.id).length
      : 0;
    if (outgoing === 0 && incomingFromOthers === 0) {
      findings.push({
        rule: 'orphan',
        file: node.path,
        message: `orphan node ${node.frontmatter.id}`,
        action:
          'Add cross-links to neighboring nodes, or accept that this node legitimately stands alone.',
      });
    }
  }
  errors.sort(compareEntries);
  findings.sort(compareEntries);
  return { errors, findings };
}
function checkSlugId(node) {
  const { id, kind } = node.frontmatter;
  const prefix = `${kind}-`;
  if (!id.startsWith(prefix)) {
    return `id ${id} does not start with kind prefix ${prefix}`;
  }
  const bare = id.slice(prefix.length);
  const canonicalBare = slugify(bare);
  if (bare !== canonicalBare) {
    return `id ${id} is not canonical; expected ${kind}-${canonicalBare}`;
  }
  const expectedFilename = `${id}.md`;
  if (node.filename !== expectedFilename) {
    return `filename ${node.filename} does not match expected ${expectedFilename}`;
  }
  const parentSegment = node.path.split(/[\\/]/).slice(-2, -1)[0];
  if (parentSegment !== kind) {
    return `file is under nodes/${parentSegment ?? '?'}/ but kind is ${kind}`;
  }
  return null;
}
function normalizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/s$/, '');
}
function compareEntries(a, b) {
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
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
function writeLintState(file, state) {
  atomicWriteJson(file, state);
}

// src/lib/paths.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, statSync } from 'fs';
import { dirname as dirname2, join as join3, resolve } from 'path';
import { fileURLToPath } from 'url';
function findRepoRoot(from = process.cwd()) {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync3(join3(cur, '.git')) ||
      existsSync3(join3(cur, '.ai/knowledge-base/.state/installed-version'))
    ) {
      return cur;
    }
    const parent = dirname2(cur);
    if (parent === cur) return resolve(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = join3(root, '.ai');
  const kbDir = join3(aiDir, 'knowledge-base');
  const stateDir = join3(kbDir, '.state');
  const configDir = join3(kbDir, '.config');
  const promptsDir = join3(configDir, 'prompts');
  const claudeDir = join3(root, '.claude');
  return {
    root,
    aiDir,
    kbDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: join3(stateDir, 'installed-version'),
    projectConfigFile: join3(kbDir, 'config.yaml'),
    sessionsDir: join3(kbDir, '_sessions'),
    logsDir: join3(kbDir, '_logs'),
    nodesDir: join3(kbDir, 'nodes'),
    conflictsDir: join3(kbDir, 'conflicts'),
    claudeDir,
    claudeCommandsDir: join3(claudeDir, 'commands'),
    claudeSkillsDir: join3(claudeDir, 'skills'),
    claudeHooksDir: join3(claudeDir, 'hooks'),
    claudeSettingsFile: join3(claudeDir, 'settings.json'),
    gitignoreFile: join3(root, '.gitignore'),
  };
}

// src/lib/settings.ts
import { existsSync as existsSync4, readFileSync as readFileSync4 } from 'fs';
import { join as join4 } from 'path';
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
  if (!existsSync4(file)) return null;
  const raw = readFileSync4(file, 'utf8');
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

// src/hooks/kb-lint-tick.ts
var PACKAGE_TAG = '[ai-knowledge-base]';
async function main() {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;
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
  if (!existsSync5(paths.installedVersionFile)) return;
  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const stateFile = lintStateFile(paths.stateDir);
    const state = readLintState(stateFile);
    const threshold = settings.lintEveryNSessions;
    const nextCount = state.sessions_since_last_lint + 1;
    if (nextCount < threshold) {
      writeLintState(stateFile, { ...state, sessions_since_last_lint: nextCount });
      return;
    }
    const result = runLint({ nodesDir: paths.nodesDir });
    writeLintState(stateFile, {
      schema_version: 1,
      sessions_since_last_lint: 0,
      last_lint_at: /* @__PURE__ */ new Date().toISOString(),
      last_errors: result.errors.length,
      last_findings: result.findings.length,
    });
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} lint tick error: ${err instanceof Error ? err.message : String(err)}
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
