// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic rules and placements; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileWeaponDefinitions, isWeaponDefinitions, WEAPON_DEFINITIONS_LIMITS } from '../../packages/content/src/weapon-definitions.ts';
import { weaponCalculatedSpeed, weaponInteger, weaponVerse, weaponFloatStore } from '../../packages/content/src/weapon-numbers.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const prefix = '[Countries]\n0=Blue\n[VehicleTypes]\n0=TEST\n[TEST]\nStrength=100\nPrimary=Pulse\n';
const baseline = prefix + '[Pulse]\nDamage=12\nROF=20\nRange=4.5\nMinimumRange=0.5\nSpeed=20\nProjectile=Ray\nWarhead=Hit\n[Ray]\nInviso=yes\n[Hit]\nVerses=100%,90%,80%,70%,60%,50%,40%,30%,20%,10%,0%\n';
const mapBase = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Units]\n0=Player,TEST,256,2,2,0,Guard,None\n';
function fixture({ rules = baseline, map = mapBase, middle = [] as string[], profile = 'ra2' as 'ra2' | 'yr' } = {}) {
  const source = { id: 'synthetic-map', profile, sha256: hash(map) };
  const layers: RuntimeIniLayer[] = [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(rules), bytes: bytes(rules) },
    ...middle.map((s, i) => ({ id: `mod-${i}`, profile, order: i + 1, kind: 'mod' as const, sourceSha256: hash(s), bytes: bytes(s) })),
    { id: 'map', profile, order: 100, kind: 'map', sourceSha256: source.sha256, bytes: bytes(map) }];
  const table = compileRuntimeIni(profile, layers);
  const definitions = compileEntityDefinitions({ rules: table, objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }),
    art: compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: hash(''), bytes: bytes('') }]) });
  return { definitions, rules: table };
}

test('both profiles compile native scalar units, configured/derived speed, projectile defaults and armor ordering', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileWeaponDefinitions(fixture({ profile })), w = r.weapons[0]!, p = r.projectiles[0]!, h = r.warheads[0]!;
    assert.equal(w.fields.damage.value, 12); assert.equal(w.fields.rof.value, 20); assert.equal(w.fields.burst.value, 1);
    assert.equal(w.fields.range.value, 1152); assert.equal(w.fields.minimumRange.value, 128);
    assert.equal(w.fields.configuredSpeed.value, 51); assert.equal(w.fields.speed.value, 64);
    assert.equal(w.fields.projectile.value, 'projectile:ray'); assert.equal(w.fields.warhead.value, 'warhead:hit');
    assert.equal(p.fields.inviso.value, true); assert.equal(p.fields.aa.value, false); assert.equal(p.fields.ag.value, true);
    assert.equal(h.fields.verses.value!.length, 11); assert.equal(h.fields.verses.value![5], 0.5); assert.equal(h.fields.verses.value![10], 0);
    assert.equal(h.fields.proneDamage.value, 1); assert.equal(r.gravity.value, 3);
    assert.equal(w.status, 'typed'); assert.equal(r.coverage.rootClosuresTyped, true); assert.equal(r.coverage.rootLinksResolved, true);
    assert.equal(r.coverage.nativeAllocationComplete, false); assert.equal(r.canStartCampaign, false);
  }
});

test('stage defaults distinguish missing section, missing key, explicitly empty and reset verses', () => {
  const r = compileWeaponDefinitions(fixture({ middle: ['[Pulse]\nDamage=19\nRange=-1\n[Hit]\nCellSpread=1.25\n'] }));
  const w = r.weapons[0]!, h = r.warheads[0]!;
  assert.equal(w.fields.damage.value, 19); assert.deepEqual(w.fields.damage.history.map(o => o.layerId), ['rules', 'mod-0']);
  assert.equal(w.fields.range.value, 1152); assert.equal(w.fields.range.history.at(-1)!.rawValue, '-1');
  assert.deepEqual(h.fields.verses.value, Array(11).fill(1)); assert.equal(h.fields.verses.rule, 'present-section-missing-verses-resets');
  assert.equal(h.fields.cellSpread.value, 1.25); assert.equal(h.resets.at(-1)!.layerId, 'mod-0');
  const empty = compileWeaponDefinitions(fixture({ middle: ['[Hit]\nVerses=\n[Pulse]\nDamage=\n'] }));
  assert.equal(empty.weapons[0]!.fields.damage.value, 12); assert.equal(empty.warheads[0]!.fields.verses.value![10], 0);
  assert.equal(empty.warheads[0]!.fields.verses.history.at(-1)!.layerId, 'mod-0');
});

test('projectile-created weapons wait for next weapon pass and are not retrospectively loaded', () => {
  const rules = baseline.replace('[Ray]\n', '[Ray]\nAirburstWeapon=Late\n') + '[Late]\nDamage=99\nProjectile=Ray\nWarhead=Hit\n';
  const a = compileWeaponDefinitions(fixture({ rules })), late = a.weapons.find(w => w.name === 'Late')!;
  assert.equal(late.allocation.phase, 'projectile-load'); assert.equal(late.fields.damage.value, 0);
  assert.equal(late.fields.projectile.value, null); assert.equal(late.status, 'unsupported'); assert.equal(a.weapons[0]!.referenceClosure, 'unsupported'); assert.deepEqual(late.loadStages, []);
  const b = compileWeaponDefinitions(fixture({ rules, middle: ['[Late]\nDamage=5\nProjectile=Ray\nWarhead=Hit\n'] }));
  const loaded = b.weapons.find(w => w.name === 'Late')!;
  assert.equal(loaded.fields.damage.value, 5); assert.deepEqual(loaded.fields.damage.history.map(o => o.layerId), ['mod-0']);
  assert.deepEqual(loaded.loadStages, ['mod-0']); assert.equal(loaded.status, 'typed');
});

test('overwritten and cleared entity links retain prior weapon allocations with exact source hashes', () => {
  const r = compileWeaponDefinitions(fixture({ middle: ['[TEST]\nPrimary=Other\n[Other]\nDamage=1\nProjectile=Ray\nWarhead=Hit\n', '[TEST]\nPrimary=none\n'] }));
  assert.equal(r.links.find(l => l.slot === 'primary' && l.typeId === 'type:unit:test')!.field.value, null);
  assert.deepEqual(r.weapons.map(w => w.name), ['Pulse', 'Other']);
  assert.equal(r.weapons[0]!.fields.damage.origin!.sourceSha256, hash(baseline));
  assert.equal(r.weapons[1]!.allocation.stage, 'mod-0');
});

test('warhead registry spelling precedes reference spelling and unsupported ambiguity is surfaced', () => {
  const r = compileWeaponDefinitions(fixture({ rules: '[Warheads]\n5=HIT\n' + baseline + '[HIT]\nCellSpread=2\n' }));
  assert.equal(r.warheads.length, 1); assert.equal(r.warheads[0]!.name, 'HIT');
  assert.equal(r.warheads[0]!.fields.cellSpread.value, 2);
  assert.ok(r.warheads[0]!.unsupportedReasons.includes('case-variant-allocation-order'));
  assert.ok(r.diagnostics.some(d => d.code === 'unsupported-reference-target'));
});

test('unknown keys remain raw with provenance, profile-specific flags do not leak into RA2', () => {
  const rules = baseline.replace('Damage=12', 'Damage=12\nMystery= 10 ; retained\nIsMagBeam=yes');
  const ra2 = compileWeaponDefinitions(fixture({ rules })), yr = compileWeaponDefinitions(fixture({ rules, profile: 'yr' }));
  assert.equal(ra2.weapons[0]!.fields.isMagBeam!.status, 'not-applicable'); assert.equal(yr.weapons[0]!.fields.isMagBeam!.value, true);
  assert.equal(ra2.weapons[0]!.unhandledFields.find(o => o.keySpelling === 'Mystery')!.rawValue, ' 10 ; retained');
  assert.ok(ra2.diagnostics.some(d => d.code === 'profile-field-not-loaded'));
});

test('invalid field conversions, missing definitions and null references are retained as unsupported', () => {
  const r = compileWeaponDefinitions(fixture({ rules: baseline.replace('Damage=12', 'Damage=2147483648').replace('Projectile=Ray', 'Projectile=none').replace('Warhead=Hit', 'Warhead=Absent') }));
  assert.equal(r.weapons[0]!.fields.damage.value, null); assert.equal(r.weapons[0]!.status, 'unsupported');
  assert.equal(r.weapons[0]!.fields.projectile.value, null); assert.equal(r.weapons[0]!.fields.projectile.status, 'explicit');
  assert.equal(r.warheads[0]!.status, 'unsupported'); assert.ok(r.warheads[0]!.unsupportedReasons.includes('no-loaded-definition-section'));
  const badVerses = compileWeaponDefinitions(fixture({ rules: baseline.replace('100%,90%,80%,70%,60%,50%,40%,30%,20%,10%,0%', '10%,20%') }));
  assert.equal(badVerses.warheads[0]!.fields.verses.status, 'unsupported');
});

test('factory, profile, pins, immutable output and fingerprint identity are enforced', () => {
  const input = fixture(), a = compileWeaponDefinitions(input), b = compileWeaponDefinitions(fixture());
  assert.equal(a.fingerprint, b.fingerprint); assert.ok(isWeaponDefinitions(a)); assert.equal(isWeaponDefinitions({ ...a }), false);
  assert.throws(() => compileWeaponDefinitions({ ...input, definitions: { ...input.definitions } }), /entity-brand/);
  assert.throws(() => compileWeaponDefinitions({ ...input, rules: fixture({ profile: 'yr' }).rules }), /profile-source/);
  assert.throws(() => compileWeaponDefinitions({ ...input, rules: fixture({ rules: baseline + '; other content\n' }).rules }), /profile-source/);
  assert.throws(() => { (a.weapons[0]!.fields.damage as { value: number }).value = 99; }, TypeError);
  assert.notEqual(a.fingerprint, compileWeaponDefinitions(fixture({ rules: baseline + '; changed pin\n' })).fingerprint);
  let reads = 0; const hostile = { get definitions() { reads++; return input.definitions; }, rules: input.rules };
  assert.throws(() => compileWeaponDefinitions(hostile), /input/); assert.equal(reads, 0);
});

test('all selected loops admit lower resource limits before output expansion', () => {
  const input = fixture();
  for (const key of ['stages', 'occurrences', 'definitions', 'links', 'fieldReads', 'history', 'serializedBytes'] as const) {
    assert.throws(() => compileWeaponDefinitions(input, { [key]: 0 }), /limit/);
  }
  assert.throws(() => compileWeaponDefinitions(input, { links: WEAPON_DEFINITIONS_LIMITS.links + 1 }), /limit/);
  assert.throws(() => compileWeaponDefinitions(input, { links: -0 }), /limit/);
  assert.throws(() => compileWeaponDefinitions(input, { get links(): number { throw Error('invoked'); } }), /limit/);
});

test('repeated consumed sections/keys reject instead of picking a native CRC tie', () => {
  assert.throws(() => compileWeaponDefinitions(fixture({ rules: baseline + '[Pulse]\nBurst=2\n' })), /repeated-consumed-section/);
  assert.throws(() => compileWeaponDefinitions(fixture({ rules: baseline.replace('Damage=12', 'Damage=12\nDamage=9') })), /repeated-consumed-key/);
});

test('numeric policy uses percent atoi, exact dyadic verses, and bounded quantized native speed', () => {
  assert.equal(weaponInteger('12.8'), 12); assert.equal(weaponInteger('1e2'), 1); assert.equal(weaponInteger('$ffffffff'), -1);
  assert.equal(weaponVerse('0.9%'), 0); assert.equal(weaponVerse('90%'), 0.8999999999999999); assert.equal(weaponVerse('25.9%'), 0.25); assert.equal(weaponVerse('0.125'), 0.125);
  assert.equal(weaponVerse('0.1'), null); assert.equal(weaponVerse('0'), 0);
  assert.equal(weaponCalculatedSpeed(0, 3, false), 0); assert.equal(weaponCalculatedSpeed(1152, 3, false), 64);
  assert.equal(weaponCalculatedSpeed(1152, 3, true), 45); assert.equal(weaponCalculatedSpeed(-1, 3, false), null);
  assert.equal(weaponCalculatedSpeed(0x7fffffff, 0x7fffffff, false), null);
  assert.equal(weaponCalculatedSpeed(256, 3, false), 30);
  assert.equal(weaponCalculatedSpeed(20480, 6, false), 383); // Ordinary sqrt would round to384.
  assert.equal(weaponFloatStore(0.01), 0.009999999776482582);
  assert.equal(weaponCalculatedSpeed(-0, 3, false), null);
});

test('art-only projectile rotation and flat keys do not masquerade as loaded rules fields', () => {
 const r = compileWeaponDefinitions(fixture({ rules: baseline.replace('[Ray]\n', '[Ray]\nRotates=yes\nFlat=yes\n') }));
 const p = r.projectiles[0]!; assert.equal(Object.hasOwn(p.fields, 'rotates'), false); assert.equal(Object.hasOwn(p.fields, 'flat'), false);
 assert.deepEqual(p.unhandledFields.filter(o => ['Rotates', 'Flat'].includes(o.keySpelling)).map(o => o.keySpelling), ['Rotates', 'Flat']);
});
