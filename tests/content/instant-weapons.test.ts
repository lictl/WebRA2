// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic inputs; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileInstantWeaponContexts, evaluateInstantWeaponContext, isInstantWeaponContexts, INSTANT_WEAPONS_LIMITS, type InstantWeaponContext } from '../../packages/content/src/instant-weapons.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const RULES = '[Countries]\n0=Blue\n[VehicleTypes]\n0=TEST\n[TEST]\nStrength=100\nPrimary=Pulse\n[Pulse]\nDamage=12\nROF=20\nRange=4\nProjectile=Ray\nWarhead=Hit\n[Ray]\nInviso=yes\nSubjectToElevation=yes\nSubjectToCliffs=yes\nSubjectToWalls=yes\n[Hit]\nWall=yes\nWood=yes\nConventional=yes\n[ElevationModel]\nElevationIncrement=4\nElevationIncrementBonus=2.5\nElevationBonusCap=3\n';
const MAP = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Units]\n0=Player,TEST,256,2,2,0,Guard,None\n';
function fixture(profile: 'ra2' | 'yr' = 'ra2', r = RULES, extra = '') {
  const map = MAP + extra, source = { id: 'map', profile, sha256: hash(map) };
  const rules = compileRuntimeIni(profile, [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(r), bytes: bytes(r) },
    { id: 'map', profile, order: 1, kind: 'map', sourceSha256: hash(map), bytes: bytes(map) }]);
  const definitions = compileEntityDefinitions({ objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }), rules,
    art: compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: hash(''), bytes: bytes('') }]) });
  return { rules, weapons: compileWeaponDefinitions({ definitions, rules }) };
}
function context(): InstantWeaponContext {
  const cells = [];
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) cells.push({ x, y, level: 2, floorZ: 208, land: 'dry' as const, overlay: 'none' as const, bridge: false });
  return { source: { id: 'source', kind: 'unit', x: 640, y: 640, z: 208, alive: true, standing: true, ground: true },
    target: { id: 'target', kind: 'infantry', x: 1152, y: 640, z: 208, alive: true, standing: true, ground: true },
    targetMode: 'entity', impact: { x: 1152, y: 640, z: 208 }, specialBarriers: 'absent', occupancy: 'complete',
    occupants: [{ id: 'target', kind: 'infantry' }], cells };
}
const evaluate = (c = context()) => evaluateInstantWeaponContext(compileInstantWeaponContexts(fixture()), 'weapon:pulse', c);

test('both profiles interpret the six context flags with origins and conditional singleton flat eligibility', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const result = compileInstantWeaponContexts(fixture(profile));
    assert.equal(result.records[0]!.status, 'context-supported');
    for (const f of Object.values(result.records[0]!.fields)) { assert.equal(f!.value, true); assert.equal(f!.origin!.sourceSha256, hash(RULES)); }
    assert.equal(result.globals.maxDamage.value, 1000); assert.equal(result.globals.maxDamage.rule, 'fresh-native-rules-constructor');
    const checked = evaluateInstantWeaponContext(result, 'weapon:pulse', context());
    assert.equal(checked.status, 'eligible-context'); assert.equal(checked.maximumDamage, 1000); assert.equal(checked.rangeBonus, 0); assert.equal(checked.impactDistance, 0);
    assert.equal(checked.canExecute, false); assert.ok(checked.requiredOtherGates.includes('actor-modifiers-and-death-effects'));
    assert.ok(checked.requiredOtherGates.includes('native-damage-clamp-application'));
  }
});

test('global section spelling, current-state overrides, numeric failures and maximum clamp are source-bound', () => {
  const r = compileInstantWeaponContexts(fixture('ra2', RULES + '[General]\nMaxDamage=1\n[CombatDamage]\nMaxDamage=80\n', '[CombatDamage]\nMaxDamage=25\n[ElevationModel]\nElevationIncrement=2\n'));
  assert.equal(r.globals.maxDamage.value, 25); assert.deepEqual(r.globals.maxDamage.history.map(o => o.layerId), ['rules', 'map']);
  assert.equal(evaluateInstantWeaponContext(r, 'weapon:pulse', context()).maximumDamage, 25);
  for (const raw of ['0', '-1', 'wat', '1000001', '2147483648']) {
    const bad = compileInstantWeaponContexts(fixture('ra2', RULES, '[CombatDamage]\nMaxDamage=' + raw + '\n'));
    assert.ok(bad.records[0]!.reasons.includes('unsupported-maximum-damage'));
  }
  const empty = compileInstantWeaponContexts(fixture('ra2', RULES + '[CombatDamage]\nMaxDamage=99\n', '[CombatDamage]\nMaxDamage=\n'));
  assert.equal(empty.globals.maxDamage.value, 99); assert.equal(empty.globals.maxDamage.rule, 'empty-retains-current');
});

test('zero/invalid increment and negative cap cannot authorize a flat elevation path', () => {
  for (const [key, value] of [['ElevationIncrement', '0'], ['ElevationIncrement', 'bad'], ['ElevationIncrementBonus', '-1'], ['ElevationBonusCap', '-1']]) {
    const r = compileInstantWeaponContexts(fixture('yr', RULES, `[ElevationModel]\n${key}=${value}\n`));
    assert.ok(r.records[0]!.reasons.includes('unsupported-elevation-model'));
  }
  const r = compileInstantWeaponContexts(fixture('ra2', RULES.replace('SubjectToElevation=yes', 'SubjectToElevation=no').replace('ElevationIncrement=4', 'ElevationIncrement=0')));
  assert.equal(r.records[0]!.status, 'context-supported');
});

test('trajectory/spread and unresolved definitions remain excluded without absorbing unrelated combat admission', () => {
  for (const text of [RULES.replace('Inviso=yes', 'Inviso=no'), RULES.replace('[Ray]\n', '[Ray]\nArcing=yes\n'), RULES.replace('[Hit]\n', '[Hit]\nCellSpread=1\n'), RULES.replace('Warhead=Hit', 'Warhead=Absent')]) {
    const r = compileInstantWeaponContexts(fixture('ra2', text)); assert.equal(r.records[0]!.status, 'unsupported');
    assert.equal(evaluateInstantWeaponContext(r, 'weapon:pulse', context()).status, 'unsupported');
  }
  const r = compileInstantWeaponContexts(fixture('ra2', RULES.replace('[Hit]\n', '[Hit]\nAnimList=Unclosed\nInfDeath=9\n')));
  assert.equal(r.records[0]!.status, 'context-supported'); assert.equal(r.canExecute, false);
  assert.ok(r.requiredOtherGates.includes('weapon-special-effects-and-animation-closure'));
});

test('the impact list includes all occupants; missing, unknown, extra, wrong-kind and incomplete lists fail closed', () => {
  for (const occupants of [[], [{ id: 'target', kind: 'other' as const }], [{ id: 'unknown', kind: 'unknown' as const }],
    [...context().occupants, { id: 'unmodeled', kind: 'unknown' as const }]]) {
    assert.ok(evaluate({ ...context(), occupants }).reasons.includes('outside-singleton-impact-cell'));
  }
  assert.ok(evaluate({ ...context(), occupancy: 'incomplete' }).reasons.includes('incomplete-impact-occupancy'));
  assert.throws(() => evaluate({ ...context(), occupants: [...context().occupants, ...context().occupants] }), /duplicate-occupant/);
});

test('flat rectangle including margins is complete and order-independent, with no wall/bridge/water fallback', () => {
  assert.deepEqual(evaluate({ ...context(), cells: [...context().cells].reverse() }), evaluate());
  assert.ok(evaluate({ ...context(), cells: context().cells.slice(1) }).reasons.includes('incomplete-context-rectangle'));
  for (const change of [{ level: 3 }, { floorZ: 0 }, { overlay: 'present' as const }, { overlay: 'unknown' as const }, { land: 'water' as const }, { bridge: true }]) {
    const cells = [...context().cells]; cells[0] = { ...cells[0]!, ...change };
    assert.equal(evaluate({ ...context(), cells }).status, 'unsupported');
  }
  const outside = [...context().cells]; outside[0] = { ...outside[0]!, x: 6 };
  assert.ok(evaluate({ ...context(), cells: outside }).reasons.includes('outside-context-rectangle'));
  assert.throws(() => evaluate({ ...context(), cells: [...context().cells, context().cells[0]!] }), /duplicate-cell/);
});

test('target mode, positions and live actor state remain explicit requirements', () => {
  for (const targetMode of ['ground', 'force-fire'] as const) assert.ok(evaluate({ ...context(), targetMode }).reasons.includes('unsupported-target-mode'));
  for (const change of [{ standing: false }, { alive: false }, { ground: false }, { kind: 'other' as const }, { id: 'source' }])
    assert.ok(evaluate({ ...context(), target: { ...context().target, ...change } }).reasons.includes('outside-standing-ground-actors'));
  assert.ok(evaluate({ ...context(), impact: { ...context().impact, x: 1153 } }).reasons.includes('nonzero-impact-distance'));
  assert.ok(evaluate({ ...context(), specialBarriers: 'unknown' }).reasons.includes('special-barrier-closure-required'));
});

test('genuine factories, exact profile/source identities, immutable outputs and unchanged inputs are enforced', () => {
  const input = fixture(), r = compileInstantWeaponContexts(input), c = context();
  const before = JSON.stringify(c); evaluateInstantWeaponContext(r, 'weapon:pulse', c); assert.equal(JSON.stringify(c), before);
  assert.equal(isInstantWeaponContexts(r), true); assert.equal(isInstantWeaponContexts({ ...r }), false);
  assert.equal(r.fingerprint, compileInstantWeaponContexts(fixture()).fingerprint);
  assert.ok(Object.isFrozen(r.records[0]!.fields.subjectToWalls!.history));
  assert.throws(() => compileInstantWeaponContexts({ ...input, weapons: { ...input.weapons } }), /weapon-factory/);
  assert.throws(() => compileInstantWeaponContexts({ ...input, rules: fixture('yr').rules }), /rules-source/);
  assert.throws(() => compileInstantWeaponContexts({ ...input, rules: fixture('ra2', RULES + '\n').rules }), /rules-source/);
  assert.throws(() => evaluateInstantWeaponContext({ ...r }, 'weapon:pulse', c), /context-factory/);
  assert.throws(() => evaluateInstantWeaponContext(r, 'weapon:absent', c), /weapon-id/);
});

test('malformed/sparse/accessor inputs and lower budgets reject before unbounded work', () => {
  const sparse = Array<InstantWeaponContext['cells'][number]>(15);
  assert.throws(() => evaluate({ ...context(), cells: sparse }), /list/);
  const getter = { ...context(), get occupancy(): 'complete' { throw Error('should not run'); } };
  assert.throws(() => evaluate(getter), /fields/);
  assert.throws(() => evaluate({ ...context(), target: { ...context().target, x: NaN } }), /integer/);
  assert.throws(() => evaluate({ ...context(), target: { ...context().target, x: -0 } }), /integer/);
  for (const options of [{ records: 1 }, { work: 0 }, { serializedBytes: 1 }]) assert.throws(() => compileInstantWeaponContexts(fixture(), options), /limit/);
  assert.throws(() => compileInstantWeaponContexts(fixture(), { cells: INSTANT_WEAPONS_LIMITS.cells + 1 }), /integer/);
  const r = compileInstantWeaponContexts(fixture(), { cells: 14 }); assert.throws(() => evaluateInstantWeaponContext(r, 'weapon:pulse', context()), /list/);
});

test('repeated consumed source occurrences remain ambiguous rather than receiving an invented winner', () => {
  assert.throws(() => compileInstantWeaponContexts(fixture('ra2', RULES + '[ElevationModel]\nElevationIncrement=1\n')), /repeated-consumed-section/);
  assert.throws(() => compileInstantWeaponContexts(fixture('ra2', RULES + '[CombatDamage]\nMaxDamage=100\nMaxDamage=50\n')), /repeated-consumed-key/);
});
