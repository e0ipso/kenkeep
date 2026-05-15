#!/usr/bin/env node
// Lints for drift between the canonical TS harness-resolution source
// and the heredoc body embedded in the shared kb-curate SKILL.md.
//
// Both sides own a list of (a) registered harness ids and (b) env-var
// detectors. When the two lists diverge, skills route to the wrong
// adapter (or fail to detect at all). This lint fails the CI build on
// drift so contributors update both files when adding a new harness.
//
// Inputs:
//   - src/harnesses/registry.ts    (REGISTERED harness ids)
//   - src/harnesses/claude/index.ts, codex/index.ts, opencode/index.ts
//     (each adapter's detectFromEnv body; we scan for `env['VAR']`)
//   - src/templates-source/skills/kb-curate/SKILL.md (heredoc body)
//
// Output:
//   - exit 0 with `detect-harness lint OK` on a match
//   - exit non-zero with a precise mismatch diff on drift
//
// Per Plan 23 Task 9.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const registryFile = join(root, 'src/harnesses/registry.ts');
const harnessesDir = join(root, 'src/harnesses');
const skillFile = join(root, 'src/templates-source/skills/kb-curate/SKILL.md');

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function readFile(path) {
  if (!existsSync(path)) fail(`required file missing: ${path}`);
  return readFileSync(path, 'utf8');
}

// 1. Registered harness ids: parse src/harnesses/registry.ts for the
//    ADAPTERS map keys. The shape is `[xxxAdapter.id]: xxxAdapter,`.
function readRegisteredFromTs() {
  const text = readFile(registryFile);
  const ids = new Set();
  for (const match of text.matchAll(/\bimport\s*\{\s*(\w+)\s*\}\s*from\s*'\.\/(\w+)\/index\.js'/g)) {
    ids.add(match[2]);
  }
  return ids;
}

// 2. Env detectors per adapter: read each src/harnesses/<id>/index.ts and
//    pull env var names out of detectFromEnv-style functions. We accept
//    either `env['NAME']` or `env.NAME`. Each detector is a tuple
//    (harness, env-name); a single adapter can declare multiple.
function readEnvDetectorsFromTs() {
  const out = new Set();
  for (const entry of readdirSync(harnessesDir)) {
    const indexFile = join(harnessesDir, entry, 'index.ts');
    if (!existsSync(indexFile) || !statSync(indexFile).isFile()) continue;
    const text = readFileSync(indexFile, 'utf8');
    if (!/detectFromEnv/.test(text)) continue;
    // Heuristic: capture the body of the first detect* function. It
    // begins at `function detect...(` and ends at the matching closing
    // brace. We grab a generous window and regex env references from it.
    const fnMatch = text.match(/function\s+detect\w*From\w*\s*\([\s\S]*?\n\}\s*\n/);
    const body = fnMatch ? fnMatch[0] : text;
    const envNames = new Set();
    for (const m of body.matchAll(/env\['([A-Z_][A-Z_0-9]*)'\]/g)) {
      envNames.add(m[1]);
    }
    for (const m of body.matchAll(/env\.([A-Z_][A-Z_0-9]*)\b/g)) {
      envNames.add(m[1]);
    }
    for (const name of envNames) out.add(`${entry}:${name}`);
  }
  return out;
}

// 3. From the heredoc inside kb-curate/SKILL.md: extract REGISTERED and
//    ENV_DETECTORS. The heredoc spans from `cat << 'EOF' > /tmp/kb-detect-harness.mjs`
//    to the matching `EOF` token.
function readFromHeredoc() {
  const text = readFile(skillFile);
  const match = text.match(/cat <<\s*'EOF'\s*>\s*\/tmp\/kb-detect-harness\.mjs\s*\n([\s\S]*?)\n\s*EOF/);
  if (!match) fail(`could not locate detect-harness heredoc in ${skillFile}`);
  const body = match[1];

  const registeredMatch = body.match(/const\s+REGISTERED\s*=\s*\[([^\]]*)\]/);
  if (!registeredMatch) fail('heredoc: REGISTERED array not found');
  const registered = new Set(
    registeredMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  );

  const detectors = new Set();
  const detectorMatch = body.match(/const\s+ENV_DETECTORS\s*=\s*\[([\s\S]*?)\]/);
  if (!detectorMatch) fail('heredoc: ENV_DETECTORS array not found');
  for (const m of detectorMatch[1].matchAll(
    /\{\s*env:\s*'([A-Z_0-9]+)'\s*,[^}]*harness:\s*'(\w+)'/g
  )) {
    detectors.add(`${m[2]}:${m[1]}`);
  }
  return { registered, detectors };
}

const tsRegistered = readRegisteredFromTs();
const tsDetectors = readEnvDetectorsFromTs();
const { registered: heredocRegistered, detectors: heredocDetectors } = readFromHeredoc();

function diffSets(label, a, b, aLabel, bLabel) {
  const onlyInA = [...a].filter(x => !b.has(x)).sort();
  const onlyInB = [...b].filter(x => !a.has(x)).sort();
  if (onlyInA.length === 0 && onlyInB.length === 0) return false;
  process.stderr.write(`drift in ${label}:\n`);
  for (const x of onlyInA) process.stderr.write(`  - only in ${aLabel}: ${x}\n`);
  for (const x of onlyInB) process.stderr.write(`  + only in ${bLabel}: ${x}\n`);
  return true;
}

let mismatched = false;
mismatched =
  diffSets('registered harness ids', tsRegistered, heredocRegistered, registryFile, skillFile) ||
  mismatched;
mismatched =
  diffSets('env detectors', tsDetectors, heredocDetectors, 'TS adapter sources', skillFile) ||
  mismatched;

if (mismatched) {
  process.stderr.write(
    '\nlint-detect-harness: TS resolver and SKILL.md heredoc disagree.\n' +
      'Update both sides when adding/removing a harness or env detector.\n'
  );
  process.exit(1);
}

process.stdout.write('detect-harness lint OK\n');
