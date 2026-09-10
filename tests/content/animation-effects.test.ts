// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic sources. No retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileAnimationEffects, isAnimationEffects, ANIMATION_EFFECTS_LIMITS } from '../../packages/content/src/animation-effects.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
const map = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Player\n[Player]\nCountry=Blue\n[Units]\n0=Player,TEST,256,2,2,0,Guard,None\n';
const base = '[Animations]\n0=Flash\n1=Impact\n[Countries]\n0=Blue\n[VehicleTypes]\n0=TEST\n[TEST]\nStrength=100\nPrimary=Pulse\n[Pulse]\nDamage=10\nAnim=Flash\nProjectile=Ray\nWarhead=Hit\n[Ray]\nInviso=yes\n[Hit]\nAnimList=Impact\n';
function fixture({ rules = base, art = '[Flash]\nRate=500\n[Impact]\nFlat=yes\n', middle = [] as string[], artMiddle = [] as string[], profile = 'yr' as 'ra2' | 'yr' } = {}) {
  const source = { id: 'map', profile, sha256: hash(map) };
  const layers = (texts: string[], ids: string[], kinds: RuntimeIniLayer['kind'][]) => texts.map((s, i) => ({ id: ids[i]!, profile, order: i, kind: kinds[i]!, sourceSha256: hash(s), bytes: bytes(s) }));
  const r = compileRuntimeIni(profile, layers([rules, ...middle, map], ['rules', ...middle.map((_, i) => `mod-${i}`), 'map'], ['base', ...middle.map(() => 'mod' as const), 'map']));
  const a = compileRuntimeIni(profile, layers([art, ...artMiddle], ['art', ...artMiddle.map((_, i) => `art-${i}`)], ['base', ...artMiddle.map(() => 'mod' as const)]));
  const definitions = compileEntityDefinitions({ rules: r, art: a, objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }) });
  return { weapons: compileWeaponDefinitions({ rules: r, definitions }), definitions, rules: r, art: a };
}
const firing = (r: ReturnType<typeof compileAnimationEffects>) => r.roots.find(v => v.ownerId === 'weapon:pulse')!;
const impact = (r: ReturnType<typeof compileAnimationEffects>) => r.roots.find(v => v.ownerId === 'warhead:hit')!;

test('both profiles prove ordinary zero-effect roots from initial registration and global art', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileAnimationEffects(fixture({ profile })), n = r.animations.find(a => a.name === 'Flash')!;
    assert.equal(firing(r).status, 'presentation-only'); assert.equal(impact(r).status, 'presentation-only');
    assert.equal(n.fields.Damage!.value, 0); assert.equal(n.fields.MakeInfantry!.status, profile === 'yr' ? 'default' : 'not-applicable');
    assert.deepEqual(n.loadStages, ['rules', 'map']); assert.equal(n.retainedFields[0]!.layerId, 'art');
    assert.equal(r.coverage.nativeAllocationComplete, false); assert.equal(r.canStartCampaign, false);
    assert.ok(r.excludedContexts.includes('actor-death-and-InfDeath-sequences'));
  }
});

test('Damage, MakeInfantry and the DropZone global identity block a zero-effect assumption', () => {
  const damage = compileAnimationEffects(fixture({ art: '[Flash]\nDamage=0.5\n[Impact]\n' }));
  assert.equal(firing(damage).status, 'gameplay-active'); assert.equal(damage.animations[0]!.fields.Damage!.value, 0.5);
  const infantry = compileAnimationEffects(fixture({ art: '[Flash]\nMakeInfantry=0\n[Impact]\n' }));
  assert.equal(firing(infantry).status, 'gameplay-active');
  const ra2 = compileAnimationEffects(fixture({ profile: 'ra2', art: '[Flash]\nMakeInfantry=0\n[Impact]\n' }));
  assert.equal(firing(ra2).status, 'presentation-only'); assert.equal(ra2.animations[0]!.fields.MakeInfantry!.history.length, 2);
  for (const profile of ['ra2', 'yr'] as const) {
    const r = compileAnimationEffects(fixture({ profile, rules: base + `[${profile === 'ra2' ? 'AudioVisual' : 'General'}]\nDropZoneAnim=Flash\n` }));
    assert.equal(firing(r).status, 'gameplay-active'); assert.equal(r.globals.dropZoneAnim.value, 'animation:flash');
  }
});

test('smudges, particles, tiberium, special modes, random timing and unknown fields are not discarded', () => {
  for (const row of ['Scorch=yes', 'Crater=yes', 'Flamer=yes', 'IsMeteor=yes', 'TiberiumChainReaction=yes', 'Bouncer=yes', 'SpawnsParticle=Unknown', 'RandomRate=2,4', 'RandomLoopDelay=1,1', 'ExtensionDamage=10', 'damage=5', 'Damage=-1', 'Damage=NaN']) {
    const r = compileAnimationEffects(fixture({ art: `[Flash]\n${row}\n[Impact]\n` }));
    assert.notEqual(firing(r).status, 'presentation-only', row);
    assert.equal(r.animations[0]!.retainedFields[0]!.rawValue, row.slice(row.indexOf('=') + 1));
  }
});

test('phase ordering uses global art and does not retrospectively load newly allocated weapon roots', () => {
  const input = fixture({ rules: base.replace('0=Flash\n', '').replace('Anim=Flash', 'Anim=Late'), art: '[Late]\nDamage=50\n[Impact]\n' });
  const r = compileAnimationEffects(input), n = r.animations.find(a => a.name === 'Late')!;
  assert.equal(n.allocation.phase, 'weapon-load'); assert.equal(n.allocation.stage, 'rules');
  assert.deepEqual(n.loadStages, ['map']); assert.equal(n.fields.Damage!.value, 50); assert.equal(firing(r).status, 'gameplay-active');
  assert.equal(n.initialRegistrySpelling, false);
  const late = compileAnimationEffects(fixture({ rules: base.replace('0=Flash\n', ''), art: '[Flash]\n[Impact]\n' }));
  assert.equal(firing(late).status, 'unknown');
});

test('next/spawn/bounce/expiry/trailer closure retains origins, late allocation and bounded cycles', () => {
  for (const key of ['Next', 'Spawns', 'BounceAnim', 'ExpireAnim', 'TrailerAnim']) {
    const r = compileAnimationEffects(fixture({ art: `[Flash]\n${key}=Impact\n[Impact]\nDamage=2\n` }));
    assert.equal(firing(r).status, 'gameplay-active'); assert.deepEqual(firing(r).reachableIds, ['animation:flash', 'animation:impact']);
    assert.equal(r.animations[0]!.edges[0]!.origin!.keySpelling, key);
  }
  const cycle = compileAnimationEffects(fixture({ art: '[Flash]\nNext=Impact\n[Impact]\nNext=Flash\n' }));
  assert.equal(firing(cycle).status, 'unknown'); assert.ok(firing(cycle).reasons.includes('animation-cycle'));
  const dynamic = compileAnimationEffects(fixture({ art: '[Flash]\nNext=Other\n[Impact]\n[Other]\nDamage=3\n' }));
  const n = dynamic.animations.find(a => a.name === 'Other')!;
  assert.equal(n.allocation.stage, 'rules'); assert.equal(n.allocation.origin.layerId, 'art'); assert.equal(n.loadStages[0], 'rules');
});

test('native comma-only lists replace on nonempty input and preserve missing/empty histories', () => {
  const r = compileAnimationEffects(fixture({ middle: ['[Pulse]\nAnim=Impact,,none\n', '[Pulse]\nAnim=\n'] }));
  assert.deepEqual(firing(r).animations.value, ['animation:impact']);
  assert.deepEqual(firing(r).animations.history.map(o => o.layerId), ['rules', 'mod-0', 'mod-1']);
  assert.ok(r.animations.some(a => a.id === 'animation:flash'));
  const clear = compileAnimationEffects(fixture({ middle: ['[Pulse]\nAnim=none\n'] })); assert.deepEqual(firing(clear).animations.value, []);
  const space = compileAnimationEffects(fixture({ rules: base.replace('Anim=Flash', 'Anim=Flash, Impact') })); assert.equal(firing(space).status, 'unsupported');
  const long = compileAnimationEffects(fixture({ rules: base.replace('Anim=Flash', `Anim=${'Flash,'.repeat(23)}`) })); assert.equal(firing(long).status, 'unsupported');
});

test('conditional global impact root remains distinct from ordinary warhead list', () => {
  const r = compileAnimationEffects(fixture({ rules: base + '[General]\nLightningWarhead=Hit\nWeatherConBoltExplosion=Flash\n', art: '[Flash]\nDamage=4\n[Impact]\n' }));
  assert.equal(impact(r).status, 'presentation-only');
  assert.equal(r.roots.find(v => v.context === 'lightning-warhead-impact')!.status, 'gameplay-active');
  assert.equal(r.globals.lightningWarhead.value, 'Hit');
});

test('exact spelling, missing definitions and native duplicate ambiguity remain visible', () => {
  const alias = compileAnimationEffects(fixture({ rules: base.replace('Anim=Flash', 'Anim=FLASH') }));
  assert.equal(firing(alias).status, 'unknown'); assert.ok(firing(alias).reasons.some(s => s.endsWith('case-variant-allocation')));
  const missing = compileAnimationEffects(fixture({ art: '[flash]\nDamage=3\n[Impact]\n' })); assert.equal(firing(missing).status, 'unknown');
  for (const art of ['[Flash]\nDamage=1\nDamage=2\n', '[Flash]\nRate=1\n[Flash]\nDamage=2\n']) assert.equal(firing(compileAnimationEffects(fixture({ art }))).status, 'unknown');
  assert.throws(() => compileAnimationEffects(fixture({ rules: base.replace('1=Impact', '0=Impact') })), /repeated-registry-key/);
});

test('multiple global art stages cannot be silently merged into an admission proof', () => {
  const r = compileAnimationEffects(fixture({ artMiddle: ['[Flash]\nDamage=5\n'] }));
  assert.equal(firing(r).status, 'unknown'); assert.ok(firing(r).reasons.includes('multiple-or-missing-global-art-stage'));
});

test('genuine graph/entity identity and exact source pins are required before processing', () => {
  const f = fixture(), other = fixture({ art: '[Flash]\nImage=Other\n[Impact]\n' });
  assert.throws(() => compileAnimationEffects({ ...f, weapons: { ...f.weapons } }), /factory/);
  assert.throws(() => compileAnimationEffects({ ...f, definitions: other.definitions }), /entity-identity/);
  assert.throws(() => compileAnimationEffects({ ...f, art: other.art }), /profile-source/);
  assert.throws(() => compileAnimationEffects({ ...f, rules: fixture({ profile: 'ra2' }).rules }), /profile-source/);
  let touched = false; const hostile = Object.defineProperty({}, 'weapons', { get() { touched = true; return f.weapons; } });
  assert.throws(() => compileAnimationEffects(hostile as typeof f), /input/); assert.equal(touched, false);
});

test('hostile prototype names are inert data and output is immutable, canonical and branded', () => {
  const input = fixture({ rules: base.replaceAll('Flash', 'constructor'), art: '[constructor]\n__proto__=yes\n[Impact]\n' });
  const a = compileAnimationEffects(input), b = compileAnimationEffects(input);
  assert.equal(a.fingerprint, b.fingerprint); assert.ok(isAnimationEffects(a)); assert.equal(isAnimationEffects({ ...a }), false);
  assert.equal(firing(a).status, 'unknown'); assert.equal(a.animations[0]!.name, 'constructor');
  assert.throws(() => { (a.animations as unknown[]).push({}); }); assert.throws(() => { (a.animations[0]!.fields.Damage as { value: number }).value = 9; });
});

test('lower-only budgets bound source reconstruction, dynamic expansion, histories and closure work', () => {
  const input = fixture({ art: '[Flash]\nNext=Other\n[Impact]\n[Other]\nNext=Final\n[Final]\n' });
  for (const [key, value] of Object.entries({ roots: 0, animations: 2, references: 0, history: 0, work: 0, nodes: 0, characters: 0, serializedBytes: 0 })) {
    assert.throws(() => compileAnimationEffects(input, { [key]: value }), /limit/, key);
  }
  assert.throws(() => compileAnimationEffects(input, { animations: ANIMATION_EFFECTS_LIMITS.animations + 1 }), /limit/);
  assert.throws(() => compileAnimationEffects(input, { work: -0 }), /limit/);
  let touched = false; const cap = Object.defineProperty({}, 'work', { enumerable: true, get() { touched = true; return 1; } });
  assert.throws(() => compileAnimationEffects(input, cap), /limit/); assert.equal(touched, false);
});


test('RA2 AudioVisual globals follow properties while YR General globals precede them', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const section = profile === 'ra2' ? 'AudioVisual' : 'General';
    const r = compileAnimationEffects(fixture({ profile, rules: base + `[${section}]\nWeatherConBoltExplosion=Other\n`, art: '[Flash]\n[Impact]\n[Other]\nDamage=7\n' }));
    const n = r.animations.find(a => a.name === 'Other')!;
    assert.equal(n.allocation.phase, profile === 'ra2' ? 'audio-visual' : 'general');
    assert.deepEqual(n.loadStages, profile === 'ra2' ? ['map'] : ['rules', 'map']);
    const wrong = compileAnimationEffects(fixture({ profile, rules: base + `[${profile === 'ra2' ? 'General' : 'AudioVisual'}]\nDropZoneAnim=Flash\n` }));
    assert.equal(wrong.globals.dropZoneAnim.value, null); assert.equal(firing(wrong).status, 'presentation-only');
  }
});
