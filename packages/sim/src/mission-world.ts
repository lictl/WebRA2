// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded compound transactions. See ../MISSION_WORLD_PROVENANCE.md.
import type { MissionAudioPolicyCatalog, MissionAudioPolicyBinding } from '../../content/src/mission-audio-policy.ts';
import type { MissionHouseSource } from './mission-house-source.ts';
import { createMissionActionWorldContext, MISSION_ACTION_WORLD_POLICY } from './mission-action-world-context.ts';
import { missionProgramHouseSource, MISSION_HOUSE_DISPATCH_POLICY } from './mission-logic.ts';
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { canonicalText, parseJson } from './canonical.ts';
import { isMissionBindingAuthority, type MissionBindingAuthority } from './mission-bindings.ts';
import { isMissionInitialFlags, type MissionInitialFlags } from './mission-initial-flags.ts';
import { missionProgramAudioPolicy, MISSION_AUDIO_DISPATCH_POLICY, missionProgramTeamActions, missionProgramCues, missionProgramCellEntry, missionProgramObjectEvents, MISSION_LOGIC_LIMITS, MISSION_CUE_DISPATCH_POLICY, MissionLogic, type MissionEffect, type MissionInput, type MissionSave, type MissionObjectEventObservation } from './mission-logic.ts';
import { assertWorldModel, createWorldModel, type WorldModel } from './world-model.ts';
import { combatSourceBridge } from './combat-model.ts';
import { WorldSimulation, worldStepCombatObservations, type WorldSave, type WorldTrace } from './world.ts';
import { appendMissionCues, createMissionCueState, restoreMissionCueState, type MissionCueState, type MissionCueEvent } from './mission-cues.ts';
import { missionCellEntrySourceBindings, type MissionCellEntrySource } from './mission-cell-entry-source.ts';
import { missionObjectEventSourceBindings, type MissionObjectEventSource, type MissionObjectEventActor } from './mission-object-event-source.ts';
import { missionTeamActionSourceContext } from './mission-team-action-source.ts';
import { compileMissionTeamRuntime, restoreMissionTeamContext, type MissionTeamRuntime } from './mission-team-context.ts';
import { isMissionTeamCellSource, missionTeamCellSourceContext } from './mission-team-cell-source.ts';
import { compileMissionTeamCellContext, missionTeamCellContextData } from './mission-team-cell-context.ts';
import type { MissionTeamCellSource } from './mission-team-cell-types.ts';
import { createMissionTeamCheckpoint, restoreMissionTeamCheckpoint, admitMissionTeamInput, stepMissionTeamWorld, missionTeamWorldStep,
  type MissionTeamCheckpoint, type MissionTeamReceipt, type MissionTeamEvent } from './mission-team-runtime.ts';
import type { TeamOrder, TeamEvent } from './team-runtime.ts';
import type { MissionCueCatalog } from '../../content/src/mission-cues.ts';
import { worldClone, worldHash, worldInteger, worldList, worldPosition, worldRecord, worldSourceHash } from './world-values.ts';

export const MISSION_WORLD_POLICY = 'webra2-mission-world-poll-1' as const;
export const MISSION_WORLD_CELL_PHASE_POLICY = 'webra2-world-cell-events-before-scenario-poll-1' as const;
export const MISSION_WORLD_OBJECT_PHASE_POLICY = 'webra2-world-health-callbacks-before-scenario-poll-1' as const;
export const MISSION_WORLD_TEAM_PHASE_POLICY = 'webra2-world-team-actions-next-tick-1' as const;
export const MISSION_WORLD_TEAM_CELL_PHASE_POLICY = 'webra2-world-team-cell-events-before-scenario-poll-1' as const;
export const MISSION_WORLD_LIMITS = Object.freeze({ ticks: 128, work: 16_777_216, trace: 32768, replayTicks: 10000, admissions: 1024, presentationUnits: 1_048_576 });
export interface MissionWorldModel {
  readonly policy: typeof MISSION_WORLD_POLICY; readonly sha256: string; readonly worldSha256: string;
  readonly teamActionSourceSha256?: string; readonly teamRuntimeSha256?: string; readonly teamPhasePolicy?: typeof MISSION_WORLD_TEAM_PHASE_POLICY;
  readonly teamCellSourceSha256?: string; readonly teamCellPhasePolicy?: typeof MISSION_WORLD_TEAM_CELL_PHASE_POLICY;
  readonly cellEntrySourceSha256?: string; readonly cellEntryPhasePolicy?: typeof MISSION_WORLD_CELL_PHASE_POLICY;
  readonly objectEventSourceSha256?: string; readonly objectEventPhasePolicy?: typeof MISSION_WORLD_OBJECT_PHASE_POLICY;
  readonly audioPolicySha256?: string; readonly audioDispatchPolicy?: typeof MISSION_AUDIO_DISPATCH_POLICY;
  readonly houseSourceSha256?: string; readonly houseDispatchPolicy?: typeof MISSION_HOUSE_DISPATCH_POLICY;
  readonly actionWorldPolicy?: typeof MISSION_ACTION_WORLD_POLICY;
  readonly cueCatalogSha256?: string; readonly cueDispatchPolicy?: typeof MISSION_CUE_DISPATCH_POLICY;
  readonly bindingsSha256: string; readonly programSha256: string; readonly flagsSha256: string;
  readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
}
export interface MissionWorldCheckpoint {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_WORLD_POLICY; readonly modelSha256: string;
  readonly world: WorldSave; readonly mission: MissionSave; readonly teams?: MissionTeamCheckpoint; readonly presentation?: MissionCueState; readonly audio?: MissionWorldAudioState;
}
export interface MissionWorldResult {
  readonly teams?: MissionWorldTeamEvents; readonly checkpoint: MissionWorldCheckpoint; readonly effects: readonly MissionEffect[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number; readonly presentation?: MissionWorldPresentation; readonly audio?: MissionWorldAudio;
}
export interface MissionWorldAudioState {
  readonly policy: typeof MISSION_AUDIO_DISPATCH_POLICY; readonly policyCatalogSha256: string;
  readonly tick: number; readonly nextSequence: number;
}
export interface MissionWorldAudioRequest {
  readonly sequence: number; readonly tick: number; readonly vmOrder: number;
  readonly bindingId: string; readonly triggerId: string; readonly instructionId: string;
  readonly opcode: 19 | 21; readonly playbackAuthorized: false;
}
export interface MissionWorldAudio {
  readonly policy: typeof MISSION_AUDIO_DISPATCH_POLICY; readonly modelSha256: string;
  readonly policyCatalogSha256: string; readonly audioCatalogSha256: string; readonly missionSha256: string;
  readonly profile: 'ra2' | 'yr'; readonly side: 0 | 1 | 2;
  readonly fromNextTick: number; readonly toNextTick: number; readonly stateSha256: string;
  readonly sourceDispatchVerified: true; readonly nativePlaybackVerified: false;
  readonly requests: readonly MissionWorldAudioRequest[];
}
const audioBatches = new WeakMap<object, MissionWorldModel>();
export function isMissionWorldAudio(model: MissionWorldModel, value: unknown): value is MissionWorldAudio {
  source(model); return !!value && typeof value === 'object' && audioBatches.get(value) === model;
}
/** This reference joins a consumer to its model; only a genuine batch proves source invocation. */
export function missionWorldAudioPolicy(model: MissionWorldModel): MissionAudioPolicyCatalog | null { return source(model).audio; }
function audioBatch(model: MissionWorldModel, from: number, checkpoint: MissionWorldCheckpoint, requests: MissionWorldAudioRequest[]): MissionWorldAudio {
  const audio = source(model).audio; if (!audio) fail('audio-source');
  const batch = freeze({ policy: MISSION_AUDIO_DISPATCH_POLICY, modelSha256: model.sha256,
    policyCatalogSha256: audio.sha256, audioCatalogSha256: audio.audioSha256, missionSha256: audio.missionSha256,
    profile: audio.profile, side: audio.side, fromNextTick: from, toNextTick: checkpoint.world.nextTick,
    stateSha256: worldHash(checkpoint), sourceDispatchVerified: true as const, nativePlaybackVerified: false as const, requests });
  audioBatches.set(batch, model); return batch;
}
function audioRequestUnits(requests: readonly MissionWorldAudioRequest[]): number {
  return requests.reduce((n, r) => n + r.instructionId.length + r.bindingId.length + r.triggerId.length, 0);
}
function restoreAudioState(audio: MissionAudioPolicyCatalog, value: unknown): MissionWorldAudioState {
  const r = worldRecord(value, ['policy', 'policyCatalogSha256', 'tick', 'nextSequence']);
  if (r.policy !== MISSION_AUDIO_DISPATCH_POLICY || r.policyCatalogSha256 !== audio.sha256) fail('audio-cursor-identity');
  return freeze({ policy: MISSION_AUDIO_DISPATCH_POLICY, policyCatalogSha256: audio.sha256,
    tick: worldInteger(r.tick, 0, MISSION_LOGIC_LIMITS.tick), nextSequence: worldInteger(r.nextSequence, 0, 1_000_000) });
}
/** Private effects only; no caller-facing append function can claim source invocation. */
function appendAudio(s: Source, cursor: MissionWorldAudioState, effects: readonly MissionEffect[], tick: number, remainingUnits: number) {
  if (!s.audio || cursor.policyCatalogSha256 !== s.audio.sha256 || tick < cursor.tick) fail('audio-source');
  const selected = effects.filter(e => e.kind === 'audio-request');
  if (selected.length > 1024 || selected.length > 1_000_000 - cursor.nextSequence) fail('audio-request-limit');
  let units = 0;
  for (const effect of selected) {
    const binding = s.audioByInstruction.get(effect.instructionId);
    if (!binding || binding.status !== 'supported-source' || binding.instruction.triggerId !== effect.triggerId ||
      binding.opcode !== effect.opcode || (effect.opcode !== 19 && effect.opcode !== 21) || effect.tick !== tick) fail('audio-effect');
    units += effect.instructionId.length + effect.bindingId.length + effect.triggerId.length;
    if (units > remainingUnits) fail('audio-payload-limit');
  }
  const requests: MissionWorldAudioRequest[] = selected.map((e, i) => ({ sequence: cursor.nextSequence + i, tick,
    vmOrder: e.order, instructionId: e.instructionId, bindingId: e.bindingId, triggerId: e.triggerId,
    opcode: e.opcode as 19 | 21, playbackAuthorized: false }));
  return { requests, units, work: effects.length + requests.length + units,
    state: restoreAudioState(s.audio, { ...cursor, tick, nextSequence: cursor.nextSequence + requests.length }) };
}
export interface MissionWorldTeamEvents {
  readonly actions: readonly MissionTeamEvent[]; readonly orders: readonly TeamOrder[];
  readonly events: readonly (TeamEvent & { tick: number })[];
}
export interface MissionWorldPresentationRequest extends MissionCueEvent {
  readonly vmOrder: number; readonly bindingId: string; readonly triggerId: string;
}
/** Genuine requests from a private authenticated compound step. Native consumers remain required. */
export interface MissionWorldPresentation {
  readonly policy: typeof MISSION_CUE_DISPATCH_POLICY; readonly modelSha256: string;
  readonly catalogSha256: string; readonly fromNextTick: number; readonly toNextTick: number;
  readonly stateSha256: string; readonly sourceDispatchVerified: true; readonly nativePresentationVerified: false;
  readonly requests: readonly MissionWorldPresentationRequest[];
}
const presentations = new WeakMap<object, MissionWorldModel>();
export function isMissionWorldPresentation(model: MissionWorldModel, value: unknown): value is MissionWorldPresentation {
  source(model); return !!value && typeof value === 'object' && presentations.get(value) === model;
}
function presentation(model: MissionWorldModel, from: number, checkpoint: MissionWorldCheckpoint, requests: MissionWorldPresentationRequest[]): MissionWorldPresentation {
  const cues = source(model).cues; if (!cues) fail('cue-source');
  const batch = freeze({ policy: MISSION_CUE_DISPATCH_POLICY, modelSha256: model.sha256, catalogSha256: cues.sha256,
    fromNextTick: from, toNextTick: checkpoint.world.nextTick, stateSha256: worldHash(checkpoint),
    sourceDispatchVerified: true as const, nativePresentationVerified: false as const, requests });
  presentations.set(batch, model); return batch;
}
function requestUnits(requests: readonly MissionWorldPresentationRequest[]): number {
  return requests.reduce((n, r) => n + (r.payload.kind === 'text' ? r.payload.text.length : 0), 0);
}
export class MissionWorldError extends Error {
  constructor(readonly code: string) { super(`mission-world-${code}`); this.name = 'MissionWorldError'; }
}
function fail(code: string): never { throw new MissionWorldError(code); }
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const c of Object.values(v)) freeze(c); Object.freeze(v); } return v;
}
type Source = { world: WorldModel; bindings: MissionBindingAuthority; flags: MissionInitialFlags; initial: MissionSave; cues: MissionCueCatalog | null;
  houses: MissionHouseSource | null;
  audio: MissionAudioPolicyCatalog | null; audioByInstruction: ReadonlyMap<string, MissionAudioPolicyBinding>;
  teams: MissionTeamRuntime | null; teamCells: MissionTeamCellSource | null; cells: MissionCellEntrySource | null; cellByAddress: ReadonlyMap<number, string>;
  objects: MissionObjectEventSource | null; objectActors: ReadonlyMap<number, MissionObjectEventActor> };
const sources = new WeakMap<MissionWorldModel, Source>();
function source(model: MissionWorldModel): Source { const s = sources.get(model); if (!s) fail('model'); return s; }
const actions = new Set([0, 1, 2, 12, 22, 23, 24, 25, 26, 27, 28, 29, 53, 54, 56, 57]);

/** Complete source/program authority is mandatory. This adapter implements poll controls and authenticated presentation requests. */
export function compileMissionWorld(input: {
  readonly world: WorldModel; readonly bindings: MissionBindingAuthority; readonly flags: MissionInitialFlags;
  readonly teamCells?: MissionTeamCellSource;
}): MissionWorldModel {
  const hasTeamCells = input !== null && typeof input === 'object' && Object.hasOwn(input, 'teamCells');
  const r = worldRecord(input, ['world', 'bindings', 'flags', ...(hasTeamCells ? ['teamCells'] : [])]);
  if (!isMissionBindingAuthority(r.bindings) || !isMissionInitialFlags(r.flags)) fail('authority');
  const bindings = r.bindings, flags = r.flags, world = r.world as WorldModel; assertWorldModel(world);
  if (!flags.canInitialize || flags.catalogSha256 !== bindings.catalogSha256 || flags.worldSha256 !== bindings.worldSha256 ||
    flags.profile !== world.contentIdentity.profile || flags.missionSha256 !== world.sourceSha256) fail('source-join');
  // Strip only optional separately authenticated adapters and prove every original
  // entity, owner, footprint, navigation grid/cost and content hash still agrees.
  const base = createWorldModel({ contentIdentity: world.contentIdentity, sourceSha256: world.sourceSha256,
    definitionsSha256: world.definitionsSha256, entities: world.entities, navigation: world.navigation,
    blocked: world.blocked.map(worldPosition), footprints: world.footprints.map(p => ({ entityId: p.entityId, cells: p.cells.map(worldPosition) })) });
  if (base.sha256 !== bindings.worldSha256 || (world.combat && !combatSourceBridge(world.combat))) fail('world-join');
  const teamSource = missionProgramTeamActions(bindings.program), audio = missionProgramAudioPolicy(bindings.program);
  const houses = missionProgramHouseSource(bindings.program);
  if ((world.ownership ?? null) !== houses || (houses && houses.bindingsSha256 !== bindings.catalogSha256)) fail('house-source');
  for (const trigger of bindings.program.triggers) {
    for (const event of trigger.events) if ((event.opcode === 36 || event.opcode === 37) && event.argument >= flags.localCapacity) fail('local-capacity');
    for (const action of trigger.actions) {
      if (!actions.has(action.opcode) && !(houses && [14, 36].includes(action.opcode)) && !(teamSource && [4, 7, 80].includes(action.opcode)) && !(missionProgramCues(bindings.program) && [11, 48, 55].includes(action.opcode)) && !(audio && [19, 21].includes(action.opcode))) fail('unimplemented-effect');
      if ((action.opcode === 56 || action.opcode === 57) && action.argument >= flags.localCapacity) fail('local-capacity');
    }
  }
  const cues = missionProgramCues(bindings.program);
  if (cues && (cues.source.sha256 !== world.sourceSha256 || cues.profile !== world.contentIdentity.profile)) fail('cue-source');
  if (audio && (audio.missionSha256 !== world.sourceSha256 || audio.profile !== world.contentIdentity.profile || audio.cuesSha256 !== cues?.sha256)) fail('audio-source');
  const audioByInstruction = new Map(audio?.bindings.map(b => [b.instructionId, b]));
  const cells = missionProgramCellEntry(bindings.program), cellByAddress = new Map<number, string>();
  if (cells) {
    if (missionCellEntrySourceBindings(cells).fingerprint !== bindings.catalogSha256) fail('cell-source');
    const actors = new Map(cells.actors.map(a => [a.entityId, a]));
    for (const entity of world.entities) if (entity.movementPerTick > 0 && entity.initialHealth !== 0 && actors.get(entity.id)?.status !== 'supported') fail('cell-movement-context');
    for (const cell of cells.cells) {
      const address = cell.y * 512 + cell.x; if (cellByAddress.has(address)) fail('cell-source'); cellByAddress.set(address, cell.cellId);
    }
  }
  const objects = missionProgramObjectEvents(bindings.program), objectActors = new Map(objects?.actors.map(a => [a.entityId, a]));
  if (objects) {
    if (missionObjectEventSourceBindings(objects).fingerprint !== bindings.catalogSha256) fail('object-source');
    const bridge = world.combat ? combatSourceBridge(world.combat) : null;
    // The proven combat bridge is the complete initial eligibility gate. Scenery and
    // movement-only actors cannot receive its hits and remain represented in the source.
    for (const actor of bridge?.actors ?? []) if (actor.role !== 'movement-only' && objectActors.get(actor.entityId)?.status !== 'supported') fail('object-combat-context');
  }
  const teams = teamSource ? compileMissionTeamRuntime(teamSource) : null;
  // Fixed initial actors and scenario polling only until current-owner callback
  // and dynamic-team observations have their own genuine context adapters.
  if (houses && (teams || cells || objects)) fail('house-callback-context');
  let teamCells: MissionTeamCellSource | null = null;
  if (hasTeamCells) {
    if (!teams || !cells || !isMissionTeamCellSource(r.teamCells)) fail('team-cell-source');
    const context = missionTeamCellSourceContext(r.teamCells);
    if (context.cells !== cells || context.actions !== teamSource || r.teamCells.baseModelSha256 !== world.sha256 ||
      !r.teamCells.coverage.allRequiredConstructorsReady || !r.teamCells.coverage.supportedWorldInvariantReady) fail('team-cell-context');
    teamCells = r.teamCells;
  }
  if (teams) {
    if (!teamSource!.wholeSourceReady || missionTeamActionSourceContext(teamSource!).bindings.fingerprint !== bindings.catalogSha256 ||
      teams.baseModelSha256 !== world.sha256) fail('team-source');
    // Only the explicit complete team-cell source extends initial actor context.
    // Object callbacks and combat still require their own dynamic actor proof.
    if ((cells && !teamCells) || objects) fail('team-dynamic-event-context');
  }
  const initial = MissionLogic.create(bindings.program, { bindings: bindings.bindings, globals: flags.globals, locals: flags.locals }).save();
  const data = { policy: MISSION_WORLD_POLICY, worldSha256: world.sha256, bindingsSha256: bindings.catalogSha256,
    programSha256: bindings.program.sha256, flagsSha256: flags.sha256, canStartCampaign: false as const, nativeBehaviorVerified: false as const,
    ...(houses ? { houseSourceSha256: houses.sha256, houseDispatchPolicy: MISSION_HOUSE_DISPATCH_POLICY, actionWorldPolicy: MISSION_ACTION_WORLD_POLICY } : {}),
    ...(teams ? { teamActionSourceSha256: teamSource!.sha256, teamRuntimeSha256: teams.sha256, teamPhasePolicy: MISSION_WORLD_TEAM_PHASE_POLICY } : {}),
    ...(teamCells ? { teamCellSourceSha256: teamCells.sha256, teamCellPhasePolicy: MISSION_WORLD_TEAM_CELL_PHASE_POLICY } : {}),
    ...(audio ? { audioPolicySha256: audio.sha256, audioDispatchPolicy: MISSION_AUDIO_DISPATCH_POLICY } : {}),
    ...(cues ? { cueCatalogSha256: cues.sha256, cueDispatchPolicy: MISSION_CUE_DISPATCH_POLICY } : {}),
    ...(cells ? { cellEntrySourceSha256: cells.sha256, cellEntryPhasePolicy: MISSION_WORLD_CELL_PHASE_POLICY } : {}),
    ...(objects ? { objectEventSourceSha256: objects.sha256, objectEventPhasePolicy: MISSION_WORLD_OBJECT_PHASE_POLICY } : {}) };
  const model = freeze({ ...data, sha256: worldHash(data) }); sources.set(model, { world, bindings, flags, initial, cues, audio, audioByInstruction, teams, teamCells, cells, cellByAddress, objects, objectActors, houses }); return model;
}
function checkFlags(s: Source, mission: MissionSave): void {
  if (mission.locals.slice(s.flags.localCapacity).some(Boolean) || mission.pending.some(i => i.kind === 'local' && i.index >= s.flags.localCapacity)) fail('local-capacity');
  const shape = (v: MissionSave) => v.bindings.map(b => ({ id: b.id, tagId: b.tagId, attachmentIds: b.attachmentIds }));
  if (canonicalText(shape(mission)) !== canonicalText(shape(s.initial))) fail('source-bindings');
  if (mission.nextTick === 0 && (canonicalText(mission.globals) !== canonicalText(s.flags.globals) || canonicalText(mission.locals) !== canonicalText(s.flags.locals))) fail('initial-flags');
}
export function restoreMissionWorld(model: MissionWorldModel, value: unknown): MissionWorldCheckpoint {
  const s = source(model), raw = typeof value === 'string' || value instanceof Uint8Array ? parseJson(value) : value;
  const r = worldRecord(worldClone(raw), ['schemaVersion', 'policy', 'modelSha256', 'world', 'mission', ...(s.teams ? ['teams'] : []), ...(s.cues ? ['presentation'] : []), ...(s.audio ? ['audio'] : [])]);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_WORLD_POLICY || r.modelSha256 !== model.sha256) fail('checkpoint-identity');
  if (s.teams && (r.teams as MissionTeamCheckpoint | null)?.pending !== null) fail('team-world');
  const teams = s.teams ? restoreMissionTeamCheckpoint(s.teams, r.teams) : null;
  if (teams && (teams.pending || canonicalText(r.world) !== canonicalText(teams.team.world))) fail('team-world');
  if (s.teamCells && teams) {
    const context = compileMissionTeamCellContext({ source: s.teamCells, teams: restoreMissionTeamContext(s.teams!, teams.history) });
    if (context.modelSha256 !== teams.team.world.state.modelSha256) fail('team-cell-world');
  }
  const world = teams ? teams.team.world : WorldSimulation.restore(s.world, r.world).save(), mission = MissionLogic.restore(s.bindings.program, r.mission).save();
  if (teams && teams.requests.some(q => q.effectOrder < 1 || q.effectOrder >= mission.nextEffectOrder || q.emittedAtTick >= mission.nextTick)) fail('team-vm-cursor');
  if (world.nextTick !== mission.nextTick) fail('clock'); checkFlags(s, mission);
  const cursor = s.cues ? restoreMissionCueState(s.cues, r.presentation) : null;
  if (cursor && (cursor.tick !== Math.max(0, world.nextTick - 1) || cursor.nextSequence > mission.nextEffectOrder - 1 ||
    (world.nextTick === 0 && cursor.nextSequence !== 0))) fail('cue-cursor');
  const audioCursor = s.audio ? restoreAudioState(s.audio, r.audio) : null;
  if (audioCursor && (audioCursor.tick !== Math.max(0, world.nextTick - 1) ||
    audioCursor.nextSequence + (cursor?.nextSequence ?? 0) > mission.nextEffectOrder - 1 ||
    (world.nextTick === 0 && audioCursor.nextSequence !== 0))) fail('audio-cursor');
  return freeze({ schemaVersion: 1, policy: MISSION_WORLD_POLICY, modelSha256: model.sha256, world, mission, ...(teams ? { teams } : {}),
    ...(cursor ? { presentation: cursor } : {}), ...(audioCursor ? { audio: audioCursor } : {}) });
}
export function createMissionWorld(model: MissionWorldModel): MissionWorldCheckpoint {
  const s = source(model);
  return restoreMissionWorld(model, { schemaVersion: 1, policy: MISSION_WORLD_POLICY, modelSha256: model.sha256,
    world: WorldSimulation.create(s.world).save(), mission: s.initial,
    ...(s.teams ? { teams: createMissionTeamCheckpoint(s.teams) } : {}),
    ...(s.cues ? { presentation: createMissionCueState(s.cues) } : {}),
    ...(s.audio ? { audio: { policy: MISSION_AUDIO_DISPATCH_POLICY, policyCatalogSha256: s.audio.sha256, tick: 0, nextSequence: 0 } } : {}) });
}
export interface MissionWorldAdmission {
  readonly commands: readonly CommandEnvelope[]; readonly flags: readonly MissionInput[];
}
/** Explicit host/test flag inputs, not a player command permission or physical world-event observation. */
export function admitMissionWorld(model: MissionWorldModel, value: unknown, input: MissionWorldAdmission): MissionWorldCheckpoint {
  const s = source(model), checkpoint = restoreMissionWorld(model, value), r = worldRecord(input, ['commands', 'flags']);
  const commands = worldList(r.commands, 256), flags = worldList(r.flags, 1024) as MissionInput[];
  const mission = MissionLogic.restore(s.bindings.program, checkpoint.mission);
  if (s.teams && checkpoint.teams) {
    const teams = commands.length ? admitMissionTeamInput(s.teams, checkpoint.teams, { commands: commands as CommandEnvelope[], requests: [] }) : checkpoint.teams;
    mission.enqueue(flags); checkFlags(s, mission.save());
    return restoreMissionWorld(model, { ...checkpoint, teams, world: teams.team.world, mission: mission.save() });
  }
  const world = WorldSimulation.restore(s.world, checkpoint.world);
  world.admitCommands(commands); mission.enqueue(flags); checkFlags(s, mission.save());
  return restoreMissionWorld(model, { ...checkpoint, world: world.save(), mission: mission.save() });
}
/** D03: source cell policy advances the world before flags/cell delivery/scenario poll; legacy models retain poll-first order. */
export function stepMissionWorld(model: MissionWorldModel, value: unknown, ticks = 1, workLimit: number = MISSION_WORLD_LIMITS.work): MissionWorldResult {
  const s = source(model), checkpoint = restoreMissionWorld(model, value);
  worldInteger(ticks, 1, MISSION_WORLD_LIMITS.ticks); worldInteger(workLimit, 0, MISSION_WORLD_LIMITS.work);
  if (s.teams) return stepMissionTeams(model, checkpoint, ticks, workLimit);
  let world = WorldSimulation.restore(s.world, checkpoint.world);
  const mission = MissionLogic.restore(s.bindings.program, checkpoint.mission);
  const effects: MissionEffect[] = [], worldEvents: WorldTrace[] = [], requests: MissionWorldPresentationRequest[] = []; let work = 0, units = 0;
  const audioRequests: MissionWorldAudioRequest[] = [];
  let cursor = checkpoint.presentation, audioCursor = checkpoint.audio;
  for (let at = 0; at < ticks; at++) {
    const advanced = s.cells || s.objects || s.houses ? world.step(1, workLimit - work) : null;
    if (advanced) work += advanced.work.entityVisits + advanced.work.navigationExpansions + advanced.work.transitions;
    const entries: { cellId: string; entityId: number }[] = [];
    if (advanced) for (const event of advanced.events) {
      if (++work > workLimit) fail('work-limit');
      if (event.phase !== 'movement' || event.kind !== 'moved' || event.cell === null) continue;
      const cellId = s.cellByAddress.get(event.cell); if (cellId) entries.push({ cellId, entityId: event.entityId });
    }
    const callbacks: MissionObjectEventObservation[] = [];
    if (advanced && s.objects) {
      const facts = worldStepCombatObservations(s.world, advanced);
      if (facts.fromNextTick !== checkpoint.mission.nextTick + at || facts.toNextTick !== advanced.nextTick) fail('object-clock');
      for (const hit of facts.damage) {
        if (++work > workLimit) fail('work-limit');
        if (hit.healthBefore <= 0 || hit.damage <= 0 || hit.healthAfter >= hit.healthBefore) continue;
        const target = s.objectActors.get(hit.targetId), attacker = s.objectActors.get(hit.sourceId);
        if (!target || !attacker || target.status !== 'supported' || attacker.status !== 'supported' ||
          target.playerId === null || attacker.playerId === null) fail('object-hit-context');
        if (target.bindingId === null) continue;
        for (const callback of hit.healthAfter === 0 ? target.fatalSequence : target.nonfatalSequence) {
          if (++work > workLimit) fail('work-limit');
          if (callbacks.length >= MISSION_LOGIC_LIMITS.objectEvents) fail('object-event-limit');
          callbacks.push({ opcode: callback.opcode, entityId: target.entityId, sourceId: attacker.entityId });
        }
      }
    }
    // No caller observation list is accepted. Only successful private world transitions
    // produce source cell delivery; renderer picks, arrivals without movement and reservations do not.
    const context = s.houses ? createMissionActionWorldContext({ world: s.world, bindings: s.bindings,
      checkpoint: world.save(), missionNextTick: checkpoint.mission.nextTick + at }, workLimit - work) : null;
    let polled: ReturnType<MissionLogic['step']>;
    if (context) {
      const transaction = mission.stepWorldContext(context); polled = transaction;
      work += transaction.worldWork; world = WorldSimulation.restore(s.world, transaction.world);
    } else polled = s.objects ? mission.stepObjectEvents(callbacks, entries) : s.cells ? mission.stepCellEntries(entries) : mission.step();
    work += polled.work;
    if (s.cues && cursor) {
      // These effects are produced immediately by the private source-bound VM;
      // no public caller-supplied invocation/effect list reaches this boundary.
      const selected = polled.effects.filter(e => e.kind === 'presentation-request');
      const appended = appendMissionCues(s.cues, cursor, { tick: polled.nextTick - 1,
        invocations: selected.map(e => ({ instructionId: e.instructionId, instanceId: e.bindingId })) });
      const emitted = appended.events.map((event, i) => ({ ...event, vmOrder: selected[i]!.order,
        bindingId: selected[i]!.bindingId, triggerId: selected[i]!.triggerId }));
      const used = requestUnits(emitted); units += used; work += used + emitted.length;
      if (units > MISSION_WORLD_LIMITS.presentationUnits) fail('cue-payload-limit');
      if (emitted.length > MISSION_WORLD_LIMITS.trace - requests.length) fail('cue-trace-limit');
      requests.push(...emitted); cursor = appended.state;
    }
    if (s.audio && audioCursor) {
      const appended = appendAudio(s, audioCursor, polled.effects, polled.nextTick - 1, MISSION_WORLD_LIMITS.presentationUnits - units);
      units += appended.units; work += appended.work;
      if (appended.requests.length > MISSION_WORLD_LIMITS.trace - audioRequests.length) fail('audio-trace-limit');
      audioRequests.push(...appended.requests); audioCursor = appended.state;
    }
    if (work > workLimit) fail('work-limit');
    const moved = advanced ?? world.step(1, workLimit - work);
    if (!advanced) work += moved.work.entityVisits + moved.work.navigationExpansions + moved.work.transitions;
    if (work > workLimit) fail('work-limit');
    if (polled.effects.length + moved.events.length > MISSION_WORLD_LIMITS.trace - effects.length - worldEvents.length) fail('trace-limit');
    if (polled.nextTick !== moved.nextTick) fail('clock');
    // Every effect is returned in source VM order. Outcome requests remain requests;
    // this policy never resolves victory, playback, teams or native attachment mutation.
    effects.push(...polled.effects); worldEvents.push(...moved.events);
  }
  const next = restoreMissionWorld(model, { ...checkpoint, world: world.save(), mission: mission.save(), ...(cursor ? { presentation: cursor } : {}), ...(audioCursor ? { audio: audioCursor } : {}) });
  return freeze({ checkpoint: next, effects, worldEvents, work,
    ...(s.cues ? { presentation: presentation(model, checkpoint.world.nextTick, next, requests) } : {}),
    ...(s.audio ? { audio: audioBatch(model, checkpoint.world.nextTick, next, audioRequests) } : {}) });
}
/** D03: one world tick, optional genuine team-cell entries, then poll and next-tick requests. */
function stepMissionTeams(model: MissionWorldModel, checkpoint: MissionWorldCheckpoint, ticks: number, workLimit: number): MissionWorldResult {
  const s = source(model), runtime = s.teams!, mission = MissionLogic.restore(s.bindings.program, checkpoint.mission);
  let teams = checkpoint.teams!, cursor = checkpoint.presentation, audioCursor = checkpoint.audio, work = 0, units = 0;
  const effects: MissionEffect[] = [], worldEvents: WorldTrace[] = [], actions: MissionTeamEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [];
  const requests: MissionWorldPresentationRequest[] = [], audioRequests: MissionWorldAudioRequest[] = [];
  const charge = (n: number) => { if (n > workLimit - work) fail('work-limit'); work += n; };
  for (let at = 0; at < ticks; at++) {
    const advanced = stepMissionTeamWorld(runtime, teams, Math.min(runtime.limits.tickWork, workLimit - work)); charge(advanced.work);
    const receipt = missionTeamWorldStep(advanced);
    let polled: ReturnType<MissionLogic['step']>;
    if (s.teamCells) {
      const context = compileMissionTeamCellContext({ source: s.teamCells, teams: restoreMissionTeamContext(runtime, advanced.checkpoint.history) },
        { contextWork: Math.min(s.teamCells.limits.contextWork, workLimit - work) });
      const data = missionTeamCellContextData(context); charge(data.contextWork);
      if (data.runtime !== runtime || context.modelSha256 !== receipt.model.sha256 || context.modelSha256 !== advanced.checkpoint.team.world.state.modelSha256) fail('team-cell-world');
      const entries: { cellId: string; entityId: number }[] = [];
      for (const event of receipt.step.events) {
        charge(1); if (event.phase !== 'movement' || event.kind !== 'moved' || event.cell === null) continue;
        const cellId = s.cellByAddress.get(event.cell); if (!cellId) continue;
        if (entries.length >= MISSION_LOGIC_LIMITS.cellEntries) fail('cell-event-limit');
        entries.push({ cellId, entityId: event.entityId });
      }
      // The observations are derived only from this private single-step receipt.
      // Births, reservations and arrivals without movement cannot deliver an event.
      polled = mission.stepTeamCellEntries(entries, context);
    } else polled = mission.step();
    charge(polled.work);
    if (receipt.step.nextTick !== polled.nextTick || advanced.checkpoint.team.world.nextTick !== polled.nextTick) fail('team-clock');
    teams = advanced.checkpoint;
    const incoming: MissionTeamReceipt[] = [];
    for (const effect of polled.effects) {
      charge(1); if (effect.kind !== 'team-request') continue;
      if (![4, 7, 80].includes(effect.opcode)) fail('team-effect');
      incoming.push({ effectOrder: effect.order, emittedAtTick: effect.tick, dueTick: effect.tick + 1,
        instructionId: effect.instructionId, bindingId: effect.bindingId, triggerId: effect.triggerId, opcode: effect.opcode as 4 | 7 | 80 });
    }
    // No receipt/effect list is accepted from callers. These requests come from
    // this private VM invocation, after the world's only advance in this tick.
    if (incoming.length) teams = admitMissionTeamInput(runtime, teams, { requests: incoming, commands: [] });
    if (s.cues && cursor) {
      const selected = polled.effects.filter(e => e.kind === 'presentation-request');
      const appended = appendMissionCues(s.cues, cursor, { tick: polled.nextTick - 1,
        invocations: selected.map(e => ({ instructionId: e.instructionId, instanceId: e.bindingId })) });
      const emitted = appended.events.map((event, i) => ({ ...event, vmOrder: selected[i]!.order,
        bindingId: selected[i]!.bindingId, triggerId: selected[i]!.triggerId }));
      const used = requestUnits(emitted); units += used; charge(used + emitted.length);
      if (units > MISSION_WORLD_LIMITS.presentationUnits) fail('cue-payload-limit');
      if (emitted.length > MISSION_WORLD_LIMITS.trace - requests.length) fail('cue-trace-limit');
      requests.push(...emitted); cursor = appended.state;
    }
    if (s.audio && audioCursor) {
      const appended = appendAudio(s, audioCursor, polled.effects, polled.nextTick - 1, MISSION_WORLD_LIMITS.presentationUnits - units);
      units += appended.units; charge(appended.work);
      if (appended.requests.length > MISSION_WORLD_LIMITS.trace - audioRequests.length) fail('audio-trace-limit');
      audioRequests.push(...appended.requests); audioCursor = appended.state;
    }
    const size = polled.effects.length + advanced.worldEvents.length + advanced.actionEvents.length + advanced.orders.length + advanced.events.length;
    if (size > MISSION_WORLD_LIMITS.trace - effects.length - worldEvents.length - actions.length - orders.length - events.length) fail('trace-limit');
    effects.push(...polled.effects); worldEvents.push(...advanced.worldEvents); actions.push(...advanced.actionEvents); orders.push(...advanced.orders); events.push(...advanced.events);
  }
  const next = restoreMissionWorld(model, { ...checkpoint, teams, world: teams.team.world, mission: mission.save(), ...(cursor ? { presentation: cursor } : {}), ...(audioCursor ? { audio: audioCursor } : {}) });
  return freeze({ checkpoint: next, effects, worldEvents, work, teams: { actions, orders, events },
    ...(s.cues ? { presentation: presentation(model, checkpoint.world.nextTick, next, requests) } : {}),
    ...(s.audio ? { audio: audioBatch(model, checkpoint.world.nextTick, next, audioRequests) } : {}) });
}
export interface MissionWorldReplay {
  readonly schemaVersion: 1; readonly modelSha256: string; readonly initialCheckpoint: MissionWorldCheckpoint;
  readonly admissions: readonly Readonly<{ nextTick: number; input: MissionWorldAdmission }>[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
export function replayMissionWorld(model: MissionWorldModel, value: unknown): MissionWorldResult {
  const s = source(model);
  const raw = typeof value === 'string' || value instanceof Uint8Array ? parseJson(value) : value;
  const r = worldRecord(worldClone(raw), ['schemaVersion', 'modelSha256', 'initialCheckpoint', 'admissions', 'finalNextTick', 'finalStateSha256']);
  if (r.schemaVersion !== 1 || r.modelSha256 !== model.sha256) fail('replay-identity'); worldSourceHash(r.finalStateSha256);
  let checkpoint = restoreMissionWorld(model, r.initialCheckpoint), previous = checkpoint.world.nextTick, work = 0, inputs = 0;
  const end = worldInteger(r.finalNextTick, previous, Math.min(1_000_000_000, previous + MISSION_WORLD_LIMITS.replayTicks));
  const admissions = worldList(r.admissions, MISSION_WORLD_LIMITS.admissions).map(v => {
    const a = worldRecord(v, ['nextTick', 'input']), nextTick = worldInteger(a.nextTick, previous, end);
    const input = worldRecord(a.input, ['commands', 'flags']);
    const commands = worldList(input.commands, 256) as CommandEnvelope[], flags = worldList(input.flags, 1024) as MissionInput[];
    inputs += commands.length + flags.length;
    if ((!commands.length && !flags.length) || inputs > MISSION_WORLD_LIMITS.admissions) fail('replay-admission-limit');
    previous = nextTick; return { nextTick, input: { commands, flags } };
  });
  const effects: MissionEffect[] = [], worldEvents: WorldTrace[] = [], requests: MissionWorldPresentationRequest[] = [];
  const actions: MissionTeamEvent[] = [], orders: TeamOrder[] = [], events: (TeamEvent & { tick: number })[] = [];
  const audioRequests: MissionWorldAudioRequest[] = [];
  const start = checkpoint.world.nextTick; let units = 0;
  function advance(tick: number): void {
    while (checkpoint.world.nextTick < tick) {
      const step = stepMissionWorld(model, checkpoint, 1, MISSION_WORLD_LIMITS.work - work); work += step.work;
      const teamCount = step.teams ? step.teams.actions.length + step.teams.orders.length + step.teams.events.length : 0;
      if (step.effects.length + step.worldEvents.length + teamCount > MISSION_WORLD_LIMITS.trace - effects.length - worldEvents.length - actions.length - orders.length - events.length) fail('replay-trace-limit');
      if (step.teams) { actions.push(...step.teams.actions); orders.push(...step.teams.orders); events.push(...step.teams.events); }
      if (step.presentation) {
        units += requestUnits(step.presentation.requests);
        if (units > MISSION_WORLD_LIMITS.presentationUnits) fail('replay-cue-payload-limit');
        if (step.presentation.requests.length > MISSION_WORLD_LIMITS.trace - requests.length) fail('replay-cue-trace-limit');
        requests.push(...step.presentation.requests);
      }
      if (step.audio) {
        units += audioRequestUnits(step.audio.requests);
        if (units > MISSION_WORLD_LIMITS.presentationUnits) fail('replay-audio-payload-limit');
        if (step.audio.requests.length > MISSION_WORLD_LIMITS.trace - audioRequests.length) fail('replay-audio-trace-limit');
        audioRequests.push(...step.audio.requests);
      }
      checkpoint = step.checkpoint; effects.push(...step.effects); worldEvents.push(...step.worldEvents);
    }
  }
  for (const a of admissions) { advance(a.nextTick); checkpoint = admitMissionWorld(model, checkpoint, a.input); }
  advance(end); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, effects, worldEvents, work, ...(s.teams ? { teams: { actions, orders, events } } : {}),
    ...(s.cues ? { presentation: presentation(model, start, checkpoint, requests) } : {}),
    ...(s.audio ? { audio: audioBatch(model, start, checkpoint, audioRequests) } : {}) });
}
