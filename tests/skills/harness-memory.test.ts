import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, cliPath, makeSandbox, repoRoot, runCli } from '../helpers.js';

/**
 * A33: the shipped skills must pull the harness's changed memory files into
 * their pipeline and record them in the ledger only after the derived nodes
 * or conflicts landed. These assertions read the rendered templates the
 * build wrote under `templates/`, so they cover what users install.
 */
function skillText(name: string): string {
  return readFileSync(join(repoRoot, 'templates/skills', name, 'SKILL.md'), 'utf8');
}

function indexOfOrFail(text: string, needle: string): number {
  const at = text.indexOf(needle);
  expect(at, `expected to find: ${needle}`).toBeGreaterThanOrEqual(0);
  return at;
}

describe('shipped skills ingest harness memory through the ledger primitives', () => {
  it('kk-bootstrap lists memory files during discovery and marks them only in the finalize step', () => {
    const text = skillText('kk-bootstrap');
    const list = indexOfOrFail(text, 'npx --yes kenkeep@latest memory list');
    const persist = indexOfOrFail(text, 'npx --yes kenkeep@latest node write');
    const completeDoc = indexOfOrFail(text, 'npx --yes kenkeep@latest bootstrap complete-doc');
    const mark = indexOfOrFail(
      text,
      'npx --yes kenkeep@latest memory mark "<iri>" --hash "<sha256>" --run-id "$RUN_ID"'
    );
    expect(list).toBeLessThan(persist);
    expect(completeDoc).toBeLessThan(mark);
    expect(text).toContain('Never mark a file while one of its `node write` calls failed');
    expect(text).toContain('omit both for a harness memory file');
  });

  it('kk-curate stages memory files before enumeration and marks them after curate-persist', () => {
    const text = skillText('kk-curate');
    const stage = indexOfOrFail(text, '## 0b. Stage changed harness memory files');
    const enumerate = indexOfOrFail(text, '## 1. Enumerate pending session logs');
    const persist = indexOfOrFail(text, '## 5. Persist surviving actions via `curate-persist`');
    const markStep = indexOfOrFail(text, '## 5b. Mark the processed harness memory files');
    const report = indexOfOrFail(text, '## 6. Report the content summary');
    expect(stage).toBeLessThan(enumerate);
    expect(persist).toBeLessThan(markStep);
    expect(markStep).toBeLessThan(report);
    const stageSection = text.slice(stage, enumerate);
    expect(stageSection).toContain('npx --yes kenkeep@latest memory list');
    expect(stageSection).toContain(
      'session-log stage-live --session-id "<session_id>" --transcript-excerpt "<path>"'
    );
    const markSection = text.slice(markStep, report);
    expect(markSection).toContain(
      'npx --yes kenkeep@latest memory mark "<iri>" --hash "<sha256>" --run-id "$RUN_ID"'
    );
    expect(markSection).toContain('exited 0 with `"failed":0`');
    expect(markSection).toContain('leave **every** file staged in Step 0b unmarked');
  });

  it('both skills say `memory list` makes a headless Claude call', () => {
    for (const name of ['kk-bootstrap', 'kk-curate']) {
      expect(skillText(name)).toContain('one headless `claude -p` call');
    }
  });
});

describe('memory list / memory mark through the built CLI', () => {
  let cwd: string;
  let binDir: string;
  let memoryFile: string;

  beforeEach(() => {
    cwd = makeSandbox('kk-memory-cli-');
    mkdirSync(join(cwd, '.git'), { recursive: true });
    mkdirSync(join(cwd, '.ai/kenkeep/.state'), { recursive: true });
    writeFileSync(
      join(cwd, '.ai/kenkeep/.state/installed-version'),
      JSON.stringify({
        schema_version: 1,
        package: 'kenkeep',
        version: '0.0.0-test',
        installed_at: '2026-10-02T10:00:00Z',
        assistants: ['claude'],
      })
    );
    memoryFile = join(cwd, 'outside', 'MEMORY.md');
    mkdirSync(join(cwd, 'outside'), { recursive: true });
    writeFileSync(memoryFile, 'Prefer tabs.\n');
    // A stand-in `claude` that answers the discovery prompt with one IRI.
    binDir = join(cwd, 'bin');
    mkdirSync(binDir, { recursive: true });
    const iri = pathToFileURL(memoryFile).href;
    const reply = JSON.stringify({
      type: 'result',
      is_error: false,
      result: JSON.stringify([iri]),
    });
    writeFileSync(join(binDir, 'claude'), `#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' '${reply}'\n`);
    chmodSync(join(binDir, 'claude'), 0o755);
  });

  afterEach(() => cleanSandbox(cwd));

  function env(): NodeJS.ProcessEnv {
    return { PATH: `${binDir}:${process.env['PATH'] ?? ''}`, CLAUDECODE: '' };
  }

  function runWithStdin(args: string[], stdin: string): { exitCode: number; stdout: string } {
    const res = spawnSync('node', [cliPath, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', ...env() },
      input: stdin,
      encoding: 'utf8',
    });
    return { exitCode: res.status ?? 1, stdout: res.stdout };
  }

  async function list(): Promise<{
    harness: string;
    files: Array<{ iri: string; path: string; sha256: string; session_id: string }>;
  }> {
    const res = await runCli(cwd, ['memory', 'list', '--harness', 'claude'], env());
    expect(res.exitCode, res.stderr).toBe(0);
    expect(res.stdout.trimEnd().split('\n'), 'one JSON document').toHaveLength(1);
    return JSON.parse(res.stdout);
  }

  it('lists a new file, skips it once marked, refuses a stale mark, and relists on change', async () => {
    const first = await list();
    expect(first.harness).toBe('claude');
    expect(first.files).toHaveLength(1);
    expect(first.files[0]!.path).toBe(memoryFile);

    const stale = await runCli(
      cwd,
      ['memory', 'mark', first.files[0]!.iri, '--hash', 'e'.repeat(64), '--run-id', 'run-0'],
      env()
    );
    expect(stale.exitCode).toBe(1);
    expect(stale.stdout).toBe('');
    expect(stale.stderr).toMatch(/changed since it was listed/);
    expect((await list()).files).toHaveLength(1);

    const marked = await runCli(
      cwd,
      [
        'memory',
        'mark',
        first.files[0]!.iri,
        '--hash',
        first.files[0]!.sha256,
        '--run-id',
        'run-1',
      ],
      env()
    );
    expect(marked.exitCode, marked.stderr).toBe(0);
    expect(JSON.parse(marked.stdout)).toEqual({
      iri: first.files[0]!.iri,
      sha256: first.files[0]!.sha256,
      run_id: 'run-1',
    });
    const ledger = JSON.parse(
      readFileSync(join(cwd, '.ai/kenkeep/.state/memory-ledger.json'), 'utf8')
    );
    expect(ledger.entries[first.files[0]!.iri].lastSeenRunId).toBe('run-1');

    expect((await list()).files).toEqual([]);

    writeFileSync(memoryFile, 'Prefer spaces.\n');
    const changed = await list();
    expect(changed.files).toHaveLength(1);
    expect(changed.files[0]!.sha256).not.toBe(first.files[0]!.sha256);
    expect(changed.files[0]!.session_id).not.toBe(first.files[0]!.session_id);
  });

  it('memory list on Claude spawns a headless `claude -p` discovery call, as its help says', async () => {
    const argvFile = join(cwd, 'discovery-argv.txt');
    const reply = JSON.stringify({ type: 'result', is_error: false, result: '[]' });
    writeFileSync(
      join(binDir, 'claude'),
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${argvFile}'\ncat >/dev/null\nprintf '%s\\n' '${reply}'\n`
    );
    expect((await list()).files).toEqual([]);
    expect(readFileSync(argvFile, 'utf8').split('\n')).toContain('-p');

    const help = await runCli(cwd, ['memory', 'list', '--help'], env());
    expect(help.stdout.replace(/\s+/g, ' ')).toContain('one headless `claude -p` discovery call');
    const groupHelp = await runCli(cwd, ['memory', '--help'], env());
    expect(groupHelp.stdout).not.toMatch(/^\s*Deterministic primitives/m);
  });

  it('kk-curate Step 5b keeps a memory file listed while a deduplicated action failed', async () => {
    mkdirSync(join(cwd, '.ai/kenkeep/nodes/topic'), { recursive: true });
    const listed = (await list()).files[0]!;

    // An ordinary session and the memory file propose the same add. Dedup
    // keeps the ordinary session's origin, so the memory origin vanishes.
    const ordinaryId = 'a6960db1-51f9-4ef4-aef6-f87ebff1e278';
    const consumed = [ordinaryId, listed.session_id].map(sessionId => {
      const staged = runWithStdin(
        [
          'session-log',
          'stage-live',
          '--session-id',
          sessionId,
          '--transcript-excerpt',
          'Prefer tabs.',
        ],
        JSON.stringify({ practice: [], map: [] })
      );
      expect(staged.exitCode).toBe(0);
      const logPath = JSON.parse(staged.stdout).path as string;
      const hashLine = readFileSync(logPath, 'utf8')
        .split('\n')
        .find(l => l.startsWith('transcript_hash:'))!;
      return {
        session_id: sessionId,
        file: logPath.split('/').pop()!,
        transcript_hash: hashLine.split(': ')[1]!.replace(/['"]/g, ''),
      };
    });
    const proposal = {
      type: 'practice',
      title: 'Prefer tabs',
      description: 'Indent with tabs.',
      tags: ['topic'],
      body: 'Indent with tabs.',
      kk_confidence: 'high',
      kk_relates_to: [],
      kk_depends_on: [],
    };
    const actions = [ordinaryId, listed.session_id].map(sessionId => ({
      action: 'add',
      candidate_origin: `${sessionId}:practice:0`,
      proposed_node: proposal,
      rationale: 'Durable preference',
      home_folder: 'missing',
    }));
    const collected = join(cwd, 'collected.json');
    const survivors = join(cwd, 'survivors.json');
    writeFileSync(collected, JSON.stringify({ actions, consumed }));
    const dedup = await runCli(
      cwd,
      ['curate-dedup', '--input', collected, '--output', survivors, '--run-id', 'run-1'],
      env()
    );
    expect(dedup.exitCode, dedup.stderr).toBe(0);
    expect(JSON.parse(dedup.stdout)).toMatchObject({ kept: 1, stamped: 2 });

    // Step 5b gate: mark only after curate-persist exits 0 with no failure.
    async function persistThenMark(): Promise<boolean> {
      const persist = await runCli(cwd, ['curate-persist', '--input', survivors], env());
      const summary = JSON.parse(persist.stdout) as {
        failed: number;
        results: Array<{ candidate_origin: string }>;
      };
      expect(summary.results.map(r => r.candidate_origin)).toEqual([`${ordinaryId}:practice:0`]);
      if (persist.exitCode !== 0 || summary.failed !== 0) return false;
      const marked = await runCli(
        cwd,
        ['memory', 'mark', listed.iri, '--hash', listed.sha256, '--run-id', 'run-1'],
        env()
      );
      expect(marked.exitCode, marked.stderr).toBe(0);
      return true;
    }

    expect(await persistThenMark()).toBe(false);
    expect((await list()).files.map(f => f.iri)).toEqual([listed.iri]);

    // Fix the cause and rerun persist: the node lands, then the file is marked.
    const doc = JSON.parse(readFileSync(survivors, 'utf8'));
    doc[0].home_folder = 'topic';
    writeFileSync(survivors, JSON.stringify(doc));
    expect(await persistThenMark()).toBe(true);
    expect(readdirSync(join(cwd, '.ai/kenkeep/nodes/topic'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/^practice-.*\.md$/)])
    );
    expect((await list()).files).toEqual([]);
  });

  it('a harness without native memory prints an empty list and exits 0', async () => {
    const res = await runCli(cwd, ['memory', 'list', '--harness', 'codex'], env());
    expect(res.exitCode, res.stderr).toBe(0);
    expect(res.stdout).toBe('{"harness":"codex","files":[]}\n');
  });
});
