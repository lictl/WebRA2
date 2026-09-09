// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic definitions/maps. No retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileEntityDefinitions, isEntityDefinitions, ENTITY_DEFINITIONS_LIMITS } from '../../packages/content/src/entity-definitions.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
const rulesText = `[Countries]\n0=Blue\n[Blue]\nName=Azure\n[General]\nTreeStrength=40\n[InfantryTypes]\n0=INF\n[VehicleTypes]\n0=TANK\n[AircraftTypes]\n0=AIR\n[BuildingTypes]\n0=HQ\n[TerrainTypes]\n0=TREE\n[SmudgeTypes]\n0=MARK\n[INF]\nStrength=7\nSpeed=4\nMovementZone=Infantry\nLocomotor={4A582744-9839-11d1-B709-00A024DDAFD1}\n[TANK]\nStrength=100\nSpeed=35.9\nArmor=Heavy\nSize=2.01\nPrimary=Bolt\n[AIR]\nStrength=100\n[HQ]\nStrength=100\n[TREE]\nName=Synthetic tree\n[MARK]\nWidth=2\n[Bolt]\nDamage=1\n`;
const mapText = `[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Infantry]\n0=Player,INF,255,2,2,2,Guard,0,None\n[Units]\n0=Player,TANK,128,2,2,0,Guard,None\n[Aircraft]\n0=Player,AIR,1,2,2,0,Guard,None\n[Structures]\n0=Player,HQ,0,2,2,0,None\n[Terrain]\n2002=TREE\n[Smudge]\n0=MARK,2,2,0\n`;
const artText = '[HQ]\nFoundation=2x2\n[TREE]\nFoundation=1x2\n';
const bytes = (s: string) => new TextEncoder().encode(s);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function fixture({ rules = rulesText, map = mapText, art = artText, profile = 'ra2' as 'ra2' | 'yr', middle = [] as string[], artMiddle = [] as string[] } = {}) {
  const source = { id: 'original-synthetic-map', profile, sha256: hash(map) };
  const layers: RuntimeIniLayer[] = [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(rules), bytes: bytes(rules) },
    ...middle.map((s, i) => ({ id: `rules-mod-${i}`, profile, order: i + 1, kind: 'mod' as const, sourceSha256: hash(s), bytes: bytes(s) })),
    { id: 'map', profile, order: 100, kind: 'map', sourceSha256: source.sha256, bytes: bytes(map) }];
  return { objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }), rules: compileRuntimeIni(profile, layers),
    art: compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: hash(art), bytes: bytes(art) },
      ...artMiddle.map((s, i) => ({ id: `art-mod-${i}`, profile, order: i + 1, kind: 'mod' as const, sourceSha256: hash(s), bytes: bytes(s) }))]) };
}
const definition = (r: ReturnType<typeof compileEntityDefinitions>, kind: string) => r.definitions.find(t => t.kind === kind)!;
function frozen<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(frozen); Object.freeze(v); } return v; }

test('both profiles expose typed six-family definitions and literal owners with native initial-health scaling', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileEntityDefinitions(fixture({ profile }));
    assert.equal(r.coverage.identityComplete, true); assert.equal(r.coverage.placedTypes, 6);
    assert.deepEqual(Object.fromEntries(r.placements.map(p => [p.rowId, p.initialHealth.value])),
      { 'infantry:0': 7, 'units:0': 50, 'aircraft:0': 1, 'structures:0': 0, 'terrain:2002': null, 'smudge:0': null });
    assert.equal(r.placements.find(p => p.rowId === 'units:0')!.ownerId, 'houses:0'); assert.equal(r.canStartCampaign, false);
    assert.equal(definition(r, 'unit').armor.value, 5); assert.equal(definition(r, 'unit').primary.value, 'weapon:bolt');
    assert.equal(definition(r, 'terrain').strength.value, 40); assert.equal(definition(r, 'terrain').armor.value, 6);
    assert.equal(definition(r, 'smudge').smudgeWidth.value, 2); assert.equal(definition(r, 'smudge').smudgeHeight.value, 1);
    assert.equal(definition(r, 'aircraft').speedType.value, 4);
    assert.equal(definition(r, 'infantry').locomotor.value!.kind, 'walk'); assert.equal(definition(r, 'infantry').movementZone.value, 7);
    assert.equal(r.nativeExecutionVerified, false); assert.ok(r.requiredRuntimeWork.includes('cell-occupancy-and-subcells'));
  }
});
test('speed uses integer parsing, clamp and native 256/100 scale; -1 retains a prior staged value', () => {
  assert.equal(definition(compileEntityDefinitions(fixture()), 'unit').speed.value, 89);
  for (const [value, expected] of [['100', 255], ['1000', 255], ['-2', 0], ['0', 0], ['4.99', 10], ['1e3', 2], ['$10', 40], ['10h', 40]] as const) {
    const r = compileEntityDefinitions(fixture({ map: mapText + `[TANK]\nSpeed=${value}\n` })); assert.equal(definition(r, 'unit').speed.value, expected);
  }
  const retained = definition(compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nSpeed=-1\n' })), 'unit');
  assert.equal(retained.speed.value, 89); assert.equal(retained.speed.history.at(-1)!.rawValue, '-1');
});
test('unit speed-type fallback observes Crusher when first loaded and explicit rereads override it', () => {
  assert.equal(definition(compileEntityDefinitions(fixture()), 'unit').speedType.value, 2);
  assert.equal(definition(compileEntityDefinitions(fixture({ rules: rulesText.replace('Speed=35.9', 'Speed=35.9\nCrusher=yes') })), 'unit').speedType.value, 1);
  // A later Crusher change does not reinitialize an already assigned SpeedType.
  assert.equal(definition(compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nCrusher=yes\n' })), 'unit').speedType.value, 2);
  assert.equal(definition(compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nCrusher=yes\nSpeedType=Hover\n' })), 'unit').speedType.value, 3);
});
test('decimal scalars round through float32 and keep Size separate from PhysicalSize', () => {
  const r = compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nPhysicalSize=0.5%\n' })), t = definition(r, 'unit');
  assert.equal(t.transportSize.value, Math.fround(2.01)); assert.notEqual(t.transportSize.value, 2.01);
  assert.equal(t.physicalSize.value, Math.fround(0.5) * 0.01); assert.equal(t.transportSize.rule, 'bounded-float32-webra2');
  const defaults = definition(r, 'aircraft'); assert.equal(defaults.physicalSize.value, 2); assert.equal(defaults.transportSize.value, 1);
});
test('building Foundation reads Image then nonzero ID fallback, while terrain uses Image only', () => {
  const rules = rulesText.replace('[HQ]\nStrength', '[HQ]\nImage=ArtA\nStrength').replace('[TREE]\nName', '[TREE]\nImage=ArtA\nName');
  const art = '[HQ]\nFoundation=1x1\n[TREE]\nFoundation=4x4\n[ArtA]\nFoundation=2x3\n[ArtB]\nFoundation=4x2\n';
  const a = compileEntityDefinitions(fixture({ rules, art }));
  assert.equal(definition(a, 'structure').foundation.value!.nativeIndex, 4);
  assert.equal(definition(a, 'terrain').foundation.value!.nativeIndex, 4);
  const b = compileEntityDefinitions(fixture({ rules, art, map: mapText + '[HQ]\nImage=ArtB\n' }));
  assert.deepEqual([definition(b, 'structure').foundation.value!.width, definition(b, 'structure').foundation.value!.height], [4, 2]);
  const c = compileEntityDefinitions(fixture({ rules, art: art.replace('Foundation=1x1', 'Foundation=3x3Refinery') }));
  assert.equal(definition(c, 'structure').foundation.value!.shape, 'refinery'); assert.equal(definition(c, 'structure').foundation.value!.occupancyVerified, false);
});
test('native exact field/section case and first allocated type spelling survive folded runtime input', () => {
  const r = compileEntityDefinitions(fixture({ rules: rulesText + '[Tank]\nStrength=999\n', map: mapText + '[TANK]\nstrength=999\n' }));
  assert.equal(definition(r, 'unit').strength.value, 100);
  const art = artText + '[hq]\nFoundation=4x4\n';
  assert.equal(definition(compileEntityDefinitions(fixture({ art })), 'structure').foundation.value!.nativeIndex, 3);
  const alias = compileEntityDefinitions(fixture({ rules: rulesText.replace('0=TANK', '0=tank') }));
  assert.equal(definition(alias, 'unit').strength.value, 0); assert.equal(definition(alias, 'unit').strength.status, 'default');
});
test('late registration does not read earlier fields, and TreeStrength fallback occurs only at the first sentinel load', () => {
  const rules = rulesText.replace('0=TANK', '0=OTHER');
  const map = mapText + '[VehicleTypes]\n0=TANK\n[TANK]\nArmor=Light\n[General]\nTreeStrength=90\n[TREE]\nName=Later\n';
  const r = compileEntityDefinitions(fixture({ rules, map }));
  assert.equal(r.definitions.find(t => t.id === 'type:unit:tank')!.strength.value, 0);
  assert.equal(definition(r, 'terrain').strength.value, 40);
  const reset = compileEntityDefinitions(fixture({ map: mapText + '[General]\nTreeStrength=90\n[TREE]\nStrength=-1\n' }));
  assert.equal(definition(reset, 'terrain').strength.value, 90);
});
test('invalid conversions remain explicit unsupported fields without fabricated native defaults', () => {
  const r = compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nStrength=2147483648\nArmor=Unlisted\nSize=NaN\nLocomotor={00000000-0000-0000-0000-000000000000}\n[HQ]\nFoundation=99x99\n', art: '[HQ]\nFoundation=99x99\n' }));
  const t = definition(r, 'unit'); assert.equal(t.strength.status, 'unsupported'); assert.equal(t.armor.status, 'unsupported');
  assert.equal(t.transportSize.status, 'unsupported'); assert.equal(t.locomotor.status, 'unsupported'); assert.equal(t.locomotor.value!.kind, null);
  assert.equal(r.placements.find(p => p.rowId === 'units:0')!.initialHealth.status, 'unsupported'); assert.equal(definition(r, 'structure').foundation.status, 'unsupported');
  assert.ok(r.diagnostics.some(d => d.code === 'unsupported-locomotor-class'));
});
test('missing or empty weapon keys retain prior pointers and none clears them, with every read origin retained', () => {
  const r = compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nPrimary=\nSecondary=<none>\n' })), t = definition(r, 'unit');
  assert.equal(t.primary.value, 'weapon:bolt'); assert.equal(t.primary.history.length, 2);
  assert.equal(t.secondary.value, null); assert.equal(t.secondary.status, 'explicit');
  assert.equal(definition(compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nPrimary=none\n' })), 'unit').primary.value, null);
});
test('consumed repeated art sections/keys fail instead of selecting a duplicate; explicit art layers remain ordered', () => {
  assert.throws(() => compileEntityDefinitions(fixture({ art: artText + '[HQ]\nOther=1\n' })), /repeated-art-section/);
  assert.throws(() => compileEntityDefinitions(fixture({ art: artText + '[HQ]\n' })), /repeated-art-section/);
  assert.throws(() => compileEntityDefinitions(fixture({ art: artText.replace('Foundation=2x2', 'Foundation=2x2\nFoundation=3x3') })), /repeated-consumed-key/);
  const r = compileEntityDefinitions(fixture({ artMiddle: ['[HQ]\nFoundation=4x4\n'] }));
  assert.equal(definition(r, 'structure').foundation.value!.width, 4); assert.equal(definition(r, 'structure').foundation.origin!.layerId, 'art-mod-0');
  assert.deepEqual(definition(r, 'structure').foundation.history.map(o => o.layerId), ['art', 'art-mod-0', 'art', 'art-mod-0']);
});
test('bounds cover overwritten source history, field work, serialized bytes and type counts', () => {
  const input = fixture({ middle: ['[TANK]\nStrength=99\n', '[TANK]\nStrength=98\n'] });
  for (const key of ['stages', 'occurrences', 'types', 'placements', 'fieldReads', 'diagnostics', 'characters', 'nodes', 'history', 'serializedBytes'] as const) {
    const target = key === 'diagnostics' ? fixture({ map: mapText + '[TANK]\nArmor=Invalid\n' }) : input;
    assert.throws(() => compileEntityDefinitions(target, { [key]: 0 }), /./, key);
    assert.throws(() => compileEntityDefinitions(input, { [key]: ENTITY_DEFINITIONS_LIMITS[key] + 1 }), /limit/);
  }
});
test('frozen input projections and profile joins are verified without invoking accessors', () => {
  const input = fixture(), cloned = structuredClone(input);
  (cloned.objects.placements.find(p => p.row.id === 'units:0') as { strengthRaw: number }).strengthRaw = 1;
  assert.throws(() => compileEntityDefinitions(frozen(cloned)), /placement-strength/);
  const other = fixture({ profile: 'yr' }); assert.throws(() => compileEntityDefinitions({ ...input, art: other.art }), /profile/);
  let calls = 0; const bad = { ...input, art: Object.freeze({ get profile() { calls++; return 'ra2'; } }) };
  assert.throws(() => compileEntityDefinitions(bad as unknown as typeof input), /profile/); assert.equal(calls, 0);
});
test('canonical fingerprint is independently reproducible, immutable and sensitive to otherwise unused source changes', () => {
  const r = compileEntityDefinitions(fixture());
  function sorted(v: unknown): unknown { return Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, sorted(x)])) : v; }
  const { fingerprint, ...body } = r; assert.equal(fingerprint, hash(JSON.stringify(sorted(body))));
  assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.definitions)); assert.ok(Object.isFrozen(r.definitions[0]!.strength.history));
  assert.equal(compileEntityDefinitions(fixture()).fingerprint, fingerprint);
  const changed = compileEntityDefinitions(fixture({ art: artText + '[Unused]\nValue=1\n' }));
  const values = (list: typeof r.definitions) => list.map(d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && typeof v === 'object' && 'value' in v ? v.value : v])));
  assert.deepEqual(values(changed.definitions), values(r.definitions)); assert.notEqual(changed.fingerprint, fingerprint);
});

test('MovementZone CrusherAll is YR-only; neighboring RA2 table data is not an accepted enum', () => {
  const map = mapText + '[TANK]\nMovementZone=CrusherAll\n';
  const ra2 = definition(compileEntityDefinitions(fixture({ map, profile: 'ra2' })), 'unit');
  const yr = definition(compileEntityDefinitions(fixture({ map, profile: 'yr' })), 'unit');
  assert.equal(ra2.movementZone.status, 'unsupported'); assert.equal(ra2.movementZone.value, null);
  assert.equal(yr.movementZone.status, 'explicit'); assert.equal(yr.movementZone.value, 12);
});

test('ambiguous float32 halfway conversions are unsupported while factory identity cannot be cloned', () => {
  for (const value of ['1.000000059604644775390625', '1.000000178813934326171875', '1.000000178813934326171875%']) {
    const r = compileEntityDefinitions(fixture({ map: mapText + `[TANK]\nSize=${value}\n` }));
    assert.equal(definition(r, 'unit').transportSize.status, 'unsupported');
  }
  const r = compileEntityDefinitions(fixture()); assert.equal(isEntityDefinitions(r), true);
  assert.equal(isEntityDefinitions(frozen(structuredClone(r))), false); assert.equal(isEntityDefinitions({ ...r }), false);
  assert.equal(isEntityDefinitions(null), false); assert.equal(isEntityDefinitions(Object.create(r)), false);
});
test('health keeps strict near-full snap and mobile minimum distinct from structure zero', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    for (const [raw, expected] of [[0, 1], [248, 96], [249, 97], [251, 100]] as const) {
      const map = mapText.replace('Player,TANK,128', `Player,TANK,${raw}`);
      const r = compileEntityDefinitions(fixture({ profile, map }));
      assert.equal(r.placements.find(p => p.rowId === 'units:0')!.initialHealth.value, expected);
      assert.equal(r.placements.find(p => p.rowId === 'structures:0')!.initialHealth.value, 0);
    }
  }
});

test('numbered weapon slots follow staged turret/count selection and ClearAllWeapons', () => {
  const rules = rulesText.replace('Primary=Bolt', 'Primary=Bolt\nSecondary=Backup');
  const map = mapText + '[TANK]\nTurretCount=2\nWeaponCount=2\nWeapon1=IndexedOne\nWeapon2=IndexedTwo\nPrimary=IgnoredOrdinary\n';
  const r = definition(compileEntityDefinitions(fixture({ rules, map })), 'unit');
  assert.equal(r.primary.value, 'weapon:indexedone'); assert.equal(r.secondary.value, 'weapon:indexedtwo');
  assert.equal(r.primary.origin!.keySpelling, 'Weapon1'); assert.ok(r.primary.history.some(o => o.keySpelling === 'TurretCount'));
  const one = definition(compileEntityDefinitions(fixture({ rules, map: map.replace('WeaponCount=2', 'WeaponCount=1') })), 'unit');
  assert.equal(one.primary.value, 'weapon:indexedone'); assert.equal(one.secondary.value, 'weapon:backup');
  const cleared = definition(compileEntityDefinitions(fixture({ rules, map: map + 'ClearAllWeapons=yes\n' })), 'unit');
  assert.equal(cleared.primary.value, null); assert.equal(cleared.secondary.value, null); assert.equal(cleared.primary.rule, 'clear-all-weapons');
  assert.equal(definition(compileEntityDefinitions(fixture({ map: mapText + '[TANK]\nTurretCount=1\n' })), 'unit').primary.status, 'unsupported');
  const capMap = map.replace('WeaponCount=2', 'WeaponCount=16');
  assert.equal(definition(compileEntityDefinitions(fixture({ map: capMap, profile: 'ra2' })), 'unit').primary.status, 'unsupported');
  assert.equal(definition(compileEntityDefinitions(fixture({ map: capMap, profile: 'yr' })), 'unit').primary.value, 'weapon:indexedone');
});
