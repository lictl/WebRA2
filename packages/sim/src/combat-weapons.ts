// SPDX-License-Identifier: GPL-3.0-or-later
// Original capability admission over source-bound weapon records. Native execution fidelity remains unverified.
import { isWeaponDefinitions, type WeaponDefinitions, type WeaponRecord } from '../../content/src/weapon-definitions.ts';
import type { IniOrigin } from '../../content/src/runtime-ini.ts';
import { combatFactor, createCombatModel, type CombatWeapon } from './combat-model.ts';
import { COMBAT_LIMITS } from './combat-limits.ts';
import { worldHash, worldInteger, worldRecord } from './world-values.ts';

export const COMBAT_WEAPONS_POLICY = 'webra2-standing-direct-weapons-1' as const;
export const COMBAT_WEAPONS_LIMITS = Object.freeze({ weapons: COMBAT_LIMITS.weapons, work: 32768 });
type Limits = { -readonly [K in keyof typeof COMBAT_WEAPONS_LIMITS]: number };
export interface CombatWeaponAdmission {
  readonly weaponId: string; readonly status: 'ready' | 'unsupported'; readonly reasons: readonly string[];
  readonly model: CombatWeapon | null; readonly deferredPresentation: readonly IniOrigin[];
}
export interface CombatWeapons {
  readonly policy: typeof COMBAT_WEAPONS_POLICY; readonly profile: WeaponDefinitions['profile'];
  readonly weaponDefinitionsSha256: string; readonly entityDefinitionsSha256: string;
  readonly sources: WeaponDefinitions['sources']; readonly records: readonly CombatWeaponAdmission[];
  readonly fingerprint: string; readonly actorRequirements: readonly string[];
  readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
export class CombatWeaponsError extends Error {
  constructor(readonly code: string) { super(`combat-weapons-${code}`); this.name = 'CombatWeaponsError'; }
}
const fail = (code: string): never => { throw new CombatWeaponsError(code); };
const results = new WeakSet<object>();
export const isCombatWeapons = (value: unknown): value is CombatWeapons => !!value && typeof value === 'object' && results.has(value);
type RecordFields = WeaponRecord<unknown>;
const weaponTrue = new Set(['decloakToFire', 'revealOnFire', 'fireWhileMoving', 'fireInTransport']);
const projectileTrue = new Set(['inviso', 'aa', 'ag']);
const warheadTrue = new Set(['bullets', 'affectsAllies']);
const animationReferences = new Set(['Anim', 'OccupantAnim', 'AssaultAnim', 'OpenToppedAnim', 'AnimList']);
const presentation = {
  weapon: new Set(['Report']),
  projectile: new Set(['Image', 'Shadow', 'FirersPalette']),
  warhead: new Set(['ShakeXlo', 'ShakeXhi', 'ShakeYlo', 'ShakeYhi', 'Bright', 'CombatLightSize', 'CLDisableBlue', 'CLDisableGreen']),
};

/** Admit the named standing/direct subset, retaining every excluded behavior as a reason. Actor admission is separate. */
export function compileCombatWeapons(input: { readonly weapons: WeaponDefinitions }, options: Partial<Limits> = {}): CombatWeapons {
  worldRecord(input, ['weapons']); const definitions = input.weapons;
  if (!isWeaponDefinitions(definitions)) fail('factory');
  const keys = Object.keys(COMBAT_WEAPONS_LIMITS).filter(k => !!options && Object.hasOwn(options, k)); worldRecord(options, keys);
  const cap: Limits = { ...COMBAT_WEAPONS_LIMITS };
  for (const key of keys as (keyof typeof cap)[]) cap[key] = worldInteger(options[key], 0, cap[key]);
  if (definitions.weapons.length > cap.weapons) fail('limit');
  let work = 0;
  const charge = () => { if (++work > cap.work) fail('work-limit'); };
  const projectiles = new Map(definitions.projectiles.map(p => [p.id, p])), warheads = new Map(definitions.warheads.map(w => [w.id, w]));
  const records: CombatWeaponAdmission[] = [];
  for (const weapon of definitions.weapons) {
    charge();
    const reasons: string[] = [], deferredPresentation: IniOrigin[] = [];
    const check = (record: RecordFields, allowed: Set<string>) => {
      if (record.status !== 'typed' || record.referenceClosure !== 'typed') reasons.push(`${record.id}:unresolved-native-definition`);
      for (const [key, field] of Object.entries(record.fields)) {
        charge();
        if (field.status === 'unsupported') reasons.push(`${record.id}:${key}:unsupported-value`);
        if (field.value === true && !allowed.has(key)) reasons.push(`${record.id}:${key}:unsupported-effect`);
      }
      for (const origin of record.unhandledFields) {
        charge();
        if (animationReferences.has(origin.keySpelling)) reasons.push(`${record.id}:${origin.keySpelling}:animation-gameplay-closure-required`);
        else if (presentation[record.kind].has(origin.keySpelling)) deferredPresentation.push(origin);
        else reasons.push(`${record.id}:${origin.keySpelling}:uninterpreted-field`);
      }
    };
    check(weapon, weaponTrue);
    const projectile = projectiles.get(weapon.fields.projectile.value ?? ''), warhead = warheads.get(weapon.fields.warhead.value ?? '');
    if (!projectile || !warhead) reasons.push('missing-projectile-or-warhead');
    let model: CombatWeapon | null = null;
    if (projectile && warhead) {
      check(projectile, projectileTrue); check(warhead, warheadTrue);
      const scalar = (record: RecordFields, key: string) => record.fields[key]?.value;
      const requireValue = (record: RecordFields, key: string, expected: number | boolean | null) => {
        if (scalar(record, key) !== expected) reasons.push(`${record.id}:${key}:outside-direct-policy`);
      };
      // Burst delays, physical trajectories, splash, healing and special effects require their own execution policies.
      for (const key of ['ambientDamage', 'radLevel']) requireValue(weapon, key, 0);
      requireValue(weapon, 'burst', 1);
      requireValue(projectile, 'inviso', true); requireValue(projectile, 'rot', 0);
      for (const key of ['arm', 'courseLockDuration', 'shrapnelCount', 'detonationAltitude']) requireValue(projectile, key, 0);
      requireValue(projectile, 'cluster', 1);
      for (const key of ['airburstWeapon', 'shrapnelWeapon']) requireValue(projectile, key, null);
      for (const key of ['cellSpread', 'cellInset', 'paralyzes']) requireValue(warhead, key, 0);
      // Other native death modes can create gameplay objects/effects, beyond an ordinary actor death.
      if (![0, 1, 2].includes(scalar(warhead, 'infDeath') as number)) reasons.push(`${warhead.id}:infDeath:unsupported-death-effect`);
      const damage = weapon.fields.damage.value, range = weapon.fields.range.value, minimumRange = weapon.fields.minimumRange.value, reload = weapon.fields.rof.value;
      const validInteger = (value: unknown, low: number, high: number): value is number => Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= low && (value as number) <= high;
      if (!validInteger(damage, 1, 1_000_000) || !validInteger(range, 0, COMBAT_LIMITS.range) || !validInteger(minimumRange, 0, range ?? 0) || !validInteger(reload, 1, COMBAT_LIMITS.delay)) reasons.push('unsupported-damage-range-or-reload');
      const ground = projectile.fields.ag.value, air = projectile.fields.aa.value, verses = warhead.fields.verses.value;
      if (typeof ground !== 'boolean' || typeof air !== 'boolean' || !ground && !air) reasons.push('unsupported-target-layer');
      if (!verses || verses.length !== 11 || verses.some(v => !Number.isFinite(v) || v < 0 || Object.is(v, -0))) reasons.push('unsupported-armor-factors');
      if (!reasons.length) {
        // Reuse the core factory to validate, own and freeze the exact runtime projection.
        model = createCombatModel({ weapons: [{ id: weapon.id, damage: damage!, range: range!, minimumRange: minimumRange!, reloadTicks: reload!,
          burst: 1, burstDelayTicks: 1, delivery: 'instant', speed: 0, ground: ground as boolean, air: air as boolean, verses: verses!.map(combatFactor) }],
        actors: [], allies: [] }).weapons[0]!;
      }
    }
    records.push(Object.freeze({ weaponId: weapon.id, status: model ? 'ready' : 'unsupported', reasons: Object.freeze([...new Set(reasons)].sort()),
      model, deferredPresentation: Object.freeze(deferredPresentation) }));
  }
  const common = { policy: COMBAT_WEAPONS_POLICY, profile: definitions.profile, weaponDefinitionsSha256: definitions.fingerprint,
    entityDefinitionsSha256: definitions.entityFingerprint, sources: definitions.sources, records: Object.freeze(records),
    actorRequirements: Object.freeze(['standing-unmodified-armor-and-damage', 'ordinary-initial-weapon-slots', 'source-bound-ammo-and-immunity',
      'source-bound-directed-allies', 'no-transport-garrison-deploy-cloak-or-veterancy-state']), nativeBehaviorVerified: false as const, canStartCampaign: false as const };
  const result = Object.freeze({ ...common, fingerprint: worldHash(common) }); results.add(result); return result;
}
