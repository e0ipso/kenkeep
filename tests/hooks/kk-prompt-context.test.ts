import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateIndex, writeIndex } from '../../src/lib/index-gen.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

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

function seedLeaf(
  nodesDir: string,
  relDir: string,
  id: string,
  kind: 'practice' | 'map',
  fields: { title: string; tags: string[]; summary: string; body: string }
): void {
  const dir = relDir === '' ? nodesDir : join(nodesDir, ...relDir.split('/'));
  mkdirSync(dir, { recursive: true });
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: fields.title,
    type: kind,
    description: fields.summary,
    tags: fields.tags,
    kk_derived_from: [],
    kk_relates_to: [],
    kk_confidence: 'high',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(fields.body, fm));
}

interface Sandbox {
  root: string;
  kkDir: string;
  nodesDir: string;
}

async function initKb(): Promise<Sandbox> {
  const root = makeSandbox('kk-prompt-context-');
  await runCli(root, ['init', '--harnesses', 'claude,codex,copilot,cursor,opencode']);
  const kkDir = join(root, '.ai', 'kenkeep');
  const nodesDir = join(kkDir, 'nodes');
  seedLeaf(nodesDir, 'harnesses', 'map-codex-harness', 'map', {
    title: 'Codex CLI harness adapter',
    tags: ['codex', 'hooks'],
    summary: 'How the Codex adapter registers hooks',
    body: 'SECRET_BODY_TEXT codex hook registration details',
  });
  seedLeaf(nodesDir, 'index', 'practice-determinism', 'practice', {
    title: 'Index determinism contract',
    tags: ['index', 'determinism'],
    summary: 'Generated indexes must be byte-stable',
    body: 'sort keys, stable ordering, no timestamps',
  });
  const idx = generateIndex(nodesDir);
  writeIndex(join(kkDir, 'ENTRY.md'), idx.rootCatalog);
  return { root, kkDir, nodesDir };
}

function hookPath(harness: string): string {
  return join(repoRoot, 'dist', 'hooks', harness, 'kk-prompt-context.cjs');
}

/** Pull the injected context string out of each harness's native output shape. */
function claudeContext(stdout: string): string {
  if (stdout.trim().length === 0) return '';
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  expect(parsed.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
  return parsed.hookSpecificOutput?.additionalContext ?? '';
}

function codexContext(stdout: string): string {
  if (stdout.trim().length === 0) return '';
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  expect(parsed.hookSpecificOutput?.hookEventName).toBe('UserPromptSubmit');
  return parsed.hookSpecificOutput?.additionalContext ?? '';
}

describe('prompt-time injection hooks (built bundles)', () => {
  let sb: Sandbox;
  beforeEach(async () => (sb = await initKb()));
  afterEach(() => cleanSandbox(sb.root));

  it('Claude injects relevant summaries and links via UserPromptSubmit additionalContext', async () => {
    const res = await runHook(hookPath('claude'), sb.root, {
      cwd: sb.root,
      prompt: 'how do I wire codex hooks',
    });
    expect(res.exitCode).toBe(0);
    const ctx = claudeContext(res.stdout);
    expect(ctx).toContain('Codex CLI harness adapter');
    expect(ctx).toContain('`map-codex-harness`');
    expect(ctx).toContain('.ai/kenkeep/nodes/harnesses/map-codex-harness.md');
    expect(ctx).toContain('open the linked node');
    // Summaries-plus-links only — never the full leaf body.
    expect(ctx).not.toContain('SECRET_BODY_TEXT');
  });

  it('Codex injects the same payload via its hookSpecificOutput channel', async () => {
    const res = await runHook(hookPath('codex'), sb.root, {
      cwd: sb.root,
      prompt: 'wire codex hooks',
    });
    expect(res.exitCode).toBe(0);
    const ctx = codexContext(res.stdout);
    expect(ctx).toContain('Codex CLI harness adapter');
    expect(ctx).toContain('.ai/kenkeep/nodes/harnesses/map-codex-harness.md');
    expect(ctx).not.toContain('SECRET_BODY_TEXT');
  });

  it('omits unrelated low-relevance nodes (no context injected)', async () => {
    const res = await runHook(hookPath('claude'), sb.root, {
      cwd: sb.root,
      prompt: 'provision a postgres replica failover topology',
    });
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe('');
  });

  it('injects nothing for an empty/missing prompt', async () => {
    const empty = await runHook(hookPath('codex'), sb.root, { cwd: sb.root, prompt: '   ' });
    expect(empty.exitCode).toBe(0);
    expect(empty.stdout.trim()).toBe('');

    const missing = await runHook(hookPath('codex'), sb.root, { cwd: sb.root });
    expect(missing.exitCode).toBe(0);
    expect(missing.stdout.trim()).toBe('');
  });

  it('fails open (exit 0, no context) when the knowledge base is absent', async () => {
    const bare = makeSandbox('kk-prompt-context-bare-');
    try {
      const res = await runHook(hookPath('claude'), bare, {
        cwd: bare,
        prompt: 'wire codex hooks',
      });
      expect(res.exitCode).toBe(0);
      expect(res.stdout.trim()).toBe('');
    } finally {
      cleanSandbox(bare);
    }
  });

  it('does not re-enter when the recursion guard is set', async () => {
    const res = await runHook(
      hookPath('claude'),
      sb.root,
      { cwd: sb.root, prompt: 'wire codex hooks' },
      { KENKEEP_BUILDER_INTERNAL: '1' }
    );
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe('');
  });
});
