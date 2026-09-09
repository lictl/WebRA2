// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature rules and mission data; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bindScenarioObjects, SCENARIO_BINDING_LIMITS } from '../../packages/content/src/scenario-bindings.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const map = `[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=BlueHouse\n[BlueHouse]\nCountry=BlueCountry\n[Infantry]\n0=BlueHouse,INF,256,2,2,2,Guard,0,None\n[Units]\n2=BlueHouse,TANK,256,2,2,0,Guard,None\n[Aircraft]\n0=BlueHouse,AIR,256,2,2,0,Guard,None\n[Structures]\n0=BlueHouse,HQ,256,2,2,0,None\n[Terrain]\n2002=TREE\n[Smudge]\n0=MARK,2,2,0\n[INF]\nStrength=75\n`;
const base = `[InfantryTypes]\n0=INF\n[VehicleTypes]\n0=TANK\n[AircraftTypes]\n0=AIR\n[BuildingTypes]\n0=HQ\n[TerrainTypes]\n0=TREE\n[SmudgeTypes]\n0=MARK\n[Countries]\n0=BlueCountry\n[BlueCountry]\nSide=Allied\n[INF]\nStrength=50\nImage=OriginalImage\n[TANK]\nStrength=100\n[AIR]\nStrength=20\n[HQ]\nStrength=200\n[TREE]\nSpawnsResource=no\n[MARK]\nWidth=1\n`;
const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
function input(mission = map, rules = base, profile: 'ra2' | 'yr' = 'ra2', mod?: string) {
  const source = { id: 'original-map', profile, sha256: hash(mission) };
  const layers: RuntimeIniLayer[] = [{ id: 'original-rules', profile, order: 0, kind: 'base', sourceSha256: hash(rules), bytes: bytes(rules) },
    { id: source.id, profile, order: 1, kind: 'map', sourceSha256: source.sha256, bytes: bytes(mission) }];
  if (mod) layers.push({ id: 'original-mod', profile, order: 2, kind: 'mod', sourceSha256: hash(mod), bytes: bytes(mod) });
  return { objects: compileScenarioObjects({ profile, source, bytes: bytes(mission) }), rules: compileRuntimeIni(profile, layers) };
}
test('all six placement families join declared definitions with map-overridden property provenance', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const result = bindScenarioObjects(input(map, base, profile));
    assert.equal(result.types.length, 6); assert.equal(result.placements.length, 6);
    assert.ok(result.types.every(type => type.status === 'resolved')); assert.deepEqual(result.unresolved, { types: 0, owners: 0, houseCountries: 0 });
    const infantry = result.types.find(type => type.kind === 'infantry')!, strength = infantry.fields.find(field => field.key === 'strength')!;
    assert.equal(strength.value, '75'); assert.equal(strength.selected.layerId, 'original-map'); assert.equal(strength.shadowed[0]!.rawValue, '50');
    assert.equal(infantry.fields.find(field => field.key === 'image')!.selected.layerId, 'original-rules');
    assert.equal(result.houses[0]!.country.targetId, 'country:bluecountry'); assert.equal(result.countries[0]!.fields[0]!.value, 'Allied');
    for (const row of result.placements) assert.equal(row.owner.status, ['terrain:2002', 'smudge:0'].includes(row.rowId) ? 'none' : 'house');
    assert.equal(result.canStartCampaign, false); assert.equal(result.nativeBehaviorVerified, false);
  }
});
test('case-folded repeated registry declarations retain alternatives and stable placement joins', () => {
  const value = input(map.replace('BlueHouse,INF', 'bluehouse,inf'), base.replace('0=INF', '5=iNf\n0=INF'));
  const result = bindScenarioObjects(value), infantry = result.types.find(type => type.kind === 'infantry')!;
  assert.equal(infantry.declarations.length, 2); assert.equal(infantry.status, 'resolved');
  const reordered = Object.freeze({ ...value.objects, placements: Object.freeze([...value.objects.placements].reverse()), houses: Object.freeze([...value.objects.houses].reverse()) });
  assert.deepEqual(bindScenarioObjects({ ...value, objects: reordered }), result);
  assert.equal(result.placements.find(row => row.rowId === 'infantry:0')!.typeId, 'type:infantry:inf');
  const named = bindScenarioObjects(input(map.replaceAll('INF', '__proto__').replaceAll('BlueHouse', 'Blue House'), base.replaceAll('INF', '__proto__')));
  assert.equal(named.types.find(type => type.kind === 'infantry')!.name, '__proto__');
  assert.equal(named.placements.find(row => row.rowId === 'infantry:0')!.owner.status, 'house');
});
test('undeclared, wrong-family and absent sections remain separate unresolved types; empty sections are present', () => {
  const result = bindScenarioObjects(input(map.replace('BlueHouse,INF', 'BlueHouse,TANK'), base.replace('0=AIR\n', '').replace('[TREE]\nSpawnsResource=no\n', '').replace('[MARK]\nWidth=1', '[MARK]')));
  assert.equal(result.types.find(type => type.kind === 'infantry')!.status, 'wrong-family');
  assert.deepEqual(result.types.find(type => type.kind === 'infantry')!.otherFamilies, ['unit']);
  assert.equal(result.types.find(type => type.kind === 'aircraft')!.status, 'undeclared');
  assert.equal(result.types.find(type => type.kind === 'terrain')!.status, 'missing-section');
  assert.equal(result.types.find(type => type.kind === 'smudge')!.status, 'resolved'); assert.equal(result.unresolved.types, 3);
});
test('literal house and country candidates remain distinct and ambiguous names do not allocate an owner', () => {
  const countryOnly = bindScenarioObjects(input(map.replace('BlueHouse,INF', 'BlueCountry,INF')));
  assert.equal(countryOnly.placements.find(row => row.rowId === 'infantry:0')!.owner.status, 'country-only');
  const ambiguous = bindScenarioObjects(input(map, base + '[Countries]\n1=BlueHouse\n'));
  assert.equal(ambiguous.placements.find(row => row.rowId === 'units:2')!.owner.status, 'ambiguous');
  assert.equal(ambiguous.unresolved.owners, 4);
  const missing = bindScenarioObjects(input(map.replace('BlueHouse,INF', 'Unknown,INF')));
  assert.equal(missing.placements.find(row => row.rowId === 'infantry:0')!.owner.status, 'missing');
  const absentHouse = bindScenarioObjects(input(map.replace('[BlueHouse]\nCountry=BlueCountry\n', '')));
  assert.equal(absentHouse.placements.find(row => row.rowId === 'units:2')!.owner.status, 'missing-house-section');
  assert.equal(absentHouse.houses[0]!.country.status, 'absent');
});
test('house country references preserve absent/missing/section/conflicting effective values without inheritance', () => {
  assert.equal(bindScenarioObjects(input(map.replace('Country=BlueCountry', 'Country=Absent'))).houses[0]!.country.status, 'missing');
  assert.equal(bindScenarioObjects(input(map, base.replace('[BlueCountry]\nSide=Allied\n', ''))).houses[0]!.country.status, 'missing-section');
  const changed = bindScenarioObjects(input(map, base, 'ra2', '[BlueHouse]\nCountry=Other\n'));
  assert.equal(bindScenarioObjects(input(map, base, 'ra2', '[BlueHouse]\nCountry=bluecountry\n')).houses[0]!.country.status, 'resolved');
  assert.equal(changed.houses[0]!.country.status, 'effective-conflict'); assert.equal(changed.houses[0]!.country.raw, 'BlueCountry');
  assert.equal(changed.houses[0]!.country.targetId, 'country:bluecountry');
});
test('profile/map identity and one effective map layer are required', () => {
  const value = input();
  assert.throws(() => bindScenarioObjects({ ...value, rules: input(map, base, 'yr').rules }), /bindings-profile/);
  assert.throws(() => bindScenarioObjects({ ...value, rules: input(map + '; different source\n').rules }), /bindings-map-identity/);
  const noMap = compileRuntimeIni('ra2', [{ id: 'base', profile: 'ra2', order: 0, kind: 'base', sourceSha256: hash(base), bytes: bytes(base) }]);
  assert.throws(() => bindScenarioObjects({ ...value, rules: noMap }), /bindings-map-identity/);
  const twoMaps = Object.freeze({ ...value.rules, layers: Object.freeze([...value.rules.layers, Object.freeze({ ...value.rules.layers[1]!, id: 'second-map', order: 2 })]) });
  assert.throws(() => bindScenarioObjects({ ...value, rules: twoMaps }), /bindings-map-identity/);
});
test('input graphs and retained provenance are immutable; getters/cycles/foreign containers fail before joining', () => {
  const value = input(), result = bindScenarioObjects(value);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.types[0]!.fields));
  assert.throws(() => { (result.types[0]!.fields[0] as { value: string }).value = 'changed'; }, TypeError);
  assert.throws(() => bindScenarioObjects({ ...value, objects: { ...value.objects } }), /bindings-immutable-input/);
  const accessed = Object.freeze({ ...value.rules, get marker(): never { throw Error('getter must not run'); } });
  assert.throws(() => bindScenarioObjects({ ...value, rules: accessed }), /bindings-input-property/);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle; Object.freeze(cycle);
  assert.throws(() => bindScenarioObjects({ ...value, rules: cycle as unknown as typeof value.rules }), /bindings-input-cycle/);
  const rows = [...value.objects.placements]; delete rows[0];
  assert.throws(() => bindScenarioObjects({ ...value, objects: Object.freeze({ ...value.objects, placements: Object.freeze(rows) }) }), /bindings-structure-limit/);
});
test('structure, character, declaration and placement budgets fail atomically and cannot be raised', () => {
  const value = input();
  for (const cap of [{ placements: 5 }, { declarations: 6 }, { houses: 0 }, { fields: 1 }, { nodes: 10 }, { characters: 8 }]) assert.throws(() => bindScenarioObjects(value, cap), /bindings-/);
  assert.doesNotThrow(() => bindScenarioObjects(value, { placements: 6, declarations: 7, houses: 1 }));
  for (const cap of [{ nodes: SCENARIO_BINDING_LIMITS.nodes + 1 }, { nodes: -0 }, { bogus: 1 }]) assert.throws(() => bindScenarioObjects(value, cap), /bindings-limit/);
});

test('overwritten registry names retain historical origins without being promoted to an effective declaration', () => {
  const result = bindScenarioObjects(input(map + '[InfantryTypes]\n0=OTHER\n[OTHER]\nStrength=10\n'));
  assert.equal(result.types.find(type => type.kind === 'infantry')!.status, 'undeclared');
  const historical = result.shadowedRegistrations.find(row => row.registry === 'infantrytypes' && row.name === 'inf')!;
  assert.equal(historical.origin.layerId, 'original-rules'); assert.equal(historical.origin.rawValue, 'INF');
  assert.ok(Object.isFrozen(historical));
});
