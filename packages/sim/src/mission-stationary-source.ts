// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound stationary mission policy. See MISSION_STATIONARY_PROVENANCE.md.
import { missionTeamOwnedBindingData, type MissionTeamOwnedBinding } from './mission-team-owned-binding.ts';
import { missionTeamActionSourceContext, type MissionTeamActionSource } from './mission-team-action-source.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { worldRecord, worldInteger, WORLD_LIMITS } from './world-values.ts';
import { teamFingerprint } from '../../content/src/team-values.ts';
import type { WorldModel } from './world-model.ts';

export const MISSION_STATIONARY_SOURCE_POLICY = 'webra2-placed-infantry-guard-source-1' as const;
export const MISSION_STATIONARY_SOURCE_LIMITS = Object.freeze({ actions: 8192, catalogs: 512,
  actorRows: 32768, work: 4_194_304, characters: 8 * 1024 ** 2, serializedBytes: 8 * 1024 ** 2 });
export type MissionStationarySourceLimits = { -readonly [K in keyof typeof MISSION_STATIONARY_SOURCE_LIMITS]: number };
export type StationaryMission = 'Guard' | 'Sleep';
export interface MissionStationaryActor {
  readonly entityId: number; readonly kind: string; readonly initialMission: StationaryMission | null;
  readonly sourceMission: string | null; readonly status: 'guard-invariant-candidate' | 'unsupported';
  readonly reasons: readonly string[];
}
export interface MissionStationaryCatalog {
  readonly catalogSha256: string;
  readonly controls: readonly Readonly<{ mission: StationaryMission; recruitable: boolean | null; reasons: readonly string[] }>[];
  readonly actors: readonly MissionStationaryActor[];
}
export interface MissionStationarySource {
  readonly policy: typeof MISSION_STATIONARY_SOURCE_POLICY; readonly profile: 'ra2' | 'yr';
  readonly bindingSha256: string; readonly sourceSha256: string; readonly modelSha256: string;
  readonly houseSourceSha256: string;
  readonly catalogs: readonly MissionStationaryCatalog[];
  readonly actions: readonly Readonly<{ instructionId: string; opcode: 4 | 7 | 80; catalogSha256: string | null;
    status: 'supported-source' | 'unsupported'; reasons: readonly string[]; guardEntityIds: readonly number[] }>[];
  /** These are prerequisites, never caller-supplied boolean grants. */
  readonly requirements: readonly string[];
  readonly upstreamWholeSourceReady: boolean;
  readonly runtimeAuthority: false; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
  readonly sha256: string;
}
export class MissionStationaryError extends Error {
  constructor(readonly code: string) { super(`mission-stationary-${code}`); this.name = 'MissionStationaryError'; }
}
export function missionStationaryFail(code: string): never { throw new MissionStationaryError(code); }
const fail = missionStationaryFail;
const sources = new WeakMap<object, Readonly<{ binding: MissionTeamOwnedBinding; source: MissionTeamActionSource;
  model: WorldModel; work: number }>>();
export function missionStationarySourceData(source: MissionStationarySource) {
  return sources.get(source) ?? fail('source-brand');
}
export function isMissionStationarySource(value: unknown): value is MissionStationarySource {
  return !!value && typeof value === 'object' && sources.has(value);
}
function limits(input: Partial<MissionStationarySourceLimits>): MissionStationarySourceLimits {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('limits');
  const result: MissionStationarySourceLimits = { ...MISSION_STATIONARY_SOURCE_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d || !('value' in d) || !d.enumerable) return fail('limits');
    const k = key as keyof MissionStationarySourceLimits;
    result[k] = worldInteger(d.value, 0, result[k]);
  }
  return result;
}

/** This catalog identifies a conditional invariant, not a new recruitment grant.
 * Only a replay-derived live witness may establish its ordinary idle boundary.
 * The complete genuine upstream source remains available through the accessor. */
export function compileMissionStationarySource(input: Readonly<{ binding: MissionTeamOwnedBinding }>,
  lowerLimits: Partial<MissionStationarySourceLimits> = {}): MissionStationarySource {
  const r = worldRecord(input, ['binding']), binding = r.binding as MissionTeamOwnedBinding;
  const { source, model } = missionTeamOwnedBindingData(binding), data = missionTeamActionSourceContext(source), cap = limits(lowerLimits);
  if (source.actions.length > cap.actions || data.recruitmentCatalogs.length > cap.catalogs) fail('source-limit');
  let work = 0, rows = 0, characters = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('source-work'); work += n; };
  const catalogs: MissionStationaryCatalog[] = [];
  for (const catalog of data.recruitmentCatalogs) {
    charge(); if (catalog.actors.length > cap.actorRows - rows) fail('actor-limit'); rows += catalog.actors.length;
    const controls = catalog.missionControl.map(c => ({ mission: c.mission, recruitable: c.recruitable, reasons: [...c.reasons] }));
    const guard = controls.find(c => c.mission === 'Guard');
    const actors: MissionStationaryActor[] = catalog.actors.map(actor => {
      charge(); const reasons = [...actor.reasons];
      if (actor.kind !== 'infantry') reasons.push('unit-idle-or-static-family-unproved');
      if (actor.mission !== 'Guard') reasons.push('initial-guard-required');
      if (actor.status !== 'source-candidate') reasons.push('recruitment-source-actor');
      if (guard?.recruitable !== true) reasons.push('guard-not-recruitable');
      return { entityId: actor.entityId, kind: actor.kind, initialMission: actor.mission === 'Guard' || actor.mission === 'Sleep' ? actor.mission : null,
        sourceMission: actor.mission, status: reasons.length ? 'unsupported' as const : 'guard-invariant-candidate' as const, reasons };
    });
    catalogs.push({ catalogSha256: catalog.sha256, controls, actors });
  }
  const bySha = new Map(catalogs.map(c => [c.catalogSha256, c]));
  const actions = source.actions.map(action => {
    charge(); const reasons = [...action.reasons], catalog = action.catalogSha256 === null ? undefined : bySha.get(action.catalogSha256);
    if (action.status !== 'supported-source') reasons.push('team-action-source');
    if (action.opcode !== 4) reasons.push('dynamic-constructor-required');
    if (action.opcode === 4 && !catalog) reasons.push('recruitment-catalog-required');
    const guardEntityIds = catalog?.actors.filter(a => a.status === 'guard-invariant-candidate').map(a => a.entityId) ?? [];
    charge(catalog?.actors.length ?? 0);
    return { instructionId: action.instructionId, opcode: action.opcode, catalogSha256: action.catalogSha256,
      status: reasons.length ? 'unsupported' as const : 'supported-source' as const, reasons, guardEntityIds };
  });
  const value = { policy: MISSION_STATIONARY_SOURCE_POLICY, profile: source.profile,
    bindingSha256: binding.sha256, sourceSha256: source.sha256, modelSha256: model.sha256, houseSourceSha256: binding.houseSourceSha256,
    catalogs, actions, requirements: ['exact-source-initial-mission', 'uninterrupted-core-operation-journal',
      'no-prior-command-movement-or-combat', 'no-active-or-historical-team-claim', 'ordinary-infantry-idle-boundary',
      'same-source-current-ownership', 'complete-upstream-program-admission'],
    upstreamWholeSourceReady: source.wholeSourceReady, runtimeAuthority: false as const,
    nativeExecutionVerified: false as const, canStartCampaign: false as const };
  // The graph is newly owned or genuine immutable source. Reserve every output
  // node/key/string before canonical serialization; no independent nested budget.
  const audit = (v: unknown): void => {
    charge();
    if (typeof v === 'string') { charge(v.length); characters += v.length; if (characters > cap.characters) fail('source-characters'); }
    else if (v && typeof v === 'object') for (const [key, item] of Object.entries(v)) { charge(key.length); audit(item); }
  };
  audit(value);
  if (model.entities.length > WORLD_LIMITS.entities) fail('source-entities');
  const result = freeze({ ...value, sha256: teamFingerprint(value, cap.serializedBytes) });
  sources.set(result, freeze({ binding, source, model, work })); return result;
}
