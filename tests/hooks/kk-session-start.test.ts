import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname as osHostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateIndex, writeIndex } from '../../src/lib/index-gen.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

// A stable phrase taken verbatim from KK_NAVIGATION_DIRECTIVE. Asserting on it
// proves the descent directive (not the old grep recipe) reaches each channel.
const DESCENT_PHRASE = 'descend on demand';
const GREP_RECIPE = 'grep -C 2';

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runHook(
  hookPath: string,
  cwd: string,
  hookInput: Record<string, unknown> | null,
  env: NodeJS.ProcessEnv = {}
): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1', ...env } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      }
    );
    if (hookInput !== null) proc.stdin?.write(JSON.stringify(hookInput));
    proc.stdin?.end();
  });
}

function runHookRaw(
  hookPath: string,
  cwd: string,
  raw: string,
  env: NodeJS.ProcessEnv = {}
): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1', ...env } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      }
    );
    proc.stdin?.write(raw);
    proc.stdin?.end();
  });
}

async function waitForFileLines(file: string, expected: number): Promise<string[]> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => line.length > 0);
      if (lines.length >= expected) return lines;
    }
    await new Promise(resolveFn => setTimeout(resolveFn, 25));
  }
  return existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => line.length > 0)
    : [];
}

async function settleNotifications(): Promise<void> {
  await new Promise(resolveFn => setTimeout(resolveFn, 100));
}

/**
 * Materialize a tree-shaped KB under the sandbox: leaves in deep branch folders
 * plus the regenerated ENTRY.md (the entry catalog carrying the global
 * nodes_hash). Returns nothing; callers read ENTRY.md afterwards.
 */
function seedLeaf(nodesDir: string, relDir: string, id: string, kind: 'practice' | 'map'): void {
  const dir = relDir === '' ? nodesDir : join(nodesDir, ...relDir.split('/'));
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 2,
    id,
    title: id,
    kind,
    tags: ['x'],
    derived_from: [],
    relates_to: [],
    confidence: 'high',
    summary: 'leaf summary',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\nBody of ${id}.`, fm));
}

function rebuildIndex(kkDir: string, nodesDir: string): void {
  const idx = generateIndex(nodesDir);
  writeIndex(join(kkDir, 'ENTRY.md'), idx.rootCatalog);
}

function seedPendingSession(kkDir: string, sessionId: string): void {
  const sessionsDir = join(kkDir, '_sessions');
  mkdirSync(sessionsDir, { recursive: true });
  writeFileSync(
    join(sessionsDir, `${sessionId}.md`),
    matter.stringify('## session\n', {
      schema_version: 1,
      session_id: sessionId,
      captured_by: 'stop',
      captured_at: '2026-05-11T10:00:00Z',
      transcript_hash: `sha256:${sessionId}`,
      proposal_status: 'done',
      proposal_completed_at: '2026-05-11T10:01:00Z',
      proposal_error: null,
      proposal_log: null,
      proposals: { practice: [{ summary: 'practice' }], map: [] },
    })
  );
}

function seedLintFindings(kkDir: string): void {
  const stateDir = join(kkDir, '.state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, 'lint-state.json'),
    JSON.stringify({
      schema_version: 1,
      sessions_since_last_lint: 0,
      last_lint_at: '2026-05-11T10:00:00.000Z',
      last_errors: 1,
      last_findings: 2,
    })
  );
}

function fakeNotifySend(root: string): { binDir: string; logFile: string } {
  const binDir = join(root, 'fake-bin');
  const logFile = join(root, 'notify.log');
  mkdirSync(binDir, { recursive: true });
  const script = join(binDir, 'notify-send');
  writeFileSync(
    script,
    '#!/bin/sh\n{ printf "%s" "$*"; printf "\\n"; } | tr "\\n" " " >> "$KK_NOTIFY_LOG"\nprintf "\\n" >> "$KK_NOTIFY_LOG"\n'
  );
  chmodSync(script, 0o755);
  return { binDir, logFile };
}

interface Sandbox {
  root: string;
  kkDir: string;
  nodesDir: string;
}

async function initTreeKb(): Promise<Sandbox> {
  const root = makeSandbox('kk-session-start-');
  await runCli(root, ['init', '--harnesses', 'claude,codex,copilot,cursor,opencode']);
  const kkDir = join(root, '.ai', 'kenkeep');
  const nodesDir = join(kkDir, 'nodes');
  // Root-level leaf plus deep-branch leaves: a real tree.
  seedLeaf(nodesDir, '', 'practice-root-leaf', 'practice');
  seedLeaf(nodesDir, 'storage', 'map-storage-leaf', 'map');
  seedLeaf(nodesDir, 'storage/tree', 'practice-deep-leaf', 'practice');
  rebuildIndex(kkDir, nodesDir);
  return { root, kkDir, nodesDir };
}

function hookPath(harness: string): string {
  return join(repoRoot, 'dist', 'hooks', harness, 'kk-session-start.cjs');
}

describe('per-harness SessionStart injection (tree descent)', () => {
  let sb: Sandbox;
  beforeEach(async () => (sb = await initTreeKb()));
  afterEach(() => cleanSandbox(sb.root));

  it('Claude injects the root index node body plus the descent directive via additionalContext', async () => {
    const res = await runHook(hookPath('claude'), sb.root, { cwd: sb.root });
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    // Native event name, not translated.
    expect(parsed.hookSpecificOutput?.hookEventName).toBe('SessionStart');
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('# kenkeep');
    expect(ctx).toContain('## Branches');
    expect(ctx).toContain(DESCENT_PHRASE);
    // Success Criterion 8: the directive is embedded in the ENTRY.md body, so the
    // hook must not append it again — exactly one occurrence reaches the channel.
    expect(ctx.split(DESCENT_PHRASE).length - 1).toBe(1);
    expect(ctx).not.toContain(GREP_RECIPE);
    // Entry catalog lists the deep branch by rollup, not the deep leaf body.
    expect(ctx).toContain('storage/');
    expect(ctx).not.toContain('practice-deep-leaf');
  });

  it('Codex injects the same payload via its additionalContext channel', async () => {
    const res = await runHook(hookPath('codex'), sb.root, { cwd: sb.root });
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additionalContext?: string };
    const ctx = parsed.additionalContext ?? '';
    expect(ctx).toContain('# kenkeep');
    expect(ctx).toContain(DESCENT_PHRASE);
    expect(ctx).not.toContain(GREP_RECIPE);
    expect(res.stdout).not.toContain('Loading knowledge base');
    expect(res.stdout).not.toContain('Knowledge base loaded');
    expect(res.stderr).toContain('Loading knowledge base');
    expect(res.stderr).toContain('Knowledge base loaded');
  });

  it('Codex session-start keeps stdout machine JSON and ignores malformed stdin', async () => {
    const res = await runHookRaw(hookPath('codex'), sb.root, 'not json');
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additionalContext?: string };
    expect(parsed.additionalContext).toContain('# kenkeep');
    expect(res.stderr).toContain('Loading knowledge base');

    const dateStr = new Date().toISOString().slice(0, 10);
    const logFile = join(sb.root, '.ai/kenkeep/_logs', `hook-errors-${dateStr}.log`);
    expect(existsSync(logFile)).toBe(false);
  });

  it('Cursor relays the payload via its native additional_context envelope', async () => {
    const res = await runHook(hookPath('cursor'), sb.root, { workspace_roots: [sb.root] });
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additional_context?: string };
    const ctx = parsed.additional_context ?? '';
    expect(ctx).toContain('# kenkeep');
    expect(ctx).toContain(DESCENT_PHRASE);
    expect(ctx).not.toContain(GREP_RECIPE);
  });

  it('OpenCode writes the root-only body plus directive to .opencode/AGENTS.md', async () => {
    const res = await runHook(hookPath('opencode'), sb.root, { cwd: sb.root });
    expect(res.exitCode).toBe(0);
    const target = join(sb.root, '.opencode', 'AGENTS.md');
    expect(existsSync(target)).toBe(true);
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('# kenkeep');
    expect(body).toContain(DESCENT_PHRASE);
    expect(body).not.toContain(GREP_RECIPE);
    expect(body).not.toContain('practice-deep-leaf');
  });

  it('Copilot writes the root index node plus directive into copilot-instructions.md', async () => {
    const res = await runHook(hookPath('copilot'), sb.root, { cwd: sb.root });
    expect(res.exitCode).toBe(0);
    const target = join(sb.root, '.github', 'copilot-instructions.md');
    expect(existsSync(target)).toBe(true);
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('# kenkeep');
    expect(body).toContain(DESCENT_PHRASE);
    expect(body).not.toContain(GREP_RECIPE);
  });

  it('keeps the injected payload bounded as deep leaves are added', async () => {
    const before = (await runHook(hookPath('claude'), sb.root, { cwd: sb.root })).stdout;
    const ctxBefore = (JSON.parse(before) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;

    // Add many leaves in a deep folder; the root index node body must not grow
    // proportionally (deep leaves surface only as a subfolder rollup count).
    for (let i = 0; i < 25; i += 1) {
      seedLeaf(sb.nodesDir, 'storage/tree', `practice-bulk-${i}`, 'practice');
    }
    rebuildIndex(sb.kkDir, sb.nodesDir);

    const after = (await runHook(hookPath('claude'), sb.root, { cwd: sb.root })).stdout;
    const ctxAfter = (JSON.parse(after) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;

    // None of the 25 deep leaf bodies/ids appear at the root.
    expect(ctxAfter).not.toContain('practice-bulk-0');
    expect(ctxAfter).not.toContain('practice-bulk-24');
    // The payload grows only by the rollup count delta, not by ~25 bullet lines.
    const growth = ctxAfter.length - ctxBefore.length;
    expect(growth).toBeLessThan(200);
  });

  it('still appends the staleness line when nodes_hash drifts from the root index node', async () => {
    // Drift: add a node after the index was rebuilt so the live hash differs.
    seedLeaf(sb.nodesDir, 'storage', 'map-drift-leaf', 'map');
    const res = await runHook(hookPath('claude'), sb.root, { cwd: sb.root });
    expect(res.exitCode).toBe(0);
    const ctx = (JSON.parse(res.stdout) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;
    expect(ctx).toContain(
      'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
    );
    expect(ctx).toContain('Action: Run npx kenkeep index rebuild.');
  });

  it('shared-result hooks preserve their output channels and send additive OS notifications', async () => {
    const fake = fakeNotifySend(sb.root);
    seedLeaf(sb.nodesDir, 'storage', 'map-shared-notification-drift', 'map');

    const cases = [
      {
        harness: 'claude',
        input: { cwd: sb.root },
        assertOutput: (res: SpawnResult) => {
          const parsed = JSON.parse(res.stdout) as {
            systemMessage?: string;
            hookSpecificOutput?: { additionalContext?: string };
          };
          expect(parsed.systemMessage).toContain(
            `kenkeep: ${sb.root.split('/').pop()} on ${osHostname()}. Action needed: Run npx kenkeep index rebuild.`
          );
          expect(parsed.hookSpecificOutput?.additionalContext).toContain(
            'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
          );
        },
      },
      {
        harness: 'codex',
        input: { cwd: sb.root },
        assertOutput: (res: SpawnResult) => {
          const parsed = JSON.parse(res.stdout) as { additionalContext?: string };
          expect(parsed.additionalContext).toContain(
            'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
          );
        },
      },
      {
        harness: 'cursor',
        input: { workspace_roots: [sb.root] },
        assertOutput: (res: SpawnResult) => {
          const parsed = JSON.parse(res.stdout) as { additional_context?: string };
          expect(parsed.additional_context).toContain(
            'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
          );
        },
      },
      {
        harness: 'opencode',
        input: { cwd: sb.root },
        assertOutput: () => {
          const body = readFileSync(join(sb.root, '.opencode', 'AGENTS.md'), 'utf8');
          expect(body).toContain(
            'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
          );
        },
      },
      {
        harness: 'copilot',
        input: { cwd: sb.root },
        assertOutput: () => {
          const body = readFileSync(join(sb.root, '.github', 'copilot-instructions.md'), 'utf8');
          expect(body).toContain(
            'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
          );
        },
      },
    ];

    for (const entry of cases) {
      const res = await runHook(hookPath(entry.harness), sb.root, entry.input, {
        PATH: `${fake.binDir}:${process.env.PATH ?? ''}`,
        KK_NOTIFY_LOG: fake.logFile,
      });
      expect(res.exitCode).toBe(0);
      entry.assertOutput(res);
    }

    const notifications = await waitForFileLines(fake.logFile, cases.length);
    expect(notifications).toHaveLength(cases.length);
    for (const line of notifications) {
      expect(line).toContain('--app-name=kenkeep');
      expect(line).toContain(`kenkeep: ${sb.root.split('/').pop()} on ${osHostname()}`);
      expect(line).toContain(`Path: ${sb.root}`);
      expect(line).toContain('Action: Run npx kenkeep index rebuild.');
    }
  });

  it('Codex preserves stdout context and sends one batched OS notification for actionable nudges', async () => {
    const fake = fakeNotifySend(sb.root);
    seedLeaf(sb.nodesDir, 'storage', 'map-notification-drift', 'map');
    seedPendingSession(sb.kkDir, 'notify-session');
    seedLintFindings(sb.kkDir);
    writeFileSync(join(sb.kkDir, 'config.yaml'), 'schema_version: 1\ncurationThreshold: 1\n');

    const res = await runHook(
      hookPath('codex'),
      sb.root,
      { cwd: sb.root },
      {
        PATH: `${fake.binDir}:${process.env.PATH ?? ''}`,
        KK_NOTIFY_LOG: fake.logFile,
      }
    );
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additionalContext?: string };
    expect(parsed.additionalContext).toContain('# kenkeep');
    expect(parsed.additionalContext).toContain('Project:');
    expect(parsed.additionalContext).toContain(`Host: ${osHostname()}`);
    expect(parsed.additionalContext).toContain(`Path: ${sb.root}`);
    expect(parsed.additionalContext).toContain(
      'Issue: ENTRY.md is stale because nodes changed since the last index rebuild.'
    );
    expect(parsed.additionalContext).toContain(
      'Issue: Curation queue is overdue: 1 session log(s) awaiting curation, 1 candidate proposal(s). Oldest uncurated capture:'
    );
    expect(parsed.additionalContext).toContain('Action: Run /kk-curate.');
    expect(parsed.additionalContext).toContain(
      'Issue: Lint findings were recorded in the last kenkeep lint run.'
    );
    expect(parsed.additionalContext).toContain('Action: Run npx kenkeep lint --verbose.');

    const notifications = await waitForFileLines(fake.logFile, 1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('--app-name=kenkeep');
    expect(notifications[0]).toContain(`kenkeep: ${sb.root.split('/').pop()} on ${osHostname()}`);
    expect(notifications[0]).toContain(`Path: ${sb.root}`);
    expect(notifications[0]).toContain('Action: Run npx kenkeep index rebuild.');
    expect(notifications[0]).toContain('Action: Run /kk-curate.');
    expect(notifications[0]).toContain('Action: Run npx kenkeep lint --verbose.');
  });

  it('Codex notification opt-out preserves stdout and skips OS notification attempts', async () => {
    const fake = fakeNotifySend(sb.root);
    seedPendingSession(sb.kkDir, 'notify-opt-out');
    writeFileSync(
      join(sb.kkDir, 'config.yaml'),
      'schema_version: 1\ncurationThreshold: 1\nnotifications:\n  enabled: false\n'
    );

    const res = await runHook(
      hookPath('codex'),
      sb.root,
      { cwd: sb.root },
      {
        PATH: `${fake.binDir}:${process.env.PATH ?? ''}`,
        KK_NOTIFY_LOG: fake.logFile,
      }
    );
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout) as { additionalContext?: string };
    expect(parsed.additionalContext).toContain('Action: Run /kk-curate.');

    await settleNotifications();
    expect(existsSync(fake.logFile)).toBe(false);
  });
});
