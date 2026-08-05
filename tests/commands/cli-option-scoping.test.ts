import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';
import { NODE_SCHEMA_VERSION } from '../../src/lib/schemas.js';
import type { NodeFrontmatter } from '../../src/lib/schemas.js';
import { defaultProjectConfigBody } from '../../src/lib/settings.js';

const exec = promisify(execFile);

/**
 * Exercises the built CLI rather than a command function, because the behavior
 * under test is Commander's argv scoping, which exists only at the process
 * boundary. Without `enablePositionalOptions` the root `--version` option was
 * matched anywhere in argv, so `pack export --version <v>` printed the package
 * version and exited 0 without ever writing a pack.
 */
describe('CLI option scoping', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox('kk-cli-scoping-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    mkdirSync(join(sandbox, '.ai/kenkeep/.state'), { recursive: true });
    mkdirSync(join(sandbox, '.ai/kenkeep/nodes'), { recursive: true });
    writeFileSync(join(sandbox, 'AGENTS.md'), '# Test repo\n');
    writeFileSync(join(sandbox, '.ai/kenkeep/config.yaml'), defaultProjectConfigBody());
    writeFileSync(
      join(sandbox, '.ai/kenkeep/.state/installed-version'),
      JSON.stringify({
        schema_version: 1,
        package: 'kenkeep',
        version: '0.0.0-test',
        installed_at: '2026-06-30T00:00:00.000Z',
        harnesses: ['claude'],
      })
    );

    // `pack export` runs lint against the copied tree and blocks on errors, so
    // the sandbox needs a real leaf plus generated indexes to reach the manifest.
    const nodeDir = join(sandbox, '.ai/kenkeep/nodes/framework');
    mkdirSync(nodeDir, { recursive: true });
    const frontmatter: NodeFrontmatter = {
      kk_schema_version: NODE_SCHEMA_VERSION,
      kk_id: 'practice-drupal-services',
      title: 'practice-drupal-services',
      type: 'practice',
      tags: ['pack'],
      kk_derived_from: [],
      kk_relates_to: [],
      kk_depends_on: [],
      kk_confidence: 'high',
      description: 'Summary for practice-drupal-services.',
    };
    writeFileSync(
      join(nodeDir, 'practice-drupal-services.md'),
      matter.stringify('# practice-drupal-services\nBody.\n', frontmatter)
    );
    await runCli(sandbox, ['index', 'rebuild']);
  });

  afterEach(() => cleanSandbox(sandbox));

  it('routes a space-separated --version to `pack export`, not to the root command', async () => {
    const out = join(sandbox, 'dist-pack');
    const result = await runCli(sandbox, [
      'pack',
      'export',
      '--name',
      'drupal',
      '--version',
      '1.0.0',
      '--summary',
      'Drupal project conventions.',
      '--out',
      out,
    ]);

    expect(result.exitCode).toBe(0);
    const manifest = yaml.load(readFileSync(join(out, 'kenkeep-pack.yaml'), 'utf8')) as {
      version: string;
    };
    expect(manifest.version).toBe('1.0.0');
  });

  it('still reports the package version for a bare root --version', async () => {
    const result = await runCli(sandbox, ['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });
});
