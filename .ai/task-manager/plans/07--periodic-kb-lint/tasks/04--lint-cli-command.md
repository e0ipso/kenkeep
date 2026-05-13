---
id: 4
group: "cli"
dependencies: [2]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# `ai-knowledge-base lint` CLI command

## Objective

Add the user-facing `lint` command. It builds `repoPaths`, runs the lint library against `paths.nodesDir`, prints a human-readable report via the existing `log` helpers, and exits with status `1` if any error fired or `0` otherwise. Supports `--verbose` to list each individual finding; without it, output is a summary plus per-rule counts.

## Skills Required

- typescript: commander wiring (matches `doctor` registration in `cli.ts`), formatting via `src/lib/log.ts`.

## Acceptance Criteria

- [ ] New file `src/commands/lint.ts` exports `runLintCommand(opts: { verbose?: boolean }): Promise<number>` returning the exit code (0 or 1). Name the wrapper differently from the library's `runLint` (e.g., `runLintCommand`) to avoid an import-name collision.
- [ ] The command imports the lint library function via a name alias, e.g. `import { runLint as runLintLib } from '../lib/lint.js';`.
- [ ] Output (non-verbose) prints, in order: a single `log.info` header line naming the lint run, a per-rule summary (counts for `dangling-edge`, `slug-id-mismatch`, `tag-near-duplicate`, `orphan`), and a final `log.success('Clean. No findings.')` if both arrays are empty, OR `log.error('N error(s)')` and/or `log.warn('M finding(s)')` lines with a single trailing `log.plain` line that names the next action (`Re-run with --verbose for per-entry details.`).
- [ ] Output (verbose) prints every error and finding on its own line, formatted as `<rule> <file>: <message> | <action>`. The ` | ` separator is intentional (no em-dash, no `–`, no ` - ` per repo prose convention). Errors go through `log.error`, findings through `log.warn`. `log.plain('')` separates the two blocks.
- [ ] Returns `1` if `errors.length > 0`; otherwise `0`. `findings.length > 0` does NOT change the exit code.
- [ ] Registered in `src/cli.ts` between `doctor` and `curate` (or wherever alphabetical-ish placement fits), with description `"Run mechanical KB content health checks (dangling edges, slug/id mismatch, tag duplicates, orphans)."` and a `--verbose, -v` flag.
- [ ] Doctor-and-lint distinction is reinforced by the description: doctor = install health; lint = content health.
- [ ] `npm run typecheck` is clean.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `src/commands/lint.ts` (new) and `src/cli.ts` (registration).
- Use `findRepoRoot()` + `repoPaths(root)` like `doctor.ts` does. `paths.nodesDir` is the input to the library.
- Use the existing `log` helpers: `log.info`, `log.success`, `log.warn`, `log.error`, `log.plain`.

## Input Dependencies

- Task 2: `src/lib/lint.ts` exporting `runLint`, `LintEntry`, `LintResult`.

## Output Artifacts

- `src/commands/lint.ts`.
- Edited `src/cli.ts` registering the `lint` subcommand.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Create `src/commands/lint.ts`:

   ```ts
   import { runLint as runLintLib, type LintEntry, type LintResult } from '../lib/lint.js';
   import { log } from '../lib/log.js';
   import { findRepoRoot, repoPaths } from '../lib/paths.js';

   export interface LintCommandOptions { verbose?: boolean; }

   export async function runLintCommand(opts: LintCommandOptions = {}): Promise<number> {
     const root = findRepoRoot();
     const paths = repoPaths(root);
     const result: LintResult = runLintLib({ nodesDir: paths.nodesDir });

     log.info(`Lint ${root}`);
     printCounts(result);
     if (opts.verbose) {
       printEntries(result);
     } else if (result.errors.length === 0 && result.findings.length === 0) {
       log.success('Clean. No findings.');
     } else {
       log.plain('Re-run with --verbose for per-entry details.');
     }
     return result.errors.length > 0 ? 1 : 0;
   }

   function printCounts(result: LintResult): void {
     const errBy = countBy(result.errors);
     const findBy = countBy(result.findings);
     const rules: Array<{ rule: string; bucket: 'errors' | 'findings' }> = [
       { rule: 'dangling-edge', bucket: 'errors' },
       { rule: 'slug-id-mismatch', bucket: 'errors' },
       { rule: 'tag-near-duplicate', bucket: 'findings' },
       { rule: 'orphan', bucket: 'findings' },
     ];
     for (const { rule, bucket } of rules) {
       const n = bucket === 'errors' ? errBy.get(rule) ?? 0 : findBy.get(rule) ?? 0;
       const fn = bucket === 'errors' ? (n > 0 ? log.error : log.plain) : (n > 0 ? log.warn : log.plain);
       fn(`${rule}: ${n}`);
     }
   }

   function printEntries(result: LintResult): void {
     for (const e of result.errors) log.error(formatEntry(e));
     if (result.errors.length > 0 && result.findings.length > 0) log.plain('');
     for (const f of result.findings) log.warn(formatEntry(f));
   }

   function formatEntry(e: LintEntry): string {
     const fileBit = e.file ? `${e.file}: ` : '';
     return `${e.rule} ${fileBit}${e.message} | ${e.action}`;
   }

   function countBy(entries: LintEntry[]): Map<string, number> {
     const m = new Map<string, number>();
     for (const e of entries) m.set(e.rule, (m.get(e.rule) ?? 0) + 1);
     return m;
   }
   ```

2. In `src/cli.ts`, add an import:

   ```ts
   import { runLintCommand } from './commands/lint.js';
   ```

3. Register the command (place it between `doctor` and `curate`):

   ```ts
   program
     .command('lint')
     .description('Run mechanical KB content health checks (dangling edges, slug/id mismatch, tag duplicates, orphans).')
     .option('-v, --verbose', 'list every error and finding individually', false)
     .action(async (opts: { verbose?: boolean }) => {
       const code = await runLintCommand({ verbose: opts.verbose === true });
       process.exit(code);
     });
   ```

4. Avoid retrospective comments. The repo prose convention forbids `—`, `–`, and ` - ` as separators in comments, docs, commit messages, and CLI prose. Use ` | ` in `formatEntry` (as shown above). Apply the same rule to any log message you add.

5. Run `npm run build && npm run typecheck`. Manually smoke-test with `node dist/cli.js lint --help`.

</details>
