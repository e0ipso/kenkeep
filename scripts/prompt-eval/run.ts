import { Command } from 'commander';
import { runPromptEvalCommand } from '../../src/commands/prompt-eval.js';
import { listHarnessIds } from '../../src/harnesses/registry.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('prompt-eval')
    .description(
      'Run the proposal-extraction evaluation corpus through an explicitly selected harness and print an advisory report.'
    )
    .requiredOption(
      '--harness <id>',
      `harness adapter used for every isolated fixture run (one of: ${listHarnessIds().join(', ')})`
    )
    .option('--runs <count>', 'number of complete corpus runs', '1')
    .option('--concurrency <count>', 'maximum simultaneous harness processes', '2')
    .option('--timeout-ms <milliseconds>', 'timeout for each fixture', '120000')
    .option('--fixtures-dir <path>', 'fixture corpus root', 'tests/fixtures/prompt-eval')
    .option(
      '--prompt-file <path>',
      'built proposal extraction prompt',
      'templates/prompts/proposal-extract.md'
    )
    .option(
      '--judge-prompt-file <path>',
      'built semantic judge prompt',
      'templates/prompts/prompt-eval-judge.md'
    )
    .option(
      '--output-dir <path>',
      'artifact directory (defaults to a unique ignored directory under .ai/kenkeep/.state/)'
    )
    .action(
      async (opts: {
        concurrency?: string;
        fixturesDir?: string;
        harness: string;
        judgePromptFile?: string;
        outputDir?: string;
        promptFile?: string;
        runs?: string;
        timeoutMs?: string;
      }) => {
        process.exitCode = await runPromptEvalCommand(opts);
      }
    );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`prompt-eval: ${message}\n`);
  process.exitCode = 1;
});
