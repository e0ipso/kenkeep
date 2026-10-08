#!/usr/bin/env node
// kk-detect-root: resolves the project root containing .ai/kenkeep.
// Shared by the kk skills: their root-resolution preamble walks up from $PWD to
// the directory holding this installed helper, then runs it from there as
// `node .ai/kenkeep/scripts/kk-detect-root.mjs`, so skills also work when
// started from a nested package directory. Walks up from the current working
// directory and prints the first ancestor that contains a `.ai/kenkeep`
// directory, or exits non-zero when none is found.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
let dir = process.cwd();
while (true) {
  if (existsSync(join(dir, '.ai', 'kenkeep'))) {
    process.stdout.write(dir);
    process.exit(0);
  }
  const parent = dirname(dir);
  if (parent === dir) {
    process.stderr.write(
      'kk-detect-root: no .ai/kenkeep found in this directory or its parents.\n'
    );
    process.exit(2);
  }
  dir = parent;
}
