// SPDX-License-Identifier: GPL-3.0-or-later
// Original D03 ownership/lifecycle reconstruction. Source actions remain caller inputs until VM dispatch binds them.
import { createMissionHouseState, applyMissionHouseChanges, planMissionHouseTransfer, applyMissionHouseTransfer } from './mission-house-state.ts';
import { worldAddress, worldClone, worldFail as fail, worldHash, worldInteger as integer, worldList, worldRecord, WORLD_LIMITS as C } from './world-values.ts';
import type { MissionHouseState, MissionHouseParticipation, MissionHouseCounts, MissionHouseSource, MissionHouseChange } from './mission-house-types.ts';
import type { WorldEntity, WorldState } from './world.ts';
import type { WorldModel } from './world-model.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';

export const WORLD_OWNERSHIP_ENGINE = 'webra2-world-8' as const;
export const WORLD_OWNERSHIP_POLICY = 'webra2-current-house-1' as const;
export type WorldHouseInvocation = { readonly instructionId: string; readonly sourceHouse: number; readonly triggerHouse: number | null }
export type WorldHouseLifecycle = { entityId: number; lethalTick: number | null; removedTick: number | null }
export type WorldHouseTransfer = WorldHouseInvocation & { nextTick: number; entityIds: number[] };
export type WorldOwnershipState = {
  policy: typeof WORLD_OWNERSHIP_POLICY; sourceSha256: string;
  lifecycle: WorldHouseLifecycle[]; transfers: WorldHouseTransfer[]; counts: readonly { [K in keyof MissionHouseCounts]: MissionHouseCounts[K] }[];
}
export interface WorldHouseTransferResult {
  readonly nextTick: number; readonly instructionId: string; readonly sourceHouse: number; readonly destinationHouse: number;
  readonly entityIds: readonly number[]; readonly changedEntityIds: readonly number[]; readonly work: number;
}
const techno = (kind: string) => ['infantry', 'unit', 'structure', 'aircraft'].includes(kind);
const context = new WeakMap<object, { model: WorldModel; source: MissionHouseSource; ledger: MissionHouseState; work: number;
  ownerHistory: Map<number, { tick: number; owner: number | null }[]> }>();
const transferCap = C.replayAdmissions;

function budget(model: WorldModel, n: number | undefined) {
  const limit = n === undefined ? C.replayWork : integer(n, 0, C.replayWork); let work = 0;
  return { charge(n = 1) { if (n > limit - work) fail('world-ownership-work'); work += n; }, get work() { return work; } };
}
const passWork = (source: MissionHouseSource) => source.types.length + source.houses.length + source.tagChains.length + source.initialActors.length * 12 + source.instructions.length;
export function worldHouseInvocation(value: unknown): WorldHouseInvocation {
  const r = worldRecord(value, ['instructionId', 'sourceHouse', 'triggerHouse']);
  if (typeof r.instructionId !== 'string' || !r.instructionId.length || r.instructionId.length > 255) fail('world-house-instruction');
  return { instructionId: r.instructionId, sourceHouse: integer(r.sourceHouse, 0, C.players - 1), triggerHouse: r.triggerHouse === null ? null : integer(r.triggerHouse, 0, C.players - 1) };
}
function participation(model: WorldModel, life: readonly WorldHouseLifecycle[], tick: number): MissionHouseParticipation[] {
  return life.map((l, i) => {
    const exists = l.removedTick === null || l.removedTick > tick, registered = exists && techno(model.entities[i]!.kind);
    return { entityId: l.entityId, exists, registered, present: registered,
      tagEligible: registered && (l.lethalTick === null || l.lethalTick > tick) };
  });
}
/** Ordinary placed-world policy: a completed removal releases both counter families.
 * Pending human deaths keep registration/presence but cannot receive action14.
 * Native limbo, absorption and technician conversion are not inferred from health. */
export function createWorldOwnership(model: WorldModel): WorldOwnershipState {
  const source = model.ownership ?? fail('world-ownership-model');
  const lifecycle = model.entities.map(e => ({ entityId: e.id, lethalTick: e.initialHealth === 0 ? 0 : null, removedTick: e.initialHealth === 0 ? 0 : null }));
  const ledger = createMissionHouseState(source, participation(model, lifecycle, 0));
  return { policy: WORLD_OWNERSHIP_POLICY, sourceSha256: source.sha256, lifecycle, transfers: [], counts: worldClone(ledger.counts) };
}
/** Strict source-bound historical reconstruction; entity.owner is the sole saved ownership value.
 * All history rows must select the complete source action set at their lifecycle boundary. */
export function restoreWorldOwnership(model: WorldModel, value: unknown, entities: readonly WorldEntity[], tick: number,
  workLimit?: number): WorldOwnershipState {
  const source = model.ownership ?? fail('world-ownership-model'), meter = budget(model, workLimit);
  const r = worldRecord(value, ['policy', 'sourceSha256', 'lifecycle', 'transfers', 'counts']);
  if (r.policy !== WORLD_OWNERSHIP_POLICY || r.sourceSha256 !== source.sha256) fail('world-ownership-identity');
  const rows = worldList(r.lifecycle, C.entities); meter.charge(rows.length * 6);
  if (rows.length !== model.entities.length || entities.length !== rows.length) fail('world-ownership-coverage');
  const lifecycle = rows.map((value, i) => {
    const r = worldRecord(value, ['entityId', 'lethalTick', 'removedTick']), d = model.entities[i]!, e = entities[i]!;
    const lethalTick = r.lethalTick === null ? null : integer(r.lethalTick, d.initialHealth === 0 ? 0 : 1, tick);
    const removedTick = r.removedTick === null ? null : integer(r.removedTick, lethalTick ?? tick + 1, tick);
    if (r.entityId !== d.id || e.id !== d.id || (lethalTick !== null) !== (e.health === 0) ||
      (removedTick !== null && lethalTick === null) || (d.initialHealth === 0 && (lethalTick !== 0 || removedTick !== 0))) fail('world-ownership-lifecycle');
    return { entityId: d.id, lethalTick, removedTick };
  });
  const transfers: WorldHouseTransfer[] = []; let lastTick = 0;
  for (const value of worldList(r.transfers, transferCap)) {
    meter.charge(); const t = worldRecord(value, ['instructionId', 'sourceHouse', 'triggerHouse', 'nextTick', 'entityIds']);
    const invocation = worldHouseInvocation({ instructionId: t.instructionId, sourceHouse: t.sourceHouse, triggerHouse: t.triggerHouse });
    const nextTick = integer(t.nextTick, lastTick, tick), entityIds = worldList(t.entityIds, C.entities).map(id => integer(id, 1, 2147483647));
    meter.charge(entityIds.length); transfers.push({ ...invocation, nextTick, entityIds }); lastTick = nextTick;
  }
  // Each underlying ledger operation is bounded independently. Reserve those
  // fixed source/actor scans before executing them, including empty selections.
  const pass = passWork(source);
  meter.charge(pass * (transfers.length * 3 + 2));
  let ledger = createMissionHouseState(source, participation(model, lifecycle, 0));
  const ownerHistory = new Map(ledger.actors.map(a => [a.entityId, [{ tick: 0, owner: a.owner }]]));
  const advance = (tick: number) => {
    const next = participation(model, lifecycle, tick), changes = next.flatMap<MissionHouseChange>((p, i) => {
      const a = ledger.actors[i]!;
      if (!a.exists) return [];
      if (!p.exists) return [{ kind: 'remove' as const, entityId: p.entityId }];
      if (a.tagEligible !== p.tagEligible || a.present !== p.present || a.registered !== p.registered)
        return [{ kind: 'participation' as const, participation: p }];
      return [];
    });
    if (changes.length) ledger = applyMissionHouseChanges(ledger, changes);
  };
  for (const t of transfers) {
    advance(t.nextTick);
    const plan = planMissionHouseTransfer(ledger, t.instructionId, { sourceHouse: t.sourceHouse, triggerHouse: t.triggerHouse });
    if (worldHash(plan.entityIds) !== worldHash(t.entityIds)) fail('world-ownership-transfer-selection');
    for (const id of plan.changedEntityIds) ownerHistory.get(id)!.push({ tick: t.nextTick, owner: plan.destinationHouse });
    ledger = applyMissionHouseTransfer(ledger, plan);
  }
  advance(tick);
  for (let i = 0; i < entities.length; i++) if (entities[i]!.owner !== ledger.actors[i]!.owner) fail('world-ownership-owner-history');
  // Canonical cloning bounds nested count records and rejects non-data properties.
  if (worldHash(r.counts) !== worldHash(ledger.counts)) fail('world-ownership-counts');
  const state: WorldOwnershipState = { policy: WORLD_OWNERSHIP_POLICY, sourceSha256: source.sha256, lifecycle, transfers, counts: worldClone(ledger.counts) };
  context.set(state, { model, source, ledger, work: meter.work, ownerHistory }); return freeze(state);
}
export function worldOwnershipLedger(model: WorldModel, state: WorldOwnershipState): MissionHouseState {
  const c = context.get(state); if (!c || c.model !== model) fail('world-ownership-context'); return c.ledger;
}
export function worldOwnershipWork(state: WorldOwnershipState): number { return context.get(state)?.work ?? fail('world-ownership-context'); }
/** Damage-time attribution is historical even after another transfer. This method
 * accepts only the source/selection-validated state returned by restoration. */
export function worldOwnershipOwnerAt(model: WorldModel, state: WorldOwnershipState, entityId: number, tick: number): number | null {
  const c = context.get(state); if (!c || c.model !== model) fail('world-ownership-context');
  const history = c.ownerHistory.get(entityId) ?? fail('world-ownership-actor');
  let lo = 0, hi = history.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (history[mid]!.tick <= tick) lo = mid + 1; else hi = mid; }
  return history[Math.max(0, lo - 1)]!.owner;
}
export function validateWorldOwnershipLifecycle(model: WorldModel, state: WorldState, nextTick: number): void {
  if (!model.ownership) return;
  const life = new Map(state.ownership!.lifecycle.map(l => [l.entityId, l])), deaths = new Map(state.combat?.deaths?.map(d => [d.entityId, d]) ?? []);
  for (const e of state.entities) if (e.health === 0) {
    const l = life.get(e.id)!, d = deaths.get(e.id);
    if (d ? l.lethalTick !== d.startedTick + 1 || l.removedTick !== (d.corpseIndex === null ? null : d.completionTick + 1) : l.removedTick !== l.lethalTick)
      fail('world-ownership-death-lifecycle');
  }
}

/** Called after the core's combat phase. It records only newly observed irreversible lifecycle transitions. */
export function updateWorldOwnershipLifecycle(model: WorldModel, state: WorldState, nextTick: number): number {
  const owned = state.ownership ?? fail('world-ownership-state');
  const deaths = new Map(state.combat?.deaths?.map(d => [d.entityId, d]) ?? []);
  const changed = owned.lifecycle.map((l, i) => {
    const e = state.entities[i]!, d = deaths.get(e.id);
    return e.health !== 0 ? l : { entityId: l.entityId, lethalTick: l.lethalTick ?? nextTick,
      removedTick: l.removedTick ?? (d && d.corpseIndex === null ? null : nextTick) };
  });
  if (changed.every((l, i) => l.lethalTick === owned.lifecycle[i]!.lethalTick && l.removedTick === owned.lifecycle[i]!.removedTick)) return 0;
  // Reconstruct the new counters through the genuine ledger without trusting old totals.
  const restored = restoreWorldOwnership(model, owned, state.entities.map((e, i) => ({ ...e,
    health: owned.lifecycle[i]!.lethalTick === null && e.health === 0 ? 1 : e.health })), nextTick);
  const prior = worldOwnershipLedger(model, restored);
  const wanted = participation(model, changed, nextTick), changes = wanted.flatMap<MissionHouseChange>((p, i) => {
    const a = prior.actors[i]!;
    if (!a.exists) return [];
    return !p.exists ? [{ kind: 'remove' as const, entityId: p.entityId }] :
      a.tagEligible !== p.tagEligible ? [{ kind: 'participation' as const, participation: p }] : [];
  });
  const ledger = applyMissionHouseChanges(prior, changes);
  state.ownership = { ...owned, lifecycle: changed, counts: worldClone(ledger.counts) };
  return worldOwnershipWork(restored) + passWork(model.ownership!);
}
/** Pure candidate construction. WorldSimulation must also cancel orders, update occupancy and validate the whole result. */
export function prepareWorldHouseTransfer(model: WorldModel, state: WorldState, nextTick: number, value: unknown,
  workLimit?: number): WorldHouseTransferResult {
  const invocation = worldHouseInvocation(value), ownership = restoreWorldOwnership(model, state.ownership, state.entities, nextTick, workLimit);
  if (ownership.transfers.length >= transferCap) fail('world-ownership-transfer-limit');
  // Reserve the pre/post history reconstruction and the plan/apply scans before
  // changing any candidate entity. This is logical work, not a CPU timing estimate.
  const work = 2 * worldOwnershipWork(ownership) + 5 * passWork(model.ownership!) + model.entities.length * 4 + 1;
  if (work > (workLimit ?? C.replayWork)) fail('world-ownership-work');
  const prior = worldOwnershipLedger(model, ownership), plan = planMissionHouseTransfer(prior, invocation.instructionId, { sourceHouse: invocation.sourceHouse, triggerHouse: invocation.triggerHouse });
  const ledger = applyMissionHouseTransfer(prior, plan), byId = new Map(ledger.actors.map(a => [a.entityId, a]));
  for (const e of state.entities) e.owner = byId.get(e.id)!.owner;
  state.ownership = { ...ownership, transfers: [...ownership.transfers, { ...invocation, nextTick, entityIds: [...plan.entityIds] }], counts: worldClone(ledger.counts) };
  return Object.freeze({ nextTick, instructionId: invocation.instructionId, sourceHouse: invocation.sourceHouse,
    destinationHouse: plan.destinationHouse, entityIds: plan.entityIds, changedEntityIds: plan.changedEntityIds, work });
}
/** Current ownership for already validated world records. Definitions always preserve initial source ownership. */
export function currentWorldOwner(model: WorldModel, entity: Pick<WorldEntity, 'id' | 'owner'>): number | null {
  return model.ownership ? entity.owner ?? null : model.entities.find(d => d.id === entity.id)?.owner ?? null;
}
