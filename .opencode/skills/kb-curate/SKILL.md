---
name: kb-curate
description: Curate pending session logs into knowledge-base nodes by running the `npx @e0ipso/ai-knowledge-base curate` CLI, then resolve any contradictions surfaced by the curator with the user in-session. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
---

# kb-curate

Run the curator over pending session logs and apply its decisions directly to `nodes/`, then resolve any contradictions interactively with the user.

## Resolve the active harness

Substitute your own best-guess id for `<hint>` based on the runtime you are running inside (one of `claude`, `codex`, `opencode`). Run the materialization block exactly as-is (it lazy-writes `/tmp/kb-detect-harness.mjs` on first invocation):

```bash
if [ ! -f /tmp/kb-detect-harness.mjs ]; then
cat << 'EOF' > /tmp/kb-detect-harness.mjs
#!/usr/bin/env node
// kb-detect-harness: resolves the active KB harness id.
// Mirrors src/harnesses/detect.ts resolveWithHint priority.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const REGISTERED = ['claude', 'codex', 'opencode'];
const ENV_DETECTORS = [
  { env: 'CLAUDECODE', value: '1', harness: 'claude' },
  { env: 'CLAUDE_PROJECT_DIR', value: '*nonempty*', harness: 'claude' },
];
function findHint(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--hint' && i + 1 < argv.length) return argv[i + 1];
  }
  return undefined;
}
function detectFromEnv(env) {
  for (const d of ENV_DETECTORS) {
    if (d.value === '*nonempty*') {
      if (typeof env[d.env] === 'string' && env[d.env].length > 0) return d.harness;
    } else if (env[d.env] === d.value) return d.harness;
  }
  return undefined;
}
function findRepoRoot(start) {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, '.ai', 'knowledge-base'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function readDefault(root) {
  if (!root) return undefined;
  const config = join(root, '.ai', 'knowledge-base', 'config.yaml');
  if (!existsSync(config)) return undefined;
  const text = readFileSync(config, 'utf8');
  const m = text.match(/^cliDefaultHarness:\s*(\S+)/m);
  return m ? m[1] : undefined;
}
const hint = findHint(process.argv.slice(2));
if (hint && REGISTERED.includes(hint)) { process.stdout.write(hint); process.exit(0); }
const fromEnv = detectFromEnv(process.env);
if (fromEnv) { process.stdout.write(fromEnv); process.exit(0); }
const fromDefault = readDefault(findRepoRoot(process.cwd()));
if (fromDefault && REGISTERED.includes(fromDefault)) { process.stdout.write(fromDefault); process.exit(0); }
process.stderr.write('kb-detect-harness: could not resolve. Pass --hint <id> or set cliDefaultHarness in .ai/knowledge-base/config.yaml.\n');
process.exit(2);
EOF
fi
HARNESS=$(node /tmp/kb-detect-harness.mjs --hint <hint>)
```

## 1. Run the curator

Run `npx @e0ipso/ai-knowledge-base curate --harness "$HARNESS"` in the project root. The command:

- Acquires the curator lock (`.ai/knowledge-base/.state/state.json`, name=`curator`, PID + 30-min TTL).
- Batches every session log whose `proposal_status: done` and which has not yet been curated.
- Spawns the curator subprocess per batch with the curator prompt (no recursion: `KB_BUILDER_INTERNAL=1`).
- Writes node files directly to `.ai/knowledge-base/nodes/<kind>/` for `add` and `modify` actions.
- Writes one markdown file per `contradict` action to `.ai/knowledge-base/conflicts/<id>.md` **without writing the conflicting node to disk**.
- Regenerates `INDEX.md` and `GRAPH.md` from the resulting `nodes/` tree.

## 2. Report the summary

Tell the user the curator's headline numbers (nodes written, drops, batches, run id). If the command reported any failures (`add_collision` or `modify_missing_target`), surface those clearly so the user may need to clean up the offending candidate manually.

## 3. Resolve pending conflicts

List every markdown file under `.ai/knowledge-base/conflicts/` (sorted by filename). For each file, read its frontmatter; skip files whose `status` is not `pending`. If no pending files remain, skip this section.

For every pending entry:

1. Read the conflict file. The frontmatter exposes `target_node_id`, `proposed_kind`, `proposed_title`, `candidate_origin`, `run_id`, and `detected_at`. The body has two sections: `## Rationale` and `## Proposed node`.
2. Read the existing node referenced by `target_node_id` (under `nodes/<kind>/<target_node_id>.md`).
3. Present both sides to the user concisely:
   - **Existing node**: title, summary, the relevant body excerpt.
   - **Proposed contradiction**: `proposed_title`, the rationale, and the proposed body.
4. Ask the user to choose one of three outcomes:
   - **Accept the proposal**: edit `nodes/<kind>/<target_node_id>.md` to match the proposed body and frontmatter, then ask the user to `git restore .ai/knowledge-base/conflicts/<id>.md` to discard the conflict file. The user reviews the node change with `git diff` and commits.
   - **Reject the proposal**: ask the user to `git restore .ai/knowledge-base/conflicts/<id>.md`. The existing node stays as is and the conflict file disappears.
   - **Keep as record**: ask the user to `git commit` the conflict file. The conflict is preserved in history for later review; the existing node stays as is.

If the user defers a conflict ("I'll think about it"), leave the file alone. It remains in `.ai/knowledge-base/conflicts/` and surfaces again on the next pass.

## 4. Hand off

Tell the user to review the changed nodes and conflict files with `git diff` and commit when they're satisfied. The curator already regenerated `INDEX.md`/`GRAPH.md` at end-of-run; if the user has a pre-commit hook wired up (see the installation docs), `npx @e0ipso/ai-knowledge-base index rebuild --harness "$HARNESS" --stage` keeps them aligned on subsequent hand edits.

## Constraints

- The curator wrapper writes directly to `nodes/`. Conflict resolution edits `nodes/` only when the user accepts a proposal; the conflict files themselves are reviewed via `git diff` and accepted with `git commit` or discarded with `git restore`.
- If the curate command reports `locked`, do not retry; explain that another curate run is in progress.
- If no session logs are pending, the command still regenerates INDEX/GRAPH; that's expected, not an error.
- If `.ai/knowledge-base/conflicts/` is empty or every file has `status` other than `pending`, there's nothing to resolve; skip step 3.
