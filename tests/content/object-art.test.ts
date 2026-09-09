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
    assert.deepEqual(person.paths, ['actor.shp']); assert.equal(person.rulesImage, 'sprite_person'); assert.equal(person.image, 'actor');
    assert.deepEqual(person.fields.filter(e => e.key === 'image').map(e => e.selected.layerId), ['rules', 'art']);
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
  const image = person.fields.find(e => e.key === 'image')!;
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
    [art.replace('Image=ACTOR', 'Image=../escape'), 'unsupported-art-image'],
    [art.replace('Foundation=2x3', 'Foundation=Custom'), 'unsupported-foundation'],
    [art.replace('Voxel=yes', 'Voxel=yes\nVoxel=no'), 'duplicate-field-within-layer'],
    [art.replace('[TRACE]', '[UNUSED]'), 'missing-art-section'],
  ] as const) assert.ok(compileObjectArt(input({ art: changed })).types.some(t => t.status === 'unsupported' && t.reasons.includes(reason)));
  assert.ok(compileObjectArt(input({ rules: rules.replace('[ROVER]\nStrength=20\n', '') })).types.some(t => t.reasons.includes('missing-rule-section')));
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
