// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
for (const path of files) {
  if (/^(game|local|node_modules|dist|coverage)\//i.test(path)) failures.push(`private/generated path tracked: ${path}`);
  // Original binary test fixtures need an explicit review before relaxing this gate.
  if (/\.(mix|mmx|yro|mmp|shp|vxl|hva|tmp|bik|vqa|bag|idx|sav|exe|dll|mp4|webm|wav)$/i.test(path)) {
    failures.push(`game/media/binary extension requires provenance review: ${path}`);
  }
  if (lstatSync(path).isSymbolicLink()) failures.push(`tracked symlink requires publication review: ${path}`);
}
const ignored = execFileSync('git', ['check-ignore', 'game/', 'local/'], { encoding: 'utf8' }).trim().split('\n');
if (!ignored.includes('game/') || !ignored.includes('local/')) failures.push('private directories are not ignored');
if (!readFileSync('.gitignore', 'utf8').includes('node_modules/')) failures.push('dependencies must be ignored');
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Publication path/extension guard passed for ${files.length} tracked files; manual payload/provenance review remains required.`);
