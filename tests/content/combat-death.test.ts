// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic sources only; no retail rows or bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileCombatDeath, isCombatDeath, COMBAT_DEATH_LIMITS } from '../../packages/content/src/combat-death.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileAnimationEffects } from '../../packages/content/src/animation-effects.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const base = '[Countries]\n0=Blue\n[InfantryTypes]\n0=PERSON\n[VehicleTypes]\n0=CAR\n[BuildingTypes]\n0=HQ\n[Animations]\n0=Quiet\n1=Other\n[PERSON]\nStrength=80\nPrimary=Pulse\n[CAR]\nStrength=150\nPrimary=Pulse\n[HQ]\nStrength=300\n[Pulse]\nDamage=10\nProjectile=Ray\nWarhead=Hit\n[Ray]\nInviso=yes\n[Hit]\n';
const map = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Infantry]\n0=Player,PERSON,256,2,2,0,Guard,0,None\n[Units]\n0=Player,CAR,256,2,2,0,Guard,None\n[Structures]\n0=Player,HQ,256,2,2,0,None\n';
function fixture({ rules = base, art = '[Quiet]\nRate=500\n[Other]\nFlat=yes\n', middle = [] as string[], mission = map,
  profile = 'yr' as 'ra2' | 'yr' } = {}) {
  const source = { id: 'map', profile, sha256: hash(mission) };
  const layer = (text: string, id: string, order: number, kind: RuntimeIniLayer['kind']) => ({ id, profile, order, kind, sourceSha256: hash(text), bytes: bytes(text) });
  const r = compileRuntimeIni(profile, [layer(rules, 'rules', 0, 'base'), ...middle.map((s, i) => layer(s, `mod-${i}`, i + 1, 'mod')), layer(mission, 'map', 100, 'map')]);
  const a = compileRuntimeIni(profile, [layer(art, 'art', 0, 'base')]);
  const definitions = compileEntityDefinitions({ rules: r, art: a, objects: compileScenarioObjects({ profile, source, bytes: bytes(mission) }) });
  const weapons = compileWeaponDefinitions({ rules: r, definitions });
  const actors = compileCombatActors({ rules: r, definitions, mission: { source, bytes: bytes(mission) } });
  return { definitions, weapons, actors, rules: r, art: a, effects: compileAnimationEffects({ rules: r, art: a, definitions, weapons }) };
}
const type = (r: ReturnType<typeof compileCombatDeath>, kind = 'infantry') => r.types.find(t => t.kind === kind)!;
const field = (r: ReturnType<typeof compileCombatDeath>, key: string, kind = 'infantry') => type(r, kind).fields[key]!;
const change = (key: string, value: string) => base.replace('[PERSON]\n', `[PERSON]\n${key}=${value}\n`);
const freeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } };

test('fresh both-profile defaults remain distinct from execution and complete runtime requirements', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileCombatDeath(fixture({ profile }));
    assert.equal(type(r).status, 'typed-prerequisites'); assert.equal(type(r, 'structure').status, 'not-applicable');
    assert.equal(field(r, 'Organic').value, true); assert.equal(field(r, 'Organic', 'unit').value, false);
    for (const k of ['Explodes', 'Crewed', 'Crashable', 'NotHuman', 'Cyborg']) assert.equal(field(r, k).value, false);
    assert.equal(field(r, 'DeathWeaponDamageModifier').value, 1); assert.equal(field(r, 'DeathWeapon').value, null);
    assert.deepEqual(field(r, 'DeathAnims').value, []); assert.deepEqual(field(r, 'DebrisTypes').value, []);
    assert.equal(r.globalDeathWeapon.value, null); assert.equal(r.nativeExecutionVerified, false); assert.equal(r.canExecuteCombat, false);
    assert.equal(type(r).branches.find(b => b.id === 'death-debris')!.sourceState, 'inactive');
    assert.equal(type(r).branches.find(b => b.id === 'death-explosion')!.sourceState, 'conditional');
    assert.ok(type(r, 'unit').branches.find(b => b.id === 'crew-survivor')!.requirements.includes('live-driver-index'));
    assert.deepEqual(r.placements.map(p => p.typeId).sort(), ['type:infantry:person', 'type:structure:hq', 'type:unit:car']);
  }
});

test('incoming rules references and global art properties retain separate histories', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileCombatDeath(fixture({ profile, rules: change('DeathAnims', 'Quiet'), art: '[Quiet]\nDamage=2\n[Other]\nDeathAnims=Quiet\n' }));
    assert.equal(field(r, 'DeathAnims').origin!.layerId, 'rules');
    const ref = type(r).animationReferences.find(a => a.field === 'DeathAnims')!;
    assert.equal(ref.status, 'active-effects'); assert.deepEqual(ref.reachableIds, ['animation:quiet']);
    assert.ok(ref.reasons.some(s => s.includes('positive-damage')));
    const artOnly = compileCombatDeath(fixture({ profile, art: '[PERSON]\nDeathAnims=Quiet\n[Quiet]\nDamage=2\n' }));
    assert.deepEqual(field(artOnly, 'DeathAnims').value, []);
  }
});

test('nonempty comma lists replace, empty values preserve, and exact-name allocation stays explicit', () => {
  const r = compileCombatDeath(fixture({ rules: change('DeathAnims', 'Quiet'), middle: ['[PERSON]\nDeathAnims=Other,,none\n', '[PERSON]\nDeathAnims=\n'] }));
  assert.deepEqual(field(r, 'DeathAnims').value, ['Other']);
  assert.deepEqual(field(r, 'DeathAnims').history.map(o => o.layerId), ['rules', 'mod-0', 'mod-1']);
  assert.equal(type(r).animationReferences.find(a => a.field === 'DeathAnims')!.status, 'presentation-fields-only');
  const empty = compileCombatDeath(fixture({ rules: change('DeathAnims', 'none') })); assert.deepEqual(field(empty, 'DeathAnims').value, []);
  for (const value of ['Quiet, Other', 'QUIET', 'Unknown']) {
    const v = compileCombatDeath(fixture({ rules: change('DeathAnims', value) }));
    assert.equal(type(v).animationReferences.find(a => a.field === 'DeathAnims')!.status, 'unsupported', value);
  }
});

test('death animation dependencies do not hide active effects, cycles or unmodeled allocations', () => {
  for (const [art, expected] of [['[Quiet]\nNext=Other\n[Other]\nDamage=1\n', 'active-effects'], ['[Quiet]\nNext=Other\n[Other]\nNext=Quiet\n', 'unsupported']] as const) {
    const r = compileCombatDeath(fixture({ rules: change('DeathAnims', 'Quiet'), art }));
    assert.equal(type(r).animationReferences.find(a => a.field === 'DeathAnims')!.status, expected);
  }
  const r = compileCombatDeath(fixture({ rules: change('DeathAnims', 'Late'), art: '[Late]\nRate=400\n[Quiet]\n[Other]\n' }));
  assert.ok(type(r).animationReferences.find(a => a.field === 'DeathAnims')!.reasons.includes('animation-record-not-in-scoped-effect-compiler'));
});

test('debris clamp is per stage, dependencies retained, unsupported minimum cannot imply zero effects', () => {
  const r = compileCombatDeath(fixture({ rules: change('MaxDebris', '-2'), middle: ['[PERSON]\nMinDebris=4\n', '[PERSON]\nMaxDebris=1\n'] }));
  assert.equal(field(r, 'MinDebris').value, 4); assert.equal(field(r, 'MaxDebris').value, 4);
  assert.equal(field(r, 'MaxDebris').rule, 'native-max-debris-at-least-min');
  assert.equal(field(r, 'MaxDebris').origin!.keySpelling, 'MinDebris');
  assert.ok(field(r, 'MaxDebris').history.some(o => o.keySpelling === 'MinDebris'));
  assert.equal(type(r).branches.find(b => b.id === 'death-debris')!.sourceState, 'conditional');
  assert.deepEqual(field(r, 'DebrisAnims').value, []);
  assert.ok(type(r).branches.find(b => b.id === 'death-debris')!.requirements.includes('voxel-type-or-type/global-animation-effect-closure'));
  const negative = compileCombatDeath(fixture({ rules: change('MinDebris', '-5') })); assert.equal(field(negative, 'MinDebris').value, 0);
  const unknown = compileCombatDeath(fixture({ rules: change('MinDebris', 'garbage') }));
  assert.equal(field(unknown, 'MaxDebris').status, 'unsupported'); assert.equal(type(unknown).branches.find(b => b.id === 'death-debris')!.sourceState, 'unsupported');
});

test('numeric parser subset and float32 chop storage preserve meaningful boundary behavior', () => {
  const r = compileCombatDeath(fixture({ rules: change('DeathWeaponDamageModifier', '10%'), middle: ['[PERSON]\nPassengers=3.9\nDebrisMaximums=2,3,-1\n'] }));
  assert.equal(field(r, 'DeathWeaponDamageModifier').value, 0.09999999403953552);
  assert.equal(field(r, 'Passengers').value, 3); assert.deepEqual(field(r, 'DebrisMaximums').value, [2, 3, -1]);
  for (const [key, value] of [['Explodes', 'perhaps'], ['MinDebris', '2147483648'], ['DeathWeaponDamageModifier', '1.000000059604644775390625'], ['DebrisMaximums', '$FFFFFFFF'], ['DeathAnims', 'Quiet,'.repeat(23)]] as const) {
    const x = compileCombatDeath(fixture({ rules: change(key, value) }));
    assert.equal(field(x, key).status, 'unsupported', `${key}=${value}`); assert.equal(type(x).status, 'unsupported');
  }
});

test('death weapon pointer and CombatDamage fallback do not assert unconditional detonation', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileCombatDeath(fixture({ profile, rules: change('DeathWeapon', 'Pulse') + '[General]\nDeathWeapon=Ignored\n[CombatDamage]\nDeathWeapon=Pulse\n' }));
    assert.equal(r.globalDeathWeapon.value, 'Pulse'); assert.equal(r.globalDeathWeapon.origin!.sectionSpelling, 'CombatDamage');
    assert.equal(field(r, 'Explodes').value, false); assert.equal(type(r).weaponReference.status, 'record-present');
    assert.equal(type(r).branches.find(b => b.id === 'death-explosion')!.sourceState, 'conditional');
    assert.ok(type(r).branches.find(b => b.id === 'death-explosion')!.requirements.includes('type-explodes-or-active-veteran-explodes-or-current-weapon-suicide'));
    const wrong = compileCombatDeath(fixture({ profile, rules: base + '[General]\nDeathWeapon=Pulse\n' })); assert.equal(wrong.globalDeathWeapon.value, null);
    const unallocated = compileCombatDeath(fixture({ profile, rules: change('DeathWeapon', 'Unknown') })); assert.equal(type(unallocated).weaponReference.status, 'unsupported');
  }
});

test('factory, source, actor and profile joins reject substitution before field classification', () => {
  const f = fixture(), other = fixture({ rules: change('Crewed', 'yes') });
  for (const key of ['actors', 'definitions', 'weapons', 'effects'] as const) assert.throws(() => compileCombatDeath({ ...f, [key]: { ...f[key] } }), /factory/);
  assert.throws(() => compileCombatDeath({ ...f, effects: other.effects }), /definition-identity/);
  assert.throws(() => compileCombatDeath({ ...f, rules: other.rules }), /source-identity/);
  assert.throws(() => compileCombatDeath({ ...f, art: fixture({ profile: 'ra2' }).art }), /source-identity/);
  const changed = JSON.parse(JSON.stringify(f.rules));
  const row = changed.entries.find((e: { section: string; key: string }) => e.section === 'person' && e.key === 'strength');
  row.selected.rawValue = '999'; row.value = '999'; freeze(changed);
  assert.throws(() => compileCombatDeath({ ...f, rules: changed }), /actor-source-fields/);
});

test('duplicate native consumed sections and keys remain unsupported, not silently selected', () => {
  for (const text of ['[PERSON]\nExplodes=yes\nExplodes=no\n', '[PERSON]\nExplodes=yes\n[PERSON]\nCrewed=yes\n', '[CombatDamage]\nDeathWeapon=Pulse\nDeathWeapon=none\n']) {
    assert.throws(() => compileCombatDeath(fixture({ middle: [text] })), /ambiguous|duplicate|repeated/);
  }
});

test('owned immutable output has stable hashes, inert prototype spellings and genuine brand', () => {
  const f = fixture({ rules: change('DeathAnims', 'constructor').replace('0=Quiet', '0=constructor'), art: '[constructor]\nRate=400\n[Other]\n' });
  const a = compileCombatDeath(f), b = compileCombatDeath(f); assert.equal(a.fingerprint, b.fingerprint);
  assert.ok(isCombatDeath(a)); assert.equal(isCombatDeath({ ...a }), false);
  assert.equal(type(a).animationReferences.find(r => r.field === 'DeathAnims')!.status, 'presentation-fields-only');
  assert.throws(() => { (a.types as unknown[]).push({}); });
  assert.throws(() => { (field(a, 'DeathAnims').value as string[]).push('payload'); });
  assert.throws(() => { (a.source as { sha256: string }).sha256 = '0'.repeat(64); });
});

test('lower-only source, history, references, output and work budgets fail closed', () => {
  const f = fixture({ rules: change('DeathAnims', 'Quiet') });
  for (const key of ['stages', 'occurrences', 'types', 'placements', 'history', 'references', 'work', 'characters', 'nodes', 'serializedBytes'] as const)
    assert.throws(() => compileCombatDeath(f, { [key]: 0 }), /limit/, key);
  assert.throws(() => compileCombatDeath(fixture({ rules: change('Explodes', 'invalid') }), { diagnostics: 0 }), /diagnostic-limit/);
  for (const n of [NaN, Infinity, -0, -1, COMBAT_DEATH_LIMITS.types + 1]) assert.throws(() => compileCombatDeath(f, { types: n }), /limit/);
  let calls = 0; const hostile = { ...f, get rules(): typeof f.rules { calls++; throw new Error('getter'); } };
  assert.throws(() => compileCombatDeath(hostile), /fields/); assert.equal(calls, 0);
  const caps = Object.defineProperty({}, 'work', { enumerable: true, get() { calls++; return 0; } });
  assert.throws(() => compileCombatDeath(f, caps), /fields/); assert.equal(calls, 0);
  assert.throws(() => compileCombatDeath(new Proxy(f, { ownKeys() { throw new Error('reflection'); } })), /reflection/);
});
