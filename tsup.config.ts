import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
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
    entry: {
      'kb-capture': 'src/hooks/kb-capture.ts',
      'kb-stage2-drain': 'src/hooks/kb-stage2-drain.ts',
    },
    outDir: 'dist/hooks',
    format: ['esm'],
    target: 'node22',
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: false,
    shims: false,
    outExtension: () => ({ js: '.mjs' }),
  },
]);
