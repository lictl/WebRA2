// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Include untracked candidate docs, but not ignored private files or dependencies.
const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0').filter(path => path.endsWith('.md'));
const failures = [];
let links = 0;
for (const path of paths) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const relative = target.split('#')[0].replace(/^<|>$/g, '');
    if (!relative) continue;
    links++;
    if (!existsSync(resolve(dirname(path), relative))) failures.push(`${path}: missing ${target}`);
  }
  source.split('\n').forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${path}:${index + 1}: trailing whitespace`);
  });
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Checked ${paths.length} Markdown files and ${links} local file links (anchors not checked).`);
