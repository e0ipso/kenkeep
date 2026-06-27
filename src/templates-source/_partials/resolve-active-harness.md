## Resolve the active harness

Substitute your own best-guess id for `<hint>` based on the runtime you are running inside (one of `claude`, `codex`, `copilot`, `cursor`, `opencode`). Run the materialization block exactly as-is (it lazy-writes `/tmp/kk-detect-root.mjs` on first invocation):

```bash
if [ ! -f /tmp/kk-detect-root.mjs ]; then
cat << 'EOF' > /tmp/kk-detect-root.mjs
#!/usr/bin/env node
// kk-detect-root: resolves the project root containing .ai/kenkeep.
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
    process.stderr.write('kk-detect-root: no .ai/kenkeep found in this directory or its parents.\n');
    process.exit(2);
  }
  dir = parent;
}
EOF
fi
KK_REPO_ROOT=$(node /tmp/kk-detect-root.mjs) || exit $?
cd "$KK_REPO_ROOT" || exit $?
HARNESS=$(node .ai/kenkeep/scripts/kk-detect-harness.mjs --hint <hint> --root "$KK_REPO_ROOT")
pwd
```
