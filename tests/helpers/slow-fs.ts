import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Writes a `--require` preload that makes every `.md` read under
 * `KK_SLOW_FS_DIR` block for `KK_SLOW_FS_MS` (a synchronous wait, like a
 * stalled network filesystem). Scoped by path so module loading and files
 * outside that directory stay fast. Returns the preload path.
 */
export function writeSlowFsPreload(dir: string): string {
  const preload = join(dir, 'slow-fs.cjs');
  writeFileSync(
    preload,
    [
      "const fs = require('node:fs');",
      "const slowDir = process.env.KK_SLOW_FS_DIR || '';",
      "const slowMs = Number(process.env.KK_SLOW_FS_MS || '0');",
      'const real = fs.readFileSync;',
      'fs.readFileSync = function (p, ...rest) {',
      "  if (typeof p === 'string' && slowDir && p.startsWith(slowDir) && p.endsWith('.md')) {",
      '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, slowMs);',
      '  }',
      '  return real.call(this, p, ...rest);',
      '};',
      '',
    ].join('\n')
  );
  return preload;
}
