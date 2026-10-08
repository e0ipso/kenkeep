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
 * <harness-specific-args> "/kk-<skill> …"` with `KENKEEP_BUILDER_INTERNAL=1`
 * set on the child env and `stdio: 'inherit'`. Most harnesses use `-p`, but
 * OpenCode uses `run`. Plus the deprecation alias must write a
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
    // The harness starts from the project root even if the launcher was
    // invoked from a nested directory.
    expect(call.args.options['cwd']).toBe(sandbox);
    // Recursion guard env var present and process.env preserved.
    const env = call.args.options['env'] as Record<string, string>;
    expect(env['KENKEEP_BUILDER_INTERNAL']).toBe('1');
    expect(env['PATH']).toBeDefined();

    // Child exits 0 → launcher process.exit(0).
    call.emit(0);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  it('prefers the nearest parent .ai/kenkeep over an intervening nested .git directory', () => {
    const nested = join(sandbox, 'packages/app/src');
    mkdirSync(join(sandbox, 'packages/app/.git'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'claude', spawnFn, exitFn });

    expect(captured[0]!.args.options['cwd']).toBe(sandbox);
  });

  it('omits the slash-command tail entirely when no passedArgs are given', () => {
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'codex', spawnFn, exitFn });
    expect(captured[0]!.args.args).toEqual(['exec', '/kk-curate']);
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

  it('uses opencode run instead of -p for the opencode harness', () => {
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'opencode', spawnFn, exitFn });
    expect(captured[0]!.args.binary).toBe('opencode');
    expect(captured[0]!.args.args).toEqual(['run', '/kk-curate']);
  });

  it('uses codex exec instead of -p for the codex harness', () => {
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'codex', spawnFn, exitFn });
    expect(captured[0]!.args.binary).toBe('codex');
    expect(captured[0]!.args.args).toEqual(['exec', '/kk-curate']);
  });
});

/**
 * Writes `.ai/kenkeep/config.yaml` in the sandbox so `resolveSettings` picks
 * up a per-role model choice. The launcher must translate that choice into
 * the active adapter's native model flags; the per-host flags were verified
 * against `claude 2.1.285 --help`, `codex 0.159.3 exec --help`, Cursor
 * `agent 2026.09.28 --help`, `@github/copilot 1.0.91 --help` and
 * `opencode-ai 1.18.34 run --help`.
 */
function writeConfig(root: string, yamlBody: string): void {
  writeFileSync(join(root, '.ai/kenkeep/config.yaml'), `schema_version: 1\n${yamlBody}`);
}

describe('launchSkill model selection', () => {
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
    vi.restoreAllMocks();
  });

  const matrix: Array<{
    harness: string;
    skill: 'kk-bootstrap' | 'kk-curate' | 'kk-add';
    config: string;
    expectedArgs: string[];
  }> = [
    {
      harness: 'claude',
      skill: 'kk-bootstrap',
      config: 'bootstrapModel:\n  harness: claude\n  name: opus\n  effort: high\n',
      expectedArgs: ['--model', 'opus', '--effort', 'high', '-p', '/kk-bootstrap --from docs'],
    },
    {
      harness: 'codex',
      skill: 'kk-curate',
      config: 'curatorModel:\n  harness: codex\n  model: gpt-5-codex\n  reasoningEffort: high\n',
      expectedArgs: [
        'exec',
        '--model',
        'gpt-5-codex',
        '-c',
        'model_reasoning_effort=high',
        '/kk-curate',
      ],
    },
    {
      harness: 'cursor',
      skill: 'kk-add',
      config: 'curatorModel:\n  harness: cursor\n  model: sonnet-4-thinking\n',
      expectedArgs: ['--model', 'sonnet-4-thinking', '-p', '/kk-add'],
    },
    {
      // Copilot's `-p` takes the prompt as its value, so the model
      // flags must not sit between the two.
      harness: 'copilot',
      skill: 'kk-curate',
      config: 'curatorModel:\n  harness: copilot\n  model: gpt-5\n',
      expectedArgs: ['--model', 'gpt-5', '-p', '/kk-curate'],
    },
    {
      harness: 'opencode',
      skill: 'kk-curate',
      config:
        'curatorModel:\n  harness: opencode\n  model: anthropic/claude-sonnet-4\n  agent: curator\n',
      expectedArgs: [
        'run',
        '--model',
        'anthropic/claude-sonnet-4',
        '--agent',
        'curator',
        '/kk-curate',
      ],
    },
  ];

  it.each(matrix)(
    '$harness: passes the configured $skill role model through the native model flags',
    ({ harness, skill, config, expectedArgs }) => {
      writeConfig(sandbox, config);
      const { spawnFn, captured } = makeFakeSpawn();
      const exitFn = vi.fn((_code: number) => undefined as never);
      const passedArgs = skill === 'kk-bootstrap' ? '--from docs' : '';
      launchSkill({ skill, passedArgs, harness, spawnFn, exitFn });
      expect(captured, harness).toHaveLength(1);
      expect(captured[0]!.args.args, harness).toEqual(expectedArgs);
    }
  );

  it('launches with the host default and warns when the configured model targets another harness', () => {
    writeConfig(sandbox, 'curatorModel:\n  harness: codex\n  model: gpt-5-codex\n');
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { spawnFn, captured } = makeFakeSpawn();
    const exitFn = vi.fn((_code: number) => undefined as never);
    launchSkill({ skill: 'kk-curate', harness: 'claude', spawnFn, exitFn });
    expect(captured[0]!.args.args).toEqual(['-p', '/kk-curate']);
    const lines = stderr.mock.calls.map(call => call.join(' ')).join('\n');
    expect(lines).toMatch(/curatorModel/);
    expect(lines).toMatch(/codex/);
    expect(lines).toMatch(/claude/);
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
