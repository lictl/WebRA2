// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound world joins; see ../COMBAT_CONTENT_PROVENANCE.md.
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { isCombatActors, type CombatActors } from '../../content/src/combat-actors.ts';
import { isWeaponDefinitions, type WeaponDefinitions } from '../../content/src/weapon-definitions.ts';
import { canonicalText } from './canonical.ts';
import { isWorldContent, type WorldContent } from './world-content.ts';
import { isCombatWeapons, type CombatWeapons } from './combat-weapons.ts';
import { inspectCombatPlacement, type CombatPlacementState } from './combat-placement.ts';
import { worldHash, worldInteger, worldRecord, WORLD_LIMITS } from './world-values.ts';

export const COMBAT_ROSTER_POLICY = 'webra2-world-combat-roster-1' as const;
export const COMBAT_ROSTER_LIMITS = Object.freeze({ actors: WORLD_LIMITS.entities, types: 16384, links: 32768, allies: 65536, work: 65536 });
type Limits = { -readonly [K in keyof typeof COMBAT_ROSTER_LIMITS]: number };
export interface CombatRosterInput {
  readonly world: WorldContent; readonly definitions: EntityDefinitions; readonly actors: CombatActors;
  readonly weapons: WeaponDefinitions; readonly capabilities: CombatWeapons;
}
export interface CombatRosterActor {
  readonly entityId: number; readonly rowId: string; readonly typeId: string | null;
  readonly ownerId: string | null; readonly playerId: number | null;
  readonly status: 'initial-state-ready' | 'unsupported'; readonly reasons: readonly string[];
  readonly armor: number | null; readonly initialAmmo: number | null;
  readonly immune: boolean | null; readonly typeImmune: boolean | null;
  readonly placement: CombatPlacementState;
  /** Preserve slot order and empty slots. A candidate weapon still needs effect and dynamic context proof. */
  readonly slots: readonly Readonly<{ slot: 'primary' | 'secondary'; weaponId: string | null; status: 'empty' | 'candidate' | 'unsupported' }>[];
}
export interface CombatRoster {
  readonly policy: typeof COMBAT_ROSTER_POLICY; readonly profile: EntityDefinitions['profile'];
  readonly worldSha256: string; readonly worldModelSha256: string; readonly entityDefinitionsSha256: string;
  readonly actorDefinitionsSha256: string; readonly weaponDefinitionsSha256: string; readonly capabilitiesSha256: string;
  readonly actors: readonly CombatRosterActor[];
  /** Empty when source alliance initialization is incomplete; never infer enemies from this list alone. */
  readonly alliances: Readonly<{ status: 'ready' | 'unsupported'; pairs: readonly Readonly<{ owner: number; ally: number }>[] }>;
  readonly requiredRuntimeWork: readonly string[];
  readonly coverage: Readonly<{ placements: number; initialStateReady: number; unsupported: number; weaponCandidates: number }>;
  readonly fingerprint: string; readonly canExecuteCombat: false; readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
export class CombatRosterError extends Error { constructor(readonly code: string) { super(`combat-roster-${code}`); this.name = 'CombatRosterError'; } }
const fail = (code: string): never => { throw new CombatRosterError(code); };
const compiled = new WeakSet<object>();
export const isCombatRoster = (v: unknown): v is CombatRoster => !!v && typeof v === 'object' && compiled.has(v);
const known = <T>(f: EntityField<T> | undefined): T | null => !f || f.status === 'unsupported' || f.status === 'not-applicable' ? null : f.value;

/** Bind independently compiled source facts to authoritative world IDs. This is initial-state preparation, not executable combat admission. */
export function compileCombatRoster(input: CombatRosterInput, options: Partial<Limits> = {}): CombatRoster {
  worldRecord(input, ['world', 'definitions', 'actors', 'weapons', 'capabilities']);
  const keys = Object.keys(COMBAT_ROSTER_LIMITS).filter(k => !!options && Object.hasOwn(options, k)); worldRecord(options, keys);
  const cap: Limits = { ...COMBAT_ROSTER_LIMITS };
  for (const k of keys as (keyof Limits)[]) cap[k] = worldInteger(options[k], 0, cap[k]);
  const { world, definitions, actors, weapons, capabilities } = input;
  if (!isWorldContent(world) || !isEntityDefinitions(definitions) || !isCombatActors(actors) || !isWeaponDefinitions(weapons) || !isCombatWeapons(capabilities)) fail('factory');
  if (world.definitionsSha256 !== definitions.fingerprint || actors.entityFingerprint !== definitions.fingerprint || weapons.entityFingerprint !== definitions.fingerprint ||
    capabilities.entityDefinitionsSha256 !== definitions.fingerprint || capabilities.weaponDefinitionsSha256 !== weapons.fingerprint) fail('definition-identity');
  if (world.model.contentIdentity.profile !== definitions.profile || actors.profile !== definitions.profile || weapons.profile !== definitions.profile || capabilities.profile !== definitions.profile ||
    world.model.sourceSha256 !== definitions.source.sha256 || canonicalText(actors.source) !== canonicalText(definitions.source) ||
    canonicalText(actors.sources) !== canonicalText(definitions.sources.rules) || canonicalText(weapons.sources) !== canonicalText(actors.sources) ||
    canonicalText(capabilities.sources) !== canonicalText(actors.sources)) fail('source-identity');
  const count = world.placements.length;
  if (count > cap.actors || definitions.definitions.length > cap.types || actors.definitions.length > cap.types || weapons.links.length > cap.links || actors.directedAllies.length > cap.allies) fail('limit');
  if (world.model.entities.length !== count || definitions.placements.length !== count || actors.placements.length !== count || world.players.length !== actors.houses.length) fail('join-count');
  let work = 0;
  const charge = () => { if (++work > cap.work) fail('work-limit'); };
  const types = new Map(definitions.definitions.map(d => { charge(); return [d.id, d] as const; }));
  const actorTypes = new Map(actors.definitions.map(d => { charge(); return [d.id, d] as const; }));
  if (types.size !== actorTypes.size) fail('type-join');
  for (const [id, type] of types) { const a = actorTypes.get(id); if (!a || a.kind !== type.kind || a.name !== type.name) fail('type-join'); }
  const houses = new Map(actors.houses.map(h => [h.houseId, h]));
  for (const p of world.players) { charge(); const h = houses.get(p.houseId); if (!h || h.houseIndex !== p.playerId || h.name !== p.name) fail('house-join'); }
  const linkMap = new Map<string, WeaponDefinitions['links'][number]>();
  for (const link of weapons.links) { charge(); const key = `${link.typeId}:${link.slot}`; if (!types.has(link.typeId) || linkMap.has(key)) fail('weapon-link'); linkMap.set(key, link); }
  const weaponMap = new Map(weapons.weapons.map(w => [w.id, w]));
  const capabilityMap = new Map(capabilities.records.map(r => [r.weaponId, r]));
  if (weaponMap.size !== capabilityMap.size) fail('capability-join');
  for (const id of weaponMap.keys()) if (!capabilityMap.has(id)) fail('capability-join');
  const actorRows = new Map(actors.placements.map(p => [p.rowId, p]));
  const definitionRows = new Map(definitions.placements.map(p => [p.rowId, p]));
  const rows: CombatRosterActor[] = []; let candidates = 0;
  for (let i = 0; i < count; i++) {
    charge(); const p = world.placements[i]!, e = world.model.entities[i]!, a = actorRows.get(p.rowId), d = definitionRows.get(p.rowId);
    if (!a || !d) return fail('placement-join');
    const source = a.sourcePlacement;
    if (p.entityId !== e.id || p.rowId !== e.rowId || p.rowId !== a.rowId || p.rowId !== d.rowId || source.row.id !== p.rowId ||
      p.typeId !== a.typeId || p.typeId !== d.typeId || p.typeId !== null && p.typeId !== e.typeId ||
      p.ownerId !== a.ownerId || p.ownerId !== d.ownerId || p.playerId !== a.ownerIndex || p.playerId !== e.owner ||
      e.kind !== source.kind || e.x !== source.x || e.y !== source.y || a.rawStrength !== source.strengthRaw || a.rawStrength !== d.rawStrength ||
      canonicalText(a.initialHealth) !== canonicalText(d.initialHealth)) fail('placement-join');
    const type = p.typeId === null ? undefined : types.get(p.typeId), actor = p.typeId === null ? undefined : actorTypes.get(p.typeId);
    if (e.maximumHealth !== null && (e.maximumHealth !== known(type?.strength) || e.initialHealth !== known(a.initialHealth))) fail('health-join');
    const reasons = [...p.reasons], placement = inspectCombatPlacement(source);
    if (!type || !actor) reasons.push('unresolved-type');
    if (placement.status !== 'ordinary-ground') reasons.push(...(placement.reasons.length ? placement.reasons : ['unsupported-placement-family']));
    if (e.initialHealth === null || e.initialHealth === 0) reasons.push('unsupported-initial-health');
    if (p.playerId === null) reasons.push('unresolved-owner');
    const armor = known(type?.armor), initialAmmo = known(actor?.startingAmmo), immune = known(actor?.fields.immune), typeImmune = known(actor?.fields.typeImmune);
    if (armor === null || !Number.isSafeInteger(armor) || armor < 0 || armor > 10) reasons.push('unsupported-armor');
    if (initialAmmo === null || !Number.isSafeInteger(initialAmmo) || initialAmmo < -1 || initialAmmo > WORLD_LIMITS.health) reasons.push('unsupported-initial-ammo');
    if (immune !== false) reasons.push('immune-or-unknown');
    if (typeImmune !== false) reasons.push('type-immune-or-unknown');
    if (!actor || !['ordinary', 'cleared'].includes(actor.normalSlots.mode)) reasons.push('conditional-or-unknown-slots');
    const slots = (['primary', 'secondary'] as const).map(slot => {
      charge(); const link = p.typeId === null ? undefined : linkMap.get(`${p.typeId}:${slot}`);
      if (!link || link.field.status === 'unsupported' || link.field.status === 'not-applicable') return Object.freeze({ slot, weaponId: link?.field.value ?? null, status: 'unsupported' as const });
      const weaponId = link.field.value;
      if (weaponId === null) return Object.freeze({ slot, weaponId, status: 'empty' as const });
      const capability = capabilityMap.get(weaponId);
      if (!weaponMap.has(weaponId) || !capability) return fail('weapon-join');
      const status = capability.status === 'ready' ? 'candidate' as const : 'unsupported' as const;
      if (status === 'candidate') candidates++;
      return Object.freeze({ slot, weaponId, status });
    });
    rows.push(Object.freeze({ entityId: e.id, rowId: p.rowId, typeId: p.typeId, ownerId: p.ownerId, playerId: p.playerId,
      status: reasons.length ? 'unsupported' : 'initial-state-ready', reasons: Object.freeze([...new Set(reasons)].sort()),
      armor, initialAmmo, immune, typeImmune, placement, slots: Object.freeze(slots) }));
  }
  const pairs = actors.coverage.initialAlliancesComplete ? actors.directedAllies.map(p => {
    charge(); if (houses.get(p.houseId)?.houseIndex !== p.houseIndex || houses.get(p.allyHouseId)?.houseIndex !== p.allyHouseIndex) fail('alliance-join');
    return Object.freeze({ owner: p.houseIndex, ally: p.allyHouseIndex });
  }) : [];
  const ready = rows.filter(r => r.status === 'initial-state-ready').length;
  const common = { policy: COMBAT_ROSTER_POLICY, profile: definitions.profile, worldSha256: world.sha256, worldModelSha256: world.model.sha256,
    entityDefinitionsSha256: definitions.fingerprint, actorDefinitionsSha256: actors.fingerprint, weaponDefinitionsSha256: weapons.fingerprint, capabilitiesSha256: capabilities.fingerprint,
    actors: Object.freeze(rows), alliances: Object.freeze({ status: actors.coverage.initialAlliancesComplete ? 'ready' as const : 'unsupported' as const, pairs: Object.freeze(pairs) }),
    requiredRuntimeWork: Object.freeze(['source-bound-type-country-house-and-difficulty-modifiers', 'weapon-animation-gameplay-closure', 'dynamic-projectile-impact-and-obstruction-context',
      'standing-state-and-subcell-distance-context', 'native-fire-delay-and-death-effects', 'complete-actor-capability-before-model-attachment']),
    coverage: Object.freeze({ placements: count, initialStateReady: ready, unsupported: count - ready, weaponCandidates: candidates }),
    canExecuteCombat: false as const, nativeBehaviorVerified: false as const, canStartCampaign: false as const };
  const result = Object.freeze({ ...common, fingerprint: worldHash(common) }); compiled.add(result); return result;
}
