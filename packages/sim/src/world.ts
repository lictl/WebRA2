// SPDX-License-Identifier: MIT
// Original deterministic world motion. Rendering and native-content interpretation are separate.
import { orderCommands, type CommandEnvelope, type SaveEnvelope } from '../../contracts/src/index.ts';
import { canonicalText } from './canonical.ts';
import { findNavigationPath } from './navigation.ts';
import { createInfantryOccupancy, initialInfantrySlots, type InfantrySlotState, type InfantryOccupancy } from './infantry-passage-occupancy.ts';
import { ORDINARY_DEATH_ENGINE_VERSION, ORDINARY_DEATH_POLICY } from './ordinary-death-rules.ts';
import { SOURCE_INFANTRY_COMBAT_POLICY, SOURCE_INFANTRY_COMBAT_ENGINE_VERSION, INFANTRY_COMBAT_POLICY, INFANTRY_COMBAT_ENGINE_VERSION, COMBAT_ENGINE_VERSION } from './combat-model.ts';
import { ORDINARY_COMBAT_ENGINE_VERSION, ORDINARY_COMBAT_POLICY } from './ordinary-combat-rules.ts';
import { combatDyingActorIds, attackCombat, createCombatState, stepCombat, stopCombat, validateCombatState, validateSourceCombatState, type CombatState, type CombatDamageObservation } from './combat.ts';
import { assertWorldModel, worldAddress, worldClone, worldContent, worldEdgeCost, worldFail, worldInteger, worldList, worldPosition,
  worldRecord, WORLD_ENGINE_VERSION, WORLD_INFANTRY_ENGINE_VERSION, WORLD_LIMITS as C, WORLD_MOTION_POLICY, type WorldModel, type WorldEntityDefinition } from './world-model.ts';

export type WorldEntity = { id: number; x: number; y: number; health: number | null;
  goal: number | null; route: number[]; progress: number; waitTicks: number };
export type WorldState = { modelSha256: string; entities: WorldEntity[]; planningCursor: number;
  admissionCursors: { playerId: number; sequence: number }[]; combat?: CombatState;
  infantrySlots?: { -readonly [K in keyof InfantrySlotState]: InfantrySlotState[K] }[] };
export type WorldSave = SaveEnvelope<WorldState>;
export type WorldTrace = { tick: number; phase: 'command' | 'navigation' | 'movement' | 'combat'; kind: string; entityId: number; cell: number | null; value: number | null };
export type WorldStep = { nextTick: number; events: WorldTrace[]; work: { entityVisits: number; navigationExpansions: number; transitions: number } };
export interface WorldStepCombatObservations {
  readonly modelSha256: string; readonly fromNextTick: number; readonly toNextTick: number;
  readonly damage: readonly CombatDamageObservation[];
}
const stepCombatObservations = new WeakMap<object, { model: WorldModel; value: WorldStepCombatObservations }>();
/** Only the exact returned step and its genuine model can expose privately retained facts. */
export function worldStepCombatObservations(model: WorldModel, step: unknown): WorldStepCombatObservations {
  assertWorldModel(model);
  const entry = step && typeof step === 'object' ? stepCombatObservations.get(step) : undefined;
  if (!entry || entry.model !== model) worldFail('world-step-combat-observations');
  return entry.value;
}
type LiveSave = { -readonly [K in keyof WorldSave]: WorldSave[K] } & { queuedCommands: CommandEnvelope[]; scheduledWork: []; rngStates: Record<string, never> };

const engineVersion = (model: WorldModel) => model.infantryPassage ? WORLD_INFANTRY_ENGINE_VERSION : model.combat?.policy===SOURCE_INFANTRY_COMBAT_POLICY ? SOURCE_INFANTRY_COMBAT_ENGINE_VERSION : model.combat?.policy===INFANTRY_COMBAT_POLICY ? INFANTRY_COMBAT_ENGINE_VERSION : model.combat?.policy===ORDINARY_DEATH_POLICY ? ORDINARY_DEATH_ENGINE_VERSION : model.combat?.policy===ORDINARY_COMBAT_POLICY ? ORDINARY_COMBAT_ENGINE_VERSION : model.combat ? COMBAT_ENGINE_VERSION : WORLD_ENGINE_VERSION;
const rulesVersion = (model: WorldModel) => model.infantryPassage ? `${model.combat?.policy ?? WORLD_MOTION_POLICY}+${model.infantryPassage.policy}` : model.combat ? model.combat.policy : WORLD_MOTION_POLICY;
function infantryOccupancy(model: WorldModel, state: WorldState): InfantryOccupancy {
  const dying = combatDyingActorIds(state.combat);
  // Same authoritative release policy as whole-cell occupancy: pending deaths retain claims.
  const retiredEntityIds = state.entities.filter(e => e.health === 0 && !dying.has(e.id)).map(e => e.id);
  return createInfantryOccupancy(model.infantryPassage!, { entities: state.entities, infantrySlots: state.infantrySlots!, retiredEntityIds });
}
function command(value: unknown, combat: boolean): CommandEnvelope {
  const r = worldRecord(value, ['schemaVersion', 'tick', 'playerId', 'sequence', 'kind', 'payload']);
  if (r.schemaVersion !== 1 || (r.kind !== 'move' && r.kind !== 'stop' && !(combat && r.kind === 'attack'))) worldFail('world-command-kind');
  const payload = worldRecord(r.payload, r.kind === 'move' ? ['entityId', 'x', 'y'] : r.kind === 'attack' ? ['entityId', 'targetId'] : ['entityId']);
  const entityId = worldInteger(payload.entityId, 1, 2147483647);
  const common = { schemaVersion: 1 as const, tick: worldInteger(r.tick, 0, C.tick - 1), playerId: worldInteger(r.playerId, 0, C.players - 1),
    sequence: worldInteger(r.sequence, 0, Number.MAX_SAFE_INTEGER), kind: r.kind };
  return { ...common, payload: r.kind === 'move' ? { entityId, ...worldPosition(worldAddress(payload.x, payload.y)) } : r.kind === 'attack' ? { entityId, targetId: worldInteger(payload.targetId, 1, 2147483647) } : { entityId } };
}
function occupancy(model: WorldModel, state: WorldState): Map<number, number> {
  const counts = new Map(model.blocked.map(at => [at, 1])), dying=combatDyingActorIds(state.combat);
  const add = (at: number) => counts.set(at, (counts.get(at) ?? 0) + 1);
  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]!, d = model.entities[i]!;
    if (d.blocksCell && (e.health !== 0||dying.has(e.id))) { add(worldAddress(e.x, e.y)); if (e.progress > 0) add(e.route[1]!); }
  }
  const byId = new Map(state.entities.map(e => [e.id, e]));
  for (const p of model.footprints) if (byId.get(p.entityId)!.health !== 0) for (const at of p.cells) add(at);
  return counts;
}
function staticOccupancy(model: WorldModel, state: { entities: readonly Pick<WorldEntity, 'id' | 'health'>[] }): Set<number> {
  const blocked = new Set(model.blocked), byId = new Map(state.entities.map(e => [e.id, e]));
  for (const p of model.footprints) if (byId.get(p.entityId)?.health !== 0) for (const at of p.cells) blocked.add(at);
  return blocked;
}
function validateSave(model: WorldModel, input: unknown): LiveSave {
  assertWorldModel(model);
  const r = worldRecord(worldClone(input), ['schemaVersion', 'engineVersion', 'simulationRulesVersion', 'contentIdentity', 'nextTick', 'state', 'queuedCommands', 'scheduledWork', 'rngStates']);
  if (r.schemaVersion !== 1 || r.engineVersion !== engineVersion(model) || r.simulationRulesVersion !== rulesVersion(model)) worldFail('world-save-version');
  const contentIdentity = worldContent(r.contentIdentity);
  if (canonicalText(contentIdentity) !== canonicalText(model.contentIdentity)) worldFail('world-save-content');
  const nextTick = worldInteger(r.nextTick, 0, C.tick), s = worldRecord(r.state, ['modelSha256', 'entities', 'planningCursor', 'admissionCursors', ...(model.combat ? ['combat'] : []), ...(model.infantryPassage ? ['infantrySlots'] : [])]);
  if (s.modelSha256 !== model.sha256) worldFail('world-save-model');
  if (worldList(r.scheduledWork, 0).length || Reflect.ownKeys(worldRecord(r.rngStates, [])).length) worldFail('world-save-work');
  const inputs = worldList(s.entities, C.entities); if (inputs.length !== model.entities.length) worldFail('world-save-entities');
  const grids = new Map(model.navigation.map(b => [b.grid.movementClass, b]));
  // Read/validate health projections before using them to include stationary footprint cells.
  const projected = inputs.map((v, i) => {
    const e = worldRecord(v, ['id', 'x', 'y', 'health', 'goal', 'route', 'progress', 'waitTicks']), d = model.entities[i]!;
    const health = e.health === null ? null : worldInteger(e.health, 0, d.maximumHealth ?? 0);
    if (e.id !== d.id || (health === null) !== (d.maximumHealth === null)) worldFail('world-save-health');
    return { id: d.id, health };
  });
  const staticBlocked = staticOccupancy(model, { entities: projected });
  const entities: WorldEntity[] = []; let paths = 0;
  for (let i = 0; i < inputs.length; i++) {
    const e = worldRecord(inputs[i], ['id', 'x', 'y', 'health', 'goal', 'route', 'progress', 'waitTicks']), definition = model.entities[i]!;
    if (e.id !== definition.id) worldFail('world-save-entity-id');
    const at = worldAddress(e.x, e.y), health = e.health === null ? null : worldInteger(e.health, 0, definition.maximumHealth ?? 0);
    if (!definition.movementPerTick && at !== worldAddress(definition.x, definition.y)) worldFail('world-save-static-position');
    if ((health === null) !== (definition.maximumHealth === null)) worldFail('world-save-health');
    const goal = e.goal === null ? null : worldInteger(e.goal, 0, 512 * 512 - 1), route = worldList(e.route, C.paths).map(a => worldInteger(a, 0, 512 * 512 - 1));
    paths += route.length; if (paths > C.paths) worldFail('world-path-limit');
    const progress = worldInteger(e.progress, 0, 362 * 65535 - 1), waitTicks = worldInteger(e.waitTicks, 0, C.retryTicks);
    if (goal === null && (route.length || progress || waitTicks)) worldFail('world-save-idle');
    if (goal !== null && (health === 0 || health === null || definition.owner === null || !definition.movementPerTick || definition.navigationClass === null)) worldFail('world-save-movement');
    if (route.length) {
      if (route.length < 2 || route[0] !== at || waitTicks || new Set(route).size !== route.length) worldFail('world-save-route');
      if (route.at(-1) !== goal && !(progress > 0 && route.length === 2)) worldFail('world-save-route-goal');
      const binding = grids.get(definition.navigationClass!); if (!binding) worldFail('world-save-grid');
      for (let j = 1; j < route.length; j++) {
        const cost = worldEdgeCost(binding.grid, route[j - 1]!, route[j]!, staticBlocked);
        if (cost === null || (j === 1 && progress >= cost)) worldFail('world-save-route-edge');
      }
    } else if (progress) worldFail('world-save-progress');
    entities.push({ id: definition.id, ...worldPosition(at), health, goal, route, progress, waitTicks });
  }
  const planningCursor = worldInteger(s.planningCursor, 0, Math.max(0, entities.length - 1));
  const admissionCursors: WorldState['admissionCursors'] = [], cursors = new Map<number, number>(); let priorPlayer = -1;
  for (const item of worldList(s.admissionCursors, C.players)) {
    const row = worldRecord(item, ['playerId', 'sequence']), playerId = worldInteger(row.playerId, 0, C.players - 1), sequence = worldInteger(row.sequence, 0, Number.MAX_SAFE_INTEGER);
    if (playerId <= priorPlayer) worldFail('world-save-cursors'); priorPlayer = playerId; cursors.set(playerId, sequence); admissionCursors.push({ playerId, sequence });
  }
  const originalCommands = worldList(r.queuedCommands, C.commands).map(c => command(c, !!model.combat)); let queuedCommands: CommandEnvelope[];
  try { queuedCommands = orderCommands(originalCommands); } catch { return worldFail('world-command-duplicate'); }
  if (canonicalText(originalCommands) !== canonicalText(queuedCommands)) worldFail('world-save-command-order');
  for (const c of queuedCommands) {
    if (c.tick < nextTick || c.tick > Math.min(C.tick - 1, nextTick + C.futureTicks) || c.sequence > (cursors.get(c.playerId) ?? -1)) worldFail('world-save-command');
  }
  const state: WorldState = { modelSha256: model.sha256, entities, planningCursor, admissionCursors,
    ...(model.combat ? { combat: validateCombatState(model, s.combat, entities, nextTick) } : {}) }, counts = occupancy(model, state);
  if (model.infantryPassage) {
    state.infantrySlots = worldList(s.infantrySlots, C.entities).map(value => {
      const row = worldRecord(value, ['entityId', 'subcell', 'reservedSubcell']);
      return { entityId: worldInteger(row.entityId, 1, 2147483647), subcell: worldInteger(row.subcell, 2, 4) as InfantrySlotState['subcell'],
        reservedSubcell: row.reservedSubcell === null ? null : worldInteger(row.reservedSubcell, 2, 4) as InfantrySlotState['subcell'] };
    });
    infantryOccupancy(model, state);
  }
  validateSourceCombatState(model,state);
  // Only original shared anchors may overlap. A legal edit cannot introduce a new
  // occupant at a blocked cell or move immutable static footprints away from their actor.
  const dying=combatDyingActorIds(state.combat);
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]!, d = model.entities[i]!, at = worldAddress(e.x, e.y);
    if (d.blocksCell && (e.health !== 0||dying.has(e.id)) && (counts.get(at) ?? 0) > 1 &&
      (d.initialHealth === 0 || !model.infantryPassage && at !== worldAddress(d.x, d.y))) worldFail('world-save-anchor-overlap');
  }
  // Extra cells are occupants too. Reviving an initially absent stationary
  // footprint cannot create sharing even when every other anchor is unchanged.
  const stateById = new Map(entities.map(e => [e.id, e]));
  const definitionById = new Map(model.entities.map(e => [e.id, e]));
  for (const p of model.footprints) if (definitionById.get(p.entityId)!.initialHealth === 0 &&
    stateById.get(p.entityId)!.health !== 0 && p.cells.some(at => (counts.get(at) ?? 0) > 1)) worldFail('world-save-footprint-overlap');
  // Shared initial anchor cells are allowed, but an active edge must own its destination reservation.
  if (!model.infantryPassage) for (let i = 0; i < entities.length; i++) if (entities[i]!.progress && model.entities[i]!.blocksCell && counts.get(entities[i]!.route[1]!) !== 1) worldFail('world-save-reservation');
  const save: LiveSave = { schemaVersion: 1, engineVersion: engineVersion(model), simulationRulesVersion: rulesVersion(model),
    contentIdentity, nextTick, state, queuedCommands, scheduledWork: [], rngStates: {} };
  // Applies the existing canonical JSON byte/node guard to all combined state resources.
  worldClone(save); return save;
}

/** Pure 15 Hz logical motion policy. The caller schedules wall-clock ticks and renders snapshots. */
export class WorldSimulation {
  readonly #model: WorldModel;
  #value: LiveSave;
  private constructor(model: WorldModel, save: LiveSave) { this.#model = model; this.#value = save; }
  static create(model: WorldModel): WorldSimulation {
    assertWorldModel(model);
    return WorldSimulation.restore(model, { schemaVersion: 1, engineVersion: engineVersion(model), simulationRulesVersion: rulesVersion(model),
      contentIdentity: model.contentIdentity, nextTick: 0, state: { modelSha256: model.sha256, planningCursor: 0, admissionCursors: [],
        ...(model.combat ? { combat: createCombatState(model) } : {}),
        ...(model.infantryPassage ? { infantrySlots: initialInfantrySlots(model.infantryPassage) } : {}),
        entities: model.entities.map(e => ({ id: e.id, x: e.x, y: e.y, health: e.initialHealth, goal: null, route: [], progress: 0, waitTicks: 0 })) },
      queuedCommands: [], scheduledWork: [], rngStates: {} });
  }
  static restore(model: WorldModel, input: unknown): WorldSimulation { return new WorldSimulation(model, validateSave(model, input)); }
  get model(): WorldModel { return this.#model; }
  get nextTick(): number { return this.#value.nextTick; }
  save(): WorldSave { return worldClone(this.#value); }
  saveText(): string { return canonicalText(this.#value); }
  admitCommands(input: readonly unknown[]): CommandEnvelope[] {
    const inputs = worldList(worldClone(input), C.commands); if (inputs.length > C.commands - this.#value.queuedCommands.length) worldFail('world-command-queue');
    let commands: CommandEnvelope[];
    try { commands = orderCommands(inputs.map(c => command(c, !!this.#model.combat))); } catch (error) { if (error instanceof TypeError) return worldFail('world-command-duplicate'); throw error; }
    const cursors = new Map(this.#value.state.admissionCursors.map(c => [c.playerId, c.sequence]));
    for (const c of [...commands].sort((a, b) => a.playerId - b.playerId || a.sequence - b.sequence)) {
      if (c.tick < this.nextTick || c.tick > Math.min(C.tick - 1, this.nextTick + C.futureTicks)) worldFail('world-command-horizon');
      if (c.sequence <= (cursors.get(c.playerId) ?? -1)) worldFail('world-command-sequence'); cursors.set(c.playerId, c.sequence);
    }
    const next = worldClone(this.#value);
    next.state.admissionCursors = [...cursors].sort((a, b) => a[0] - b[0]).map(([playerId, sequence]) => ({ playerId, sequence }));
    next.queuedCommands = orderCommands([...next.queuedCommands, ...commands]); this.#value = validateSave(this.#model, next); return worldClone(commands);
  }
  /** All requested ticks commit together. Fatal transition/trace/state limits leave the prior checkpoint intact. */
  step(ticks = 1, workLimit: number = C.replayWork): WorldStep {
    worldInteger(ticks, 1, C.stepTicks); if (ticks > C.tick - this.nextTick) worldFail('world-tick-overflow');
    worldInteger(workLimit, 0, C.replayWork);
    const save = worldClone(this.#value), events: WorldTrace[] = [], definitions = new Map(this.#model.entities.map(e => [e.id, e]));
    const fromNextTick = save.nextTick, damage: CombatDamageObservation[] = [];
    const bindings = new Map(this.#model.navigation.map(b => [b.grid.movementClass, b]));
    const work = { entityVisits: 0, navigationExpansions: 0, transitions: 0 };
    const footprintWork = this.#model.footprints.reduce((sum, p) => sum + p.cells.length, 0);
    const emit = (phase: WorldTrace['phase'], kind: string, entityId: number, cell: number | null = null, value: number | null = null) => {
      if (events.length >= C.trace) worldFail('world-trace-limit'); events.push({ tick: save.nextTick, phase, kind, entityId, cell, value });
    };
    for (let tick = 0; tick < ticks; tick++) {
      const state = save.state, byId = new Map(state.entities.map(e => [e.id, e]));
      const slots = new Map(state.infantrySlots?.map(s => [s.entityId, s]) ?? []);
      let passageWork = 0;
      const chargePassage = (n: number) => {
        passageWork += n; work.entityVisits += n;
        if (passageWork > 262144 || work.entityVisits + work.navigationExpansions + work.transitions > workLimit) worldFail('world-infantry-work-limit');
      };
      const passageIndex = () => {
        chargePassage(state.entities.length * 4 + state.entities.reduce((sum, e) => sum + e.route.length, 0) +
          this.#model.blocked.length + footprintWork + slots.size * 2);
        return infantryOccupancy(this.#model, state);
      };
      const clearReservation = (id: number) => { const s = slots.get(id); if (s) s.reservedSubcell = null; };
      const staticBlocked = staticOccupancy(this.#model, state);
      // Phase 1: all due orders use the shared command order. Mid-edge move replacement finishes that edge.
      for (const c of save.queuedCommands.filter(c => c.tick === save.nextTick)) {
        const p = c.payload as Record<string, number>, e = byId.get(p.entityId!), d = definitions.get(p.entityId!);
        if (!e || !d) { emit('command', 'missing-entity', p.entityId!); continue; }
        if (d.owner !== c.playerId) { emit('command', 'not-owner', e.id); continue; }
        if (c.kind === 'attack') {
          if (e.health === 0 || e.health === null) { emit('command', 'inactive', e.id); continue; }
          if (attackCombat(this.#model, state.combat!, state.entities, e.id, p.targetId!,
            (kind, id, cell, value) => emit('command', kind, id, cell, value))) {
            e.goal = null; e.route = []; e.progress = 0; e.waitTicks = 0;
            clearReservation(e.id);
          }
          continue;
        }
        if (c.kind === 'stop' && state.combat && e.health !== null && e.health > 0) {
          stopCombat(this.#model, state.combat, e.id); e.goal = null; e.route = []; e.progress = 0; e.waitTicks = 0;
          clearReservation(e.id);
          emit('command', 'stopped', e.id, worldAddress(e.x, e.y)); continue;
        }
        if (e.health === 0 || e.health === null || !d.movementPerTick || d.navigationClass === null) { emit('command', 'immovable', e.id); continue; }
        if (state.combat) stopCombat(this.#model, state.combat, e.id);
        e.waitTicks = 0;
        if (c.kind === 'stop') { e.goal = null; e.route = []; e.progress = 0; clearReservation(e.id); emit('command', 'stopped', e.id, worldAddress(e.x, e.y)); }
        else {
          e.goal = worldAddress(p.x, p.y); e.route = e.progress ? e.route.slice(0, 2) : [];
          emit('command', 'move-accepted', e.id, e.goal);
        }
      }
      save.queuedCommands = save.queuedCommands.filter(c => c.tick !== save.nextTick);
      const counts = occupancy(this.#model, state);
      let planningPassage: InfantryOccupancy | null = null;
      const passageBlocked = (index: InfantryOccupancy, id: number, address: number) => {
        const result = index.choose(id, address); chargePassage(1 + result.work); return result.status === 'blocked';
      };
      const add = (address: number) => counts.set(address, (counts.get(address) ?? 0) + 1);
      const remove = (address: number) => { const count = counts.get(address)!; if (count === 1) counts.delete(address); else counts.set(address, count - 1); };
      for (const e of state.entities) if (e.waitTicks) e.waitTicks--;
      // Phase 2: a saved rotating cursor fairly assigns bounded searches; units still move in stable ID order.
      let expanded = 0, queries = 0, pathCells = state.entities.reduce((n, e) => n + e.route.length, 0);
      const first = state.planningCursor;
      for (let visited = 0; visited < state.entities.length && queries < C.routeQueriesPerTick && expanded < C.routeExpansionsPerTick; visited++) {
        const index = (first + visited) % state.entities.length, e = state.entities[index]!;
        if (e.goal === null || e.route.length || e.waitTicks) continue;
        const at = worldAddress(e.x, e.y);
        if (at === e.goal) { e.goal = null; emit('navigation', 'arrived', e.id, at); continue; }
        const d = definitions.get(e.id)!, binding = bindings.get(d.navigationClass!)!;
        if (slots.has(e.id)) planningPassage ??= passageIndex();
        // An initially shared cell can be exited. New destinations still require a free cell.
        const occupied = [...counts.keys()].filter(n => n !== at &&
          (!planningPassage || !slots.has(e.id) || passageBlocked(planningPassage, e.id, n))).map(worldPosition);
        const route = findNavigationPath(binding.grid, { start: { x: e.x, y: e.y }, goal: worldPosition(e.goal), occupied },
          { expanded: C.routeExpansionsPerTick - expanded, pathCells: Math.max(0, C.paths - pathCells) });
        expanded += route.expanded; queries++; state.planningCursor = (index + 1) % state.entities.length;
        work.navigationExpansions += route.expanded;
        if (route.status === 'found') {
          e.route = route.path.map(p => worldAddress(p.x, p.y)); pathCells += e.route.length; emit('navigation', 'path-found', e.id, e.goal, route.cost);
        } else {
          e.waitTicks = route.status === 'budget-exhausted' ? 1 : C.retryTicks;
          emit('navigation', route.status, e.id, e.goal, route.expanded);
        }
      }
      // Phase 3: each actor reserves its next cell for the whole partial edge. No reciprocal swaps.
      let transitions = 0;
      const unavailable = { has: (address: number) => counts.has(address) };
      for (const e of state.entities) {
        if (!e.route.length) continue;
        const d = definitions.get(e.id)!, binding = bindings.get(d.navigationClass!)!;
        let credit = d.movementPerTick * binding.costScale;
        while (credit && e.route.length) {
          const from = worldAddress(e.x, e.y), next = e.route[1]!;
          const slot = slots.get(e.id), index = slot && !e.progress ? passageIndex() : null;
          const blockers = index ? { has: (address: number) => passageBlocked(index, e.id, address) } : unavailable;
          const cost = worldEdgeCost(binding.grid, from, next, e.progress ? staticBlocked : blockers);
          if (cost === null) {
            if (e.progress) worldFail('world-active-edge');
            e.route = []; e.waitTicks = C.retryTicks; emit('movement', 'blocked', e.id, next); break;
          }
          if (index && slot) {
            const choice = index.choose(e.id, next); chargePassage(1 + choice.work);
            if (choice.status !== 'available' || choice.subcell === null) worldFail('world-infantry-reservation');
            slot.reservedSubcell = choice.subcell;
          }
          if (!e.progress && d.blocksCell) add(next);
          const used = Math.min(credit, cost - e.progress); e.progress += used; credit -= used;
          if (e.progress < cost) { emit('movement', 'progress', e.id, next, e.progress); break; }
          if (++transitions > C.transitionsPerTick) worldFail('world-transition-limit');
          work.transitions++;
          if (d.blocksCell) remove(from);
          Object.assign(e, worldPosition(next)); e.route = e.route.slice(1); e.progress = 0; emit('movement', 'moved', e.id, next);
          if (slot) { if (slot.reservedSubcell === null) worldFail('world-infantry-reservation'); slot.subcell = slot.reservedSubcell; slot.reservedSubcell = null; }
          if (next === e.goal) { e.route = []; e.goal = null; emit('movement', 'arrived', e.id, next); }
          else if (e.route.length === 1) { e.route = []; break; }
        }
      }
      // Phase 4: due death completions, impacts, then stable-ID firing. Completed deaths release cells next tick.
      if (state.combat) work.transitions += stepCombat(this.#model, state, save.nextTick,
        (kind, id, cell, value) => emit('combat', kind, id, cell, value), value => {
          if (damage.length >= C.trace) worldFail('world-damage-observation-limit');
          damage.push(Object.freeze({ ...value }));
        });
      if (slots.size && state.combat) {
        const dying = combatDyingActorIds(state.combat), blockedHeads = new Map<number, Set<number>>();
        for (const id of dying) { const e = byId.get(id)!, at = worldAddress(e.x, e.y), owners = blockedHeads.get(at) ?? new Set<number>(); owners.add(id); blockedHeads.set(at, owners); }
        for (const slot of slots.values()) {
          const e = byId.get(slot.entityId)!;
          if (e.progress && blockedHeads.get(e.route[1]!)?.size) {
            // D03: a new pending death cancels an incoming edge at its retained anchor,
            // like Stop, then retries the goal. It cannot acquire a dying occupied cell.
            const destination = e.route[1]!; e.route = []; e.progress = 0; e.waitTicks = C.retryTicks;
            slot.reservedSubcell = null; emit('movement', 'infantry-dying-blocked', e.id, destination);
          }
        }
      }
      for (const slot of slots.values()) if (byId.get(slot.entityId)!.progress === 0) slot.reservedSubcell = null;
      // Logical work accounting; not CPU timings or exhaustive validation/allocation operations.
      work.entityVisits += 3 * state.entities.length;
      if (work.entityVisits + work.navigationExpansions + work.transitions > workLimit) worldFail('world-work-limit');
      save.nextTick++;
    }
    this.#value = validateSave(this.#model, save);
    const result = { nextTick: this.nextTick, events, work };
    const value = Object.freeze({ modelSha256: this.#model.sha256, fromNextTick, toNextTick: this.nextTick,
      damage: Object.freeze(damage) });
    stepCombatObservations.set(result, { model: this.#model, value });
    return result;
  }
}

/** Convenience for rendering/controls; definitions remain outside mutable state and retain source row IDs. */
export function worldEntityDefinition(model: WorldModel, id: number): WorldEntityDefinition | null {
  assertWorldModel(model); worldInteger(id, 1, 2147483647); return model.entities.find(e => e.id === id) ?? null;
}
