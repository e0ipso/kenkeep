/**
 * Strategy base for every adapter's `kk-session-start` hook.
 *
 * The six adapters' session-start hooks were 60–84% identical: resolve the
 * start cwd, find the repo root, bail when the repo is not a kenkeep project,
 * load settings, build the session-start context, send notifications, render
 * the nudge, then report. `runSessionStartHook` owns that fixed algorithm;
 * `SessionStartStrategy` names each point where a host legitimately differs
 * and supplies the majority behaviour as an overridable default.
 *
 * Only `tag` and `emit` are abstract — everything else is a default an
 * adapter overrides when, and only when, its host actually differs:
 *
 *   Claude    emit + reportStatus (statusLine rides in the JSON envelope)
 *   Codex     emit + invalidJson  (tolerates non-JSON payloads)
 *   Cursor    emit + cwdKeys      (start dir arrives as `workspace_roots`)
 *   Kiro      emit                (raw stdout)
 *   Copilot   emit + banner       (rewrites an instructions file)
 *   OpenCode  emit                (rewrites `.opencode/AGENTS.md`)
 *
 * An override is therefore a positive statement about that harness, not a
 * flag threaded through shared code.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hookStartCwd, runHookEntry } from './hook-entry.js';
import { lintStateFile } from './lint-state.js';
import { findRepoRoot, repoPaths, type RepoPaths } from './paths.js';
import {
  buildNudgeContent,
  buildSessionStartContext,
  sendSessionStartNotifications,
} from './session-start.js';
import { resolveSettings } from './settings.js';

const PACKAGE_TAG = '[kenkeep]';

/** What `emit` receives once the shared work is done. */
export interface SessionStartEmit {
  /** The rendered entry-catalog body to inject into the agent's context. */
  content: string;
  /** One-line human-readable status (staleness, pending curation, ...). */
  statusLine: string;
  /** Resolved repository root. */
  root: string;
  /** Resolved kenkeep paths for that root. */
  paths: RepoPaths;
}

export abstract class SessionStartStrategy {
  /** Diagnostic tag, e.g. `'kiro:kk-session-start'`. */
  abstract readonly tag: string;

  /**
   * Delivers the context to the host. Every harness accepts injected context
   * through a different channel, so this is the one step with no sensible
   * default.
   */
  abstract emit(ctx: SessionStartEmit): void | Promise<void>;

  /**
   * Payload keys carrying the start directory, in priority order. Override
   * for hosts that name the field differently — Cursor sends
   * `workspace_roots`.
   */
  cwdKeys(): string[] {
    return ['cwd'];
  }

  /**
   * How a non-JSON payload is treated. Override to `'ignore'` on hosts where
   * an absent or malformed payload is expected rather than noteworthy.
   */
  invalidJson(): 'diagnostic' | 'ignore' {
    return 'diagnostic';
  }

  /** Progress banner written to stderr before the context is built. */
  banner(): string {
    return '📖 kenkeep Index: Loading knowledge base…';
  }

  /**
   * Reports the status line to the user after `emit`. Override to a no-op on
   * hosts that carry the status inside the emitted payload instead.
   */
  reportStatus(statusLine: string): void {
    process.stderr.write(`${statusLine}\n`);
    process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
  }
}

/**
 * Registers the session-start hook for `strategy`.
 *
 * Fail-open throughout: a repo that is not a kenkeep project returns
 * silently, and any error is reported on stderr without a non-zero exit, so a
 * broken knowledge base never blocks a session.
 */
export function runSessionStartHook(strategy: SessionStartStrategy): void {
  runHookEntry({
    tag: strategy.tag,
    deadlineMs: 1000,
    invalidJson: strategy.invalidJson(),
    main: async payload => {
      const startCwd = hookStartCwd(payload, ...strategy.cwdKeys());
      const root = findRepoRoot(startCwd);
      const paths = repoPaths(root);
      if (!existsSync(paths.installedVersionFile)) return;

      try {
        process.stderr.write(`${strategy.banner()}\n`);
        const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
        const result = buildSessionStartContext({
          kkDir: paths.kkDir,
          nodesDir: paths.nodesDir,
          sessionsDir: paths.sessionsDir,
          stateFile: join(paths.stateDir, 'state.json'),
          lintStateFile: lintStateFile(paths.stateDir),
          threshold: settings.curationThreshold,
        });
        sendSessionStartNotifications(settings, result, paths.kkDir);
        const { statusLine, content } = buildNudgeContent(result);

        await strategy.emit({ content, statusLine, root, paths });
        strategy.reportStatus(statusLine);
      } catch (err) {
        process.stderr.write(
          `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    },
  });
}
