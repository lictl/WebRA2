// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic rules/maps; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assembleScenarioDefinitions, SCENARIO_CONSTRUCTION_LIMITS } from '../../packages/content/src/scenario-construction.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
const base = `[Countries]\n9=BlueCountry\n2=RedCountry\n[BlueCountry]\nName=Blue Alias\nSide=First\n[RedCountry]\nName=Red Alias\n[InfantryTypes]\n8=INF\n[VehicleTypes]\n5=TANK\n[AircraftTypes]\n9=AIR\n[BuildingTypes]\n10=HQ\n[TerrainTypes]\n6=TREE\n[SmudgeTypes]\n5=MARK\n[INF]\nStrength=10\n[HQ]\nStrength=30\n[TREE]\nName=Tree Alias\n`;
const mission = `[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n9=BlueHouse\n1=RedHouse\n[BlueHouse]\nCountry=BlueCountry\n[RedHouse]\nCountry=RedCountry\n[Infantry]\n0=BlueHouse,INF,256,2,2,2,Guard,0,None\n[Units]\n0=BlueHouse,TANK,256,2,2,0,Guard,None\n[Aircraft]\n0=BlueHouse,AIR,256,2,2,0,Guard,None\n[Structures]\n0=BlueHouse,HQ,256,2,2,0,None\n[Terrain]\n2002=TREE\n[Smudge]\n0=MARK,2,2,0\n`;
const bytes = (s: string) => new TextEncoder().encode(s);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function input(map = mission, rules = base, profile: 'ra2' | 'yr' = 'ra2', middles: string[] = []) {
  const source = { id: 'objects-source', profile, sha256: hash(map) };
  const layers: RuntimeIniLayer[] = [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(rules), bytes: bytes(rules) },
    ...middles.map((text, i) => ({ id: `mod-${i}`, profile, order: 10 + i, kind: 'mod' as const, sourceSha256: hash(text), bytes: bytes(text) })),
    { id: 'mission-layer', profile, order: 100, kind: 'map', sourceSha256: source.sha256, bytes: bytes(map) }];
  return { objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }), rules: compileRuntimeIni(profile, layers) };
}
const registry = (result: ReturnType<typeof assembleScenarioDefinitions>, kind: string) => result.registries.find(r => r.kind === kind)!.entries;
test('both profiles construct all six families and literal house indices using source order, never numeric keys', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const result = assembleScenarioDefinitions(input(mission, base, profile));
    assert.equal(result.identityComplete, true); assert.equal(result.canStartCampaign, false); assert.equal(result.nativeBehaviorVerified, false);
    assert.equal(result.placements.length, 6); assert.ok(result.registries.every(r => r.entries.length === 1));
    assert.deepEqual(result.countries.map(c => [c.name, c.index]), [['BlueCountry', 0], ['RedCountry', 1]]);
    assert.deepEqual(result.houses.map(h => [h.name, h.id, h.index]), [['BlueHouse', 'houses:9', 0], ['RedHouse', 'houses:1', 1]]);
    assert.equal(result.placements.find(p => p.rowId === 'units:0')!.owner.houseIndex, 0);
    assert.equal(registry(result, 'unit')[0]!.id, 'type:unit:tank');
    assert.ok(result.placements.filter(p => p.rowId.startsWith('terrain:') || p.rowId.startsWith('smudge:')).every(p => p.owner.status === 'none'));
  }
});
test('overwritten numeric registrations append without erasing earlier types; casefold repeats keep first allocation', () => {
  const map = mission + '[BuildingTypes]\n10=NEW\n12=hq\n[NEW]\nStrength=40\n[HQ]\nStrength=50\n';
  const result = assembleScenarioDefinitions(input(map, base, 'yr', ['[BuildingTypes]\n10=MID\n[MID]\nStrength=35\n']));
  assert.deepEqual(registry(result, 'structure').map(t => [t.name, t.index]), [['HQ', 0], ['MID', 1], ['NEW', 2]]);
  const hq = registry(result, 'structure')[0]!; assert.equal(hq.registrations.length, 2);
  assert.equal(hq.fields[0]!.value, '50'); assert.equal(hq.fields[0]!.shadowed[0]!.rawValue, '30');
  assert.equal(hq.registrations[0]!.layerId, 'rules'); assert.equal(hq.registrations[1]!.layerId, 'mission-layer');
  assert.equal(result.placements.find(p => p.rowId === 'structures:0')!.typeIndex, 0);
});
test('late registration never retroactively loads an earlier section; each later section load preserves history', () => {
  const rules = base.replace('10=HQ', '10=OTHER') + '[LATE]\nStrength=999\n';
  const map = mission.replace('BlueHouse,HQ', 'BlueHouse,LATE') + '[BuildingTypes]\n0=LATE\n[LATE]\nImage=NewImage\n';
  const result = assembleScenarioDefinitions(input(map, rules));
  const late = registry(result, 'structure').find(t => t.name === 'LATE')!;
  assert.equal(late.definitionStages.length, 1); assert.deepEqual(late.fields.map(f => f.key), ['Image']);
  assert.equal(late.fields[0]!.selected.layerId, 'mission-layer');
});
test('owner lookup is case-sensitive and cannot fall back to country aliases, IDs or similarly named sections', () => {
  const map = mission.replace('BlueHouse,INF', 'bluehouse,INF').replace('BlueHouse,TANK', 'BlueCountry,TANK');
  const result = assembleScenarioDefinitions(input(map, base + '[UnusedHouse]\nCountry=BlueCountry\n'));
  assert.equal(result.placements.find(p => p.rowId === 'infantry:0')!.owner.status, 'missing');
  assert.equal(result.placements.find(p => p.rowId === 'units:0')!.owner.status, 'missing');
  assert.equal(result.identityComplete, false);
  const same = assembleScenarioDefinitions(input(mission.replaceAll('BlueHouse', 'BlueCountry')));
  assert.equal(same.placements.find(p => p.rowId === 'units:0')!.owner.status, 'house');
  assert.equal(same.houses[0]!.country.id, 'country:bluecountry');
});
test('house Country uses mission-only fields: missing or explicit empty selects zero, unknown nonempty creates a new type', () => {
  for (const value of ['', 'Country=\n']) {
    const map = mission.replace('Country=BlueCountry\n', value);
    const result = assembleScenarioDefinitions(input(map, base + '[BlueHouse]\nCountry=RedCountry\n'));
    assert.equal(result.houses[0]!.country.status, 'default-zero'); assert.equal(result.houses[0]!.country.index, 0);
    assert.equal(result.houses[0]!.country.raw, value ? '' : null);
  }
  const result = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', 'Country=NewCountry'), base + '[NewCountry]\nName=TooEarly\n'));
  const newCountry = result.countries.at(-1)!;
  assert.equal(newCountry.name, 'NewCountry'); assert.equal(newCountry.index, 2); assert.equal(newCountry.allocation, 'house-country');
  assert.equal(newCountry.alias.value, 'NewCountry'); assert.equal(newCountry.parentCountry.status, 'constructor');
  assert.equal(newCountry.fields.length, 0); assert.equal(result.houses[0]!.country.status, 'implicit');
});
test('country aliases update after each registration stage and first array match wins over a later ID', () => {
  const map = mission.replace('Country=BlueCountry', 'Country=RedCountry') + '[BlueCountry]\nName=RedCountry\n';
  const result = assembleScenarioDefinitions(input(map));
  assert.equal(result.houses[0]!.country.id, 'country:bluecountry');
  assert.equal(result.countries[0]!.alias.origin!.layerId, 'mission-layer');
  const oldAlias = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', 'Country=Blue Alias')));
  assert.equal(oldAlias.houses[0]!.country.id, 'country:bluecountry');
  const superseded = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', 'Country=Blue Alias') + '[BlueCountry]\nName=Changed\n'));
  assert.equal(superseded.houses[0]!.country.status, 'implicit'); assert.equal(superseded.countries.at(-1)!.name, 'Blue Alias');
});
test('ParentCountry is an identity reference only; missing later key resets to self only when section exists', () => {
  const rules = base.replace('Name=Blue Alias', 'Name=Blue Alias\nParentCountry=RedCountry');
  const unchanged = assembleScenarioDefinitions(input(mission, rules));
  assert.equal(unchanged.countries[0]!.parentCountry.targetId, 'country:redcountry');
  assert.equal(unchanged.countries[0]!.parentCountry.status, 'reference');
  assert.equal(unchanged.countries[0]!.fields.find(f => f.key === 'Side')!.value, 'First');
  const reset = assembleScenarioDefinitions(input(mission + '[BlueCountry]\nName=Kept\n', rules));
  assert.equal(reset.countries[0]!.parentCountry.value, 'BlueCountry'); assert.equal(reset.countries[0]!.parentCountry.status, 'self');
  // Raw input property remains historical, separately from the native field's missing-key reset rule.
  assert.equal(reset.countries[0]!.fields.find(f => f.key === 'ParentCountry')!.value, 'RedCountry');
});
test('no map house list creates one house per country; base house lists are not map declarations', () => {
  const map = mission.replace('[Houses]\n9=BlueHouse\n1=RedHouse\n', '').replaceAll('BlueHouse,', 'BlueCountry,');
  const result = assembleScenarioDefinitions(input(map, base + '[Houses]\n0=Ignored\n'));
  assert.equal(result.houses.length, 2); assert.ok(result.houses.every(h => h.allocation === 'country-fallback'));
  assert.equal(result.placements.find(p => p.rowId === 'infantry:0')!.owner.houseId, 'house:fallback:0');
});
test('terrain placement can allocate a constructor identity, but other families never allocate from a matching section', () => {
  const map = mission.replace('2002=TREE', '2002=NEW_TREE').replace('BlueHouse,AIR', 'BlueHouse,UNLISTED') + '[NEW_TREE]\nStrength=999\n[UNLISTED]\nStrength=888\n';
  const result = assembleScenarioDefinitions(input(map));
  const terrain = registry(result, 'terrain').at(-1)!;
  assert.equal(terrain.allocation, 'terrain-placement'); assert.equal(terrain.name, 'NEW_TREE'); assert.equal(terrain.fields.length, 0);
  assert.equal(result.placements.find(p => p.rowId === 'terrain:2002')!.typeStatus, 'implicit');
  assert.equal(result.placements.find(p => p.rowId === 'aircraft:0')!.typeStatus, 'missing');
  const wrong = assembleScenarioDefinitions(input(mission.replace('BlueHouse,INF', 'BlueHouse,TANK')));
  assert.equal(wrong.placements.find(p => p.rowId === 'infantry:0')!.typeStatus, 'wrong-family');
});
test('truncation, special selectors and missing parent identities are explicit unsupported diagnostics', () => {
  for (const country of ['<random>', '<Player @ A>', 'N'.repeat(25)]) {
    const result = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', `Country=${country}`)));
    assert.equal(result.houses[0]!.country.status, 'unsupported'); assert.equal(result.identityComplete, false);
  }
  const name = 'A'.repeat(20), result = assembleScenarioDefinitions(input(mission.replaceAll('BlueHouse', name)));
  assert.ok(result.diagnostics.some(d => d.code === 'unsupported-house-name')); assert.equal(result.placements.length, 6);
  const bad = assembleScenarioDefinitions(input(mission, base.replace('8=INF', `8=${'I'.repeat(25)}`).replace('Name=Blue Alias', 'Name=Blue Alias\nParentCountry=Absent')));
  assert.ok(bad.diagnostics.some(d => d.code === 'unsupported-registration-name'));
  assert.ok(bad.diagnostics.some(d => d.code === 'parent-country-missing'));
});
test('empty and none registry rows allocate nothing; hostile ordinary identifiers are safe data', () => {
  const result = assembleScenarioDefinitions(input(mission.replaceAll('INF', 'constructor'), base.replaceAll('INF', 'constructor') + '[Extra]\nconstructor=x\n', 'yr', ['[VehicleTypes]\n3=\n4=none\n5=<none>\n6=__proto__\n[__proto__]\nconstructor=value\n']));
  assert.equal(result.identityComplete, true); assert.equal(registry(result, 'unit').length, 2);
  assert.equal(registry(result, 'unit')[1]!.fields[0]!.key, 'constructor'); assert.equal(registry(result, 'infantry')[0]!.name, 'constructor');
  assert.equal(result.diagnostics.filter(d => d.code === 'ignored-empty-registration').length, 3);
});
test('same-stage duplicate registry keys or sections reject rather than invent native tie resolution', () => {
  for (const text of ['[BuildingTypes]\n0=A\n0=B\n', '[BuildingTypes]\n0=A\n[BuildingTypes]\n1=B\n']) {
    assert.throws(() => assembleScenarioDefinitions(input(mission, base, 'ra2', [text])), /construction-repeated/);
  }
});
test('source, profile, logical stage and consumed map origin mismatches reject', () => {
  const value = input();
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: input(mission, base, 'yr').rules }), /construction-profile/);
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: input(mission + ';altered\n').rules }), /construction-map-identity/);
  const wrongStage = Object.freeze({ ...value.rules, layers: Object.freeze([...value.rules.layers].reverse()) });
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: wrongStage }), /construction-stage/);
  const p = value.objects.placements[0]!, wrongPlacement = Object.freeze({ ...p, type: 'Forged' });
  const objects = Object.freeze({ ...value.objects, placements: Object.freeze([wrongPlacement, ...value.objects.placements.slice(1)]) });
  assert.throws(() => assembleScenarioDefinitions({ ...value, objects }), /construction-placement-fields/);
  const bad = Object.freeze({ ...value.rules, entries: Object.freeze(value.rules.entries.map((e, i) => i ? e : Object.freeze({ ...e, selected: Object.freeze({ ...e.selected, sourceSha256: 'f'.repeat(64) }) }))) });
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: bad }), /construction-entry-origin/);
});
test('frozen data ownership, getters/cycles and count/work caps reject before returning partial results', () => {
  const value = input(), before = JSON.stringify(value);
  for (const cap of [{ stages: 0 }, { occurrences: 1 }, { registrations: 1 }, { definitions: 0 }, { fields: 0 }, { houses: 1 }, { placements: 1 }, { work: 1 }, { nodes: 10 }, { characters: 10 }]) {
    assert.throws(() => assembleScenarioDefinitions(value, cap), /construction-/); assert.equal(JSON.stringify(value), before);
  }
  assert.throws(() => assembleScenarioDefinitions(value, { work: SCENARIO_CONSTRUCTION_LIMITS.work + 1 }), /construction-limit/);
  let invoked = false; const accessed = Object.freeze({ ...value.rules, get marker() { invoked = true; return 1; } });
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: accessed }), /construction-input-property/); assert.equal(invoked, false);
  assert.throws(() => assembleScenarioDefinitions({ ...value, objects: { ...value.objects } }), /construction-immutable-input/);
  const result = assembleScenarioDefinitions(value);
  assert.throws(() => { (result.houses as unknown as unknown[]).push(1); }, TypeError);
  const reordered = Object.freeze({ ...value.objects, houses: Object.freeze([...value.objects.houses].reverse()), placements: Object.freeze([...value.objects.placements].reverse()) });
  assert.deepEqual(assembleScenarioDefinitions({ ...value, objects: reordered }), result);
});
test('native section/key spelling stays distinct from casefold type IDs, including separate case variants', () => {
  const map = mission + '[InfantryTypes]\n1=inf\n[inf]\nImage=WrongSection\n[INF]\nstrength=20\n';
  const rules = base + '[Inf]\nWarheadOnly=yes\n';
  const result = assembleScenarioDefinitions(input(map, rules));
  const inf = registry(result, 'infantry')[0]!;
  assert.equal(inf.name, 'INF'); assert.equal(inf.registrations.length, 2);
  assert.deepEqual(inf.fields.map(f => [f.key, f.value]), [['Strength', '10'], ['strength', '20']]);
  assert.equal(inf.definitionStages.length, 2); assert.equal(result.identityComplete, true);
  const caseKeys = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', 'country=RedCountry')));
  assert.equal(caseKeys.houses[0]!.country.status, 'default-zero');
  const wrongRegistry = assembleScenarioDefinitions(input(mission, base.replace('[InfantryTypes]', '[infantrytypes]')));
  assert.equal(wrongRegistry.placements.find(p => p.rowId === 'infantry:0')!.typeStatus, 'missing');
});
test('same exact definition section or key repeats reject, while different case keys stay raw', () => {
  for (const extra of ['[INF]\nExtra=2\n', '[INF]\nStrength=2\nStrength=3\n']) {
    assert.throws(() => assembleScenarioDefinitions(input(mission, base + extra)), /construction-repeated/);
  }
  const distinct = assembleScenarioDefinitions(input(mission, base.replace('Strength=10', 'Strength=10\nstrength=20')));
  assert.deepEqual(registry(distinct, 'infantry')[0]!.fields.map(f => f.key), ['Strength', 'strength']);
});
test('four General building references allocate in native field order, load current fields and do not reload earlier stages', () => {
  const rules = base + '[LATE_GATE]\nStrength=TooEarly\n[General]\nNodGateTwo=D\nNodGateOne=C\nGDIGateTwo=B\nGDIGateOne=A\n[A]\nStrength=11\n';
  const map = mission + '[General]\nGDIGateOne=LATE_GATE\n[LATE_GATE]\nImage=AtAllocation\n';
  const result = assembleScenarioDefinitions(input(map, rules));
  assert.deepEqual(registry(result, 'structure').map(t => t.name), ['HQ', 'A', 'B', 'C', 'D', 'LATE_GATE']);
  const first = registry(result, 'structure')[1]!, late = registry(result, 'structure').at(-1)!;
  assert.equal(first.allocation, 'general-reference'); assert.equal(first.allocationOrigin.keySpelling, 'GDIGateOne');
  assert.equal(first.fields[0]!.value, '11'); assert.deepEqual(late.fields.map(f => f.key), ['Image']);
  assert.equal(result.indexScope, 'modeled-allocation-order');
  const duplicate = rules.replace('GDIGateOne=A', 'GDIGateOne=A\nGDIGateOne=B');
  assert.throws(() => assembleScenarioDefinitions(input(mission, duplicate)), /construction-repeated-general-reference/);
  assert.throws(() => assembleScenarioDefinitions(input(map, rules), { work: 40 }), /construction-work-limit/);
});
test('known long country aliases resolve, but unknown aliases cannot be silently truncated into new IDs', () => {
  const alias = 'Alias '.repeat(5).trim();
  const result = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', `Country=${alias}`), base.replace('Name=Blue Alias', `Name=${alias}`)));
  assert.equal(result.houses[0]!.country.status, 'lookup'); assert.equal(result.houses[0]!.country.id, 'country:bluecountry');
  const absent = assembleScenarioDefinitions(input(mission.replace('Country=BlueCountry', `Country=${alias}`)));
  assert.equal(absent.houses[0]!.country.status, 'unsupported'); assert.equal(absent.countries.length, 2);
});
test('forged origin occurrence and before-header placement reject even on deeply frozen inputs', () => {
  const value = input();
  for (const change of [{ sectionOccurrence: 999 }, { keyOccurrence: -1 }, { line: 1 }]) {
    const entries = Object.freeze(value.rules.entries.map((e, i) => i ? e : Object.freeze({ ...e, selected: Object.freeze({ ...e.selected, ...change }) })));
    assert.throws(() => assembleScenarioDefinitions({ ...value, rules: Object.freeze({ ...value.rules, entries }) }), /construction-entry-origin/);
  }
});
test('later Countries key replacement preserves earlier allocation and Name updates only from existing allocated-ID sections', () => {
  const map = mission + '[Countries]\n9=GreenCountry\n10=bluecountry\n[GreenCountry]\nName=Green Alias\n[bluecountry]\nName=WrongCase\n';
  const result = assembleScenarioDefinitions(input(map));
  assert.deepEqual(result.countries.map(c => [c.name, c.index]), [['BlueCountry', 0], ['RedCountry', 1], ['GreenCountry', 2]]);
  assert.equal(result.countries[0]!.registrations.length, 2); assert.equal(result.countries[0]!.alias.value, 'Blue Alias');
  assert.equal(result.houses[0]!.country.index, 0); assert.equal(result.identityComplete, true);
  assert.equal(result.countries[2]!.definitionStages.length, 1);
});

test('placement source sections require exact native case and reject repeated exact sections before identity closure', () => {
  assert.throws(() => assembleScenarioDefinitions(input(mission.replace('[Units]', '[units]'))), /construction-placement-section/);
  assert.throws(() => assembleScenarioDefinitions(input(mission + '[Units]\n1=BlueHouse,TANK,256,2,2,0,Guard,None\n')), /construction-repeated-section/);
  const value = input(), first = value.objects.placements[0]!;
  const row = Object.freeze({ ...first.row, origin: Object.freeze({ ...first.row.origin, sectionSpelling: first.row.origin.sectionSpelling.toLowerCase() }) });
  const objects = Object.freeze({ ...value.objects, placements: Object.freeze([Object.freeze({ ...first, row }), ...value.objects.placements.slice(1)]) });
  assert.throws(() => assembleScenarioDefinitions({ ...value, objects }), /construction-object-origin/);
});
test('shared source view rejects an origin moved beyond another header even if its earlier declared header exists', () => {
  const value = input();
  const entries = Object.freeze(value.rules.entries.map(e => e.section !== 'inf' || e.key !== 'strength' ? e :
    Object.freeze({ ...e, selected: Object.freeze({ ...e.selected, line: base.split('\n').length + 1 }) })));
  assert.throws(() => assembleScenarioDefinitions({ ...value, rules: Object.freeze({ ...value.rules, entries }) }), /construction-entry-origin/);
});
