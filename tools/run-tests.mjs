// SPDX-License-Identifier: MIT
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.isFile() && /\.test\.(ts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}
const paths = process.argv.slice(2);
const files = (paths.length ? paths : ['tests']).flatMap(findTests).sort();
if (!files.length) throw new Error('No public tests found; refusing an empty passing suite.');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
