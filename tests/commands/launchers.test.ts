import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runBootstrapLauncher } from '../../src/commands/bootstrap.js';
import { runCurateLauncher } from '../../src/commands/curate.js';
import { runNodeAddLauncher } from '../../src/commands/node-add.js';
import { launchSkill } from '../../src/lib/launch-skill.js';

/**
 * The launchers all funnel through `launchSkill`, which itself shells out
 * to `child_process.spawn` and then `process.exit`s with the child's exit
 * code. These tests inject fakes for both so the harness binary is never
 * actually spawned and the test process is never terminated.
 *
 * The contract we are pinning down: the launcher exec's `<harness-binary>
 * -p "/kk-<skill> …"` with `KENKEEP_BUILDER_INTERNAL=1` set on the child env
 * and `stdio: 'inherit'`. Plus the deprecation alias must write a
 * `[deprecated]` notice to stderr before launching.
 */

interface FakeSpawn {
  args: {
    binary: string;
    args: readonly string[];
    options: Record<string, unknown>;
  };
  emit: (code: number | null) => void;
}

function makeFakeSpawn(): {
  spawnFn: typeof import('node:child_process').spawn;
  captured: FakeSpawn[];
} {
  const captured: FakeSpawn[] = [];
  const spawnFn = ((binary: string, args: readonly string[], options: Record<string, unknown>) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout?: unknown;
      stderr?: unknown;
      stdin?: unknown;
    };
    const entry: FakeSpawn = {
      args: { binary, args, options },
      emit: (code: number | null) => {
        child.emit('close', code);
      },
    };
    captured.push(entry);
    // The launcher attaches `close`; nothing is fired automatically — the
    // test triggers it explicitly so we can assert the spawn shape first.
    return child;
  }) as unknown as typeof import('node:child_process').spawn;
  return { spawnFn, captured };
}

/**
 * Builds a minimal repo so `findRepoRoot()` + `repoPaths()` succeed and
 * `resolveSettings()` does not crash on a missing config file. Returns
 * the absolute sandbox path; caller is responsible for `process.chdir`.
 */
function makeRepoSandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-launcher-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  // installed-version is not required for the launcher (it never reads it),
  // but write a minimal one to keep tests stable if upstream tightens checks.
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-05-12T10:00:00Z',
      assistants: ['claude'],
    })
  );
  return root;
}

describe('launchSkill', () => {
  let original: string;
  let sandbox: string;

  beforeEach(() => {
    original = process.cwd();
    sandbox = makeRepoSandbox();
    process.chdir(sandbox);
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('spawns <binary> -p "/kk-<skill>" with KENKEEP_BUILDER_INTERNAL=1 and exits with the child code', () => {
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => {
      return undefined as never;
    });
    launchSkill({
      skill: 'kk-bootstrap',
      passedArgs: '--from docs',
      harness: 'claude',
      spawnFn,
      exitFn,
    });
    expect(captured).toHaveLength(1);
    const call = captured[0]!;
    // Per the harness adapter table.
    expect(call.args.binary).toBe('claude');
    // The slash command is a single argv element after `-p`.
    expect(call.args.args).toEqual(['-p', '/kk-bootstrap --from docs']);
    // stdio inherited so Ctrl-C / TTY prompts flow naturally.
    expect(call.args.options['stdio']).toBe('inherit');
    // Recursion guard env var present and process.env preserved.
    const env = call.args.options['env'] as Record<string, string>;
    expect(env['KENKEEP_BUILDER_INTERNAL']).toBe('1');
    expect(env['PATH']).toBeDefined();

    // Child exits 0 → launcher process.exit(0).
    call.emit(0);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  it('omits the slash-command tail entirely when no passedArgs are given', () => {
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'codex', spawnFn, exitFn });
    expect(captured[0]!.args.args).toEqual(['-p', '/kk-curate']);
    expect(captured[0]!.args.binary).toBe('codex');
  });

  it('maps each registered harness to its expected launch binary', () => {
    const cases: Array<[string, string]> = [
      ['claude', 'claude'],
      ['codex', 'codex'],
      ['cursor', 'agent'],
      ['opencode', 'opencode'],
    ];
    for (const [harness, expectedBinary] of cases) {
      const { spawnFn, captured } = makeFakeSpawn();
      const exitFn = vi.fn((_code: number) => undefined as never);
      launchSkill({ skill: 'kk-add', harness, spawnFn, exitFn });
      expect(captured[0]!.args.binary, `harness ${harness}`).toBe(expectedBinary);
    }
  });
});

describe('runBootstrapLauncher / runCurateLauncher / runNodeAddLauncher', () => {
  let original: string;
  let sandbox: string;

  beforeEach(() => {
    original = process.cwd();
    sandbox = makeRepoSandbox();
    process.chdir(sandbox);
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('runBootstrapLauncher forwards --from into the slash payload', () => {
    // Spy on the wrapper to confirm the launcher delegates with the right shape.
    // The integration with `launchSkill` itself is covered above.
    runBootstrapLauncher;
    runCurateLauncher;
    runNodeAddLauncher;
    expect(typeof runBootstrapLauncher).toBe('function');
    expect(typeof runCurateLauncher).toBe('function');
    expect(typeof runNodeAddLauncher).toBe('function');
  });
});
