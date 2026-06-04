import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Discovers per-adapter build artifacts under `src/harnesses/<id>/`.
 *
 * Two kinds of artifacts are emitted:
 *
 *   1. **Per-event hook scripts** discovered at `src/harnesses/<id>/hooks/*.ts`.
 *      For adapters whose host runtime owns `<dir>/hooks/` (OpenCode reserves
 *      `.opencode/hooks/` for its own use; Copilot keeps the hook-config JSON
 *      `kk.json` under `.copilot/hooks/`), the output is renamed to
 *      `kk-hooks/<name>.cjs` to keep the private dispatch tree separate. The
 *      rename is triggered by the presence of a sibling `plugins/` directory
 *      (the adapter ships a plugin shim, see Plan 23) or an explicit
 *      `.kk-hooks-output` marker file (the adapter's `<dir>/hooks/` holds its
 *      hook-config artifact rather than scripts).
 *   2. **Plugin modules** discovered at `src/harnesses/<id>/plugins/*.ts` and
 *      emitted to `dist/plugins/<id>/<name>.mjs` for the build-templates
 *      script to mirror into `templates/<id>/plugins/<name>.mjs`.
 *
 * Adapter detection is by directory glob; no central enum of harness ids.
 */
type DiscoveredEntries = {
  hookEntries: Record<string, string>;
  pluginEntries: Record<string, string>;
  /** Adapter ids whose hook output is renamed to `kk-hooks/`. */
  kkHooksOutputAdapters: Set<string>;
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
  const kkHooksOutputAdapters = new Set<string>();
  const harnessesDir = 'src/harnesses';
  let harnessIds: string[];
  try {
    harnessIds = readdirSync(harnessesDir);
  } catch {
    return { hookEntries, pluginEntries, kkHooksOutputAdapters };
  }
  for (const id of harnessIds) {
    const adapterDir = join(harnessesDir, id);
    if (!dirExists(adapterDir)) continue;
    const hooksDir = join(adapterDir, 'hooks');
    const pluginsDir = join(adapterDir, 'plugins');
    const hasPlugins = dirExists(pluginsDir);
    const hasKkHooksMarker = existsSync(join(adapterDir, '.kk-hooks-output'));
    if (hasPlugins || hasKkHooksMarker) kkHooksOutputAdapters.add(id);
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
  return { hookEntries, pluginEntries, kkHooksOutputAdapters };
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
    // Hooks ship as compiled, self-contained .cjs files. The .cjs
    // extension forces CommonJS regardless of the consumer's
    // package.json `type` field. CJS is the natural format here
    // because the bundled runtime deps (zod, js-yaml,
    // proper-lockfile, etc.) are CJS-native and call `require()`
    // internally; bundling them into an ESM `.mjs` would require a
    // `createRequire` shim to satisfy those calls. `noExternal`
    // inlines every npm dependency so the hook does not rely on the
    // consumer repo having our runtime deps installed.
    entry: discovered.hookEntries,
    outDir: 'dist/hooks',
    format: ['cjs'] as const,
    target: 'node22',
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: false,
    // Polyfills `import.meta.url` for the CJS output so any helper that
    // resolves paths relative to its own module (e.g. `packageRoot()` in
    // `lib/paths.ts`) keeps working when bundled into a `.cjs` hook.
    shims: true,
    noExternal: [/.*/],
    outExtension: () => ({ js: '.cjs' }),
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
    banner: { js: '// kenkeep plugin' },
  } as (typeof configs)[number]);
}

export default defineConfig(configs);
