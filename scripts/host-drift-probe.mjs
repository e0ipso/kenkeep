#!/usr/bin/env node
// Token-free host-contract drift probe. Run weekly against the LATEST
// harness CLIs (never pinned — drift detection wants today's release).
// Verifies, per harness, everything that can be verified WITHOUT a model
// call or auth: the binary runs, `kenkeep init` produces a setup the real
// binary's doctor checks accept, and (where the host allows it) the
// pre-auth slice of the integration contract. A red run means "a host
// changed its contract", attributable to the host release — never to a
// kenkeep commit. The post-auth slice (does injected context reach the
// model, does capture fire in a live session) is the manual tier: see
// docs/internals/manual-test-plan.md.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(repoRoot, 'dist', 'cli.js');
const HARNESSES = [
  { id: 'claude', binary: 'claude' },
  { id: 'codex', binary: 'codex' },
  { id: 'copilot', binary: 'copilot' },
  { id: 'cursor', binary: 'cursor-agent' },
  { id: 'opencode', binary: 'opencode' },
];

const failures = [];

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, ...opts });
}

function check(label, ok, detail = '') {
  const mark = ok ? 'ok ' : 'FAIL';
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

for (const { id, binary } of HARNESSES) {
  console.log(`\n## ${id}`);

  const version = sh(binary, ['--version']);
  check(
    `${binary} --version`,
    version.status === 0,
    (version.stdout || version.stderr).trim().split('\n')[0]
  );
  if (version.status !== 0) continue;

  // init + doctor against the REAL binary: doctor's per-harness checks
  // include "CLI on PATH" and the host config files init wrote.
  const sandbox = mkdtempSync(join(tmpdir(), `kk-drift-${id}-`));
  const env = { ...process.env };
  if (id === 'copilot') env.COPILOT_HOME = join(sandbox, 'copilot-home');
  sh('git', ['init', '-q'], { cwd: sandbox });
  const init = sh('node', [cli, 'init', '--harnesses', id], { cwd: sandbox, env });
  check(
    'kenkeep init',
    init.status === 0,
    init.status === 0 ? '' : (init.stderr || '').trim().slice(0, 200)
  );
  const doctor = sh('node', [cli, 'doctor'], { cwd: sandbox, env });
  check(
    'kenkeep doctor',
    doctor.status === 0,
    doctor.status === 0 ? '' : (doctor.stdout + doctor.stderr).trim().slice(-300)
  );

  // OpenCode pre-auth contract probe: the host must load plugins declared
  // in .opencode/opencode.json and fire session.created — both happen
  // BEFORE any model/auth interaction, so an unauthenticated `opencode run`
  // failing at the LLM step still proves (or disproves) the contract.
  if (id === 'opencode') {
    const probeLog = join(sandbox, 'probe-events.log');
    const pluginsDir = join(sandbox, '.opencode', 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, 'probe.mjs'),
      [
        "import { appendFileSync } from 'node:fs';",
        'export default async () => {',
        `  appendFileSync(${JSON.stringify(probeLog)}, 'LOADED\\n');`,
        '  return { event: async ({ event }) => {',
        `    appendFileSync(${JSON.stringify(probeLog)}, event.type + '\\n');`,
        '  } };',
        '};',
        '',
      ].join('\n')
    );
    const config = JSON.parse(readFileSync(join(sandbox, '.opencode', 'opencode.json'), 'utf8'));
    config.plugin = [...(config.plugin ?? []), './plugins/probe.mjs'];
    writeFileSync(join(sandbox, '.opencode', 'opencode.json'), JSON.stringify(config, null, 2));
    // Expected to FAIL at the model call (no auth in CI). The contract
    // probe is plugin DISCOVERY: OpenCode must load plugins declared in the
    // config array — the exact contract that silently broke once. Event
    // delivery (session.created) needs a resolvable model, so it is
    // reported informationally, never failed on.
    sh(binary, ['run', 'probe'], { cwd: sandbox, env, timeout: 180_000 });
    const events = existsSync(probeLog) ? readFileSync(probeLog, 'utf8') : '';
    check('plugin loaded from config array', events.includes('LOADED'));
    console.log(
      `  [info] session.created ${events.includes('session.created') ? 'fired' : 'not observed (needs a resolvable model — covered by the manual tier)'}`
    );
  }

  // Codex pre-auth contract probe: `codex doctor` runs without credentials
  // and validates config/install consistency, which covers hooks.json parse.
  if (id === 'codex') {
    const codexDoctor = sh(binary, ['doctor'], { cwd: sandbox, env, timeout: 120_000 });
    const out = codexDoctor.stdout + codexDoctor.stderr;
    check('codex doctor runs (auth errors expected)', out.includes('Codex Doctor'));
  }
}

console.log(
  failures.length === 0
    ? '\nAll host-contract probes passed.'
    : `\n${failures.length} probe(s) failed: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
