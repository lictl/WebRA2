// SPDX-License-Identifier: MIT
import { orderCommands } from '../../contracts/src/index.ts';
import { canonicalText } from './canonical.ts';
import { sampleRandom, seededRandom } from './rng.ts';
import { array, command, detached, fail, findEntity, identity, integer, position, record, sortedWork, validateSave, work } from './validation.ts';
import { ENGINE_VERSION, RULES_VERSION, LIMITS, type CommandEnvelope, type ContentIdentity, type RngState, type Scenario, type ScheduledWork, type SimSave, type StepResult, type TraceEvent } from './types.ts';

type LiveSave = { -readonly [K in keyof Omit<SimSave, 'queuedCommands' | 'scheduledWork' | 'rngStates'>]: SimSave[K] } & { queuedCommands: CommandEnvelope[]; scheduledWork: ScheduledWork[]; rngStates: { simulation: RngState } };
const live = (save: SimSave) => save as LiveSave;
function increment(value: number, code: string): number { if (value >= Number.MAX_SAFE_INTEGER) return fail(code); return value + 1; }

/** Pure fixed logical ticks. All policy in this first kernel is explicitly synthetic. */
export class Simulation {
  #value: LiveSave;
  private constructor(save: SimSave) { this.#value = live(save); }
  static restore(input: unknown, expectedContent: ContentIdentity): Simulation { return new Simulation(validateSave(input, expectedContent)); }
  static create(config: Scenario, content: ContentIdentity): Simulation {
    const c = record(detached(config), ['width', 'height', 'blocked', 'entities', 'reinforcements', 'seed']);
    const width = integer(c.width, 1, LIMITS.grid), height = integer(c.height, 1, LIMITS.grid);
    const blocked = array(c.blocked, LIMITS.grid ** 2).map(p => position(p, width, height)).sort((a, b) => a.y - b.y || a.x - b.x);
    const entities = array(c.entities, LIMITS.entities).map((item, index) => {
      const e = record(item, ['owner', 'x', 'y', 'hp']); const p = position({ x: e.x, y: e.y }, width, height);
      return { id: index + 1, owner: integer(e.owner, 0, LIMITS.players - 1), ...p, hp: integer(e.hp, 1, LIMITS.hp), destination: null };
    });
    const scheduled = array(c.reinforcements, LIMITS.work).map((item, index) => {
      const r = record(item, ['dueTick', 'owner', 'x', 'y', 'hp']);
      return work({ dueTick: r.dueTick, order: index + 1, kind: 'reinforcement', payload: { owner: r.owner, x: r.x, y: r.y, hp: r.hp } }, width, height, 0);
    });
    return Simulation.restore({ schemaVersion: 1, engineVersion: ENGINE_VERSION, simulationRulesVersion: RULES_VERSION, contentIdentity: identity(detached(content)), nextTick: 0,
      state: { width, height, blocked, entities, nextEntityId: entities.length + 1, nextWorkOrder: scheduled.length + 1, admissionCursors: [], resolvedEvents: 0 },
      queuedCommands: [], scheduledWork: sortedWork(scheduled), rngStates: { simulation: seededRandom(integer(c.seed, 0, 0xffffffff)) } }, content);
  }
  get nextTick(): number { return this.#value.nextTick; }
  save(): SimSave { return detached(this.#value) as SimSave; }
  saveText(): string { return canonicalText(this.#value); }
  /** Entire batch validates before queue/cursor mutation; returns detached execution order. */
  admitCommands(values: readonly unknown[]): CommandEnvelope[] {
    const inputs = array(detached(values), LIMITS.commands);
    if (inputs.length > LIMITS.commands - this.#value.queuedCommands.length) fail('command-queue-limit');
    const { width, height } = this.#value.state;
    let batch: CommandEnvelope[]; try { batch = orderCommands(inputs.map(c => command(c, width, height))); } catch (error) { if (error instanceof TypeError) return fail('duplicate-command'); throw error; }
    const cursors = new Map(this.#value.state.admissionCursors.map(c => [c.playerId, c.sequence]));
    for (const c of [...batch].sort((a, b) => a.playerId - b.playerId || a.sequence - b.sequence)) {
      integer(c.tick, this.nextTick, Math.min(LIMITS.tick - 1, this.nextTick + LIMITS.futureTicks), 'command-horizon');
      if (c.sequence <= (cursors.get(c.playerId) ?? -1)) fail('command-sequence-reused'); cursors.set(c.playerId, c.sequence);
    }
    const next = live(this.save());
    next.state.admissionCursors = [...cursors].sort((a, b) => a[0] - b[0]).map(([playerId, sequence]) => ({ playerId, sequence }));
    next.queuedCommands = orderCommands([...next.queuedCommands, ...batch]);
    this.#value = live(validateSave(next, this.#value.contentIdentity));
    return detached(batch) as CommandEnvelope[];
  }
  /** One bounded transaction, even when advancing several ticks; fatal work/counter limits roll back every tick in this call. */
  step(ticks = 1): StepResult {
    integer(ticks, 1, LIMITS.stepTicks, 'step-tick-limit');
    if (ticks > LIMITS.tick - this.nextTick) fail('tick-overflow');
    const save = live(this.save()), events: TraceEvent[] = [];
    const cell = (p: { x: number; y: number }) => p.y * save.state.width + p.x;
    const occupiedCells = new Set([...save.state.blocked, ...save.state.entities].map(cell));
    const emit = (phase: TraceEvent['phase'], kind: string, entityId: number, otherId: number | null = null, value: number | null = null) => {
      if (events.length >= LIMITS.trace) fail('trace-limit'); events.push({ tick: save.nextTick, phase, kind, entityId, otherId, value });
    };
    for (let count = 0; count < ticks; count++) {
      const state = save.state, tick = save.nextTick;
      // Phase 1: commands in (tick, player, sequence) order. Gameplay rejection is an observable outcome.
      for (const c of save.queuedCommands.filter(c => c.tick === tick)) {
        const p = c.payload as Record<string, number>, entity = findEntity(state.entities, p.entityId!);
        if (!entity) { emit('command', 'missing-entity', p.entityId!); continue; }
        if (entity.owner !== c.playerId) { emit('command', 'not-owner', entity.id); continue; }
        if (c.kind === 'move') { entity.destination = { x: p.x!, y: p.y! }; emit('command', 'move-accepted', entity.id); }
        else {
          const target = findEntity(state.entities, p.targetId!);
          if (!target || target.owner === entity.owner) { emit('command', 'invalid-target', entity.id, p.targetId!); continue; }
          if (Math.abs(target.x - entity.x) + Math.abs(target.y - entity.y) > 4) { emit('command', 'attack-out-of-range', entity.id, target.id); continue; }
          if (save.scheduledWork.length >= LIMITS.work) fail('scheduled-work-limit');
          if (tick > LIMITS.tick - 3) fail('work-tick-overflow');
          const order = state.nextWorkOrder; state.nextWorkOrder = increment(order, 'work-order-overflow');
          save.scheduledWork.push({ dueTick: tick + 2, order, kind: 'impact', payload: { attackerId: entity.id, targetId: target.id } });
          emit('command', 'attack-scheduled', entity.id, target.id, order);
        }
      }
      save.queuedCommands = save.queuedCommands.filter(c => c.tick !== tick);
      // Phase 2: due work uses saved allocation order. No same-tick work creation is supported.
      sortedWork(save.scheduledWork);
      for (const event of save.scheduledWork.filter(w => w.dueTick === tick)) {
        state.resolvedEvents = increment(state.resolvedEvents, 'event-counter-overflow');
        if (event.kind === 'impact') {
          const target = findEntity(state.entities, event.payload.targetId);
          if (!target) { emit('work', 'impact-target-missing', event.payload.attackerId, event.payload.targetId); continue; }
          const damage = 2 + sampleRandom(save.rngStates.simulation, 4); target.hp -= damage;
          emit('work', 'damage', event.payload.attackerId, target.id, damage);
          if (target.hp <= 0) { occupiedCells.delete(cell(target)); state.entities = state.entities.filter(e => e.id !== target.id); emit('work', 'destroyed', target.id); }
        } else {
          if (occupiedCells.has(cell(event.payload)) || state.entities.length >= LIMITS.entities) { emit('work', 'reinforcement-blocked', 0, null, event.order); continue; }
          const id = state.nextEntityId; state.nextEntityId = increment(id, 'entity-id-overflow');
          state.entities.push({ id, ...event.payload, destination: null }); occupiedCells.add(cell(event.payload)); emit('work', 'reinforced', id);
        }
      }
      save.scheduledWork = save.scheduledWork.filter(w => w.dueTick !== tick);
      // Phase 3: sequential stable-ID movement. X before Y, one cell; blocked units keep their order.
      for (const entity of state.entities) {
        const destination = entity.destination; if (!destination) continue;
        if (destination.x === entity.x && destination.y === entity.y) { entity.destination = null; emit('movement', 'arrived', entity.id); continue; }
        const target = entity.x !== destination.x ? { x: entity.x + Math.sign(destination.x - entity.x), y: entity.y } : { x: entity.x, y: entity.y + Math.sign(destination.y - entity.y) };
        if (occupiedCells.has(cell(target))) { emit('movement', 'blocked', entity.id); continue; }
        occupiedCells.delete(cell(entity)); occupiedCells.add(cell(target));
        entity.x = target.x; entity.y = target.y; emit('movement', 'moved', entity.id, null, entity.y * state.width + entity.x);
        if (entity.x === destination.x && entity.y === destination.y) entity.destination = null;
      }
      save.nextTick++;
    }
    this.#value = live(validateSave(save, this.#value.contentIdentity));
    return { nextTick: this.nextTick, events };
  }
}
