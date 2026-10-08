import { existsSync } from 'node:fs';
import {
  assertContentHash,
  assertSourceDoc,
  bootstrapStateFile,
  completeDocument,
  liveNodeIds,
  updateBootstrapStateLocked,
} from '../lib/bootstrap.js';
import { stderrLog } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export interface BootstrapCompleteDocArgs {
  /** Repo-relative POSIX path of the document, as `finddocs` printed it. */
  doc: string;
  /** SHA-256 hex digest of the document, as `finddocs --with-hashes` printed it. */
  hash: string;
}

export interface BootstrapCompleteDocDeps {
  /** Writer of the JSON result to stdout. Injected for tests. */
  writeStdout?: (s: string) => void;
}

/**
 * Headless primitive: `bootstrap complete-doc <relpath> --hash <sha256>`.
 *
 * Declares one source document fully handled by the kk-bootstrap skill at
 * this content hash, whether it produced nodes or none (zero nodes is a valid
 * result and is recorded the same way). Only this step marks a document
 * complete; `node write --source-doc` records each written node under the
 * document's unfinished attempt, so a run interrupted mid-document leaves the
 * document listed for the next run.
 *
 * Moves the attempt's written ids into `docs[<relpath>]` of
 * `bootstrap-state.json` under the state lock, leaving out any of them that is
 * no longer in the tree. Ids recorded by an earlier completion are kept as
 * they are, even if those leaves were deleted since. Idempotent at the same
 * hash.
 * Refuses, changing nothing, an invalid path or hash, or an unfinished attempt
 * recorded at a different hash (the document changed mid-run).
 *
 * Stdout contract: one JSON document
 * `{"doc","content_sha256","produced_nodes"}`; diagnostics go to stderr.
 */
export async function runBootstrapCompleteDocCommand(
  args: BootstrapCompleteDocArgs,
  deps: BootstrapCompleteDocDeps = {}
): Promise<number> {
  const writeStdout = deps.writeStdout ?? ((s: string) => process.stdout.write(s));
  try {
    const root = findRepoRoot();
    const paths = repoPaths(root);
    if (!existsSync(paths.installedVersionFile)) {
      throw new Error(
        'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
      );
    }
    const doc = assertSourceDoc(root, args.doc);
    const hash = assertContentHash(args.hash);
    const entry = await updateBootstrapStateLocked(bootstrapStateFile(paths.stateDir), state => {
      const { next, entry } = completeDocument(state, {
        doc,
        hash,
        now: new Date().toISOString(),
        liveIds: liveNodeIds(paths.nodesDir),
      });
      return { next, result: entry };
    });
    writeStdout(
      `${JSON.stringify({ doc, content_sha256: entry.content_sha256, produced_nodes: entry.produced_nodes })}\n`
    );
    return 0;
  } catch (err) {
    stderrLog.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
