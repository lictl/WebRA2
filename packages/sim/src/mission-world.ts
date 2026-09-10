// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded compound transactions. See ../MISSION_WORLD_PROVENANCE.md.
import type { CommandEnvelope } from '../../contracts/src/index.ts';
import { canonicalText, parseJson } from './canonical.ts';
import { isMissionBindingAuthority, type MissionBindingAuthority } from './mission-bindings.ts';
import { isMissionInitialFlags, type MissionInitialFlags } from './mission-initial-flags.ts';
import { MissionLogic, type MissionEffect, type MissionInput, type MissionSave } from './mission-logic.ts';
import { assertWorldModel, createWorldModel, type WorldModel } from './world-model.ts';
import { combatSourceBridge } from './combat-model.ts';
import { WorldSimulation, type WorldSave, type WorldTrace } from './world.ts';
import { worldClone, worldHash, worldInteger, worldList, worldPosition, worldRecord, worldSourceHash } from './world-values.ts';

export const MISSION_WORLD_POLICY = 'webra2-mission-world-poll-1' as const;
export const MISSION_WORLD_LIMITS = Object.freeze({ ticks: 128, work: 16_777_216, trace: 32768, replayTicks: 10000, admissions: 1024 });
export interface MissionWorldModel {
  readonly policy: typeof MISSION_WORLD_POLICY; readonly sha256: string; readonly worldSha256: string;
  readonly bindingsSha256: string; readonly programSha256: string; readonly flagsSha256: string;
  readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
}
export interface MissionWorldCheckpoint {
  readonly schemaVersion: 1; readonly policy: typeof MISSION_WORLD_POLICY; readonly modelSha256: string;
  readonly world: WorldSave; readonly mission: MissionSave;
}
export interface MissionWorldResult {
  readonly checkpoint: MissionWorldCheckpoint; readonly effects: readonly MissionEffect[];
  readonly worldEvents: readonly WorldTrace[]; readonly work: number;
}
export class MissionWorldError extends Error {
  constructor(readonly code: string) { super(`mission-world-${code}`); this.name = 'MissionWorldError'; }
}
function fail(code: string): never { throw new MissionWorldError(code); }
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const c of Object.values(v)) freeze(c); Object.freeze(v); } return v;
}
type Source = { world: WorldModel; bindings: MissionBindingAuthority; flags: MissionInitialFlags; initial: MissionSave };
const sources = new WeakMap<MissionWorldModel, Source>();
function source(model: MissionWorldModel): Source { const s = sources.get(model); if (!s) fail('model'); return s; }
const actions = new Set([0, 1, 2, 12, 22, 23, 24, 25, 26, 27, 28, 29, 53, 54, 56, 57]);

/** Complete source/program authority is mandatory. This adapter implements only the poll VM's internal controls. */
export function compileMissionWorld(input: {
  readonly world: WorldModel; readonly bindings: MissionBindingAuthority; readonly flags: MissionInitialFlags;
}): MissionWorldModel {
  const r = worldRecord(input, ['world', 'bindings', 'flags']);
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
  for (const trigger of bindings.program.triggers) {
    for (const event of trigger.events) if ((event.opcode === 36 || event.opcode === 37) && event.argument >= flags.localCapacity) fail('local-capacity');
    for (const action of trigger.actions) {
      if (!actions.has(action.opcode)) fail('unimplemented-effect');
      if ((action.opcode === 56 || action.opcode === 57) && action.argument >= flags.localCapacity) fail('local-capacity');
    }
  }
  const initial = MissionLogic.create(bindings.program, { bindings: bindings.bindings, globals: flags.globals, locals: flags.locals }).save();
  const data = { policy: MISSION_WORLD_POLICY, worldSha256: world.sha256, bindingsSha256: bindings.catalogSha256,
    programSha256: bindings.program.sha256, flagsSha256: flags.sha256, canStartCampaign: false as const, nativeBehaviorVerified: false as const };
  const model = freeze({ ...data, sha256: worldHash(data) }); sources.set(model, { world, bindings, flags, initial }); return model;
}
function checkFlags(s: Source, mission: MissionSave): void {
  if (mission.locals.slice(s.flags.localCapacity).some(Boolean) || mission.pending.some(i => i.kind === 'local' && i.index >= s.flags.localCapacity)) fail('local-capacity');
  const shape = (v: MissionSave) => v.bindings.map(b => ({ id: b.id, tagId: b.tagId, attachmentIds: b.attachmentIds }));
  if (canonicalText(shape(mission)) !== canonicalText(shape(s.initial))) fail('source-bindings');
  if (mission.nextTick === 0 && (canonicalText(mission.globals) !== canonicalText(s.flags.globals) || canonicalText(mission.locals) !== canonicalText(s.flags.locals))) fail('initial-flags');
}
export function restoreMissionWorld(model: MissionWorldModel, value: unknown): MissionWorldCheckpoint {
  const s = source(model), raw = typeof value === 'string' || value instanceof Uint8Array ? parseJson(value) : value;
  const r = worldRecord(worldClone(raw), ['schemaVersion', 'policy', 'modelSha256', 'world', 'mission']);
  if (r.schemaVersion !== 1 || r.policy !== MISSION_WORLD_POLICY || r.modelSha256 !== model.sha256) fail('checkpoint-identity');
  const world = WorldSimulation.restore(s.world, r.world).save(), mission = MissionLogic.restore(s.bindings.program, r.mission).save();
  if (world.nextTick !== mission.nextTick) fail('clock'); checkFlags(s, mission);
  return freeze({ schemaVersion: 1, policy: MISSION_WORLD_POLICY, modelSha256: model.sha256, world, mission });
}
export function createMissionWorld(model: MissionWorldModel): MissionWorldCheckpoint {
  const s = source(model);
  return restoreMissionWorld(model, { schemaVersion: 1, policy: MISSION_WORLD_POLICY, modelSha256: model.sha256,
    world: WorldSimulation.create(s.world).save(), mission: s.initial });
}
export interface MissionWorldAdmission {
  readonly commands: readonly CommandEnvelope[]; readonly flags: readonly MissionInput[];
}
/** Explicit host/test flag inputs, not a player command permission or physical world-event observation. */
export function admitMissionWorld(model: MissionWorldModel, value: unknown, input: MissionWorldAdmission): MissionWorldCheckpoint {
  const s = source(model), checkpoint = restoreMissionWorld(model, value), r = worldRecord(input, ['commands', 'flags']);
  const commands = worldList(r.commands, 256), flags = worldList(r.flags, 1024) as MissionInput[];
  const world = WorldSimulation.restore(s.world, checkpoint.world), mission = MissionLogic.restore(s.bindings.program, checkpoint.mission);
  world.admitCommands(commands); mission.enqueue(flags); checkFlags(s, mission.save());
  return restoreMissionWorld(model, { ...checkpoint, world: world.save(), mission: mission.save() });
}
/** D03: apply due flags and poll controls, then advance the world once. Publish only a complete candidate. */
export function stepMissionWorld(model: MissionWorldModel, value: unknown, ticks = 1, workLimit: number = MISSION_WORLD_LIMITS.work): MissionWorldResult {
  const s = source(model), checkpoint = restoreMissionWorld(model, value);
  worldInteger(ticks, 1, MISSION_WORLD_LIMITS.ticks); worldInteger(workLimit, 0, MISSION_WORLD_LIMITS.work);
  const world = WorldSimulation.restore(s.world, checkpoint.world), mission = MissionLogic.restore(s.bindings.program, checkpoint.mission);
  const effects: MissionEffect[] = [], worldEvents: WorldTrace[] = []; let work = 0;
  for (let at = 0; at < ticks; at++) {
    const polled = mission.step(); work += polled.work;
    if (work > workLimit) fail('work-limit');
    const moved = world.step(1, workLimit - work); work += moved.work.entityVisits + moved.work.navigationExpansions + moved.work.transitions;
    if (work > workLimit) fail('work-limit');
    if (polled.effects.length + moved.events.length > MISSION_WORLD_LIMITS.trace - effects.length - worldEvents.length) fail('trace-limit');
    if (polled.nextTick !== moved.nextTick) fail('clock');
    // Every effect is returned in source VM order. Outcome requests remain requests;
    // this policy never resolves victory, media, teams or physical tag callbacks.
    effects.push(...polled.effects); worldEvents.push(...moved.events);
  }
  const next = restoreMissionWorld(model, { ...checkpoint, world: world.save(), mission: mission.save() });
  return freeze({ checkpoint: next, effects, worldEvents, work });
}
export interface MissionWorldReplay {
  readonly schemaVersion: 1; readonly modelSha256: string; readonly initialCheckpoint: MissionWorldCheckpoint;
  readonly admissions: readonly Readonly<{ nextTick: number; input: MissionWorldAdmission }>[];
  readonly finalNextTick: number; readonly finalStateSha256: string;
}
export function replayMissionWorld(model: MissionWorldModel, value: unknown): MissionWorldResult {
  source(model);
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
  const effects: MissionEffect[] = [], worldEvents: WorldTrace[] = [];
  function advance(tick: number): void {
    while (checkpoint.world.nextTick < tick) {
      const step = stepMissionWorld(model, checkpoint, 1, MISSION_WORLD_LIMITS.work - work); work += step.work;
      if (step.effects.length + step.worldEvents.length > MISSION_WORLD_LIMITS.trace - effects.length - worldEvents.length) fail('replay-trace-limit');
      checkpoint = step.checkpoint; effects.push(...step.effects); worldEvents.push(...step.worldEvents);
    }
  }
  for (const a of admissions) { advance(a.nextTick); checkpoint = admitMissionWorld(model, checkpoint, a.input); }
  advance(end); if (worldHash(checkpoint) !== r.finalStateSha256) fail('replay-final-hash');
  return freeze({ checkpoint, effects, worldEvents, work });
}
