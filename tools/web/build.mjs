// SPDX-License-Identifier: MIT
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, realpath, lstat, readdir, rm } from 'node:fs/promises';
import { relative, resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const allowedOutput = /^(?:app\.(?:js|css)|workers\/(?:import|simulation|terrain)\.js|chunks\/[a-zA-Z0-9_-]+\.js)$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function boundedFile(path, limit) {
  if (await realpath(path) !== resolve(path)) throw new Error(`Build input has symlink components: ${path}`);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > limit) throw new Error(`Invalid build input: ${path}`);
  return readFile(path);
}

/** Build explicit code inputs only. No asset directory or glob is a build entrypoint. */
export async function buildWeb(root = repositoryRoot) {
  root = await realpath(root);
  const outputDirectory = resolve(root, 'dist');
  try { if ((await lstat(outputDirectory)).isSymbolicLink()) throw new Error('Output directory cannot be a symlink'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const inputs = [];
  const result = await build({
    absWorkingDir: root, entryPoints: { app: 'apps/web/src/main.ts', 'workers/import': 'apps/web/src/import-worker.ts', 'workers/simulation': 'apps/web/src/simulation-worker.ts', 'workers/terrain': 'apps/web/src/terrain-worker.ts' }, outdir: outputDirectory,
    bundle: true, platform: 'browser', format: 'esm', target: ['es2022'], splitting: true,
    chunkNames: 'chunks/[name]-[hash]', sourcemap: false, minify: false, legalComments: 'inline',
    write: false, metafile: true, logLevel: 'silent',
    plugins: [{ name: 'code-input-boundary', setup(builder) {
      builder.onLoad({ filter: /.*/ }, async args => {
        const actual = await realpath(args.path);
        const path = relative(root, actual).split(sep).join('/');
        if (!/^(?:apps\/web\/|packages\/|node_modules\/(?:egoroof-blowfish|@noble\/hashes)\/)/.test(path) ||
            (!/^(?:node_modules\/egoroof-blowfish\/|node_modules\/@noble\/hashes\/)/.test(path) && /(?:^|\/)(?:game|local|public|dist)(?:\/|$)/i.test(path)) ||
            !['.ts', '.js', '.mjs', '.css'].includes(extname(actual))) {
          throw new Error(`Build input is outside approved code paths: ${path}`);
        }
        // The dependency package's own dist/ is approved; repository dist/ is not.
        inputs.push(path);
        return { contents: await boundedFile(actual, 2 * 1024 * 1024), loader: extname(actual) === '.css' ? 'css' : extname(actual) === '.ts' ? 'ts' : 'js', resolveDir: dirname(actual) };
      });
    } }],
  });
  for (const output of Object.values(result.metafile.outputs)) {
    if (output.imports.some(item => item.external)) throw new Error('Browser output cannot depend on external runtime imports');
  }
  const outputs = new Map();
  for (const file of result.outputFiles) {
    const name = relative(outputDirectory, file.path).split(sep).join('/');
    if (!allowedOutput.test(name) || file.contents.length > 8 * 1024 * 1024) throw new Error(`Unexpected browser output: ${name}`);
    outputs.set(name, file.contents);
  }
  outputs.set('index.html', await boundedFile(resolve(root, 'apps/web/index.html'), 256 * 1024));
  for (const name of ['LICENSE', 'apps/web/PROVENANCE.md', 'LICENSES/GPL-3.0-or-later.txt', 'docs/licensing.md',
    'packages/formats/PROVENANCE.md', 'packages/formats/MAP_PACK_PROVENANCE.md', 'packages/formats/TMP_PROVENANCE.md', 'packages/formats/shp-PROVENANCE.md', 'packages/formats/SHP_RUNTIME_PROVENANCE.md', 'packages/formats/VOXEL_PROVENANCE.md',
    'packages/render/PROVENANCE.md', 'packages/render/SPRITE_PROVENANCE.md', 'packages/render/VOXEL_PROVENANCE.md', 'packages/sim/MISSION_LOGIC_PROVENANCE.md', 'packages/sim/WORLD_CONTENT_PROVENANCE.md', 'packages/sim/COMBAT_CONTENT_PROVENANCE.md', 'packages/sim/NATIVE_RANDOM_PROVENANCE.md', 'packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md', 'packages/sim/ORDINARY_DEATH_PROVENANCE.md', 'packages/sim/ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md', 'packages/sim/INFANTRY_PASSAGE_PROVENANCE.md', 'packages/sim/TEAM_DESTINATIONS_PROVENANCE.md', 'packages/sim/TEAM_RUNTIME_PROVENANCE.md', 'packages/sim/TEAM_SLEEP_PROVENANCE.md', 'packages/sim/TEAM_RECRUITMENT_PROVENANCE.md', 'packages/sim/TEAM_SPAWN_PROVENANCE.md', 'packages/content/TEAM_ACTIVATION_PROVENANCE.md', 'packages/content/PROVENANCE.md', 'packages/content/CAMPAIGN_LAUNCH_PROVENANCE.md', 'packages/content/OBJECT_ART_PROVENANCE.md', 'packages/content/CONSTRUCTION_PROVENANCE.md', 'packages/content/ENTITY_DEFINITIONS_PROVENANCE.md', 'packages/content/TERRAIN_TRAVERSAL_PROVENANCE.md', 'packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md', 'packages/content/FOUNDATION_OCCUPANCY_PROVENANCE.md', 'packages/content/WEAPON_DEFINITIONS_PROVENANCE.md', 'packages/content/VOXEL_RESOURCES_PROVENANCE.md', 'packages/content/TEAM_DEFINITIONS_PROVENANCE.md', 'packages/content/COMBAT_ACTORS_PROVENANCE.md', 'packages/content/COMBAT_DEATH_PROVENANCE.md', 'packages/content/COMBAT_MODIFIERS_PROVENANCE.md', 'packages/content/COMBAT_VETERANCY_PROVENANCE.md', 'packages/content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md', 'packages/sim/INFANTRY_FIRING_PROVENANCE.md', 'packages/content/INSTANT_WEAPONS_PROVENANCE.md', 'packages/content/ANIMATION_EFFECTS_PROVENANCE.md', 'packages/content/INI_SOURCE_PROVENANCE.md', 'packages/content/LOCALE_PROVENANCE.md', 'packages/vfs/PROVENANCE.md', 'packages/vfs/HASH_PROVENANCE.md',
    'node_modules/@noble/hashes/LICENSE', 'node_modules/egoroof-blowfish/LICENSE.md']) {
    const target = name === 'LICENSE' ? 'LICENSE.txt' : name === 'LICENSES/GPL-3.0-or-later.txt' ? name :
      name === 'node_modules/egoroof-blowfish/LICENSE.md' ? 'licenses/blowfish.txt' :
      name === 'node_modules/@noble/hashes/LICENSE' ? 'licenses/noble-hashes.txt' : `licenses/${name.replaceAll('/', '-')}.txt`;
    outputs.set(target, await boundedFile(resolve(root, name), 256 * 1024));
  }
  outputs.set('NOTICES.txt', Buffer.from('WebRA2 development build. Application: GPL-3.0-or-later; separable original components: MIT.\nThis code-only build contains no game assets. Read the included license texts and provenance notices.\nCorresponding source and build instructions: https://github.com/lictl/WebRA2\nThis local development output is not a finalized release distribution.\n'));
  const total = [...outputs.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (total > 16 * 1024 * 1024) throw new Error('Browser build exceeds 16 MiB code-output cap');
  // Publish after every input/output has passed; remove only this generated output directory.
  await mkdir(outputDirectory, { recursive: true });
  for (const entry of await readdir(outputDirectory)) await rm(resolve(outputDirectory, entry), { recursive: true, force: true });
  const files = [];
  for (const [name, bytes] of outputs) {
    const path = resolve(outputDirectory, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    files.push({ name, size: bytes.length, sha256: digest(bytes) });
  }
  const manifest = { schemaVersion: 1, files, inputs: [...new Set(inputs)].sort() };
  await writeFile(resolve(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildWeb();
  console.log(`Built ${manifest.files.length} code/license files from ${manifest.inputs.length} approved inputs. No retail assets included.`);
}
