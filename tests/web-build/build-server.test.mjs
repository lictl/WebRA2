// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { request } from 'node:http';
import { buildWeb, repositoryRoot } from '../../tools/web/build.mjs';
import { startWebServer } from '../../tools/web/serve.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'webra2-build-'));
  for (const name of ['LICENSE', 'apps/web/PROVENANCE.md', 'LICENSES/GPL-3.0-or-later.txt', 'docs/licensing.md',
    'packages/formats/PROVENANCE.md', 'packages/formats/MAP_PACK_PROVENANCE.md', 'packages/formats/TMP_PROVENANCE.md', 'packages/formats/shp-PROVENANCE.md', 'packages/formats/SHP_RUNTIME_PROVENANCE.md', 'packages/formats/VOXEL_PROVENANCE.md',
    'packages/render/PROVENANCE.md', 'packages/render/SPRITE_PROVENANCE.md', 'packages/render/VOXEL_PROVENANCE.md', 'packages/sim/MISSION_LOGIC_PROVENANCE.md', 'packages/sim/MISSION_BINDINGS_PROVENANCE.md', 'packages/content/MISSION_CUES_PROVENANCE.md', 'packages/sim/WORLD_CONTENT_PROVENANCE.md', 'packages/sim/COMBAT_CONTENT_PROVENANCE.md', 'packages/sim/NATIVE_RANDOM_PROVENANCE.md', 'packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md', 'packages/sim/ORDINARY_DEATH_PROVENANCE.md', 'packages/sim/ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md', 'packages/sim/INFANTRY_PASSAGE_PROVENANCE.md', 'packages/sim/TEAM_DESTINATIONS_PROVENANCE.md', 'packages/sim/TEAM_RUNTIME_PROVENANCE.md', 'packages/sim/TEAM_SLEEP_PROVENANCE.md', 'packages/sim/TEAM_RECRUITMENT_PROVENANCE.md', 'packages/sim/TEAM_SPAWN_PROVENANCE.md', 'packages/content/TEAM_ACTIVATION_PROVENANCE.md', 'packages/content/PROVENANCE.md', 'packages/content/CAMPAIGN_LAUNCH_PROVENANCE.md', 'packages/content/OBJECT_ART_PROVENANCE.md', 'packages/content/CONSTRUCTION_PROVENANCE.md', 'packages/content/ENTITY_DEFINITIONS_PROVENANCE.md', 'packages/content/TERRAIN_TRAVERSAL_PROVENANCE.md', 'packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md', 'packages/content/FOUNDATION_OCCUPANCY_PROVENANCE.md', 'packages/content/WEAPON_DEFINITIONS_PROVENANCE.md', 'packages/content/VOXEL_RESOURCES_PROVENANCE.md', 'packages/content/TEAM_DEFINITIONS_PROVENANCE.md', 'packages/content/COMBAT_ACTORS_PROVENANCE.md', 'packages/content/COMBAT_DEATH_PROVENANCE.md', 'packages/content/COMBAT_MODIFIERS_PROVENANCE.md', 'packages/content/COMBAT_VETERANCY_PROVENANCE.md', 'packages/content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md', 'packages/sim/INFANTRY_FIRING_PROVENANCE.md', 'packages/content/INSTANT_WEAPONS_PROVENANCE.md', 'packages/content/ANIMATION_EFFECTS_PROVENANCE.md', 'packages/content/INI_SOURCE_PROVENANCE.md', 'packages/content/LOCALE_PROVENANCE.md', 'packages/vfs/PROVENANCE.md', 'packages/vfs/HASH_PROVENANCE.md',
    'node_modules/@noble/hashes/LICENSE', 'node_modules/egoroof-blowfish/LICENSE.md']) {
    await mkdir(dirname(join(root, name)), { recursive: true }); await copyFile(join(repositoryRoot, name), join(root, name));
  }
  await mkdir(join(root, 'apps/web/src'), { recursive: true });
  await writeFile(join(root, 'apps/web/src/main.ts'), "import './style.css'; const title: string = 'Synthetic app'; document.body.dataset.title = title;\n");
  await writeFile(join(root, 'apps/web/src/import-worker.ts'), 'self.onmessage = () => self.postMessage(42);');
  await writeFile(join(root, 'apps/web/src/simulation-worker.ts'), 'self.onmessage = () => self.postMessage(43);');
  await writeFile(join(root, 'apps/web/src/terrain-worker.ts'), 'self.onmessage = () => self.postMessage(44);');
  await writeFile(join(root, 'apps/web/src/style.css'), 'body { color: #f0f0f0; }');
  await writeFile(join(root, 'apps/web/index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><script type="module" src="/app.js"></script></body></html>');
  return root;
}
function http(url, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url + '/', { ...options, path }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end(options.body);
  });
}

test('build emits portable code and notices with a hash manifest, without retail inputs', async () => {
  const root = await fixture();
  try {
    const manifest = await buildWeb(root);
    assert.deepEqual(manifest.inputs, ['apps/web/src/import-worker.ts', 'apps/web/src/main.ts', 'apps/web/src/simulation-worker.ts', 'apps/web/src/style.css', 'apps/web/src/terrain-worker.ts']);
    assert.ok(manifest.files.some(row => row.name === 'app.css'));
    assert.ok(manifest.files.some(row => row.name === 'licenses/noble-hashes.txt'));
    assert.ok(manifest.files.some(row => row.name === 'licenses/packages-render-PROVENANCE.md.txt'));
    assert.ok(manifest.files.some(row => row.name === 'licenses/packages-vfs-HASH_PROVENANCE.md.txt'));
    assert.ok(manifest.files.some(row => row.name === 'licenses/packages-content-OBJECT_ART_PROVENANCE.md.txt'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-render-VOXEL_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/render/VOXEL_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-ENTITY_DEFINITIONS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/ENTITY_DEFINITIONS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-TERRAIN_TRAVERSAL_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/TERRAIN_TRAVERSAL_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-CAMPAIGN_LAUNCH_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/CAMPAIGN_LAUNCH_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-INFANTRY_PASSAGE_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/INFANTRY_PASSAGE_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-MISSION_BINDINGS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/MISSION_BINDINGS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-MISSION_CUES_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/MISSION_CUES_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-WORLD_CONTENT_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/WORLD_CONTENT_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-COMBAT_CONTENT_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/COMBAT_CONTENT_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-NATIVE_RANDOM_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/NATIVE_RANDOM_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-NATIVE_COMBAT_NUMBERS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-ORDINARY_DEATH_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/ORDINARY_DEATH_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-TEAM_DESTINATIONS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/TEAM_DESTINATIONS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-TEAM_RUNTIME_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/TEAM_RUNTIME_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-TEAM_SLEEP_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/TEAM_SLEEP_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-TEAM_RECRUITMENT_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/TEAM_RECRUITMENT_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-TEAM_SPAWN_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/TEAM_SPAWN_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-TEAM_ACTIVATION_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/TEAM_ACTIVATION_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-FOUNDATION_OCCUPANCY_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/FOUNDATION_OCCUPANCY_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-WEAPON_DEFINITIONS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/WEAPON_DEFINITIONS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-VOXEL_RESOURCES_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/VOXEL_RESOURCES_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-TEAM_DEFINITIONS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/TEAM_DEFINITIONS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-COMBAT_ACTORS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/COMBAT_ACTORS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-COMBAT_DEATH_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/COMBAT_DEATH_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-COMBAT_MODIFIERS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/COMBAT_MODIFIERS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-COMBAT_VETERANCY_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/COMBAT_VETERANCY_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-COMBAT_INITIAL_RUNTIME_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-sim-INFANTRY_FIRING_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/sim/INFANTRY_FIRING_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-INSTANT_WEAPONS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/INSTANT_WEAPONS_PROVENANCE.md'), 'utf8'));
    assert.equal(await readFile(join(root, 'dist/licenses/packages-content-ANIMATION_EFFECTS_PROVENANCE.md.txt'), 'utf8'), await readFile(join(repositoryRoot, 'packages/content/ANIMATION_EFFECTS_PROVENANCE.md'), 'utf8'));
    for (const path of ['packages-render-SPRITE_PROVENANCE.md', 'packages-sim-MISSION_LOGIC_PROVENANCE.md']) {
      const name = `licenses/${path}.txt`;
      assert.ok(manifest.files.some(row => row.name === name));
      assert.equal(await readFile(join(root, 'dist', name), 'utf8'), await readFile(join(repositoryRoot, path.startsWith('packages-render') ? 'packages/render/SPRITE_PROVENANCE.md' : 'packages/sim/MISSION_LOGIC_PROVENANCE.md'), 'utf8'));
    }
    for (const component of ['MAP_PACK', 'TMP', 'SHP_RUNTIME', 'VOXEL']) assert.ok(manifest.files.some(row => row.name === `licenses/packages-formats-${component}_PROVENANCE.md.txt`));
    assert.ok(manifest.files.some(row => row.name === 'LICENSES/GPL-3.0-or-later.txt'));
    assert.match(await readFile(join(root, 'dist/app.js'), 'utf8'), /Synthetic app/);
    assert.equal((await buildWeb(root)).files.find(row => row.name === 'app.js').sha256, manifest.files.find(row => row.name === 'app.js').sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('build rejects private imports before publishing and keeps the prior good bundle', async () => {
  const root = await fixture();
  try {
    await buildWeb(root); const prior = await readFile(join(root, 'dist/app.js'), 'utf8');
    for (const directory of ['game', 'local']) {
      await mkdir(join(root, directory)); await writeFile(join(root, directory, 'private.ts'), 'export const secret = "private synthetic marker";');
      await writeFile(join(root, 'apps/web/src/main.ts'), `import {secret} from '../../../${directory}/private.ts'; console.log(secret);`);
      await assert.rejects(buildWeb(root), /outside approved code paths/);
      assert.equal(await readFile(join(root, 'dist/app.js'), 'utf8'), prior);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('build rejects symlink input escapes and a symlink output directory', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'local')); await writeFile(join(root, 'local/secret.ts'), 'export const secret = 1;');
    await symlink(join(root, 'local/secret.ts'), join(root, 'packages/secret.ts'));
    await writeFile(join(root, 'apps/web/src/main.ts'), "import {secret} from '../../../packages/secret.ts'; console.log(secret);");
    await assert.rejects(buildWeb(root), /outside approved code paths/);
    await symlink(join(root, 'local'), join(root, 'dist')); await assert.rejects(buildWeb(root), /symlink/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('launcher serves only validated app routes with no asset or upload endpoint', async () => {
  const root = await fixture(); let app;
  try {
    await buildWeb(root); app = await startWebServer({ root, port: 0 });
    for (const path of ['/', '/index.html', '/app.js', '/app.css', '/workers/import.js', '/workers/simulation.js', '/workers/terrain.js', '/NOTICES.txt', '/LICENSES/GPL-3.0-or-later.txt']) assert.equal((await http(app.url, path)).status, 200);
    const page = await http(app.url, '/'); assert.match(page.headers['content-security-policy'], /connect-src 'none'/); assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    const head = await http(app.url, '/app.js', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.body, '');
    for (const path of ['/game/ra2.mix', '/local/secret', '/../game/ra2.mix', '/%2e%2e/game/ra2.mix', '//app.js', '/app.js?asset=1', '/manifest.json', '/workers/arbitrary.js']) assert.equal((await http(app.url, path)).status, 404);
    assert.equal((await http(app.url, '/app.js', { method: 'POST', body: 'synthetic bytes' })).status, 404);
    assert.equal((await http(app.url, '/', { headers: { Host: 'example.com' } })).status, 404);
  } finally { if (app) await app.close(); await rm(root, { recursive: true, force: true }); }
});
test('launcher refuses changed build bytes and unapproved manifest routes', async () => {
  const root = await fixture();
  try {
    await buildWeb(root); await writeFile(join(root, 'dist/app.js'), 'tampered');
    await assert.rejects(startWebServer({ root, port: 0 }), /Stale or changed/);
    const manifest = await buildWeb(root); manifest.files[0].name = '../game/secret.mix';
    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify(manifest));
    await assert.rejects(startWebServer({ root, port: 0 }), /Invalid code route/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('build rejects external runtime code and remote CSS resources', async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, 'apps/web/src/main.ts'), "import 'https://example.com/runtime.js';");
    await assert.rejects(buildWeb(root), /external runtime imports/);
    await writeFile(join(root, 'apps/web/src/main.ts'), "import './style.css';");
    await writeFile(join(root, 'apps/web/src/terrain-worker.ts'), 'self.onmessage = () => self.postMessage(44);');
  await writeFile(join(root, 'apps/web/src/style.css'), 'body { background: url(https://example.com/asset.png); }');
    await assert.rejects(buildWeb(root), /external runtime imports/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('copied notices reject intermediate symlinks before changing the last good build', async () => {
  const root = await fixture();
  try {
    await buildWeb(root);
    const manifest = await readFile(join(root, 'dist/manifest.json'), 'utf8');
    const notice = await readFile(join(root, 'dist/licenses/docs-licensing.md.txt'), 'utf8');
    await mkdir(join(root, 'local'));
    await writeFile(join(root, 'local/licensing.md'), 'PRIVATE SYNTHETIC MARKER');
    await rm(join(root, 'docs'), { recursive: true });
    await symlink(join(root, 'local'), join(root, 'docs'));
    await assert.rejects(buildWeb(root), /symlink components/);
    assert.equal(await readFile(join(root, 'dist/manifest.json'), 'utf8'), manifest);
    assert.equal(await readFile(join(root, 'dist/licenses/docs-licensing.md.txt'), 'utf8'), notice);
  } finally { await rm(root, { recursive: true, force: true }); }
});
