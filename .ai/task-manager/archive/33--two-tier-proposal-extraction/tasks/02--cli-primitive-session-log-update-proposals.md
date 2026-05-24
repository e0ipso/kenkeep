---
id: 2
group: "cli-primitive"
dependencies: []
status: "completed"
created: "2026-05-24"
skills: ["typescript"]
complexity_score: 4.5
complexity_notes: "New CLI command with stdin parsing, Zod validation, frontmatter writing, and CLI registration"
---
# Implement `session-log update-proposals` CLI primitive

## Objective
Add a new deterministic CLI command `session-log update-proposals` that reads proposal JSON from stdin, validates it against `ProposalOutputSchema`, and writes the results into a session log's frontmatter. This provides a clean, reusable mechanism for the `/kb-curate` pre-step to persist proposals without spawning a headless CLI.

## Skills Required
TypeScript — new command implementation following existing CLI patterns (`node write`, `curate-dedup`).

## Acceptance Criteria
- [ ] New file `src/commands/session-log-update-proposals.ts` implements the command logic
- [ ] `src/cli.ts` registers a `session-log` command group with `update-proposals` subcommand
- [ ] Command reads proposal JSON from stdin, validates against `ProposalOutputSchema`
- [ ] Command updates frontmatter fields: `proposal_status`, `proposal_completed_at`, `proposal_error`, and `proposals.{practice, map}`
- [ ] Command replaces the `(populated by proposal worker)` body placeholder on success
- [ ] Command accepts `--status <done|failed>` and `--error <message>` flags
- [ ] Command prints `session_id` to stdout on success
- [ ] Command exits non-zero on failure
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow the existing CLI command pattern: `src/commands/<name>.ts` exports a `run<Name>Command` function, registered in `src/cli.ts`.
- Use `gray-matter` (already a dependency) for frontmatter parsing/serialization.
- Use `ProposalOutputSchema` from `src/lib/schemas.ts` for stdin validation.
- Reuse the `writeSessionLogFrontmatter` and `updateProposalBody` logic from `src/lib/proposal-drain.ts`. These are currently module-private functions — either export them or extract the minimal logic into the new command directly (the functions are small: ~15 lines each).

## Input Dependencies
None — this task has no dependencies on other tasks.

## Output Artifacts
- New file: `src/commands/session-log-update-proposals.ts`
- Modified file: `src/cli.ts` (new `session-log` command group)
- Possibly modified: `src/lib/proposal-drain.ts` (if exporting `writeSessionLogFrontmatter` and `updateProposalBody`)

## Implementation Notes

<details>

### CLI registration in `src/cli.ts`

Follow the `node` / `index` / `logs` command group pattern. After the `logsGroup` block (around line 247), add:

```typescript
import { runSessionLogUpdateProposalsCommand } from './commands/session-log-update-proposals.js';

// ... inside main(), after logsGroup:

const sessionLogGroup = program.command('session-log').description('Manage session log files.');
sessionLogGroup
  .command('update-proposals')
  .description(
    'Headless primitive: read proposal JSON from stdin, validate against ProposalOutputSchema, and write results into the session log frontmatter at <path>. Pure Node — no LLM.'
  )
  .argument('<path>', 'path to the session log file')
  .requiredOption('--status <status>', 'proposal status: done or failed')
  .option('--error <message>', 'error message (used with --status failed)')
  .action(async (path: string, opts: { status: string; error?: string }) => {
    const code = await runSessionLogUpdateProposalsCommand({ path, status: opts.status, error: opts.error });
    process.exit(code);
  });
```

### Command implementation (`src/commands/session-log-update-proposals.ts`)

The command should:

1. **Read stdin** (same pattern as `curate-dedup` for stdin reading — collect all chunks, parse as JSON).
2. **Validate `--status`**: must be `'done'` or `'failed'`. Exit 1 if invalid.
3. **When `--status done`**:
   - Parse the stdin JSON and validate against `ProposalOutputSchema` (from `src/lib/schemas.ts`). On validation failure, write error to stderr and exit 1.
   - Read the session log file at `<path>` using `gray-matter`.
   - Update frontmatter: `proposal_status: 'done'`, `proposal_completed_at: new Date().toISOString()`, `proposal_error: null`, `proposals: { practice: [...], map: [...] }`.
   - Replace the `(populated by proposal worker)` placeholder in the body with `_Extraction complete; see proposals in frontmatter._`.
   - Write the file back using `gray-matter.stringify()`.
   - Print the `session_id` from the frontmatter to stdout.
4. **When `--status failed`**:
   - No stdin validation needed.
   - Read the session log file at `<path>` using `gray-matter`.
   - Update frontmatter: `proposal_status: 'failed'`, `proposal_completed_at: new Date().toISOString()`, `proposal_error: opts.error ?? 'unknown error'`.
   - Write the file back.
   - Print the `session_id` to stdout.
5. **Exit codes**: 0 on success, 1 on any error.

### Reusing `writeSessionLogFrontmatter` and `updateProposalBody`

The functions in `src/lib/proposal-drain.ts` (lines 225-250) are currently not exported. Two approaches:

**Option A (preferred):** Export both functions by changing `function writeSessionLogFrontmatter` to `export function writeSessionLogFrontmatter` and `function updateProposalBody` to `export function updateProposalBody`. Also export the `FrontmatterPatch` interface. Then import and call them from the new command.

**Option B:** Duplicate the logic (it's only ~25 lines total). This avoids modifying `proposal-drain.ts` but creates duplication.

Go with Option A unless it causes circular dependency issues.

### Stdin reading helper

```typescript
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
```

</details>
