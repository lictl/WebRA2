// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileObjectArt, assertObjectArtPlan, OBJECT_ART_LIMITS } from '../../packages/content/src/object-art.ts';
import { input, rules, art, mission } from './object-art.fixture.ts';

test('still-art policy joins all families, preserves Image provenance and uses only requested-theater fallbacks', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const p = compileObjectArt(input({ profile }));
    assert.equal(p.types.length, 6); assert.equal(p.placements.length, 6);
    const person = p.types.find(t => t.kind === 'infantry')!, hall = p.types.find(t => t.kind === 'structure')!;
    assert.deepEqual(person.paths, ['actor.shp']); assert.equal(person.rulesImage, 'ACTOR'); assert.equal(person.image, 'ACTOR');
    assert.deepEqual(person.fields.filter(e => e.key === 'Image').map(e => e.selected.layerId), ['rules']);
    assert.deepEqual(hall.paths, profile === 'ra2' ? ['guall.shp', 'ggall.shp', 'ghall.shp'] : ['gnall.shp', 'ggall.shp', 'ghall.shp']);
    assert.deepEqual(hall.foundation, { width: 2, height: 3 }); assert.equal(person.frame, 0); assert.equal(person.remap, 'original-palette');
    assert.equal(p.types.filter(t => t.status === 'voxel').length, 2);
    assert.equal(p.nativeBehaviorVerified, false); assert.equal(p.canStartCampaign, false); assertObjectArtPlan(p);
    assert.throws(() => assertObjectArtPlan(structuredClone(p)), /art-plan/);
  }
});
test('map Image override preserves prior origin while declaration order and object order do not select artwork', () => {
  const source = input({ mission: mission + '[PERSON]\nImage=PLANT\n' }), p = compileObjectArt(source);
  const person = p.types.find(t => t.kind === 'infantry')!;
  assert.deepEqual(person.paths, ['plant.urb', 'plant.shp']); assert.equal(person.palettePath, 'isourb.pal');
  const image = person.fields.find(e => e.key === 'Image')!;
  assert.equal(image.selected.layerId, 'original-map'); assert.equal(image.shadowed[0]!.layerId, 'rules');
  const reversed = Object.freeze({ ...source.objects, placements: Object.freeze([...source.objects.placements].reverse()) });
  assert.deepEqual(compileObjectArt({ ...source, objects: reversed }), p);
  const custom = compileObjectArt(input({ art: art + '[TRACE]\nPalette=OriginalPalette\n' }));
  assert.equal(custom.types.find(t => t.kind === 'smudge')!.palettePath, 'originalpaletteurb.pal');
  const explicitExtension = compileObjectArt(input({ art: art + '[TRACE]\nPalette=OriginalPalette.pal\n' }));
  assert.ok(explicitExtension.types.find(t => t.kind === 'smudge')!.reasons.includes('unsupported-palette'));
});
test('unsafe names, unsupported flags, absent definitions and duplicate source fields remain explicit', () => {
  for (const [changed, reason] of [
    [art.replace('NewTheater=yes', 'NewTheater=maybe'), 'unsupported-newtheater'],
    [art.replace('[GHALL]', '[GHALL]\nImage=../escape'), 'unsupported-art-image'],
    [art.replace('Foundation=2x3', 'Foundation=Custom'), 'unsupported-foundation'],
    [art.replace('Voxel=yes', 'Voxel=yes\nVoxel=no'), 'ambiguous-art-source'],
    [art.replace('[TRACE]', '[UNUSED]'), 'missing-art-section'],
  ] as const) assert.ok(compileObjectArt(input({ art: changed })).types.some(t => t.status === 'unsupported' && t.reasons.includes(reason)));
  assert.ok(compileObjectArt(input({ rules: rules.replace('[ROVER]\nStrength=20\n', '') })).types.some(t => t.reasons.includes('unloaded-type-definition')));
});
test('profile/source boundaries and immutable graph limits reject before retaining compiler data', () => {
  const value = input();
  assert.throws(() => compileObjectArt({ ...value, art: input({ profile: 'yr' }).art }), /art-profile/);
  assert.throws(() => compileObjectArt({ ...value, rules: input({ mission: mission + '; new source\n' }).rules }), /art-map-identity/);
  assert.throws(() => compileObjectArt({ ...value, theater: 'NEWURBAN' }), /art-profile/);
  assert.throws(() => compileObjectArt({ ...value, theater: new String('URBAN') as unknown as 'URBAN' }), /art-profile/);
  assert.throws(() => compileObjectArt({ ...value, art: { ...value.art } }), /art-immutable/);
  const getter = Object.freeze({ ...value.art, get unwanted(): never { throw Error('must not execute'); } });
  assert.throws(() => compileObjectArt({ ...value, art: getter }), /art-property/);
  for (const options of [{ placements: 5 }, { types: 1 }, { fields: 1 }, { nodes: 5 }, { characters: 10 }, { nodes: OBJECT_ART_LIMITS.nodes + 1 }]) assert.throws(() => compileObjectArt(value, options), /art-/);
});

test('first allocated spelling selects exact rule and art names while type IDs remain case insensitive', () => {
  const p = compileObjectArt(input({ rules: rules.replace('0=PERSON', '0=Person').replace('[PERSON]', '[Person]') + '[PERSON]\nImage=WRONG\n',
    art: art + '[actor]\nVoxel=yes\n' }));
  const person = p.types.find(t => t.kind === 'infantry')!;
  assert.equal(person.id, 'type:infantry:person'); assert.equal(person.rulesImage, 'ACTOR'); assert.equal(person.status, 'shp');
  assert.equal(person.fields.find(f => f.source === 'rules')!.section, 'Person');
  assert.equal(p.sourceViewPolicy, 'webra2-ini-source-view-1'); assert.equal(p.constructionPolicy, 'webra2-scenario-construction-1');
  const wrongKey = compileObjectArt(input({ rules: rules.replace('Image=ACTOR', 'image=ACTOR'), art: art + '[PERSON]\nRemapable=yes\n' }));
  assert.equal(wrongKey.types.find(t => t.kind === 'infantry')!.rulesImage, 'PERSON');
});

test('late registration ignores earlier Image and successive exact sections retain art flag state', () => {
  const late = compileObjectArt(input({ rules: rules.replace('0=ROVER', '0=UNUSED').replace('[ROVER]', '[ROVER]\nImage=WRONG'),
    mission: mission + '[VehicleTypes]\n0=ROVER\n[ROVER]\nStrength=30\n' }));
  assert.equal(late.types.find(t => t.kind === 'unit')!.rulesImage, 'ROVER');
  const p = compileObjectArt(input({ rules: rules.replace('[GHALL]', '[GHALL]\nImage=FIRST'),
    ruleMods: ['[GHALL]\nImage=SECOND\n'], mission: mission + '[GHALL]\nIMAGE=IGNORED\n',
    art: art + '[FIRST]\nTheater=yes\n[SECOND]\nFoundation=1x2\n' }));
  const hall = p.types.find(t => t.kind === 'structure')!;
  assert.equal(hall.rulesImage, 'SECOND'); assert.deepEqual(hall.paths, ['second.urb', 'second.shp']);
  assert.deepEqual(hall.fields.find(f => f.source === 'rules')!.shadowed.map(o => o.layerId), ['rules']);
  assert.deepEqual(hall.fields.find(f => f.key === 'Theater')!.loadedAt, ['rules']);
});

test('building Image redirect keeps original art flags and exact layer policy never merges duplicate bodies', () => {
  const p = compileObjectArt(input({ art: art.replace('[GHALL]', '[GHALL]\nImage=GTFILE') + '[GTFILE]\nVoxel=yes\n' }));
  const hall = p.types.find(t => t.kind === 'structure')!;
  assert.equal(hall.status, 'shp'); assert.equal(hall.image, 'GTFILE'); assert.deepEqual(hall.paths, ['gufile.shp', 'ggfile.shp', 'gtfile.shp']);
  const ignoredFamily = compileObjectArt(input({ art: art.replace('[ACTOR]', '[ACTOR]\nImage=OTHER') }));
  assert.ok(ignoredFamily.types.find(t => t.kind === 'infantry')!.reasons.includes('unsupported-art-image-for-family'));
  const overlay = compileObjectArt(input({ artMods: ['[GHALL]\nFoundation=3x4\n[ghall]\nVoxel=yes\n'] }));
  assert.deepEqual(overlay.types.find(t => t.kind === 'structure')!.foundation, { width: 3, height: 4 });
  assert.equal(overlay.artLayerPolicy, 'exact-name-last-layer');
  const duplicate = compileObjectArt(input({ art: art + '[GHALL]\nPalette=Original\n' }));
  assert.ok(duplicate.types.find(t => t.kind === 'structure')!.reasons.includes('ambiguous-art-source'));
  assert.throws(() => compileObjectArt(input(), { work: 0 }), /art-work-limit/);
});
