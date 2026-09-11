// SPDX-License-Identifier: GPL-3.0-or-later
// Original code-only benchmark builder; no retail inputs or dependencies added.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { noticeSources } from './notices.mjs';
export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function bounded(path, max) {
  if (await realpath(path) !== resolve(path)) throw Error('Symlink input refused');
  const info = await lstat(path);
  if (!info.isFile() || info.size > max) throw Error('Input size/type');
  return readFile(path);
}
export async function buildPerformance(destination, root = repositoryRoot) {
  root = await realpath(root);
  const privateRoot = resolve(root, 'local'), output = resolve(root, destination);
  if (!output.startsWith(privateRoot + sep)) throw Error('Output must be a fresh directory inside ignored local/');
  await mkdir(dirname(output), { recursive: true });
  if (await realpath(dirname(output)) !== dirname(output)) throw Error('Symlink output parent refused');
  // Never overwrite an existing immutable benchmark.
  await mkdir(output); const outdir = resolve(output, 'dist');
  const inputs = new Map();
  const result = await build({ absWorkingDir: root, entryPoints: { main: 'tools/performance/main.mjs', worker: 'tools/performance/worker.mjs' },
    outdir, bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: false,
    // Preserve the literal path until onLoad has checked for symbolic links.
    preserveSymlinks: true,
    legalComments: 'inline', write: false, metafile: true, logLevel: 'silent',
    plugins: [{ name: 'performance-code-only', setup(builder) {
      builder.onLoad({ filter: /.*/ }, async args => {
        const actual = await realpath(args.path);
        if (actual !== resolve(args.path)) throw Error('Symlink code input refused');
        const name = relative(root, actual).split(sep).join('/');
        if (!/^(?:tools\/performance\/|apps\/web\/src\/|packages\/|node_modules\/(?:@noble\/hashes|egoroof-blowfish)\/)/.test(name)
          || (!name.startsWith('node_modules/') && /(?:^|\/)(?:local|game|public|dist)(?:\/|$)/i.test(name))
          || !['.mjs', '.js', '.ts'].includes(extname(actual))) throw Error('Unapproved benchmark input: ' + name);
        const bytes = await bounded(actual, 2 * 1024 * 1024); inputs.set(name, { name, bytes: bytes.length, sha256: hash(bytes) });
        return { contents: bytes, loader: extname(actual) === '.ts' ? 'ts' : 'js', resolveDir: dirname(actual) };
      });
    } }],
  });
  if (Object.values(result.metafile.outputs).some(o => o.imports.some(i => i.external))) throw Error('External runtime import refused');
  const files = new Map();
  for (const file of result.outputFiles) {
    const name = relative(outdir, file.path);
    if (!['main.js', 'worker.js'].includes(name) || file.contents.length > 8 * 1024 * 1024) throw Error('Unexpected output');
    files.set(name, file.contents);
  }
  files.set('index.html', await bounded(resolve(root, 'tools/performance/index.html'), 256 * 1024));
  // This intentionally carries the broader existing app notice set, not a minimized subset.
  for (const name of noticeSources) {
    const target = name === 'LICENSE' ? 'LICENSE.txt' : name === 'LICENSES/GPL-3.0-or-later.txt' ? name :
      name === 'node_modules/egoroof-blowfish/LICENSE.md' ? 'licenses/blowfish.txt' :
      name === 'node_modules/@noble/hashes/LICENSE' ? 'licenses/noble-hashes.txt' : `licenses/${name.replaceAll('/', '-')}.txt`;
    files.set(target, await bounded(resolve(root, name), 256 * 1024));
  }
  files.set('NOTICES.txt', Buffer.from('Original WebRA2 performance harness: GPL-3.0-or-later. Existing GPL/MIT engine components and locked dependency notices are included.\nThe broader app notice set is retained intentionally; inclusion does not mean every component executes in this workload.\nNo retail assets are included. This is a local diagnostic, not a finalized distribution.\nCorresponding source, original fixtures and build instructions: https://github.com/lictl/WebRA2 (tools/performance; docs/performance-baseline.md).\n'));
  if ([...files.values()].reduce((n, b) => n + b.length, 0) > 16 * 1024 * 1024) throw Error('Output size limit');
  const outputs = [];
  for (const [name, bytes] of files) { const target = resolve(outdir, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
    outputs.push({ name, bytes: bytes.length, sha256: hash(bytes) }); }
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const engineDiff = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'packages', 'apps/web'], { cwd: root, encoding: 'utf8' }).trim();
  const manifest = { schema: 1, gitHead, engineDiff: engineDiff ? engineDiff.split('\n') : [],
    files: outputs.sort((a, b) => a.name.localeCompare(b.name)), inputs: [...inputs.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(output, 'metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: node tools/performance/build.mjs local/<fresh-output-directory>');
  const manifest = await buildPerformance(process.argv[2]);
  console.log(`Built ${manifest.files.length} code/license files from ${manifest.inputs.length} approved inputs; head ${manifest.gitHead}.`);
}
