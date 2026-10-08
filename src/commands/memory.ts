import { existsSync } from 'node:fs';
import { resolveActiveHarness } from '../harnesses/detect.js';
import { stderrLog } from '../lib/log.js';
import { discoverHarnessMemoryFiles, recordHarnessMemoryFile } from '../lib/memory-files.js';
import { findKenkeepRoot, findRepoRoot, repoPaths, type RepoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export interface MemoryCommandDeps {
  /** Writer of the JSON result to stdout. Injected for tests. */
  writeStdout?: (s: string) => void;
}

export interface MemoryListArgs {
  /** `--harness <id>` flag value; otherwise env detection, then `cliDefaultHarness`. */
  harness?: string | undefined;
}

export interface MemoryMarkArgs {
  iri: string;
  hash: string;
  runId: string;
}

function resolveInitializedPaths(): RepoPaths {
  const root = findKenkeepRoot() ?? findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    throw new Error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
  }
  return paths;
}

/**
 * Headless primitive: `memory list`.
 *
 * Asks the active harness adapter for its auto-memory files and prints the
 * ones whose content the per-user ledger (`.state/memory-ledger.json`) has
 * not recorded: new files and files changed since they were last marked.
 * Adapters without native memory contribute nothing and spawn nothing. The
 * Claude adapter finds its files with one headless `claude -p` call, so this
 * primitive is not LLM-free there; a failed call lists nothing.
 * Reading never updates the ledger; a file stays listed until `memory mark`
 * records it after the derived knowledge was persisted.
 *
 * Stdout contract: one JSON document
 * `{"harness","files":[{"iri","path","sha256","bytes","session_id"}]}`;
 * diagnostics go to stderr. Content is not inlined: the skill reads `path`.
 */
export async function runMemoryListCommand(
  args: MemoryListArgs = {},
  deps: MemoryCommandDeps = {}
): Promise<number> {
  const writeStdout = deps.writeStdout ?? ((s: string) => process.stdout.write(s));
  try {
    const paths = resolveInitializedPaths();
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const adapter = resolveActiveHarness({
      ...(args.harness !== undefined ? { flag: args.harness } : {}),
      ...(settings.cliDefaultHarness !== undefined
        ? { cliDefault: settings.cliDefaultHarness }
        : {}),
    });
    const files = await discoverHarnessMemoryFiles({ adapter, paths });
    const doc = {
      harness: adapter.id,
      files: files.map(f => ({
        iri: f.iri,
        path: f.absPath,
        sha256: f.sha256,
        bytes: f.bytes,
        session_id: f.sessionId,
      })),
    };
    writeStdout(`${JSON.stringify(doc)}\n`);
    return 0;
  } catch (err) {
    stderrLog.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

/**
 * Headless primitive: `memory mark <iri> --hash <sha256> --run-id <id>`.
 *
 * Records one memory file as processed at the listed content hash, so
 * `memory list` skips it until its content changes. Run it only after the
 * nodes or conflicts derived from the file were written successfully; the
 * primitive refuses (exit 1, ledger untouched) when the file changed since
 * it was listed or is no longer readable.
 *
 * Stdout contract: one JSON document `{"iri","sha256","run_id"}`.
 */
export async function runMemoryMarkCommand(
  args: MemoryMarkArgs,
  deps: MemoryCommandDeps = {}
): Promise<number> {
  const writeStdout = deps.writeStdout ?? ((s: string) => process.stdout.write(s));
  try {
    const paths = resolveInitializedPaths();
    const entry = await recordHarnessMemoryFile(paths, {
      iri: args.iri,
      sha256: args.hash,
      runId: args.runId,
    });
    writeStdout(
      `${JSON.stringify({ iri: args.iri, sha256: entry.sha256, run_id: entry.lastSeenRunId })}\n`
    );
    return 0;
  } catch (err) {
    stderrLog.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
