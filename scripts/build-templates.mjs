#!/usr/bin/env node
// Builds the shipped `templates/` directory.
//
// 1. Copies `src/templates-source/` (static markdown, settings, etc.) into `templates/`.
// 2. Renders Handlebars prompt templates (`*.md.hbs`) in the copied tree into
//    self-contained `*.md` files, expanding shared partials from `_partials/`.
// 3. Copies compiled hook scripts from `dist/hooks/<harness>/*.cjs` into
//    `templates/<harness>/hooks/*.cjs` (or `templates/<harness>/kk-hooks/*.cjs`
//    for adapters that ship a plugin shim or carry a `.kk-hooks-output`
//    marker, to keep our dispatch tree separate from a `hooks/` directory the
//    host reserves or that holds the hook-config artifact).
// 4. Copies compiled plugin modules from `dist/plugins/<harness>/*.mjs` into
//    `templates/<harness>/plugins/*.mjs` for adapters that ship a plugin shim.
//
// Composition happens here, at build time, so shipped templates stay plain,
// self-contained markdown with no runtime templating dependency.
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
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'src/templates-source');
const dest = resolve(root, 'templates');
const compiledHooksRoot = resolve(root, 'dist/hooks');
const compiledPluginsRoot = resolve(root, 'dist/plugins');
const harnessSrcRoot = resolve(root, 'src/harnesses');
// Partials live under `_partials/` and are never shipped; they are registered
// by name (path relative to `_partials/`, sans `.md.hbs`) so templates can pull
// them in with `{{> name}}`.
const partialsDir = resolve(src, '_partials');
const partialExtension = '.md.hbs';

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

function registerPartials() {
  if (!existsSync(partialsDir)) return 0;
  let count = 0;
  for (const file of walkFiles(partialsDir)) {
    if (!file.endsWith(partialExtension)) continue;
    const name = relative(partialsDir, file)
      .slice(0, -partialExtension.length)
      .split('\\')
      .join('/');
    // trimEnd so authoring a trailing newline never shifts rendered output.
    Handlebars.registerPartial(name, readFileSync(file, 'utf8').trimEnd());
    count += 1;
  }
  return count;
}

function renderTemplates() {
  // Markdown, not HTML: never entity-escape `&`, `<`, `>` in substitutions.
  const partials = registerPartials();
  const destPartialsDir = join(dest, '_partials');
  let rendered = 0;
  for (const file of walkFiles(dest)) {
    if (!file.endsWith('.hbs')) continue;
    // Partials are expanded into their callers, never rendered on their own.
    if (!relative(destPartialsDir, file).startsWith('..')) continue;
    // noEscape: markdown/shell, never entity-escape `&`, `<`, `>`.
    // ignoreStandalone: substitute partials literally; do not strip the
    // blank lines a partial tag sits between, so spacing stays predictable.
    const template = Handlebars.compile(readFileSync(file, 'utf8'), {
      noEscape: true,
      ignoreStandalone: true,
    });
    const outPath = file.slice(0, -'.hbs'.length);
    writeFileSync(outPath, template(undefined, { partials: Handlebars.partials }));
    unlinkSync(file);
    rendered += 1;
  }

  // Partials are a build-time-only concern; never ship them.
  rmSync(join(dest, '_partials'), { recursive: true, force: true });

  // Guard the self-contained packaging rule: no stray `.hbs` files and no
  // unexpanded `{{ ... }}` markers may reach the shipped tree.
  for (const file of walkFiles(dest)) {
    if (file.endsWith('.hbs')) {
      throw new Error(`Unrendered template left in shipped tree: ${file}`);
    }
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(file, 'utf8');
    if (/\{\{.*?\}\}/s.test(text)) {
      throw new Error(`Unresolved Handlebars marker in ${file}`);
    }
  }

  if (rendered > 0) {
    console.log(`Rendered ${rendered} prompt template(s) from ${partials} partial(s)`);
  }
}

renderTemplates();

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
