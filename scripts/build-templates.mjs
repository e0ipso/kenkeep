#!/usr/bin/env node
// Builds the shipped `templates/` directory.
//
// 1. Copies `src/templates-source/` (static markdown, settings, etc.) into `templates/`.
// 2. Renders source-only markdown partial includes in the copied templates.
// 3. Copies compiled hook scripts from `dist/hooks/<harness>/*.cjs` into
//    `templates/<harness>/hooks/*.cjs` (or `templates/<harness>/kk-hooks/*.cjs`
//    for adapters that ship a plugin shim or carry a `.kk-hooks-output`
//    marker, to keep our dispatch tree separate from a `hooks/` directory the
//    host reserves or that holds the hook-config artifact).
// 4. Copies compiled plugin modules from `dist/plugins/<harness>/*.mjs` into
//    `templates/<harness>/plugins/*.mjs` for adapters that ship a plugin shim.
//
// Run after `tsup` so the compiled artifacts exist; the package's `prepare`
// script wires this up.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'src/templates-source');
const dest = resolve(root, 'templates');
const compiledHooksRoot = resolve(root, 'dist/hooks');
const compiledPluginsRoot = resolve(root, 'dist/plugins');
const harnessSrcRoot = resolve(root, 'src/harnesses');
const includePattern = /^<!--\s*kk-include:\s*([A-Za-z0-9._/-]+)(?:\s+(\{.*\}))?\s*-->$/gm;
const partialVariablePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

if (!existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);

function walkFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else if (stat.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function parseIncludeArgs(raw, name) {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Template partial include args must be a JSON object: ${name}`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string') {
      throw new Error(`Template partial include args must be string values: ${name}`);
    }
  }
  return parsed;
}

function loadPartial(name, args = {}) {
  const path = resolve(src, name);
  const rel = relative(src, path);
  if (rel.startsWith('..') || rel === '' || rel.includes('\\')) {
    throw new Error(`Invalid template partial include: ${name}`);
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Template partial not found: ${name}`);
  }
  const text = readFileSync(path, 'utf8').trimEnd();
  return text.replace(partialVariablePattern, (_match, key) => {
    if (!Object.hasOwn(args, key)) {
      throw new Error(`Missing value for {{${key}}} in template partial: ${name}`);
    }
    return args[key];
  });
}

function renderTemplateIncludes(dir) {
  let rendered = 0;
  for (const file of walkFiles(dir)) {
    if (!file.endsWith('.md')) continue;
    if (relative(join(dir, '_partials'), file).startsWith('..') === false) continue;

    const original = readFileSync(file, 'utf8');
    const next = original.replace(includePattern, (_match, name, rawArgs) => {
      rendered += 1;
      return loadPartial(name, parseIncludeArgs(rawArgs, name));
    });
    if (next !== original) {
      writeFileSync(file, next);
    }
  }

  rmSync(join(dir, '_partials'), { recursive: true, force: true });

  for (const file of walkFiles(dir)) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(file, 'utf8');
    if (includePattern.test(text)) {
      includePattern.lastIndex = 0;
      throw new Error(`Unresolved template include marker in ${file}`);
    }
    includePattern.lastIndex = 0;
  }

  if (rendered > 0) {
    console.log(`Rendered ${rendered} template partial include(s)`);
  }
}

renderTemplateIncludes(dest);

function usesKkHooksOutput(harnessId) {
  const adapterDir = join(harnessSrcRoot, harnessId);
  return (
    existsSync(join(adapterDir, 'plugins')) || existsSync(join(adapterDir, '.kk-hooks-output'))
  );
}

if (existsSync(compiledHooksRoot)) {
  for (const harnessId of readdirSync(compiledHooksRoot)) {
    const harnessDir = join(compiledHooksRoot, harnessId);
    if (!statSync(harnessDir).isDirectory()) continue;
    const dirName = usesKkHooksOutput(harnessId) ? 'kk-hooks' : 'hooks';
    const destHooksDir = resolve(dest, harnessId, dirName);
    mkdirSync(destHooksDir, { recursive: true });
    let copied = 0;
    for (const name of readdirSync(harnessDir)) {
      const from = join(harnessDir, name);
      if (!statSync(from).isFile()) continue;
      if (!name.endsWith('.cjs')) continue;
      cpSync(from, join(destHooksDir, name));
      copied += 1;
    }
    console.log(`Copied ${copied} ${harnessId} hook(s) -> ${destHooksDir}`);
  }
} else {
  console.warn(
    `Compiled hooks directory not found: ${compiledHooksRoot}. Run tsup first ` +
      `(npm run build:cli). Continuing without hooks; templates may be incomplete.`
  );
}

if (existsSync(compiledPluginsRoot)) {
  for (const harnessId of readdirSync(compiledPluginsRoot)) {
    const harnessDir = join(compiledPluginsRoot, harnessId);
    if (!statSync(harnessDir).isDirectory()) continue;
    const destPluginsDir = resolve(dest, harnessId, 'plugins');
    mkdirSync(destPluginsDir, { recursive: true });
    let copied = 0;
    for (const name of readdirSync(harnessDir)) {
      const from = join(harnessDir, name);
      if (!statSync(from).isFile()) continue;
      if (!name.endsWith('.mjs')) continue;
      cpSync(from, join(destPluginsDir, name));
      copied += 1;
    }
    console.log(`Copied ${copied} ${harnessId} plugin(s) -> ${destPluginsDir}`);
  }
}
