// src/lib/capture.ts
import { createHash } from 'crypto';
import { existsSync as existsSync4, readFileSync as readFileSync2 } from 'fs';

// src/lib/secret-scan.ts
import { existsSync } from 'fs';
import { join } from 'path';
var FALLBACK_CONFIG = {
  rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }],
};
function redactSecrets(text, findings) {
  const ordered = [...findings].sort((a, b) => (b.secret?.length ?? 0) - (a.secret?.length ?? 0));
  let out = text;
  for (const f of ordered) {
    const secret = f.secret;
    if (typeof secret !== 'string' || secret.length === 0) continue;
    out = out.split(secret).join(`[REDACTED:${f.ruleId}]`);
  }
  return out;
}
async function loadResolvedConfig(cwd) {
  const { loadConfig } = await import('@secretlint/config-loader');
  const explicit = join(cwd, '.secretlintrc.json');
  if (existsSync(explicit)) {
    const loaded2 = await loadConfig({ cwd, configFilePath: explicit });
    if (loaded2.ok) return loaded2.config;
  }
  try {
    const loaded2 = await loadConfig({ cwd });
    if (loaded2.ok) return loaded2.config;
  } catch {}
  const { loadPackagesFromConfigDescriptor } = await import('@secretlint/config-loader');
  const loaded = await loadPackagesFromConfigDescriptor({
    configDescriptor: FALLBACK_CONFIG,
  });
  return loaded.config;
}
async function scanAndRedact(text, timeoutMs = 1e3) {
  let timer;
  try {
    const cwd = process.cwd();
    const config = await loadResolvedConfig(cwd);
    const { lintSource } = await import('@secretlint/core');
    const linted = await Promise.race([
      lintSource({
        source: {
          filePath: join(cwd, '__transcript__.txt'),
          content: text,
          contentType: 'text',
        },
        options: {
          config,
          noPhysicFilePath: true,
        },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`secretlint timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
    const findings = [];
    for (const m of linted.messages) {
      if (m.type !== 'message') continue;
      const [start, end] = m.range;
      if (typeof start !== 'number' || typeof end !== 'number' || end <= start) continue;
      const secret = text.slice(start, end);
      if (secret.length === 0) continue;
      findings.push({
        ruleId: m.ruleId,
        secret,
        startLine: m.loc?.start?.line,
        endLine: m.loc?.end?.line,
      });
    }
    if (findings.length === 0) {
      return { status: 'clean', redactedText: text, findings: [] };
    }
    return {
      status: 'redacted',
      redactedText: redactSecrets(text, findings),
      findings,
    };
  } catch (err) {
    const e = err;
    return {
      status: 'blocked',
      redactedText: '',
      findings: [],
      error: e.message,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// src/lib/session-log.ts
import { existsSync as existsSync2, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join as join2 } from 'path';
import { dump } from 'js-yaml';
function renderSessionLog(input) {
  const proposalStatus = input.proposalStatus ?? 'pending';
  const proposalError = input.proposalError ?? null;
  const proposalCompletedAt = input.proposalCompletedAt ?? null;
  const frontmatter = {
    schema_version: 1,
    session_id: input.sessionId,
    captured_by: input.capturedBy,
    captured_at: input.capturedAt,
    transcript_hash: input.transcriptHash,
    proposal_status: proposalStatus,
    proposal_completed_at: proposalCompletedAt,
    proposal_error: proposalError,
    proposal_log: null,
    secret_scan_status: input.secretScanStatus,
    proposals: { practice: [], map: [] },
  };
  const yaml2 = dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const bodyLines = [
    '## Transcript',
    '',
    input.body.trimEnd(),
    '',
    '## Proposal',
    '',
    '(populated by proposal worker)',
    '',
  ];
  return `---
${yaml2}---
${bodyLines.join('\n')}`;
}
function writeSessionLog(sessionsDir, filename, contents) {
  mkdirSync(sessionsDir, { recursive: true });
  const path = join2(sessionsDir, filename);
  writeFileSync(path, contents);
  return path;
}
function buildSessionLogFilename(capturedAt, sessionId) {
  const d = new Date(capturedAt);
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `${stamp}-${sessionId}.md`;
}
function findSessionLogBySessionId(sessionsDir, sessionId) {
  if (!existsSync2(sessionsDir)) return null;
  const suffix = `-${sessionId}.md`;
  const matches = readdirSync(sessionsDir)
    .filter(f => f.endsWith(suffix))
    .sort();
  return matches[0] ?? null;
}
var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertValidSessionId(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('session_id must be a non-empty string');
  }
  if (!UUID_V4_RE.test(sessionId)) {
    throw new Error(`session_id "${sessionId}" is not a UUID v4`);
  }
  return sessionId.toLowerCase();
}
function pad(n) {
  return n.toString().padStart(2, '0');
}

// src/lib/settings.ts
import { existsSync as existsSync3, readFileSync } from 'fs';
import { join as join3 } from 'path';
import yaml from 'js-yaml';

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

// src/lib/settings.ts
var CURSORY_MAX_USER_TURNS = 1;
var CURSORY_MAX_USER_CHARS = 200;
var CURSORY_MAX_AGENT_CHARS = 500;

// src/lib/transcript.ts
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => !!c && typeof c === 'object')
      .filter(c => (c.type ?? 'text') === 'text')
      .map(c => (typeof c.text === 'string' ? c.text : ''))
      .filter(s => s.length > 0)
      .join('\n');
  }
  return '';
}
function parseTranscriptJsonl(text) {
  const out = { interleaved: [] };
  for (const rawLine of text.split('\n')) {
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
    if (role === 'user') {
      const text2 = extractText(content);
      if (text2) {
        out.interleaved.push({ role: 'user', text: text2 });
      }
    } else if (role === 'assistant' || role === 'agent') {
      const text2 = extractText(content);
      if (text2) {
        out.interleaved.push({ role: 'agent', text: text2 });
      }
    }
  }
  return out;
}
var SELF_REVIEW_APPLY_TRIGGER = /^\s*\/self-review-apply\s+(\S+\.xml)\s*$/;
function renderRoleTagged(t) {
  const segs = t.interleaved;
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    if (seg.role === 'user') {
      const match = SELF_REVIEW_APPLY_TRIGGER.exec(seg.text);
      if (match) {
        const path = match[1];
        lines.push(`[USER /self-review-apply ${path}]: ${seg.text}`);
        const next = segs[i + 1];
        if (next && next.role === 'agent') {
          lines.push(`[AGENT NARRATION OF SELF-REVIEW ${path}]: ${next.text}`);
          i += 1;
        }
        continue;
      }
      lines.push(`[USER]: ${seg.text}`);
    } else {
      lines.push(`[AGENT]: ${seg.text}`);
    }
  }
  return lines.join('\n\n');
}

// src/lib/capture.ts
var HOOK_EVENT_TO_TRIGGER = {
  Stop: 'stop',
  SessionEnd: 'session_end',
  PreCompact: 'pre_compact',
};
function eventToTrigger(event) {
  if (event && HOOK_EVENT_TO_TRIGGER[event]) {
    return HOOK_EVENT_TO_TRIGGER[event];
  }
  return 'stop';
}
async function captureSession(input, ctx) {
  const trigger = eventToTrigger(input.hook_event_name);
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync4(transcriptPath)) {
    return {
      status: 'no-transcript',
      error: `transcript_path missing or absent: ${transcriptPath ?? '(none)'}`,
    };
  }
  const transcriptText = readFileSync2(transcriptPath, 'utf8');
  const parsed = parseTranscriptJsonl(transcriptText);
  const slice = renderRoleTagged(parsed);
  if (!slice.trim()) {
    return { status: 'no-content' };
  }
  const hash = `sha256:${createHash('sha256').update(slice).digest('hex')}`;
  const scan = ctx.scan ?? (text => scanAndRedact(text, ctx.scanTimeoutMs ?? 1e3));
  const scanResult = await scan(slice);
  if (scanResult.status === 'blocked') {
    return {
      status: 'secret-scan-blocked',
      secretScanStatus: 'blocked',
      ...(scanResult.error !== void 0 ? { error: scanResult.error } : {}),
    };
  }
  const capturedAt = (ctx.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
  const sessionId = input.session_id;
  const existingFilename = findSessionLogBySessionId(ctx.sessionsDir, sessionId);
  const filename = existingFilename ?? buildSessionLogFilename(capturedAt, sessionId);
  let userTurns = 0;
  let userChars = 0;
  let agentChars = 0;
  for (const seg of parsed.interleaved) {
    if (seg.role === 'user') {
      userTurns += 1;
      userChars += seg.text.length;
    } else if (seg.role === 'agent') {
      agentChars += seg.text.length;
    }
  }
  const isCursory =
    userTurns <= CURSORY_MAX_USER_TURNS &&
    userChars <= CURSORY_MAX_USER_CHARS &&
    agentChars <= CURSORY_MAX_AGENT_CHARS;
  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    secretScanStatus: scanResult.status,
    body: scanResult.status === 'redacted' ? scanResult.redactedText : slice,
    ...(isCursory
      ? {
          proposalStatus: 'skipped',
          proposalError: 'cursory_session',
          proposalCompletedAt: capturedAt,
        }
      : {}),
  });
  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);
  return {
    status: 'written',
    sessionLogPath,
    secretScanStatus: scanResult.status,
  };
}

// src/lib/paths.ts
import { existsSync as existsSync5, readFileSync as readFileSync3, statSync } from 'fs';
import { dirname, join as join4, resolve } from 'path';
import { fileURLToPath } from 'url';
function findRepoRoot(from = process.cwd()) {
  let cur = resolve(from);
  while (true) {
    if (
      existsSync5(join4(cur, '.git')) ||
      existsSync5(join4(cur, '.ai/knowledge-base/.state/installed-version'))
    ) {
      return cur;
    }
    const parent = dirname(cur);
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

// src/hooks/kb-capture.ts
var HARD_DEADLINE_MS = 1e3;
var PACKAGE_TAG = '[ai-knowledge-base]';
async function main() {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();
  const raw = await readStdin();
  if (raw.trim().length === 0) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const startCwd =
    typeof payload['cwd'] === 'string' && payload['cwd'].length > 0
      ? payload['cwd']
      : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  try {
    const sessionId = assertValidSessionId(payload['session_id']);
    const input = {
      session_id: sessionId,
      ...(typeof payload['transcript_path'] === 'string'
        ? { transcript_path: payload['transcript_path'] }
        : {}),
      ...(typeof payload['hook_event_name'] === 'string'
        ? { hook_event_name: payload['hook_event_name'] }
        : {}),
      ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] } : {}),
    };
    const result = await captureSession(input, { sessionsDir: paths.sessionsDir });
    if (result.status === 'secret-scan-blocked') {
      process.stderr.write(
        `${PACKAGE_TAG} secret scan blocked transcript capture: ${result.error ?? 'unknown error'}
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
