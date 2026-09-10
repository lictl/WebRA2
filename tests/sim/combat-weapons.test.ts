// SPDX-License-Identifier: GPL-3.0-or-later
// Original small source graphs; no retail assets or names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileCombatWeapons, isCombatWeapons } from '../../packages/sim/src/combat-weapons.ts';
import { combatDamage } from '../../packages/sim/src/combat-model.ts';

const hash = (s: string) => createHash('sha256').update(s).digest('hex'), bytes = (s: string) => new TextEncoder().encode(s);
function fixture({ profile = 'ra2' as 'ra2' | 'yr', gun = '', projectile = '', warhead = '', mod = '' } = {}) {
  const base = '[Countries]\n0=Blue\n[VehicleTypes]\n0=ROVER\n[ROVER]\nStrength=100\nPrimary=Beam\n' +
    '[Beam]\nDamage=7\nROF=12\nRange=4.5\nMinimumRange=0.5\nProjectile=Ray\nWarhead=Impact\n' + gun +
    '\n[Ray]\nInviso=yes\n' + projectile + '\n[Impact]\nVerses=75%,100%,50%,0%,100%,100%,100%,100%,100%,100%,100%\n' + warhead;
  const map = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Units]\n0=Player,ROVER,256,2,2,0,Guard,None\n';
  const source = { id: 'map', profile, sha256: hash(map) };
  const rules = compileRuntimeIni(profile, [{ id: 'base', profile, order: 0, kind: 'base', bytes: bytes(base), sourceSha256: hash(base) },
    { id: 'mod', profile, order: 1, kind: 'mod', bytes: bytes(mod), sourceSha256: hash(mod) },
    { id: 'map', profile, order: 2, kind: 'map', bytes: bytes(map), sourceSha256: hash(map) }]);
  const art = compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', bytes: bytes(''), sourceSha256: hash('') }]);
  return compileWeaponDefinitions({ definitions: compileEntityDefinitions({ objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }), rules, art }), rules });
}

test('both profiles admit the exact standing/direct projection and bind the source graph', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const source = fixture({ profile }), r = compileCombatWeapons({ weapons: source }), w = r.records[0]!;
    assert(isCombatWeapons(r)); assert(!isCombatWeapons({ ...r })); assert.equal(w.status, 'ready'); assert.deepEqual(w.reasons, []);
    assert.equal(r.weaponDefinitionsSha256, source.fingerprint); assert.equal(r.entityDefinitionsSha256, source.entityFingerprint);
    assert.equal(w.model!.range, 1152); assert.equal(w.model!.minimumRange, 128); assert.equal(w.model!.reloadTicks, 12);
    assert.equal(w.model!.delivery, 'instant'); assert.equal(w.model!.burst, 1); assert.equal(w.model!.speed, 0);
    assert.equal(combatDamage(w.model!, 0), 5); assert.equal(combatDamage(w.model!, 3), 0);
    assert(Object.isFrozen(w.model!.verses)); assert(Object.isFrozen(w.reasons)); assert.equal(r.canStartCampaign, false);
    assert.equal(compileCombatWeapons({ weapons: fixture({ profile }) }).fingerprint, r.fingerprint);
    assert.notEqual(compileCombatWeapons({ weapons: fixture({ profile, mod: '[Unused]\nValue=changed\n' }) }).fingerprint, r.fingerprint);
  }
});

test('special effects, physical projectiles, splash, bursts and healing retain unsupported reasons', () => {
  const changes = [{ gun: 'MindControl=yes\n' }, { gun: 'IsRailgun=yes\n' }, { gun: 'Spawner=yes\n' }, { gun: 'Burst=2\n' },
    { gun: 'Damage=-5\n' }, { gun: 'ROF=0\n' }, { projectile: 'Inviso=no\n' }, { projectile: 'ROT=3\n' },
    { projectile: 'Airburst=yes\n' }, { warhead: 'CellSpread=0.5\n' }, { warhead: 'MindControl=yes\n' },
    { warhead: 'InfDeath=9\n' }, { warhead: 'Temporal=yes\n' }, { warhead: 'Paralyzes=3\n' }, { gun: 'UnknownModFlag=no\n' }];
  for (const change of changes) {
    const mod = '[Beam]\n' + (change.gun ?? '') + '\n[Ray]\n' + (change.projectile ?? '') + '\n[Impact]\n' + (change.warhead ?? '');
    const w = compileCombatWeapons({ weapons: fixture({ mod }) }).records[0]!;
    assert.equal(w.status, 'unsupported', JSON.stringify(change)); assert.equal(w.model, null); assert(w.reasons.length > 0);
  }
});

test('presentation deferrals retain exact origins without deciding damage or readiness from artwork', () => {
  const source = fixture({ gun: 'Report=original-shot\n', projectile: 'Image=original-ray\n', warhead: 'ShakeXlo=1\n' });
  const r = compileCombatWeapons({ weapons: source }), w = r.records[0]!;
  assert.equal(w.status, 'ready'); assert.deepEqual(w.deferredPresentation.map(o => o.keySpelling), ['Report', 'Image', 'ShakeXlo']);
  assert(w.deferredPresentation.every(o => o.sourceSha256 === source.sources[0]!.sourceSha256));
  assert.equal(combatDamage(w.model!, 0), 5);
  assert(r.actorRequirements.includes('standing-unmodified-armor-and-damage'));
});

test('animation references require gameplay closure before publishing an executable model', () => {
  for (const mod of ['[Beam]\nAnim=Effect\n', '[Impact]\nAnimList=Effect\n', '[Beam]\nOccupantAnim=Effect\n']) {
    const w = compileCombatWeapons({ weapons: fixture({ mod: mod + '[Effect]\nDamage=50\nMakeInfantry=1\n' }) }).records[0]!;
    assert.equal(w.status, 'unsupported'); assert.equal(w.model, null);
    assert(w.reasons.some(r => r.endsWith(':animation-gameplay-closure-required')));
    assert(!w.deferredPresentation.some(o => /Anim/.test(o.keySpelling)));
  }
});

test('a later explicit supported override can clear a special effect while history stays source-bound', () => {
  const blocked = fixture({ gun: 'IsSonic=yes\n' }), changed = fixture({ gun: 'IsSonic=yes\n', mod: '[Beam]\nIsSonic=no\n' });
  assert.equal(compileCombatWeapons({ weapons: blocked }).records[0]!.status, 'unsupported');
  const r = compileCombatWeapons({ weapons: changed }); assert.equal(r.records[0]!.status, 'ready');
  assert.deepEqual(changed.weapons[0]!.fields.isSonic!.history.map(o => o.layerId), ['base', 'mod']);
  assert.notEqual(r.fingerprint, compileCombatWeapons({ weapons: fixture() }).fingerprint);
});

test('unknown native allocation/reference state never becomes an executable weapon', () => {
  const source = fixture({ mod: '[Warheads]\n0=IMPACT\n[IMPACT]\nVerses=100%\n' });
  assert.equal(compileCombatWeapons({ weapons: source }).records[0]!.status, 'unsupported');
  const unavailable = compileCombatWeapons({ weapons: fixture({ projectile: 'AirburstWeapon=Later\n' }) });
  assert(unavailable.records.every(r => r.status === 'unsupported'));
});

test('genuine input, exact field shapes and lower bounds precede publication', () => {
  const weapons = fixture(); assert.throws(() => compileCombatWeapons({ weapons: { ...weapons } }), /factory/);
  assert.throws(() => compileCombatWeapons({ weapons }, { weapons: 0 }), /limit/);
  assert.throws(() => compileCombatWeapons({ weapons }, { weapons: 1025 }), /world-integer/);
  assert.throws(() => compileCombatWeapons({ weapons }, { work: 0 }), /work-limit/);
  let invoked = false; const bad = Object.defineProperty({ weapons }, 'weapons', { get() { invoked = true; return weapons; }, enumerable: true });
  assert.throws(() => compileCombatWeapons(bad), /world-fields/); assert.equal(invoked, false);
});
