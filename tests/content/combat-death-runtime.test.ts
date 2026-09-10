// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic sources and state; no game content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileOrdinaryDeath, selectOrdinaryInfantryDeath, isOrdinaryDeath, type OrdinaryDeathContext, type OrdinaryDeathSelection } from '../../packages/content/src/combat-death-runtime.ts';
import { compileCombatVeterancy } from '../../packages/content/src/combat-veterancy.ts';
import { compileCombatDeath } from '../../packages/content/src/combat-death.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileAnimationEffects } from '../../packages/content/src/animation-effects.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
function fixture({ profile = 'yr' as 'ra2' | 'yr', typeFields = '', corpse = 'Quiet,Other', art = '[Quiet]\nRate=500\n[Other]\nFlat=yes\n',
  ruleExtra = '', middle = [] as string[], infDeath = 1, suicide = false } = {}) {
  const rules = `[Countries]\n0=Blue\n[InfantryTypes]\n0=PERSON\n[Animations]\n0=Quiet\n1=Other\n[${profile === 'ra2' ? 'AudioVisual' : 'General'}]\nDeadBodies=${corpse}\n[PERSON]\nStrength=80\nPrimary=Pulse\nLocomotor={4a582744-9839-11d1-b709-00a024ddafd1}\n${typeFields}\n[Pulse]\nDamage=10\nProjectile=Ray\nWarhead=Hit\nSuicide=${suicide ? 'yes' : 'no'}\n[Ray]\nInviso=yes\n[Hit]\nInfDeath=${infDeath}\n${ruleExtra}`;
  const mission = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Infantry]\n0=Player,PERSON,256,2,2,0,Guard,0,None\n1=Player,PERSON,256,3,2,0,Guard,0,None\n';
  const source = { id: 'map', profile, sha256: hash(mission) };
  const layer = (text: string, id: string, order: number, kind: RuntimeIniLayer['kind']) => ({ id, profile, order, kind, sourceSha256: hash(text), bytes: bytes(text) });
  const r = compileRuntimeIni(profile, [layer(rules, 'rules', 0, 'base'), ...middle.map((s, i) => layer(s, `mod-${i}`, i + 1, 'mod')), layer(mission, 'map', 100, 'map')]);
  const a = compileRuntimeIni(profile, [layer(art, 'art', 0, 'base')]);
  const definitions = compileEntityDefinitions({ rules: r, art: a, objects: compileScenarioObjects({ profile, source, bytes: bytes(mission) }) });
  const weapons = compileWeaponDefinitions({ rules: r, definitions });
  const actors = compileCombatActors({ rules: r, definitions, mission: { source, bytes: bytes(mission) } });
  const input = { definitions, weapons, actors, rules: r, art: a, effects: compileAnimationEffects({ rules: r, art: a, definitions, weapons }) };
  return { ...input, death: compileCombatDeath(input), veterancy: compileCombatVeterancy({ actors, rules: r }) };
}
const context = (): OrdinaryDeathContext => ({ complete: true, standing: true, dryGround: true, onBridge: false,
  heightAboveGround: 0, sequence: 0, currentLocomotor: 'walk', inTransport: false, passengerCount: 0, driverIndex: -1,
  attachedEffects: false, spawnManager: false, slaveManager: false, mindControl: false, temporal: false, warping: false,
  immobilized: false, veterancy: 0 });
function selection(f: ReturnType<typeof fixture>): OrdinaryDeathSelection {
  const [v, a] = f.actors.placements;
  return { victim: { id: 'world-victim', rowId: v!.rowId, typeId: v!.typeId!, ownerId: v!.ownerId! },
    attacker: { id: 'world-attacker', rowId: a!.rowId, typeId: a!.typeId!, ownerId: a!.ownerId! },
    attackWeaponId: 'weapon:pulse', warheadId: 'warhead:hit', currentWeaponId: 'weapon:pulse', lethal: true, context: context() };
}

test('both profiles return owned ordinary death events and preserve all accounting identities', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const infDeath of [1, 2]) {
    const f = fixture({ profile, infDeath }), p = compileOrdinaryDeath(f), s = selection(f), d = selectOrdinaryInfantryDeath(p, s);
    assert.ok(isOrdinaryDeath(p)); assert.equal(d.status, 'ready-ordinary-human', JSON.stringify(d.reasons));
    assert.equal(d.sequence, infDeath === 1 ? 11 : 12); assert.equal(d.canStartCampaign, false);
    assert.equal(d.terminal!.removal, 'at-explicit-sequence-completion'); assert.equal(d.terminal!.occupancy, 'release-owned-walk-occupancy');
    assert.equal(d.terminal!.selection, 'one-native-word-modulo-count'); assert.equal(d.terminal!.corpseCandidates.length, 2);
    assert.deepEqual(d.victim, s.victim); assert.deepEqual(d.attacker, s.attacker); assert.deepEqual(d.source, f.death.source);
    assert.ok(Object.isFrozen(d.terminal!.corpseCandidates)); assert.ok(Object.isFrozen(d.victim));
    (s.victim as { id: string }).id = 'mutated'; assert.equal(d.victim.id, 'world-victim');
    assert.deepEqual(selectOrdinaryInfantryDeath(p, selection(f)), d);
  }
});

test('global section, type replacement and current-value empty handling follow the profile source', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, typeFields: 'DeadBodies=Other', middle: ['[PERSON]\nDeadBodies=\n'] }), p = compileOrdinaryDeath(f);
    assert.equal(p.types[0]!.corpse!.source, 'type'); assert.deepEqual(p.types[0]!.corpse!.candidates.map(a => a.name), ['Other']);
    assert.equal(p.globalDeadBodies.origin!.sectionSpelling, profile === 'ra2' ? 'AudioVisual' : 'General');
    assert.equal(selectOrdinaryInfantryDeath(p, selection(f)).status, 'ready-ordinary-human');
    const ignored = fixture({ profile, corpse: 'Quiet', ruleExtra: `[${profile === 'ra2' ? 'General' : 'AudioVisual'}]\nDeadBodies=Unknown\n` });
    assert.equal(selectOrdinaryInfantryDeath(compileOrdinaryDeath(ignored), selection(ignored)).status, 'ready-ordinary-human');
  }
});

test('all possible corpse roots and transitive effects must be closed before any selection', () => {
  for (const art of ['[Quiet]\nRate=1\n[Other]\nDamage=1\n', '[Quiet]\nNext=Other\n[Other]\nNext=Quiet\n', '[Quiet]\nNext=Missing\n[Other]\n']) {
    const f = fixture({ art }), d = selectOrdinaryInfantryDeath(compileOrdinaryDeath(f), selection(f));
    assert.equal(d.status, 'unsupported'); assert.equal(d.sequence, null); assert.equal(d.terminal, null);
  }
  for (const corpse of ['Unknown', 'QUIET', 'Quiet, Other', 'none', '']) {
    const f = fixture({ corpse }), p = compileOrdinaryDeath(f); assert.equal(selectOrdinaryInfantryDeath(p, selection(f)).status, 'unsupported');
    if (corpse === 'none' || corpse === '') assert.ok(p.types[0]!.reasons.includes('empty-global-corpse-fallback-native-division-unchecked'));
  }
  const one = fixture({ corpse: 'Quiet' }); assert.equal(selectOrdinaryInfantryDeath(compileOrdinaryDeath(one), selection(one)).terminal!.selection, 'one-native-word-modulo-count');
});

test('inactive death paths do not forbid a nonlethal result, while ordinary lethal source exclusions stay explicit', () => {
  for (const typeFields of ['Explodes=yes', 'Cyborg=yes', 'NotHuman=yes', 'Crashable=yes', 'JumpJet=yes', 'MaxDebris=2', 'DeathAnims=Quiet']) {
    const f = fixture({ typeFields }), p = compileOrdinaryDeath(f), s = selection(f);
    assert.equal(selectOrdinaryInfantryDeath(p, s).status, 'unsupported', typeFields);
    assert.equal(selectOrdinaryInfantryDeath(p, { ...s, lethal: false }).status, 'nonlethal', typeFields);
  }
  for (const infDeath of [0, 3, 8, 11]) { const f = fixture({ infDeath }); assert.equal(selectOrdinaryInfantryDeath(compileOrdinaryDeath(f), selection(f)).status, 'unsupported'); }
});

test('every current-context gate is exercised and a missing weapon cannot evade suicide', () => {
  const f = fixture(), p = compileOrdinaryDeath(f), s = selection(f);
  const changes = { complete: false, standing: false, dryGround: false, onBridge: true, heightAboveGround: 1, sequence: 33,
    currentLocomotor: 'unknown', inTransport: true, passengerCount: 1, driverIndex: 0, attachedEffects: true, spawnManager: true,
    slaveManager: true, mindControl: true, temporal: true, warping: true, immobilized: true };
  for (const [k, v] of Object.entries(changes)) assert.equal(selectOrdinaryInfantryDeath(p, { ...s, context: { ...context(), [k]: v } as OrdinaryDeathContext }).status, 'unsupported', k);
  const sf = fixture({ suicide: true }), sp = compileOrdinaryDeath(sf);
  assert.ok(selectOrdinaryInfantryDeath(sp, selection(sf)).reasons.includes('active-or-unknown-current-weapon-suicide'));
  assert.ok(selectOrdinaryInfantryDeath(sp, { ...selection(sf), currentWeaponId: null }).reasons.includes('armed-victim-current-weapon-required'));
});

test('victim, owner, attacker, weapon and source joins cannot be interchanged', () => {
  const f = fixture(), p = compileOrdinaryDeath(f), s = selection(f);
  for (const bad of [{ ...s, victim: { ...s.victim, ownerId: 'other' } }, { ...s, attacker: { ...s.attacker, rowId: 'unknown' } },
    { ...s, attacker: { ...s.attacker, id: s.victim.id } }, { ...s, attackWeaponId: 'weapon:missing' }, { ...s, warheadId: 'warhead:missing' },
    { ...s, currentWeaponId: 'weapon:missing' }]) assert.equal(selectOrdinaryInfantryDeath(p, bad).status, 'unsupported');
  const alternate = fixture({ corpse: 'Other' }); assert.throws(() => compileOrdinaryDeath({ ...f, death: alternate.death }), /death-source-identity/);
  assert.throws(() => compileOrdinaryDeath({ ...f, death: structuredClone(f.death) }), /death-factory/);
  assert.throws(() => selectOrdinaryInfantryDeath(structuredClone(p), s), /plan-factory/);
});

test('consumed duplicate fields and malformed native lists never create a partial ready plan', () => {
  for (const middle of [['[General]\nDeadBodies=Quiet\nDeadBodies=Other\n'], ['[PERSON]\nJumpJet=no\nJumpJet=yes\n']]) {
    assert.throws(() => compileOrdinaryDeath(fixture({ middle })), /repeated-(?:consumed-)?key/);
  }
  const f = fixture({ middle: ['[PERSON]\nJumpJet=maybe\n'] }); assert.equal(compileOrdinaryDeath(f).types[0]!.status, 'unsupported');
});

test('lower limits, getters, boxed scalars, sparse lookalikes and reflection failures are rejected', () => {
  const f = fixture(), p = compileOrdinaryDeath(f), s = selection(f);
  for (const limits of [{ references: 0 }, { work: 0 }, { history: 0 }, { serializedBytes: 1 }, { types: 0 }]) assert.throws(() => compileOrdinaryDeath(f, limits));
  assert.throws(() => compileOrdinaryDeath(f, { work: Infinity }));
  let calls = 0; assert.throws(() => compileOrdinaryDeath({ ...f, get death() { calls++; return f.death; } })); assert.equal(calls, 0);
  assert.throws(() => selectOrdinaryInfantryDeath(p, { ...s, context: { ...context(), complete: new Boolean(true) } } as unknown as OrdinaryDeathSelection));
  assert.throws(() => selectOrdinaryInfantryDeath(p, { ...s, context: { ...context(), sequence: -0 } }));
  assert.throws(() => selectOrdinaryInfantryDeath(p, { ...s, context: [] } as unknown as OrdinaryDeathSelection));
  assert.throws(() => selectOrdinaryInfantryDeath(p, new Proxy(s, { ownKeys() { throw new Error('reflection'); } })), /reflection/);
  const bad = { ...context(), get standing() { calls++; return true; } };
  assert.throws(() => selectOrdinaryInfantryDeath(p, { ...s, context: bad })); assert.equal(calls, 0);
});


test('source-bound current veterancy gates only active or unknown EXPLODES and preserves profile storage', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const f = fixture({ profile, typeFields: 'VeteranAbilities=EXPLODES' }), p = compileOrdinaryDeath(f), s = selection(f);
    for (const veterancy of [-1, 0, 0.5, 1, 2]) {
      const d = selectOrdinaryInfantryDeath(p, { ...s, context: { ...context(), veterancy } });
      assert.equal(d.status, veterancy < 1 ? 'ready-ordinary-human' : 'unsupported');
      assert.equal(d.selectedVeterancy!.sourceFingerprint, f.veterancy.fingerprint);
      assert.equal(d.selectedVeterancy!.enabled.explodes, veterancy >= 1);
    }
    const elite = fixture({ profile, typeFields: 'EliteAbilities=EXPLODES' }), ep = compileOrdinaryDeath(elite);
    assert.equal(selectOrdinaryInfantryDeath(ep, { ...selection(elite), context: { ...context(), veterancy: 1 } }).status, 'ready-ordinary-human');
    assert.equal(selectOrdinaryInfantryDeath(ep, { ...selection(elite), context: { ...context(), veterancy: 2 } }).status, 'unsupported');
    const input = { ...s, context: { ...context(), veterancy: 0.1 } };
    if (profile === 'ra2') assert.equal(selectOrdinaryInfantryDeath(p, input).status, 'ready-ordinary-human');
    else assert.throws(() => selectOrdinaryInfantryDeath(p, input), /context-veterancy/);
    for (const veterancy of [NaN, Infinity, -0, 65537]) assert.throws(() => selectOrdinaryInfantryDeath(p, { ...s, context: { ...context(), veterancy } }));
    assert.throws(() => compileOrdinaryDeath({ ...f, veterancy: structuredClone(f.veterancy) }), /veterancy-factory/);
    assert.throws(() => compileOrdinaryDeath({ ...f, veterancy: elite.veterancy }), /veterancy-source-identity/);
    const unknown = fixture({ profile, typeFields: `VeteranAbilities=${'X'.repeat(128)}` }), up = compileOrdinaryDeath(unknown), us = selection(unknown);
    assert.equal(selectOrdinaryInfantryDeath(up, us).status, 'ready-ordinary-human');
    assert.equal(selectOrdinaryInfantryDeath(up, { ...us, context: { ...context(), veterancy: 1 } }).status, 'unsupported');
    assert.equal(selectOrdinaryInfantryDeath(up, { ...us, lethal: false, context: { ...context(), veterancy: 1 } }).status, 'nonlethal');
  }
});
