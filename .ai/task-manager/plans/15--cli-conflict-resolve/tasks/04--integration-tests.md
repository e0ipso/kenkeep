---
id: 4
group: "testing"
dependencies: [1, 2, 3]
status: "pending"
created: 2026-05-13
skills:
  - vitest
  - typescript
---

# Add integration tests for `conflict list` / `conflict resolve` and assert the skill upgrade

## Objective

Cover the new CLI surface end-to-end and confirm `init --upgrade` ships the tightened `allowed-tools` line. Mantra: write a few tests, mostly integration. Each test drives the real CLI via the `runCli` helper used by other command tests.

## Skills Required

- `vitest`: write integration tests using the project's existing `runCli` / `makeSandbox` helpers.
- `typescript`: shape fixtures (synthetic `pending-conflicts.json`, synthetic node files) that satisfy the schemas.

## Acceptance Criteria

- [ ] New file `tests/commands/conflict.test.ts` covers all six scenarios listed under Success Criteria of the plan:
  1. `conflict list` with no `pending-conflicts.json` on disk prints `[]` and exits `0`.
  2. `conflict list` with a populated file prints the conflicts array as parseable JSON whose structure matches the file's `conflicts` array.
  3. `conflict resolve <id> --action replace` deletes the old node file, writes the proposed node, removes the entry from `pending-conflicts.json`, regenerates `INDEX.md` / `GRAPH.md`, and exits `0`.
  4. `conflict resolve <id> --action reject` leaves nodes untouched, removes the entry, regenerates INDEX/GRAPH, and exits `0`.
  5. `conflict resolve <unknown-id> --action reject` exits non-zero and leaves `pending-conflicts.json` byte-identical to its prior contents.
  6. `conflict resolve <id> --action replace` on a target whose node file is missing exits non-zero and performs no partial mutation (the proposed-node file is not written; the entry remains in `pending-conflicts.json`).
- [ ] `tests/upgrade.test.ts` gains one assertion: after `init --upgrade`, the installed `kb-curate/SKILL.md` contains the exact tightened `allowed-tools` line (`Bash(ai-knowledge-base curate:*), Bash(ai-knowledge-base conflict:*), Read`) and no longer mentions `Bash(rm:*)`, `Edit`, or `Write`.
- [ ] All tests in the file pass under `npm test` (or the project equivalent).

**Meaningful Test Strategy Guidelines (mantra: "write a few tests, mostly integration"):**

- **Tests focus on YOUR code**: the six scenarios target the new CLI's branching (missing file, unknown id, missing target, replace path, reject path, JSON output).
- **Integration over unit**: drive the full CLI via `runCli`, asserting on stdout/exit codes plus the resulting filesystem state. Do not unit-test `JSON.stringify` or commander.
- **Combine related scenarios** in a single `describe('conflict resolve')` block; do not split each branch into its own `describe`. The "missing file" / "populated file" cases for `conflict list` go in a sibling `describe('conflict list')`.
- **Do not test framework behavior**: do not assert `--help` text, do not assert commander's parsing of `--action`, do not test `writeNodeFile`'s atomicity (it has its own coverage in `tests/lib/nodes.test.ts`).
- **Edge cases worth covering**: the "no `proposed_node`" branch and the `target_node_id === null` branch can be folded into a single negative test if the time cost is high; otherwise skip them — the plan's six scenarios are the authoritative list.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Use the existing helpers `makeSandbox`, `cleanSandbox`, `runCli` from `tests/helpers.js` (see `tests/index-rebuild.test.ts` for the canonical layout).
- Initialize each sandbox with `runCli(sandbox, ['init', '--assistants', 'claude'])` so paths are valid.
- Construct fixtures directly with `writeFileSync` / `matter.stringify`:
  - A real node at `.ai/knowledge-base/nodes/practice/<id>.md` with `NodeFrontmatterSchema`-compliant frontmatter (see `writeNode` in `tests/index-rebuild.test.ts:11-26` for the exact shape).
  - A `pending-conflicts.json` at `.ai/knowledge-base/.state/pending-conflicts.json` shaped as `{ schema_version: 1, conflicts: [<ConflictReport>] }` per `src/lib/schemas.ts:229`. Each `ConflictReport` needs `id`, `detected_at` (ISO), `run_id`, `candidate_origin`, `target_node_id`, `rationale`, and `proposed_node` (omit or set to `null` for the "no proposed_node" negative case; `proposed_node` itself must satisfy `CuratorProposedNodeSchema`).
- For the upgrade assertion, mirror the structure already in `tests/upgrade.test.ts` (it reads installed files post-upgrade and asserts on their contents).

## Input Dependencies

- Task 1: CLI module must exist for the tests to drive it.
- Task 2: CLI wiring must exist or the tests cannot reach the entry points.
- Task 3: Skill template must already carry the new `allowed-tools` line for the upgrade assertion to pass.

## Output Artifacts

- `tests/commands/conflict.test.ts` (new).
- Updated `tests/upgrade.test.ts` with the new assertion.

## Implementation Notes

<details>
<summary>Fixture sketch and test layout</summary>

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

function writeNode(sandbox: string, kind: 'practice' | 'map', id: string, body = 'Original body.'): void {
  const dir = join(sandbox, '.ai/knowledge-base/nodes', kind);
  mkdirSync(dir, { recursive: true });
  const fm = { schema_version: 1, id, title: id, kind, tags: [], derived_from: [], relates_to: [], confidence: 'high', summary: 's' };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n${body}`, fm));
}

function writeConflicts(sandbox: string, conflicts: unknown[]): string {
  const file = join(sandbox, '.ai/knowledge-base/.state/pending-conflicts.json');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ schema_version: 1, conflicts }, null, 2)}\n`);
  return file;
}
```

A representative `ConflictReport` fixture:

```ts
{
  id: '01HZZZZZZZZZZZZZZZZZZZZ001',
  detected_at: '2026-05-13T00:00:00.000Z',
  run_id: 'run-1',
  candidate_origin: 'session:foo',
  target_node_id: 'practice-foo',
  rationale: 'The proposed node contradicts the existing one.',
  proposed_node: {
    id: 'practice-foo',
    title: 'Practice foo (replaced)',
    kind: 'practice',
    tags: [],
    derived_from: [],
    relates_to: [],
    confidence: 'high',
    summary: 'replaced summary',
    body: 'Replaced body.',
  },
}
```

For the upgrade assertion, the installed skill lands at `.claude/skills/kb-curate/SKILL.md` inside the sandbox (mirror the path used elsewhere in `tests/upgrade.test.ts`). Read it after `init --upgrade` and assert with `toContain` on the new `allowed-tools` line and `not.toContain` on `Bash(rm:*)`, `Edit`, `Write`.

</details>
