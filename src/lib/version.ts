import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageRoot } from './paths.js';

interface PackageJson {
  version: string;
  name: string;
}

let cached: PackageJson | null = null;

function readPackageJson(): PackageJson {
  if (cached) return cached;
  const file = join(packageRoot(), 'package.json');
  cached = JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
  return cached;
}

export function packageVersion(): string {
  return readPackageJson().version;
}
