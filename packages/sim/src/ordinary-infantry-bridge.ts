// SPDX-License-Identifier: GPL-3.0-or-later
// Original source/world composition. See ../ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md.
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { isCombatActors, type CombatActors } from '../../content/src/combat-actors.ts';
import { isWeaponDefinitions, type WeaponDefinitions } from '../../content/src/weapon-definitions.ts';
import { isInstantWeaponContexts, evaluateInstantWeaponContext, type InstantWeaponContexts, type InstantWeaponContext } from '../../content/src/instant-weapons.ts';
import { isAnimationEffects, type AnimationEffects } from '../../content/src/animation-effects.ts';
import { isCombatModifiers, type CombatModifiers } from '../../content/src/combat-modifiers.ts';
import { isCombatVeterancy, selectCombatVeterancy, type CombatVeterancy } from '../../content/src/combat-veterancy.ts';
import { isCombatInitialRuntime, createInfantryFiringProgram, type CombatInitialRuntime, type InfantryFiringProgram } from '../../content/src/combat-initial-runtime.ts';
import { isCombatDeath, type CombatDeath } from '../../content/src/combat-death.ts';
import { isOrdinaryDeath, selectOrdinaryInfantryDeath, type OrdinaryDeath, type OrdinaryDeathDecision } from '../../content/src/combat-death-runtime.ts';
import { isTerrainTraversal, type TerrainTraversal } from '../../content/src/terrain-traversal.ts';
import { combatActorFingerprint } from '../../content/src/combat-actor-values.ts';
import { isWorldContent, type WorldContent } from './world-content.ts';
import { compileCombatWeapons } from './combat-weapons.ts';
import { compileCombatRoster } from './combat-roster.ts';
import { createCombatModel, combatFactor, type CombatModel, type CombatWeapon, type CombatActor } from './combat-model.ts';
import { createOrdinaryCombatRules, type OrdinaryCombatActor } from './ordinary-combat-rules.ts';
import { createOrdinaryDeathRules, type OrdinaryDeathActor } from './ordinary-death-rules.ts';
import { assertWorldModel, worldHash, worldRecord, worldInteger, worldPosition, type WorldModel } from './world-model.ts';
import { WorldSimulation, type WorldState } from './world.ts';
import { canonicalText } from './canonical.ts';

export const ORDINARY_INFANTRY_BRIDGE_POLICY = 'webra2-standing-human-source-combat-1' as const;
export const ORDINARY_INFANTRY_BRIDGE_LIMITS = Object.freeze({ actors: 2048, types: 16384, weapons: 1024,
  terrainCells: 130816, contextCells: 4096, work: 262144, contextWork: 65536, reasonCharacters: 1_048_576, serializedBytes: 8 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof ORDINARY_INFANTRY_BRIDGE_LIMITS]: number };
export interface OrdinaryInfantryBridgeInput {
  readonly world: WorldContent; readonly definitions: EntityDefinitions; readonly actors: CombatActors; readonly weapons: WeaponDefinitions;
  readonly instant: InstantWeaponContexts; readonly effects: AnimationEffects; readonly modifiers: CombatModifiers; readonly veterancy: CombatVeterancy;
  readonly initial: CombatInitialRuntime; readonly death: CombatDeath; readonly ordinaryDeath: OrdinaryDeath; readonly traversal: TerrainTraversal;
  readonly seed: number; readonly sequence11Ticks: number; readonly sequence12Ticks: number;
}
export interface OrdinaryInfantryActor {
  readonly entityId: number; readonly rowId: string; readonly typeId: string | null; readonly ownerId: string | null; readonly playerId: number | null;
  readonly role: 'attacker' | 'target-only' | 'movement-only'; readonly attackReasons: readonly string[]; readonly targetReasons: readonly string[];
  readonly weaponId: string | null; readonly currentWeaponId: string | null; readonly warheadId: string | null; readonly veterancy: number | null;
}
export interface OrdinaryInfantryBridge {
  readonly policy: typeof ORDINARY_INFANTRY_BRIDGE_POLICY; readonly profile: 'ra2' | 'yr'; readonly fingerprint: string;
  readonly baseModelSha256: string; readonly combat: CombatModel | null; readonly programs: readonly InfantryFiringProgram[];
  readonly actors: readonly OrdinaryInfantryActor[]; readonly pins: Readonly<Record<string, string>>; readonly limits: Readonly<Limits>;
  readonly coverage: Readonly<{ attackers: number; targetOnly: number; movementOnly: number; weapons: number }>;
  readonly canStartCampaign: false;
}
export interface OrdinaryInfantryAttack {
  readonly status: 'eligible' | 'unsupported'; readonly reasons: readonly string[]; readonly sourceId: number; readonly targetId: number;
  readonly weaponId: string | null; readonly programSha256: string | null; readonly contextSha256: string;
  readonly deathSelection: OrdinaryDeathDecision | null; readonly work: number;
}
export class OrdinaryInfantryBridgeError extends Error {
  constructor(readonly code: string) { super(`ordinary-infantry-${code}`); this.name = 'OrdinaryInfantryBridgeError'; }
}
const fail = (code: string): never => { throw new OrdinaryInfantryBridgeError(code); };
const known = <T>(f: EntityField<T> | undefined): T | null => !f || ['unsupported', 'not-applicable'].includes(f.status) ? null : f.value;
const same = (a: unknown, b: unknown): boolean => canonicalText(a) === canonicalText(b);
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
type Private = { input: OrdinaryInfantryBridgeInput; rows: Map<number, OrdinaryInfantryActor>; terrain: Map<number, TerrainTraversal['cells'][number]>;
  programs: Map<number, InfantryFiringProgram>; movementHash: string };
const bridges = new WeakMap<object, Private>();
export const isOrdinaryInfantryBridge = (v: unknown): v is OrdinaryInfantryBridge => !!v && typeof v === 'object' && bridges.has(v);
function movementHash(model: WorldModel): string {
  return worldHash({ contentIdentity: model.contentIdentity, sourceSha256: model.sourceSha256, definitionsSha256: model.definitionsSha256,
    entities: model.entities, navigation: model.navigation.map(n => ({ hash: n.grid.sha256, costScale: n.costScale })), blocked: model.blocked, footprints: model.footprints });
}
function settings(options: Partial<Limits>): Limits {
  const keys = Reflect.ownKeys(options); if (keys.some(k => typeof k !== 'string' || !Object.hasOwn(ORDINARY_INFANTRY_BRIDGE_LIMITS, k))) fail('limits');
  const r = worldRecord(options, keys as string[]), cap = { ...ORDINARY_INFANTRY_BRIDGE_LIMITS } as Limits;
  for (const k of keys as (keyof Limits)[]) cap[k] = worldInteger(r[k], 0, cap[k]); return cap;
}
function authenticate(i: OrdinaryInfantryBridgeInput): void {
  if (!isWorldContent(i.world) || !isEntityDefinitions(i.definitions) || !isCombatActors(i.actors) || !isWeaponDefinitions(i.weapons) ||
    !isInstantWeaponContexts(i.instant) || !isAnimationEffects(i.effects) || !isCombatModifiers(i.modifiers) || !isCombatVeterancy(i.veterancy) ||
    !isCombatInitialRuntime(i.initial) || !isCombatDeath(i.death) || !isOrdinaryDeath(i.ordinaryDeath) || !isTerrainTraversal(i.traversal)) fail('factory');
  const d = i.definitions, a = i.actors, w = i.weapons;
  if (i.world.definitionsSha256 !== d.fingerprint || a.entityFingerprint !== d.fingerprint || w.entityFingerprint !== d.fingerprint ||
    i.instant.weaponDefinitionsSha256 !== w.fingerprint || i.instant.entityDefinitionsSha256 !== d.fingerprint ||
    i.effects.entityFingerprint !== d.fingerprint || i.effects.weaponFingerprint !== w.fingerprint ||
    i.modifiers.actorFingerprint !== a.fingerprint || i.veterancy.actorFingerprint !== a.fingerprint || i.initial.actorFingerprint !== a.fingerprint ||
    i.initial.entityFingerprint !== d.fingerprint || i.death.actorFingerprint !== a.fingerprint || i.death.entityFingerprint !== d.fingerprint ||
    i.death.weaponFingerprint !== w.fingerprint || i.death.effectFingerprint !== i.effects.fingerprint ||
    i.ordinaryDeath.deathFingerprint !== i.death.fingerprint || i.ordinaryDeath.veterancyFingerprint !== i.veterancy.fingerprint ||
    i.world.traversalSha256 !== i.traversal.sha256) fail('fingerprint-join');
  if ([a, w, i.instant, i.effects, i.modifiers, i.veterancy, i.initial, i.death, i.ordinaryDeath].some(s => s.profile !== d.profile) ||
    i.traversal.contentIdentity.profile !== d.profile || !same(i.world.model.contentIdentity, i.traversal.contentIdentity) ||
    [a, i.modifiers, i.veterancy, i.initial, i.death, i.ordinaryDeath, i.traversal].some(s => !same(s.source, d.source)) ||
    [a.sources, w.sources, i.instant.sources, i.modifiers.sources, i.veterancy.sources, i.initial.sources.rules].some(s => !same(s, d.sources.rules)) ||
    [i.effects.sources, i.death.sources, i.ordinaryDeath.sources].some(s => !same(s, d.sources)) || !same(i.initial.sources.art, d.sources.art)) fail('source-join');
  if (i.world.model.combat) fail('already-combat-bound');
}

/** Authenticates the prepared sources. This program is a closed standing-human mode, not general native weapon admission. */
export function compileOrdinaryInfantryBridge(input: OrdinaryInfantryBridgeInput, options: Partial<Limits> = {}): OrdinaryInfantryBridge {
  const i = worldRecord(input, ['world', 'definitions', 'actors', 'weapons', 'instant', 'effects', 'modifiers', 'veterancy', 'initial', 'death', 'ordinaryDeath', 'traversal', 'seed', 'sequence11Ticks', 'sequence12Ticks']) as unknown as OrdinaryInfantryBridgeInput;
  const cap = settings(options); authenticate(i);
  const seed = worldInteger(i.seed, 0, 0xffffffff), sequence11Ticks = worldInteger(i.sequence11Ticks, 1, 10000), sequence12Ticks = worldInteger(i.sequence12Ticks, 1, 10000);
  if (i.world.placements.length > cap.actors || i.definitions.definitions.length > cap.types || i.weapons.weapons.length > cap.weapons || i.traversal.cells.length > cap.terrainCells) fail('limit');
  let work = 0, reasonCharacters = 0;
  const charge = (n = 1): void => { work += n; if (work > cap.work) fail('work-limit'); };
  const reasons = (values: string[]): readonly string[] => { const out = [...new Set(values)].sort(); for (const r of out) reasonCharacters += r.length;
    if (reasonCharacters > cap.reasonCharacters) fail('reason-limit'); return Object.freeze(out); };
  const capabilities = compileCombatWeapons({ weapons: i.weapons });
  const roster = compileCombatRoster({ world: i.world, definitions: i.definitions, actors: i.actors, weapons: i.weapons, capabilities });
  const types = new Map(i.definitions.definitions.map(t => [t.id, t])), actors = new Map(i.actors.definitions.map(a => [a.id, a]));
  const initial = new Map(i.initial.placements.map(p => [p.rowId, p])), houses = new Map(i.modifiers.houses.map(h => [h.houseId, h]));
  const weapons = new Map(i.weapons.weapons.map(w => [w.id, w])), warheads = new Map(i.weapons.warheads.map(w => [w.id, w]));
  const primary = new Map(i.weapons.links.filter(l => l.slot === 'primary').map(l => [l.typeId, l.field]));
  const rows: OrdinaryInfantryActor[] = [], combatActors: CombatActor[] = [], numeric: OrdinaryCombatActor[] = [], programs: InfantryFiringProgram[] = [], deathActors: OrdinaryDeathActor[] = [];
  const readyWeapons = new Map<string, CombatWeapon>(), deathWeapons = new Map<string, { weaponId: string; infDeath: 1 | 2 }>();
  for (const p of roster.actors) {
    charge(); const type = p.typeId === null ? undefined : types.get(p.typeId), actor = p.typeId === null ? undefined : actors.get(p.typeId), fresh = initial.get(p.rowId);
    const source = i.world.model.entities.find(e => e.id === p.entityId)!;
    const weaponId = p.typeId === null ? null : known(primary.get(p.typeId)), weapon = weaponId === null ? undefined : weapons.get(weaponId), warhead = weapon ? warheads.get(known(weapon.fields.warhead) ?? '') : undefined;
    const selected = fresh?.veterancy !== null && fresh?.veterancy !== undefined && type && ['infantry', 'unit', 'aircraft', 'structure'].includes(type.kind)
      ? selectCombatVeterancy(i.veterancy, { typeId: type.id, veterancy: fresh.veterancy }) : null;
    const house = p.ownerId === null ? undefined : houses.get(p.ownerId), deathType = i.ordinaryDeath.types.find(t => t.typeId === p.typeId);
    // Source rank is typed independently. Other active veteran consumers stay explicit until implemented.
    const common = p.reasons.filter(r => r !== 'initial-veterancy');
    if (type?.kind !== 'infantry' || known(type.locomotor)?.kind !== 'walk') common.push('not-standing-Walk-infantry');
    if (fresh?.status !== 'ready' || fresh.actorId !== p.entityId) common.push('fresh-source-state');
    const veteranType = i.veterancy.types.find(t => t.typeId === p.typeId);
    if (selected && (selected.rank === 'veteran' || selected.rank === 'elite')) {
      const lists = selected.rank === 'veteran' ? [known(veteranType?.veteran)] : [known(veteranType?.veteran), known(veteranType?.elite)];
      for (const list of lists) { if (list === null) common.push('unknown-active-veterancy'); else for (const name of list)
        if (!['FIREPOWER', 'STRONGER', 'ROF', 'EXPLODES'].includes(name)) common.push(`active-veterancy:${name}`); }
    }
    if (!selected || selected.enabled.explodes !== false || Object.values(selected.modifiers).some(v => v === null)) common.push('veterancy-context');
    const factors = house && selected && fresh?.status === 'ready' ? {
      entityId: p.entityId, houseFirepower: known(house.fields.firepower), actorFirepower: fresh.actorFirepower,
      veteranCombat: selected.modifiers.combat, countryArmor: known(house.fields.countryArmorInfantry), actorArmor: fresh.actorArmor,
      veteranArmor: selected.modifiers.armor, houseRof: known(house.fields.rof), veteranRof: selected.modifiers.rof } : null;
    if (!factors || Object.values(factors).some(v => v === null) || house?.houseIndex !== p.playerId) common.push('numerical-source');
    if (!source.blocksCell || source.navigationClass === null) common.push('walk-occupancy-source');
    const targetReasons = [...common];
    if (deathType?.status !== 'conditional-human' || deathType.corpse?.status !== 'presentation-fields-only') targetReasons.push('ordinary-human-death-source', ...deathType?.reasons ?? []);
    if (weaponId !== null && (!weapon || weapon.status !== 'typed' || known(weapon.fields.suicide) !== false)) targetReasons.push('current-weapon-source');
    const attackReasons = [...targetReasons];
    if (roster.alliances.status !== 'ready') attackReasons.push('incomplete-alliance-source');
    const context = i.instant.records.find(r => r.weaponId === weaponId), capability = capabilities.records.find(r => r.weaponId === weaponId);
    const fire = i.effects.roots.find(r => r.ownerId === weaponId && r.key === 'Anim' && r.context === 'ordinary-firing');
    const impact = i.effects.roots.find(r => r.ownerId === warhead?.id && r.key === 'AnimList' && r.context === 'ordinary-impact');
    const effectReady = fire?.status === 'presentation-only' && impact?.status === 'presentation-only';
    if (context?.status !== 'context-supported') attackReasons.push('instant-source');
    if (!effectReady) attackReasons.push('ordinary-animation-closure');
    for (const r of capability?.reasons ?? ['no-primary-weapon']) {
      charge();
      if (/:(subjectToElevation|subjectToCliffs|subjectToWalls|wall|wood|conventional):unsupported-effect$/.test(r) && context?.status === 'context-supported') continue;
      if (/:(Anim|AnimList):animation-gameplay-closure-required$/.test(r) && effectReady) continue;
      // Native normal infantry Fire cannot select OccupantAnim. AssaultAnim's separate consumer requires a building target.
      if (/:(OccupantAnim|AssaultAnim):animation-gameplay-closure-required$/.test(r)) continue;
      if (r === 'unsupported-damage-range-or-reload' && weapon && known(weapon.fields.rof) === 0 &&
        Number.isSafeInteger(known(weapon.fields.damage)) && known(weapon.fields.damage)! > 0 && known(weapon.fields.damage)! <= 1_000_000 &&
        Number.isSafeInteger(known(weapon.fields.range)) && known(weapon.fields.range)! >= 0 && known(weapon.fields.range)! <= 262144 &&
        Number.isSafeInteger(known(weapon.fields.minimumRange)) && known(weapon.fields.minimumRange)! >= 0 && known(weapon.fields.minimumRange)! <= known(weapon.fields.range)!) continue;
      attackReasons.push(r);
    }
    if (known(actor?.startingAmmo) !== -1) attackReasons.push('finite-ammo-reload-not-bound');
    if (!warhead || known(warhead.fields.infDeath) !== 1 && known(warhead.fields.infDeath) !== 2) attackReasons.push('ordinary-death-mode');
    if (i.initial.types.find(t => t.typeId === p.typeId)?.standingPrimary.status !== 'ready') attackReasons.push('standing-fire-program');
    const target = reasons(targetReasons), attack = reasons(attackReasons), role = target.length ? 'movement-only' as const : attack.length ? 'target-only' as const : 'attacker' as const;
    rows.push(freeze({ entityId: p.entityId, rowId: p.rowId, typeId: p.typeId, ownerId: p.ownerId, playerId: p.playerId, role,
      attackReasons: attack, targetReasons: target, weaponId: role === 'attacker' ? weaponId : null, currentWeaponId: weaponId,
      warheadId: role === 'attacker' ? warhead!.id : null, veterancy: fresh?.veterancy ?? null }));
    if (role === 'movement-only') continue;
    combatActors.push({ entityId: p.entityId, armor: p.armor!, layer: 'ground', weapons: role === 'attacker' ? [weaponId!] : [], initialAmmo: p.initialAmmo! });
    numeric.push(factors as OrdinaryCombatActor);
    deathActors.push({ entityId: p.entityId, corpseAnimationIds: deathType!.corpse!.candidates.map(c => c.animationId), sequence11Ticks, sequence12Ticks });
    if (role === 'attacker') {
      programs.push(createInfantryFiringProgram(i.initial, p.rowId));
      readyWeapons.set(weaponId!, { id: weaponId!, damage: known(weapon!.fields.damage)!, range: known(weapon!.fields.range)!, minimumRange: known(weapon!.fields.minimumRange)!,
        reloadTicks: known(weapon!.fields.rof)!, burst: 1, burstDelayTicks: 1, delivery: 'instant', speed: 0, ground: true, air: false, verses: known(warhead!.fields.verses)!.map(combatFactor) });
      deathWeapons.set(weaponId!, { weaponId: weaponId!, infDeath: known(warhead!.fields.infDeath) as 1 | 2 });
    }
  }
  charge(i.traversal.cells.length);
  const selectedWeapons = [...readyWeapons.values()], combat = selectedWeapons.length ? createCombatModel({ actors: combatActors, weapons: selectedWeapons, infantryFiring: programs,
    allies: roster.alliances.pairs.map(a => ({ playerId: a.owner, allyId: a.ally })),
    ordinary: createOrdinaryCombatRules({ seed, actors: numeric, weapons: selectedWeapons.map(w => ({ weaponId: w.id, maxDamage: known(i.instant.globals.maxDamage)! })) }),
    ordinaryDeath: createOrdinaryDeathRules({ actors: deathActors, weapons: [...deathWeapons.values()] }) }) : null;
  const pins = { world: i.world.sha256, model: i.world.model.sha256, entities: i.definitions.fingerprint, actors: i.actors.fingerprint, weapons: i.weapons.fingerprint,
    instant: i.instant.fingerprint, effects: i.effects.fingerprint, modifiers: i.modifiers.fingerprint, veterancy: i.veterancy.fingerprint,
    initial: i.initial.fingerprint, death: i.death.fingerprint, ordinaryDeath: i.ordinaryDeath.fingerprint, traversal: i.traversal.sha256 };
  const data = freeze({ policy: ORDINARY_INFANTRY_BRIDGE_POLICY, profile: i.definitions.profile, baseModelSha256: i.world.model.sha256,
    combat, programs, actors: rows, pins, limits: cap, coverage: { attackers: programs.length, targetOnly: rows.filter(r => r.role === 'target-only').length,
      movementOnly: rows.filter(r => r.role === 'movement-only').length, weapons: selectedWeapons.length }, canStartCampaign: false as const });
  const fingerprint = combatActorFingerprint({ ...data, seed, sequence11Ticks, sequence12Ticks }, cap.serializedBytes);
  const result = Object.freeze({ ...data, fingerprint });
  bridges.set(result, { input: i, rows: new Map(rows.map(r => [r.entityId, r])), programs: new Map(programs.map(p => [p.actorId, p])),
    terrain: new Map(i.traversal.cells.map(c => [c.x + 512 * c.y, c])), movementHash: movementHash(i.world.model) }); return result;
}

function joined(bridge: OrdinaryInfantryBridge, model: WorldModel): Private {
  const data = bridges.get(bridge); if (!data) return fail('bridge-factory'); assertWorldModel(model);
  if (movementHash(model) !== data.movementHash) fail('world-join');
  // The root's source-bound combat factory will compare its unbound projection against this exact model.
  if (model.combat && model.combat.sha256 !== bridge.combat?.sha256) fail('combat-join'); return data;
}

/** Engine-internal only: state must be the core's validated, owned current state. It never admits commands or consumes RNG.
 * Untrusted callers use evaluateOrdinaryInfantryAttack, which validates and owns a WorldSave before this path. */
export function evaluateOrdinaryInfantryState(bridge: OrdinaryInfantryBridge, model: WorldModel, state: WorldState,
  input: { readonly sourceId: number; readonly targetId: number }): OrdinaryInfantryAttack {
  const data = joined(bridge, model), r = worldRecord(input, ['sourceId', 'targetId']), sourceId = worldInteger(r.sourceId, 1, 2147483647), targetId = worldInteger(r.targetId, 1, 2147483647);
  const sourceRow = data.rows.get(sourceId), targetRow = data.rows.get(targetId), reasons: string[] = [];
  let work = 0; const charge = (n = 1): void => { work += n; if (work > bridge.limits.contextWork) fail('context-work'); };
  charge(state.entities.length); const entities = new Map(state.entities.map(e => [e.id, e])), source = entities.get(sourceId), target = entities.get(targetId);
  const done = (context: InstantWeaponContext | null, deathSelection: OrdinaryDeathDecision | null = null): OrdinaryInfantryAttack => freeze({
    status: reasons.length ? 'unsupported' as const : 'eligible' as const, reasons: [...new Set(reasons)].sort(), sourceId, targetId,
    weaponId: sourceRow?.weaponId ?? null, programSha256: data.programs.get(sourceId)?.fingerprint ?? null,
    contextSha256: worldHash({ bridge: bridge.fingerprint, state: worldHash(state), sourceId, targetId, context }), deathSelection, work });
  if (sourceRow?.role !== 'attacker' || !source) reasons.push('source-not-attacker');
  if (!targetRow || targetRow.role === 'movement-only' || !target) reasons.push('target-not-damageable');
  if (reasons.length) return done(null);
  if (sourceId === targetId || sourceRow!.playerId === targetRow!.playerId || bridge.combat!.allies.some(a => a.playerId === sourceRow!.playerId && a.allyId === targetRow!.playerId)) reasons.push('allied-target');
  if (source!.health === null || source!.health <= 0 || target!.health === null || target!.health <= 0) reasons.push('inactive-actor');
  const standing = (e: NonNullable<typeof source>) => e.goal === null && e.route.length === 0 && e.progress === 0;
  if (!standing(source!) || !standing(target!)) reasons.push('moving-actor');
  const weapon = bridge.combat!.weapons.find(w => w.id === sourceRow!.weaponId)!;
  const distance = ((source!.x - target!.x) ** 2 + (source!.y - target!.y) ** 2) * 65536;
  if (distance < weapon.minimumRange ** 2 || distance > weapon.range ** 2) reasons.push('out-of-range');
  if (reasons.length) return done(null);
  const left = Math.min(source!.x, target!.x) - 1, top = Math.min(source!.y, target!.y) - 1, right = Math.max(source!.x, target!.x) + 1, bottom = Math.max(source!.y, target!.y) + 1;
  const count = (right - left + 1) * (bottom - top + 1);
  if (count > bridge.limits.contextCells) { reasons.push('context-cell-limit'); return done(null); }
  const atTarget = target!.x + 512 * target!.y, footprintOwners = new Map<number, Set<number>>(), blockers = new Set(model.blocked);
  charge(model.blocked.length);
  for (const f of model.footprints) if (entities.get(f.entityId)?.health !== 0) for (const at of f.cells) {
    charge(); blockers.add(at); const owners = footprintOwners.get(at) ?? new Set<number>(); owners.add(f.entityId); footprintOwners.set(at, owners);
  }
  const dying = new Set(state.combat?.deaths?.filter(d => d.corpseIndex === null).map(d => d.entityId) ?? []), occupants = new Map<number, InstantWeaponContext['occupants'][number]>();
  for (let index = 0; index < state.entities.length; index++) {
    charge(); const e = state.entities[index]!, d = model.entities[index]!;
    if (e.health === 0 && !dying.has(e.id)) continue;
    const kind = d.kind === 'infantry' || d.kind === 'unit' ? d.kind : 'other' as const, at = e.x + 512 * e.y;
    if (at === atTarget || e.progress > 0 && e.route[1] === atTarget) occupants.set(e.id, { id: String(e.id), kind });
    if (kind === 'other' || dying.has(e.id)) blockers.add(at);
  }
  for (const id of footprintOwners.get(atTarget) ?? []) occupants.set(id, { id: String(id), kind: 'other' });
  const cells: InstantWeaponContext['cells'][number][] = []; let barrier = false;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    charge(); if (x < 0 || y < 0 || x > 511 || y > 511) continue;
    const at = x + 512 * y, t = data.terrain.get(at); if (blockers.has(at)) barrier = true;
    if (t) cells.push({ x, y, level: t.elevation, floorZ: 0, land: [0, 1, 3, 7, 9].includes(t.landType ?? -1) && t.blockers.length === 0 ? 'dry' : 'unknown',
      overlay: t.overlayType === 255 ? 'none' : 'present', bridge: t.overlayType !== 255 });
  }
  const projection = (e: NonNullable<typeof source>) => ({ id: String(e.id), kind: 'infantry' as const, x: e.x * 256 + 128, y: e.y * 256 + 128, z: 0, alive: e.health! > 0, standing: standing(e), ground: true });
  const context: InstantWeaponContext = { source: projection(source!), target: projection(target!), targetMode: 'entity',
    impact: { x: target!.x * 256 + 128, y: target!.y * 256 + 128, z: 0 }, specialBarriers: barrier ? 'present' : 'absent', occupancy: 'complete', occupants: [...occupants.values()], cells };
  const decision = evaluateInstantWeaponContext(data.input.instant, weapon.id, context); reasons.push(...decision.reasons);
  // Closed mode has no native animation-sequence/status transitions: logical windup remains standing pose.
  const identity = (row: OrdinaryInfantryActor) => ({ id: String(row.entityId), rowId: row.rowId, typeId: row.typeId!, ownerId: row.ownerId! });
  const deathSelection = selectOrdinaryInfantryDeath(data.input.ordinaryDeath, { victim: identity(targetRow!), attacker: identity(sourceRow!),
    attackWeaponId: weapon.id, warheadId: sourceRow!.warheadId!, currentWeaponId: targetRow!.currentWeaponId, lethal: true,
    context: { complete: true, standing: standing(target!), dryGround: cells.some(c => c.x === target!.x && c.y === target!.y && c.land === 'dry'),
      onBridge: cells.some(c => c.x === target!.x && c.y === target!.y && c.bridge), heightAboveGround: 0, sequence: 0, currentLocomotor: 'walk',
      inTransport: false, passengerCount: 0, driverIndex: -1, attachedEffects: false, spawnManager: false, slaveManager: false, mindControl: false,
      temporal: false, warping: false, immobilized: false, veterancy: targetRow!.veterancy! } });
  reasons.push(...deathSelection.reasons); return done(context, deathSelection);
}

/** Public boundary owns and validates the entire checkpoint; UI input contains identities only. */
export function evaluateOrdinaryInfantryAttack(bridge: OrdinaryInfantryBridge, model: WorldModel, save: unknown,
  input: { readonly sourceId: number; readonly targetId: number }): OrdinaryInfantryAttack {
  joined(bridge, model); const owned = WorldSimulation.restore(model, save).save();
  return evaluateOrdinaryInfantryState(bridge, model, owned.state, input);
}
