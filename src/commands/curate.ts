import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  curatorLogFile,
  runCurate,
  type CuratorRunner,
  type PendingSession,
} from '../lib/curate.js';
import { runHeadlessClaude, type RunHeadlessOptions } from '../lib/headless.js';
import { log } from '../lib/log.js';
import { findRepoRoot, packageTemplatesDir, repoPaths } from '../lib/paths.js';
import { type ConflictReport, type PendingConflictsFile } from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';
import { ulid } from '../lib/ulid.js';

const HEARTBEAT_MS = 15_000;

export interface CurateCommandOptions {
  timeoutMs?: number;
  verbose?: boolean;
}

export async function runCurateCommand(opts: CurateCommandOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.'
    );
    return 1;
  }

  const promptTemplate = loadCuratorPrompt(paths.promptsDir);
  if (!promptTemplate) {
    log.error('Curator prompt template not found.');
    return 1;
  }

  const runner: CuratorRunner = (prompt, stdin, schema, runnerOpts) =>
    runHeadlessClaude(prompt, stdin, schema, runnerOpts as RunHeadlessOptions);

  log.info('Curating pending session logs…');
  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });

  const now = new Date();
  const runId = ulid(now);
  const logFile = curatorLogFile(paths.logsDir, runId, now);
  log.plain(`  curator log: ${logFile}`);

  const heartbeats = new Map<number, { timer: NodeJS.Timeout; started: number }>();
  const baseOpts = {
    kbDir: paths.kbDir,
    sessionsDir: paths.sessionsDir,
    nodesDir: paths.nodesDir,
    logsDir: paths.logsDir,
    stateFile: join(paths.stateDir, 'state.json'),
    promptTemplate,
    runner,
    runId,
    logFile,
    ...(settings.curatorModel
      ? { model: settings.curatorModel.name, effort: settings.curatorModel.effort }
      : {}),
    onBatchStart: ({
      index,
      total,
      batch,
    }: {
      index: number;
      total: number;
      batch: PendingSession[];
    }) => {
      const candidates = batch.reduce(
        (sum, s) => sum + s.practiceCandidates.length + s.mapCandidates.length,
        0
      );
      log.info(
        `Batch ${index + 1}/${total}: ${batch.length} session(s), ${candidates} candidate(s)`
      );
      const started = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        log.plain(`  still running (${elapsed}s)…`);
      }, HEARTBEAT_MS);
      timer.unref();
      heartbeats.set(index, { timer, started });
    },
    onBatchEnd: ({ index, durationMs }: { index: number; total: number; durationMs: number }) => {
      const entry = heartbeats.get(index);
      if (entry) {
        clearInterval(entry.timer);
        heartbeats.delete(index);
      }
      log.success(`Batch ${index + 1} finished in ${Math.round(durationMs / 1000)}s`);
    },
    ...(opts.verbose ? { onCuratorMessage: makeVerbosePrinter() } : {}),
  };
  let result;
  try {
    result = await runCurate({
      ...baseOpts,
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
  } finally {
    for (const { timer } of heartbeats.values()) clearInterval(timer);
    heartbeats.clear();
  }

  // Always (re)write the side-channel so a completed run with zero conflicts
  // clears any stale entries from a previous run.
  writePendingConflicts(join(paths.stateDir, 'pending-conflicts.json'), result.conflicts);

  switch (result.status) {
    case 'locked':
      log.warn(`Curator is locked: ${result.reason ?? 'another run holds the lock'}.`);
      return 0;
    case 'no-pending':
      log.success('No pending session logs. INDEX and GRAPH regenerated.');
      return 0;
    case 'completed':
      log.success(
        `Curator finished: ${result.nodesWritten} node(s) written, ${result.drops} drop(s) over ${result.batches} batch(es).`
      );
      log.plain(`Run id: ${result.runId ?? '(unknown)'}`);
      if (result.failures.length > 0) {
        log.warn(`${result.failures.length} action(s) failed:`);
        for (const f of result.failures) log.plain(`  ! [${f.reason}] ${f.detail}`);
      }
      if (result.conflicts.length > 0) {
        log.warn(
          `${result.conflicts.length} contradiction(s) require resolution; see ` +
            '`.ai/knowledge-base/.state/pending-conflicts.json` (the kb-curate skill resolves these in-session).'
        );
      }
      log.plain('Review changed files with `git diff nodes/` before committing.');
      return 0;
  }
}

interface AssistantContentBlock {
  type?: string;
  text?: string;
  name?: string;
}

interface AssistantMessage {
  message?: { content?: AssistantContentBlock[] };
}

function makeVerbosePrinter(): (msg: unknown) => void {
  return (raw: unknown) => {
    if (!isObject(raw)) return;
    if (raw['type'] !== 'assistant') return;
    const content = (raw as AssistantMessage).message?.content;
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (!isObject(block)) continue;
      if (block.type === 'text' && typeof block.text === 'string') {
        const text = block.text.trim();
        if (text.length === 0) continue;
        for (const line of text.split('\n')) log.plain(`  ${line}`);
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        log.plain(`  → ${block.name}`);
      }
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function writePendingConflicts(file: string, conflicts: ConflictReport[]): void {
  mkdirSync(join(file, '..'), { recursive: true });
  const payload: PendingConflictsFile = { schema_version: 1, conflicts };
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function loadCuratorPrompt(promptsDir: string): string | null {
  const local = join(promptsDir, 'curator.md');
  if (existsSync(local)) return readFileSync(local, 'utf8');
  const fallback = join(packageTemplatesDir(), 'prompts', 'curator.md');
  if (existsSync(fallback)) return readFileSync(fallback, 'utf8');
  return null;
}
