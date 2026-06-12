import { runLint as runLintLib, type LintEntry, type LintResult } from '../lib/lint.js';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export interface LintCommandOptions {
  verbose?: boolean;
}

export async function runLintCommand(opts: LintCommandOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const result: LintResult = runLintLib({ nodesDir: paths.nodesDir, root, kkDir: paths.kkDir });

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
    const n = bucket === 'errors' ? (errBy.get(rule) ?? 0) : (findBy.get(rule) ?? 0);
    const fn = bucket === 'errors' ? (n > 0 ? log.error : log.plain) : n > 0 ? log.warn : log.plain;
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
