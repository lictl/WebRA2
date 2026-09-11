// SPDX-License-Identifier: GPL-3.0-or-later
// Original genuine source join. See ../MISSION_TEAM_CONSTRUCTOR_PROVENANCE.md.
import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { missionHouseSourceContext } from './mission-house-source.ts';
import { missionTeamCellSourceContext } from './mission-team-cell-source.ts';
import { teamSpawnCatalogData } from './team-spawn-context.ts';
import { teamActivationDefinitions } from '../../content/src/team-activation.ts';
import { worldHash, worldInteger, worldRecord, worldFail } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { MISSION_TEAM_CONSTRUCTOR_POLICY, MISSION_TEAM_CONSTRUCTOR_LIMITS,
  type MissionTeamConstructorLimits, type MissionTeamConstructorSourceInput, type MissionTeamConstructorSource,
  type MissionTeamConstructorArchetype, type MissionTeamConstructorAction } from './mission-team-constructor-types.ts';
export type { MissionTeamConstructorSource, MissionTeamConstructorSourceInput } from './mission-team-constructor-types.ts';
export function constructorFail(code: string): never { return worldFail(`team-constructor-${code}`); }
export function constructorLimits(input: Partial<MissionTeamConstructorLimits> = {}, maximum: Readonly<MissionTeamConstructorLimits> = MISSION_TEAM_CONSTRUCTOR_LIMITS): MissionTeamConstructorLimits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) constructorFail('limits');
  const out = { ...maximum };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(out, key)) constructorFail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key); if (!d || !('value' in d) || !d.enumerable) constructorFail('limits');
    out[key as keyof MissionTeamConstructorLimits] = worldInteger(d.value, 0, out[key as keyof MissionTeamConstructorLimits]);
  }
  return out;
}
const sources = new WeakMap<object, Readonly<MissionTeamConstructorSourceInput & { work: number }>>();
export function missionTeamConstructorSourceData(source: MissionTeamConstructorSource) { return sources.get(source) ?? constructorFail('source-brand'); }
/** All action declarations survive. Supported ordinary constructors do not grant
 * cell-entry, autonomous behavior, actor combat or complete mission authority. */
export function compileMissionTeamConstructorSource(input: MissionTeamConstructorSourceInput,
  lower: Partial<MissionTeamConstructorLimits> = {}): MissionTeamConstructorSource {
  const r = worldRecord(input, ['actions', 'houses', 'constructors']), actions = r.actions as MissionTeamConstructorSourceInput['actions'];
  const houses = r.houses as MissionTeamConstructorSourceInput['houses'], constructors = r.constructors as MissionTeamConstructorSourceInput['constructors'];
  const ac = missionTeamActionSourceContext(actions), hc = missionHouseSourceContext(houses), cc = missionTeamCellSourceContext(constructors), limits = constructorLimits(lower);
  if (hc.bindings !== ac.bindings || cc.actions !== actions || cc.world !== ac.world || houses.baseWorldSha256 !== ac.world.model.sha256 ||
    houses.definitionsSha256 !== actions.entitiesSha256 || constructors.definitionsSha256 !== actions.entitiesSha256 || houses.profile !== actions.profile) constructorFail('source-identity');
  if (actions.actions.length > limits.actions || houses.types.length > limits.types || constructors.archetypes.length > limits.types || ac.world.model.entities.length > limits.actors) constructorFail('count-limit');
  let work = 0; const charge = (n = 1) => { if (n > limits.work - work) constructorFail('work-limit'); work += n; };
  const teams = teamActivationDefinitions(ac.activation);
  charge(actions.actions.length + houses.types.length + constructors.archetypes.length + constructors.actions.length + ac.spawnCatalogs.length + teams.teams.length);
  const teamTypes = new Map(teams.teams.map(t => [t.id, t]));
  const houseTypes = new Map(houses.types.map(t => [t.typeId, t])), proofs = new Map(constructors.archetypes.map(t => [t.typeId, t]));
  const proofActions = new Map(constructors.actions.map(a => [a.instructionId, a])), catalogs = new Map(ac.spawnCatalogs.map(c => [c.sha256, c]));
  const archetypes = new Map<string, MissionTeamConstructorArchetype>(); let references = 0;
  for (const catalog of ac.spawnCatalogs) {
    charge(catalog.archetypes.length); if (teamSpawnCatalogData(catalog).world !== ac.world) constructorFail('catalog-world');
    for (const a of catalog.archetypes) {
      const h = houseTypes.get(a.typeId), proof = proofs.get(a.typeId), reasons: string[] = [];
      if (a.kind !== 'unit') reasons.push('unit-constructor-required');
      if (!h || h.kind !== a.kind || h.status !== 'supported-counts' || !['unit', 'none'].includes(h.registeredClass ?? '') || !['unit', 'none'].includes(h.presentClass ?? '')) reasons.push('population-type');
      if (!proof || proof.kind !== a.kind || proof.constructorEligibility !== 'supported') reasons.push('constructor-prerequisites');
      const row: MissionTeamConstructorArchetype = { typeId: a.typeId, kind: a.kind, maximumHealth: a.maximumHealth,
        movementPerTick: a.movementPerTick, navigationClass: a.navigationClass,
        registeredClass: h?.registeredClass === 'unit' || h?.registeredClass === 'none' ? h.registeredClass : null,
        presentClass: h?.presentClass === 'unit' || h?.presentClass === 'none' ? h.presentClass : null,
        status: reasons.length ? 'unsupported' : 'supported', reasons };
      const prior = archetypes.get(a.typeId); if (prior && worldHash(prior) !== worldHash(row)) constructorFail('archetype-conflict');
      archetypes.set(a.typeId, row); if (archetypes.size > limits.types) constructorFail('type-limit');
    }
  }
  const rows: MissionTeamConstructorAction[] = actions.actions.map(a => {
    const reasons: string[] = [], catalog = a.catalogSha256 === null ? undefined : catalogs.get(a.catalogSha256);
    const template = catalog?.templates.find(t => t.teamId === a.teamId), proof = proofActions.get(a.instructionId), typeIds = template?.memberTypeIds ?? [];
    charge((catalog?.templates.length ?? 0) + typeIds.length + (proof?.typeIds.length ?? 0) + houses.houses.length); references += typeIds.length;
    if (references > limits.references || typeIds.length > limits.members) constructorFail('reference-limit');
    if (a.opcode !== 4) {
      if (a.status !== 'supported-source' || a.branch !== 'reinforce' || !catalog || !template) reasons.push('source-constructor-action');
      if (!proof || proof.kind !== 'spawn' || proof.status !== 'supported' || worldHash(proof.typeIds) !== worldHash(typeIds)) reasons.push('constructor-action-proof');
      if (a.teamId === null || teamTypes.get(a.teamId)?.tag.status !== 'none') reasons.push('constructor-tag-attachment');
      for (const id of typeIds) if (archetypes.get(id)?.status !== 'supported') reasons.push(`archetype:${id}`);
      if (!houses.houses.some(h => h.playerId === template?.playerId && h.houseId === template?.houseId)) reasons.push('constructor-house');
    }
    return { instructionId: a.instructionId, opcode: a.opcode, teamId: a.teamId, catalogSha256: a.catalogSha256,
      typeIds: [...typeIds], status: a.opcode === 4 ? 'not-construction' : reasons.length ? 'unsupported' : 'supported', reasons };
  });
  const value = { policy: MISSION_TEAM_CONSTRUCTOR_POLICY, profile: actions.profile, actionSourceSha256: actions.sha256,
    houseSourceSha256: houses.sha256, constructorSourceSha256: constructors.sha256, baseModelSha256: ac.world.model.sha256,
    definitionsSha256: actions.entitiesSha256, actions: rows, archetypes: [...archetypes.values()].sort((a,b)=>a.typeId<b.typeId?-1:a.typeId>b.typeId?1:0),
    allRequiredConstructorsReady: rows.every(a => a.status !== 'unsupported'), cellWorldInvariantReady: constructors.coverage.supportedWorldInvariantReady,
    limits, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  charge(rows.length * 12 + archetypes.size * 16 + references * 2);
  const result = freeze({ ...value, sha256: worldHash(value) }); sources.set(result, freeze({ actions, houses, constructors, work })); return result;
}
