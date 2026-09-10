// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic content; no retail rows or bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileCombatActors, isCombatActors, COMBAT_ACTORS_LIMITS } from '../../packages/content/src/combat-actors.ts';
const rulesText = `[Countries]\n0=Blue\n[Blue]\nName=Azure\n[General]\nTreeStrength=40\n[InfantryTypes]\n0=INF\n[VehicleTypes]\n0=TANK\n[AircraftTypes]\n0=AIR\n[BuildingTypes]\n0=HQ\n[TerrainTypes]\n0=TREE\n[SmudgeTypes]\n0=MARK\n[INF]\nStrength=7\nSpeed=4\nMovementZone=Infantry\nLocomotor={4A582744-9839-11d1-B709-00A024DDAFD1}\n[TANK]\nStrength=100\nSpeed=35.9\nArmor=Heavy\nSize=2.01\nPrimary=Bolt\n[AIR]\nStrength=100\n[HQ]\nStrength=100\n[TREE]\nName=Synthetic tree\n[MARK]\nWidth=2\n[Bolt]\nDamage=1\n`;
const mapText = `[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n1=Other\n[Other]\nCountry=Blue\n[Player]\nCountry=Blue\n[Infantry]\n0=Player,INF,255,2,2,2,Guard,0,None\n[Units]\n0=Player,TANK,128,2,2,0,Guard,None\n[Aircraft]\n0=Player,AIR,1,2,2,0,Guard,None\n[Structures]\n0=Player,HQ,0,2,2,0,None\n[Terrain]\n2002=TREE\n[Smudge]\n0=MARK,2,2,0\n`;
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

function actorInput(opts: Parameters<typeof fixture>[0] = {}) {
  const base = fixture(opts); const definitions = compileEntityDefinitions(base), map = opts.map ?? mapText;
  return { definitions, rules: base.rules, mission: { source: base.objects.source, bytes: bytes(map) } };
}
const def = (r: ReturnType<typeof compileCombatActors>, kind = 'unit') => r.definitions.find(d => d.kind === kind)!;

test('both profiles retain all six families and fresh placement/type/owner/health joins', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileCombatActors(actorInput({ profile }));
    assert(isCombatActors(r)); assert(!isCombatActors({ ...r })); assert(Object.isFrozen(r.placements[0]!.sourcePlacement.row.tokens));
    assert.equal(r.definitions.length, 6); assert.equal(r.placements.length, 6); assert.equal(r.coverage.identityComplete, true);
    const p = r.placements.find(p => p.rowId === 'units:0')!;
    assert.equal(p.ownerId, 'houses:0'); assert.equal(p.ownerIndex, 0); assert.equal(p.rawStrength, 128); assert.equal(p.initialHealth.value, 50);
    assert.equal(p.sourcePlacement.row.origin.rawValue, 'Player,TANK,128,2,2,0,Guard,None');
    assert.equal(def(r).startingAmmo.value, -1); assert.equal(def(r).fields.immune.value, false);
    assert.equal(def(r).fields.typeImmune.value, false); assert.equal(def(r).fields.weaponCount.status, 'unsupported');
    assert.equal(def(r, 'smudge').fields.immune.value, true); assert.equal(def(r, 'smudge').fields.immune.rule, 'native-smudge-constructor');
    assert.equal(def(r).normalSlots.mode, 'ordinary'); assert.equal(def(r, 'terrain').startingAmmo.status, 'not-applicable');
    assert.equal(r.coverage.initialAlliancesComplete, true); assert.deepEqual(r.directedAllies, []); assert.equal(r.canStartCampaign, false);
  }
});
test('starting ammunition selects exactly minus-one fallback without capacity clamping', () => {
  for (const [initial, capacity, expected] of [[-1, 8, 8], [0, 8, 0], [20, 8, 20], [-1, -1, -1]] as const) {
    const r = compileCombatActors(actorInput({ map: mapText + `[TANK]\nInitialAmmo=${initial}\nAmmo=${capacity}\n` }));
    assert.equal(def(r).startingAmmo.value, expected);
    assert.equal(def(r).startingAmmo.rule, initial === -1 ? 'initial-ammo-minus-one-selects-ammo' : 'initial-ammo-direct-no-clamp');
  }
  const x = def(compileCombatActors(actorInput({ map: mapText + '[TANK]\nInitialAmmo=-2\nAmmo=10\n' })));
  assert.equal(x.fields.initialAmmo.value, -2); assert.equal(x.startingAmmo.status, 'unsupported'); assert.equal(x.startingAmmo.value, null);
});
test('exact staged reads preserve empty defaults, raw histories and allocation-time source visibility', () => {
  const rules = rulesText.replace('Speed=35.9', 'Speed=35.9\nAmmo=9\nInitialAmmo=3\nImmune=yes\nTypeImmune=yes');
  const r = compileCombatActors(actorInput({ rules, middle: ['[TANK]\nInitialAmmo=-1\nAmmo=7 ; raw comment\n'], map: mapText + '[TANK]\nAmmo=\nImmune=no\n' }));
  const d = def(r); assert.equal(d.startingAmmo.value, 7); assert.equal(d.fields.immune.value, false); assert.equal(d.fields.typeImmune.value, true);
  assert.deepEqual(d.fields.ammo.history.map(o => o.rawValue), ['9', '7 ; raw comment', '']);
  assert.equal(d.fields.ammo.origin!.rawValue, '7 ; raw comment'); assert.equal(d.fields.ammo.history[2]!.sourceSha256, r.source.sha256);
  assert(d.rawFields.some(o => o.keySpelling === 'Speed'));
  const early = rulesText.replace('[VehicleTypes]\n0=TANK\n', '');
  const late = compileCombatActors(actorInput({ rules: early.replace('Speed=35.9', 'Speed=35.9\nAmmo=18'), map: mapText + '[VehicleTypes]\n0=TANK\n' }));
  assert.equal(def(late).startingAmmo.value, -1);
});
test('native current numeric/boolean parsing stays bounded and malformed modifiers remain unsupported', () => {
  const r = compileCombatActors(actorInput({ map: mapText + '[TANK]\nAmmo=$10\nInitialAmmo=10h\nImmune=perhaps\n' }));
  assert.equal(def(r).fields.ammo.value, 16); assert.equal(def(r).startingAmmo.value, 16); assert.equal(def(r).fields.immune.status, 'unsupported');
  const tooLong = compileCombatActors(actorInput({ map: mapText + '[TANK]\nAmmo=' + '1'.repeat(128) + '\n' }));
  assert.equal(def(tooLong).startingAmmo.status, 'unsupported');
});
test('conditional slot controls never silently choose an indexed, gunner, charge or gattling slot', () => {
  for (const field of ['TurretCount=2\nWeaponCount=3', 'Gunner=yes', 'IsChargeTurret=yes', 'IsGattling=yes']) {
    const d = def(compileCombatActors(actorInput({ profile: 'yr', map: mapText + `[TANK]\n${field}\n` })));
    assert.equal(d.normalSlots.mode, 'conditional'); assert(d.normalSlots.reasons.length > 0);
  }
  const clear = def(compileCombatActors(actorInput({ map: mapText + '[TANK]\nClearAllWeapons=yes\n' })));
  assert.equal(clear.normalSlots.mode, 'cleared');
  const unknown = def(compileCombatActors(actorInput({ map: mapText + '[TANK]\nTurretCount=invalid\n' })));
  assert.equal(unknown.normalSlots.mode, 'unsupported');
  const ra2 = def(compileCombatActors(actorInput({ map: mapText + '[TANK]\nIsGattling=yes\nUnknownModFlag=7\n' })));
  assert.equal(ra2.fields.isGattling.status, 'not-applicable'); assert(ra2.rawFields.some(o => o.keySpelling === 'UnknownModFlag'));
});
test('campaign alliances are directed exact names, with repeated and self tokens preserving source evidence', () => {
  const map = mapText.replace('[Player]\nCountry=Blue', '[Player]\nCountry=Blue\nAllies=Other,,Other,Player');
  const r = compileCombatActors(actorInput({ map })); assert.equal(r.coverage.initialAlliancesComplete, true);
  assert.equal(r.houses[0]!.allies.value, 3); assert.deepEqual(r.houses[0]!.tokens.map(t => t.raw), ['Other', 'Other', 'Player']);
  assert.deepEqual(r.directedAllies, [{ houseId: 'houses:0', allyHouseId: 'houses:1', houseIndex: 0, allyHouseIndex: 1 }]);
  assert.equal(r.houses[1]!.allies.value, 0); assert.equal(r.houses[0]!.allies.history[0]!.keySpelling, 'Allies');
});
test('unknown, case-varied, whitespace and truncated alliance names do not become implied enemy relations', () => {
  for (const value of ['other', 'Other, Player', 'Missing', 'Other '.repeat(30)]) {
    const map = mapText.replace('[Player]\nCountry=Blue', `[Player]\nCountry=Blue\nAllies=${value}`);
    const r = compileCombatActors(actorInput({ map }));
    assert.equal(r.coverage.initialAlliancesComplete, false); assert.equal(r.houses[0]!.allies.value, null); assert.equal(r.houses[0]!.status, 'unsupported');
  }
  const map = mapText.replace('[Player]\nCountry=Blue', '[Player]\nCountry=Blue\nallies=Other');
  const r = compileCombatActors(actorInput({ map })); assert.equal(r.houses[0]!.allies.value, 0); assert(r.houses[0]!.rawFields.some(o => o.keySpelling === 'allies'));
});
test('32-bit house masks reject index aliases, while bit31 remains an unsigned exact value', () => {
  const list = Array.from({ length: 32 }, (_, i) => `${i}=${i === 0 ? 'Player' : 'H'+i}`).join('\n');
  const sections = Array.from({ length: 31 }, (_, i) => `[H${i+1}]\nCountry=Blue`).join('\n');
  const map = mapText.replace('[Houses]\n0=Player\n1=Other\n[Other]\nCountry=Blue', `[Houses]\n${list}\n${sections}`).replace('[Player]\nCountry=Blue','[Player]\nCountry=Blue\nAllies=H31');
  const r = compileCombatActors(actorInput({ map })); assert.equal(r.houses[0]!.allies.value, 2147483648); assert.equal(r.directedAllies[0]!.allyHouseIndex, 31);
  const excessive = map.replace('[Houses]\n', '[Houses]\n32=Extra\n') + '[Extra]\nCountry=Blue\n';
  const x = compileCombatActors(actorInput({ map: excessive })); assert.equal(x.coverage.initialAlliancesComplete, false); assert.equal(x.directedAllies.length, 0);
});
test('fresh mission bytes, exact source views and genuine definition joins reject substitution', () => {
  const input = actorInput();
  assert.throws(() => compileCombatActors({ ...input, definitions: { ...input.definitions } }), /entity-brand/);
  assert.throws(() => compileCombatActors({ ...input, mission: { ...input.mission, bytes: bytes(mapText+'\n') } }), /mission-hash/);
  assert.throws(() => compileCombatActors({ ...input, mission: { ...input.mission, source: { ...input.mission.source, profile: 'yr' } } }), /mission-identity/);
  const alternate = actorInput({ rules: rulesText + '[OtherDefinition]\nAmmo=5\n' });
  assert.throws(() => compileCombatActors({ ...input, rules: alternate.rules }), /rules-identity/);
  const changed = JSON.parse(JSON.stringify(input.rules)); const row = changed.entries.find((e: { section: string; key: string }) => e.section === 'player' && e.key === 'country')!;
  row.value = 'Different'; row.selected.rawValue = 'Different';
  const freeze = (v: object): void => { Object.values(v).forEach(x => { if (x && typeof x === 'object') freeze(x); }); Object.freeze(v); }; freeze(changed);
  assert.throws(() => compileCombatActors({ ...input, rules: changed }), /mission-table-mismatch/);
});
test('owned source buffers, raw records and identities remain detached and canonical', () => {
  const input = actorInput(), r = compileCombatActors(input), again = compileCombatActors(actorInput());
  assert.equal(r.fingerprint, again.fingerprint); input.mission.bytes.fill(0); assert.equal(r.fingerprint, again.fingerprint);
  assert(Object.isFrozen(r.definitions[0]!.rawFields)); assert(Object.isFrozen(r.houses[0]!.allies));
  const changed = compileCombatActors(actorInput({ map: mapText + '[TANK]\nAmmo=9\n' })); assert.notEqual(r.fingerprint, changed.fingerprint);
});
test('lowered budgets fail before expansions and hostile accessors are never invoked', () => {
  const input = actorInput();
  for (const key of ['missionBytes','stages','occurrences','types','placements','houses','fields','rawFields','characters','nodes','work','serializedBytes'] as const)
    assert.throws(() => compileCombatActors(input, { [key]: 0 }));
  const allied = actorInput({ map: mapText.replace('[Player]\nCountry=Blue','[Player]\nCountry=Blue\nAllies=Other') });
  for (const key of ['history','tokens','pairs'] as const) assert.throws(() => compileCombatActors(allied, { [key]: 0 }));
  for (const value of [-1,-0,NaN,Infinity,COMBAT_ACTORS_LIMITS.types+1]) assert.throws(() => compileCombatActors(input, { types: value }), /limits/);
  let calls = 0; const bad = { ...input, get rules(): typeof input.rules { calls++; throw new Error('getter'); } };
  assert.throws(() => compileCombatActors(bad), /input/); assert.equal(calls, 0);
  const badBytes = new Uint8Array(input.mission.bytes); Object.defineProperty(badBytes,'byteLength',{get(){calls++;return 0;}});
  assert.throws(() => compileCombatActors({ ...input, mission: { ...input.mission, bytes: badBytes } }), /mission-bytes/); assert.equal(calls, 0);
});

test('smudge subtype immunity can be explicitly reloaded and ambiguous consumed sections are rejected', () => {
  const r = compileCombatActors(actorInput({ map: mapText + '[MARK]\nImmune=no\n' }));
  assert.equal(def(r, 'smudge').fields.immune.value, false); assert.equal(def(r, 'smudge').fields.immune.history.length, 1);
  for (const text of ['[TANK]\nAmmo=1\n[TANK]\nImmune=no\n', '[TANK]\nAmmo=1\nAmmo=2\n', '[Player]\nAllies=Other\n'])
    assert.throws(() => compileCombatActors(actorInput({ map: mapText + text })));
});

test('fallback houses and imported prototype spellings preserve unsupported scope and literal lookup', () => {
  const withoutList = mapText.replace('[Houses]\n0=Player\n1=Other\n[Other]\nCountry=Blue\n', '').replaceAll('Player,', 'Blue,');
  const fallback = compileCombatActors(actorInput({ map: withoutList }));
  assert.equal(fallback.coverage.initialAlliancesComplete, false); assert.equal(fallback.houses[0]!.status, 'unsupported');
  const hostile = mapText.replaceAll('Other', 'constructor').replace('[Player]\nCountry=Blue', '[Player]\nCountry=Blue\nAllies=constructor') + '[TANK]\n__proto__=opaque\nconstructor=opaque\n';
  const r = compileCombatActors(actorInput({ map: hostile }));
  assert.equal(r.coverage.initialAlliancesComplete, true); assert.equal(r.directedAllies[0]!.allyHouseId, 'houses:1');
  assert.equal(def(r).normalSlots.mode, 'ordinary'); assert(def(r).rawFields.some(o => o.keySpelling === '__proto__'));
});
