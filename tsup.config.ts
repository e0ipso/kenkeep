import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Discovers per-adapter build artifacts under `src/harnesses/<id>/`.
 *
 * Two kinds of artifacts are emitted:
 *
 *   1. **Per-event hook scripts** discovered at `src/harnesses/<id>/hooks/*.ts`.
 *      For adapters whose host runtime owns `<dir>/hooks/` (OpenCode reserves
 *      `.opencode/hooks/` for its own use), the output is renamed to
 *      `kb-hooks/<name>.mjs` to keep the private dispatch tree separate. The
 *      rename is triggered by the presence of a sibling `plugins/` directory:
 *      that signals the adapter ships a plugin shim and needs `kb-hooks/`
 *      under its native root (see Plan 23 for the convention).
 *   2. **Plugin modules** discovered at `src/harnesses/<id>/plugins/*.ts` and
 *      emitted to `dist/plugins/<id>/<name>.mjs` for the build-templates
 *      script to mirror into `templates/<id>/plugins/<name>.mjs`.
 *
 * Adapter detection is by directory glob; no central enum of harness ids.
 */
type DiscoveredEntries = {
  hookEntries: Record<string, string>;
  pluginEntries: Record<string, string>;
  /** Adapter ids whose hook output is renamed to `kb-hooks/`. */
  kbHooksOutputAdapters: Set<string>;
};

function dirExists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function discoverEntries(): DiscoveredEntries {
  const hookEntries: Record<string, string> = {};
  const pluginEntries: Record<string, string> = {};
  const kbHooksOutputAdapters = new Set<string>();
  const harnessesDir = 'src/harnesses';
  let harnessIds: string[];
  try {
    harnessIds = readdirSync(harnessesDir);
  } catch {
    return { hookEntries, pluginEntries, kbHooksOutputAdapters };
  }
  for (const id of harnessIds) {
    const adapterDir = join(harnessesDir, id);
    if (!dirExists(adapterDir)) continue;
    const hooksDir = join(adapterDir, 'hooks');
    const pluginsDir = join(adapterDir, 'plugins');
    const hasPlugins = dirExists(pluginsDir);
    if (hasPlugins) kbHooksOutputAdapters.add(id);
    if (dirExists(hooksDir)) {
      for (const name of readdirSync(hooksDir)) {
        if (!name.endsWith('.ts')) continue;
        const full = join(hooksDir, name);
        if (!statSync(full).isFile()) continue;
        const stem = name.slice(0, -'.ts'.length);
        hookEntries[`${id}/${stem}`] = full;
      }
    }
    if (hasPlugins) {
      for (const name of readdirSync(pluginsDir)) {
        if (!name.endsWith('.ts')) continue;
        const full = join(pluginsDir, name);
        if (!statSync(full).isFile()) continue;
        const stem = name.slice(0, -'.ts'.length);
        pluginEntries[`${id}/${stem}`] = full;
      }
    }
  }
  return { hookEntries, pluginEntries, kbHooksOutputAdapters };
}

const discovered = discoverEntries();

const configs = [
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'] as const,
    target: 'node22',
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: false,
    minify: false,
    shims: false,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    // Hooks ship as compiled, self-contained .mjs files. We use the
    // .mjs extension so they run as ESM in consumer repos regardless
    // of the consumer's package.json `type` field.
    entry: discovered.hookEntries,
    outDir: 'dist/hooks',
    format: ['esm'] as const,
    target: 'node22',
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: false,
    shims: false,
    outExtension: () => ({ js: '.mjs' }),
  },
];

if (Object.keys(discovered.pluginEntries).length > 0) {
  configs.push({
    entry: discovered.pluginEntries,
    outDir: 'dist/plugins',
    format: ['esm'] as const,
    target: 'node22',
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: false,
    shims: false,
    outExtension: () => ({ js: '.mjs' }),
    // Re-inject the per-adapter package marker so doctor checks can
    // identify our plugin file against unrelated user plugins. The
    // leading comment in the TS source gets stripped during tsup's
    // ESM transform; this banner survives.
    banner: { js: '// @e0ipso/ai-knowledge-base plugin' },
  } as (typeof configs)[number]);
}

export default defineConfig(configs);
