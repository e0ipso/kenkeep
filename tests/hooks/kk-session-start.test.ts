import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    const ctxBefore = (
      JSON.parse(before) as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;

    // Add many leaves in a deep folder; the root index node body must not grow
    // proportionally (deep leaves surface only as a subfolder rollup count).
    for (let i = 0; i < 25; i += 1) {
      seedLeaf(sb.nodesDir, 'storage/tree', `practice-bulk-${i}`, 'practice');
    }
    rebuildIndex(sb.kkDir, sb.nodesDir);

    const after = (await runHook(hookPath('claude'), sb.root, { cwd: sb.root })).stdout;
    const ctxAfter = (
      JSON.parse(after) as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;

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
    const ctx = (
      JSON.parse(res.stdout) as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;
    expect(ctx).toContain('kenkeep index is stale');
  });
});
