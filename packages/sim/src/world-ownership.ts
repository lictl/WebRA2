// SPDX-License-Identifier: GPL-3.0-or-later
// Original D03 ownership/lifecycle reconstruction. Source actions remain caller inputs until VM dispatch binds them.
import { createMissionHouseState, applyMissionHouseChanges, planMissionHouseTransfer, applyMissionHouseTransfer } from './mission-house-state.ts';
import { worldAddress, worldClone, worldFail as fail, worldHash, worldInteger as integer, worldList, worldRecord, WORLD_LIMITS as C } from './world-values.ts';
import type { MissionHouseState, MissionHouseParticipation, MissionHouseCounts, MissionHouseSource, MissionHouseChange } from './mission-house-types.ts';
import type { WorldEntity, WorldState } from './world.ts';
import { assertWorldModel, type WorldModel } from './world-model.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import type { InfantryPassageCatalog } from './infantry-passage-catalog.ts';
import { navigationCell } from './navigation.ts';
import { missionTeamConstructorHistoryData } from './mission-team-constructor-history.ts';
import { missionTeamConstructorSourceData } from './mission-team-constructor-source.ts';
import { missionTeamSnapshot } from './mission-team-values.ts';

export const WORLD_OWNERSHIP_ENGINE = 'webra2-world-8' as const;
export const WORLD_OWNERSHIP_POLICY = 'webra2-current-house-1' as const;
export type WorldHouseInvocation = { readonly instructionId: string; readonly sourceHouse: number; readonly triggerHouse: number | null }
export type WorldHouseLifecycle = { entityId: number; lethalTick: number | null; removedTick: number | null }
export type WorldHouseTransfer = WorldHouseInvocation & { nextTick: number; entityIds: number[] };
/** A capture preserves an already settled group, never an incoming reservation.
 * Members describe a possible pre-transfer group; remaining IDs shrink on departure. */
export type WorldHouseSharing = { transferIndex: number; cell: number;
  members: { entityId: number; subcell: number }[]; remainingIds: number[] };
export type WorldOwnershipState = {
  policy: typeof WORLD_OWNERSHIP_POLICY; sourceSha256: string;
  lifecycle: WorldHouseLifecycle[]; transfers: WorldHouseTransfer[]; counts: readonly { [K in keyof MissionHouseCounts]: MissionHouseCounts[K] }[];
  sharing?: WorldHouseSharing[];
}
export interface WorldHouseTransferResult {
  readonly nextTick: number; readonly instructionId: string; readonly sourceHouse: number; readonly destinationHouse: number;
  readonly entityIds: readonly number[]; readonly changedEntityIds: readonly number[]; readonly work: number;
}
const techno = (kind: string) => ['infantry', 'unit', 'structure', 'aircraft'].includes(kind);
const context = new WeakMap<object, { model: WorldModel; source: MissionHouseSource; ledger: MissionHouseState; work: number;
  ownerHistory: Map<number, { tick: number; revision: number; owner: number | null }[]> }>();
const transferCap = C.replayAdmissions;
function allied(catalog: InfantryPassageCatalog, a: number | null, b: number | null): boolean {
  return a !== null && b !== null && (a === b || catalog.alliancesComplete && catalog.alliances.some(p => p.from === a && p.to === b));
}
function arrival(catalog: InfantryPassageCatalog, ids: readonly number[], owner: (id: number) => number | null): boolean {
  return ids.length <= 1 || ids.some(last => ids.every(other => other === last || allied(catalog, owner(last), owner(other))) &&
    arrival(catalog, ids.filter(id => id !== last), owner));
}

function budget(model: WorldModel, n: number | undefined) {
  const limit = n === undefined ? C.replayWork : integer(n, 0, C.replayWork); let work = 0;
  return { charge(n = 1) { if (n > limit - work) fail('world-ownership-work'); work += n; }, get work() { return work; }, get remaining() { return limit - work; } };
}
const passWork = (source: MissionHouseSource, actors = source.initialActors.length) => source.types.length + source.houses.length + source.tagChains.length + actors * 12 + source.instructions.length;
const modelPassWork = (model: WorldModel) => passWork(model.ownership!, model.construction ? model.entities.length : undefined);
function constructionData(model: WorldModel) {
  if (!model.construction) return undefined;
  const data = missionTeamConstructorHistoryData(model.construction);
  if (missionTeamConstructorSourceData(data.source).houses !== model.ownership) fail('world-ownership-construction-source');
  return data;
}
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
  if (constructionData(model)?.births.length) fail('world-ownership-construction-create');
  const lifecycle = model.entities.map(e => ({ entityId: e.id, lethalTick: e.initialHealth === 0 ? 0 : null, removedTick: e.initialHealth === 0 ? 0 : null }));
  const ledger = createMissionHouseState(source, participation(model, lifecycle, 0));
  return { policy: WORLD_OWNERSHIP_POLICY, sourceSha256: source.sha256, lifecycle, transfers: [], counts: worldClone(ledger.counts),
    ...(model.infantryPassage ? { sharing: [] } : {}) };
}
/** Strict source-bound historical reconstruction; entity.owner is the sole saved ownership value.
 * All history rows must select the complete source action set at their lifecycle boundary. */
export function restoreWorldOwnership(model: WorldModel, value: unknown, entities: readonly WorldEntity[], tick: number,
  workLimit?: number): WorldOwnershipState {
  const source = model.ownership ?? fail('world-ownership-model'), meter = budget(model, workLimit);
  const construction = constructionData(model), births = construction?.births ?? [];
  // Histories are already genuine immutable source data. Reserve their traversal
  // before creating indexes; only the model's source-authenticated prefix is initial.
  if (construction) meter.charge(births.length + construction.entities.length * 3 + model.entities.length);
  const born = new Map(births.flatMap(b => b.actors.map(a => [a.entityId, b] as const)));
  if (births.some(b => b.bornAtTick > tick)) fail('world-ownership-birth-time');
  const r = worldRecord(value, ['policy', 'sourceSha256', 'lifecycle', 'transfers', 'counts', ...(model.infantryPassage ? ['sharing'] : [])]);
  if (r.policy !== WORLD_OWNERSHIP_POLICY || r.sourceSha256 !== source.sha256) fail('world-ownership-identity');
  const rows = worldList(r.lifecycle, C.entities); meter.charge(rows.length * 6);
  if (rows.length !== model.entities.length || entities.length !== rows.length) fail('world-ownership-coverage');
  const lifecycle = rows.map((value, i) => {
    const r = worldRecord(value, ['entityId', 'lethalTick', 'removedTick']), d = model.entities[i]!, e = entities[i]!;
    const lethalTick = r.lethalTick === null ? null : integer(r.lethalTick, d.initialHealth === 0 ? 0 : (born.get(d.id)?.bornAtTick ?? 0) + 1, tick);
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
  const sharing: WorldHouseSharing[] = [], claimed = new Set<number>(), sharingByTransfer = new Map<number, WorldHouseSharing[]>();
  if (model.infantryPassage) {
    meter.charge(model.entities.length * 4 + model.infantryPassage.alliances.length + model.blocked.length + model.footprints.reduce((n,p) => n+p.cells.length,0));
    const catalog = model.infantryPassage, actors = new Map(catalog.actors.map(a => [a.entityId, a]));
    const defs = new Map(model.entities.map((d, i) => [d.id, { d, e: entities[i]!, l: lifecycle[i]! }]));
    const grids = new Map(model.navigation.map(b => [b.grid.movementClass, b.grid]));
    const staticAt = new Map<number, number[]>();
    const addStatic=(at:number,id:number)=>{const list=staticAt.get(at)??[];list.push(id);staticAt.set(at,list);};
    for (const d of model.entities) if (!d.movementPerTick && d.blocksCell) addStatic(worldAddress(d.x,d.y),d.id);
    for (const p of model.footprints) for (const at of p.cells) addStatic(at,p.entityId);
    const blocked = new Set(model.blocked); let previousCell = -1;
    for (const item of worldList(r.sharing, C.entities)) {
      meter.charge(64 + catalog.alliances.length * 18);
      const v = worldRecord(item, ['transferIndex','cell','members','remainingIds']), transferIndex = integer(v.transferIndex,0,transfers.length-1);
      const cell = integer(v.cell,previousCell+1,262143), t = transfers[transferIndex]!; previousCell = cell;
      if (blocked.has(cell) || staticAt.get(cell)?.some(id => { const l=defs.get(id)!.l; return l.removedTick === null || l.removedTick > t.nextTick; })) fail('world-ownership-sharing-blocker');
      let previousId = 0;
      const members = worldList(v.members,3).map(value => {
        const m=worldRecord(value,['entityId','subcell']), entityId=integer(m.entityId,previousId+1,2147483647), subcell=integer(m.subcell,2,4); previousId=entityId;
        const a=actors.get(entityId), row=defs.get(entityId);
        if (!a || a.status!=='ordinary-slots' || !row || row.l.removedTick!==null && row.l.removedTick<=t.nextTick ||
          !navigationCell(grids.get(row.d.navigationClass!)!, {x:cell%512,y:Math.floor(cell/512)})) fail('world-ownership-sharing-member');
        return {entityId,subcell};
      });
      if (members.length<2 || new Set(members.map(m=>m.subcell)).size!==members.length) fail('world-ownership-sharing-members');
      previousId=0;
      const remainingIds=worldList(v.remainingIds,3).map(value=> {
        const id=integer(value,previousId+1,2147483647);previousId=id;const row=defs.get(id);
        if (!members.some(m=>m.entityId===id)||claimed.has(id)||!row||worldAddress(row.e.x,row.e.y)!==cell||row.l.removedTick!==null) fail('world-ownership-sharing-remaining');
        claimed.add(id);return id;
      });
      if (remainingIds.length<2) fail('world-ownership-sharing-remaining');
      const group={transferIndex,cell,members,remainingIds};sharing.push(group);
      const list=sharingByTransfer.get(transferIndex)??[];list.push(group);sharingByTransfer.set(transferIndex,list);
    }
  }
  // Each underlying ledger operation is bounded independently. Reserve those
  // fixed source/actor scans before executing them, including empty selections.
  const passageActors=new Map(model.infantryPassage?.actors.map(a=>[a.entityId,a]));
  const pass = modelPassWork(model);
  // Each birth adds at most one lifecycle pass and one insertion/publish pass.
  // Reserve the maximum current actor population, not only initial placed rows.
  meter.charge(pass * (transfers.length * 3 + 2 + births.length * 2));
  let ledger = createMissionHouseState(source, participation(model, lifecycle, 0).filter(p => !born.has(p.entityId)));
  const lifeIndex = new Map(lifecycle.map((l, i) => [l.entityId, i]));
  const ownerHistory = new Map(ledger.actors.map(a => [a.entityId, [{ tick: 0, revision: 0, owner: a.owner }]]));
  const advance = (tick: number) => {
    const next = participation(model, lifecycle, tick), changes = ledger.actors.flatMap<MissionHouseChange>(a => {
      const p = next[lifeIndex.get(a.entityId)!]!;
      if (!a.exists) return [];
      if (!p.exists) return [{ kind: 'remove' as const, entityId: p.entityId }];
      if (a.tagEligible !== p.tagEligible || a.present !== p.present || a.registered !== p.registered)
        return [{ kind: 'participation' as const, participation: p }];
      return [];
    });
    if (changes.length) ledger = applyMissionHouseChanges(ledger, changes);
  };
  let birthIndex = 0;
  const insertBirths = (revision: number, throughTick: number) => {
    while (birthIndex < births.length && births[birthIndex]!.ownershipRevision === revision) {
      const b = births[birthIndex++]!;
      if (b.bornAtTick > throughTick || revision > 0 && b.bornAtTick < transfers[revision - 1]!.nextTick) fail('world-ownership-birth-order');
      advance(b.bornAtTick);
      ledger = applyMissionHouseChanges(ledger, b.actors.map(a => ({ kind: 'insert', actor: {
        entityId: a.entityId, typeId: a.typeId, owner: a.playerId, tagId: null,
        exists: true, registered: true, present: true, tagEligible: true,
      } })));
      for (const a of b.actors) ownerHistory.set(a.entityId, [{ tick: b.bornAtTick, revision, owner: a.playerId }]);
    }
  };
  for (const [index,t] of transfers.entries()) {
    insertBirths(index, t.nextTick);
    advance(t.nextTick);
    const plan = planMissionHouseTransfer(ledger, t.instructionId, { sourceHouse: t.sourceHouse, triggerHouse: t.triggerHouse });
    if (worldHash(plan.entityIds) !== worldHash(t.entityIds)) fail('world-ownership-transfer-selection');
    const owners=new Map(ledger.actors.map(a=>[a.entityId,a.owner])),changed=new Set(plan.changedEntityIds);
    for (const group of sharingByTransfer.get(index)??[]) {
      if (!group.members.some(m=>changed.has(m.entityId)) ||
        !(group.members.every(m=>{const a=passageActors.get(m.entityId)!;return a.initialCell===group.cell&&a.sourceSubcell===m.subcell;}) ||
          arrival(model.infantryPassage!,group.members.map(m=>m.entityId),id=>owners.get(id)!))) fail('world-ownership-sharing-history');
    }
    for (const id of plan.changedEntityIds) ownerHistory.get(id)!.push({ tick: t.nextTick, revision: index + 1, owner: plan.destinationHouse });
    ledger = applyMissionHouseTransfer(ledger, plan);
  }
  insertBirths(transfers.length, tick);
  if (birthIndex !== births.length) fail('world-ownership-birth-revision');
  advance(tick);
  for (let i = 0; i < entities.length; i++) if (entities[i]!.owner !== ledger.actors[i]!.owner) fail('world-ownership-owner-history');
  // Canonical cloning bounds nested count records and rejects non-data properties.
  if (worldHash(r.counts) !== worldHash(ledger.counts)) fail('world-ownership-counts');
  const finalOwners=new Map(ledger.actors.map(a=>[a.entityId,a.owner]));
  for (const group of sharing) if (arrival(model.infantryPassage!,group.remainingIds,id=>finalOwners.get(id)!)) fail('world-ownership-sharing-unneeded');
  const state: WorldOwnershipState = { policy: WORLD_OWNERSHIP_POLICY, sourceSha256: source.sha256, lifecycle, transfers, counts: worldClone(ledger.counts),
    ...(model.infantryPassage ? {sharing} : {}) };
  context.set(state, { model, source, ledger, work: meter.work, ownerHistory }); return freeze(state);
}
/** Appends population only after the core has selected a genuine extended model.
 * The result is component data, not a constructor invocation or a world commit.
 * Whole-save command/occupancy validation remains the WorldSimulation boundary. */
export function appendWorldOwnership(previousModel: WorldModel, nextModel: WorldModel, previousState: WorldState,
  newEntities: readonly WorldEntity[], nextTick: number, workLimit?: number): Readonly<{ ownership: WorldOwnershipState; work: number }> {
  assertWorldModel(previousModel); assertWorldModel(nextModel); integer(nextTick, 0, C.tick);
  const meter = budget(nextModel, workLimit), next = constructionData(nextModel) ?? fail('world-ownership-construction-model');
  const previous = constructionData(previousModel), oldBirths = previous?.births ?? [];
  meter.charge(previousModel.entities.length * 16 + nextModel.entities.length * 16 + next.births.length * 8 + next.entities.length * 16);
  if (previousModel.ownership !== nextModel.ownership || previousModel.combat !== nextModel.combat ||
    previousModel.infantryPassage !== nextModel.infantryPassage || previous && previous.source !== next.source ||
    oldBirths.length > next.births.length || worldHash(oldBirths) !== worldHash(next.births.slice(0, oldBirths.length)) ||
    worldHash(previousModel.entities) !== worldHash(nextModel.entities.slice(0, previousModel.entities.length))) fail('world-ownership-construction-prefix');
  // Own caller descriptors before trusting array length, history or entity fields.
  const fields = worldRecord(previousState, ['modelSha256', 'entities', 'planningCursor', 'admissionCursors',
    ...(previousModel.combat ? ['combat'] : []), ...(previousModel.infantryPassage ? ['infantrySlots'] : []), 'ownership']);
  const prior = missionTeamSnapshot({ ownership: fields.ownership, entities: fields.entities }, n => meter.charge(n)) as
    { ownership: WorldOwnershipState; entities: WorldEntity[] };
  const entities = missionTeamSnapshot(newEntities, n => meter.charge(n)) as WorldEntity[];
  if (fields.modelSha256 !== previousModel.sha256 || !Array.isArray(entities) || entities.length !== nextModel.entities.length ||
    worldHash(prior.entities) !== worldHash(entities.slice(0, previousModel.entities.length))) fail('world-ownership-construction-state');
  const restored = restoreWorldOwnership(previousModel, prior.ownership, prior.entities, nextTick, meter.remaining);
  meter.charge(worldOwnershipWork(restored));
  const births = next.births.slice(oldBirths.length), revision = restored.transfers.length;
  if (births.some(b => b.bornAtTick !== nextTick || b.ownershipRevision !== revision)) fail('world-ownership-construction-boundary');
  const inserted = births.flatMap(b => b.actors);
  if (entities.length !== prior.entities.length + inserted.length) fail('world-ownership-construction-coverage');
  const expected = nextModel.entities.slice(previousModel.entities.length).map(d => ({ id: d.id, x: d.x, y: d.y,
    health: d.initialHealth, owner: d.owner, goal: null, route: [], progress: 0, waitTicks: 0 }));
  if (worldHash(expected) !== worldHash(entities.slice(previousModel.entities.length))) fail('world-ownership-construction-initial');
  meter.charge(modelPassWork(nextModel) * births.length * 2);
  let ledger = worldOwnershipLedger(previousModel, restored);
  for (const b of births) ledger = applyMissionHouseChanges(ledger, b.actors.map(a => ({ kind: 'insert', actor: {
    entityId: a.entityId, typeId: a.typeId, owner: a.playerId, tagId: null,
    exists: true, registered: true, present: true, tagEligible: true,
  } })));
  const candidate: WorldOwnershipState = { ...restored,
    lifecycle: [...restored.lifecycle, ...inserted.map(a => ({ entityId: a.entityId, lethalTick: null, removedTick: null }))],
    counts: worldClone(ledger.counts) };
  const ownership = restoreWorldOwnership(nextModel, candidate, entities, nextTick, meter.remaining);
  meter.charge(worldOwnershipWork(ownership));
  return Object.freeze({ ownership, work: meter.work });
}
export function worldOwnershipLedger(model: WorldModel, state: WorldOwnershipState): MissionHouseState {
  const c = context.get(state); if (!c || c.model !== model) fail('world-ownership-context'); return c.ledger;
}
export function worldOwnershipWork(state: WorldOwnershipState): number { return context.get(state)?.work ?? fail('world-ownership-context'); }
/** This accepts only restored ownership from the exact bound catalog's model.
 * It cannot turn arbitrary owner fields or saved permission flags into an occupancy authority. */
export function worldOwnershipInfantryData(state: WorldOwnershipState, catalog: InfantryPassageCatalog) {
  const c=context.get(state);if(!c || c.model.infantryPassage!==catalog) fail('world-ownership-infantry-context');
  return {model:c.model,owners:c.ledger.actors.map(a=>({entityId:a.entityId,owner:a.owner})),sharing:state.sharing!,
    transferredIds:[...c.ownerHistory].filter(([,history])=>history.length>1).map(([id])=>id)};
}
/** Drop departed/retired members immediately. Claims never authorize return to a hostile cell. */
export function pruneWorldHouseSharing(model: WorldModel, state: WorldState): number {
  if (!model.infantryPassage || !state.ownership?.sharing?.length) return 0;
  const prior=state.ownership, byId=new Map(state.entities.map(e=>[e.id,e])), slots=new Map(state.infantrySlots!.map(s=>[s.entityId,s]));
  const lives=new Map(prior.lifecycle.map(l=>[l.entityId,l]));
  const sharing=prior.sharing!.flatMap(group=> {
    const remainingIds=group.remainingIds.filter(id=>{const e=byId.get(id)!;return worldAddress(e.x,e.y)===group.cell && lives.get(id)!.removedTick===null &&
      slots.get(id)!.subcell===group.members.find(m=>m.entityId===id)!.subcell;});
    return remainingIds.length<2 || arrival(model.infantryPassage!,remainingIds,id=>byId.get(id)!.owner!) ? [] : [{...group,remainingIds}];
  });
  const c=context.get(prior);state.ownership=freeze({...prior,sharing});if(c)context.set(state.ownership,c);
  return state.entities.length*3+prior.sharing!.length*(64+model.infantryPassage.alliances.length*18);
}
/** Damage-time attribution is historical even after another transfer. This method
 * accepts only the source/selection-validated state returned by restoration. */
export function worldOwnershipOwnerAt(model: WorldModel, state: WorldOwnershipState, entityId: number, tick: number): number | null {
  const c = context.get(state); if (!c || c.model !== model) fail('world-ownership-context');
  const history = c.ownerHistory.get(entityId) ?? fail('world-ownership-actor');
  if (tick < history[0]!.tick) fail('world-ownership-before-birth');
  let lo = 0, hi = history.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (history[mid]!.tick <= tick) lo = mid + 1; else hi = mid; }
  return history[Math.max(0, lo - 1)]!.owner;
}
/** Exact source-validated transfer boundary, including several transfers at the
 * same tick. The last-change revision also prevents a change-back from silently
 * restoring an earlier team claim. This adds no saved state or world identity. */
export function worldOwnershipAtRevision(model: WorldModel, state: WorldOwnershipState, entityId: number, revision: number):
Readonly<{ owner: number | null; lastChangeRevision: number }> {
  const c = context.get(state); if (!c || c.model !== model) fail('world-ownership-context');
  integer(revision, 0, state.transfers.length);
  const history = c.ownerHistory.get(entityId) ?? fail('world-ownership-actor');
  if (revision < history[0]!.revision) fail('world-ownership-before-birth');
  let lo = 0, hi = history.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (history[mid]!.revision <= revision) lo = mid + 1; else hi = mid; }
  const row = history[Math.max(0, lo - 1)]!;
  return Object.freeze({ owner: row.owner, lastChangeRevision: row.revision });
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
  return worldOwnershipWork(restored) + modelPassWork(model);
}
/** Pure candidate construction. WorldSimulation must also cancel orders, update occupancy and validate the whole result. */
export function prepareWorldHouseTransfer(model: WorldModel, state: WorldState, nextTick: number, value: unknown,
  workLimit?: number): WorldHouseTransferResult {
  const invocation = worldHouseInvocation(value), ownership = restoreWorldOwnership(model, state.ownership, state.entities, nextTick, workLimit);
  if (ownership.transfers.length >= transferCap) fail('world-ownership-transfer-limit');
  // Reserve the pre/post history reconstruction and the plan/apply scans before
  // changing any candidate entity. This is logical work, not a CPU timing estimate.
  const sharingWork = model.infantryPassage ? model.entities.length*(128+model.infantryPassage.alliances.length*36) : 0;
  const work = 2 * worldOwnershipWork(ownership) + 5 * modelPassWork(model) + model.entities.length * 4 + sharingWork + 1;
  if (work > (workLimit ?? C.replayWork)) fail('world-ownership-work');
  const prior = worldOwnershipLedger(model, ownership), plan = planMissionHouseTransfer(prior, invocation.instructionId, { sourceHouse: invocation.sourceHouse, triggerHouse: invocation.triggerHouse });
  const ledger = applyMissionHouseTransfer(prior, plan), byId = new Map(ledger.actors.map(a => [a.entityId, a]));
  for (const e of state.entities) e.owner = byId.get(e.id)!.owner;
  state.ownership = { ...ownership, transfers: [...ownership.transfers, { ...invocation, nextTick, entityIds: [...plan.entityIds] }], counts: worldClone(ledger.counts) };
  if(model.infantryPassage) {
    pruneWorldHouseSharing(model,state);
    const catalog=model.infantryPassage, rows=new Map(catalog.actors.map(a=>[a.entityId,a])), slots=new Map(state.infantrySlots!.map(s=>[s.entityId,s]));
    const live=new Map(state.ownership.lifecycle.map(l=>[l.entityId,l.removedTick===null])), groups=new Map<number,WorldEntity[]>();
    for(const e of state.entities)if(live.get(e.id) && slots.has(e.id)) {const at=worldAddress(e.x,e.y),list=groups.get(at)??[];list.push(e);groups.set(at,list);}
    const changed=new Set(plan.changedEntityIds),priorOwners=new Map(prior.actors.map(a=>[a.entityId,a.owner])),sharing=[...state.ownership.sharing!],sharedCells=new Set(sharing.map(g=>g.cell));
    for(const [cell,group]of groups)if(group.length>1 && !arrival(catalog,group.map(e=>e.id),id=>byId.get(id)!.owner) &&
      group.some(e=>changed.has(e.id)) && !sharedCells.has(cell)) {
      const original=group.every(e=>rows.get(e.id)!.initialCell===cell&&rows.get(e.id)!.sourceSubcell===slots.get(e.id)!.subcell);
      if(group.length>3 || !original&&!arrival(catalog,group.map(e=>e.id),id=>priorOwners.get(id)!))fail('world-ownership-sharing-history');
      sharing.push({transferIndex:ownership.transfers.length,cell,
        members:group.map(e=>({entityId:e.id,subcell:slots.get(e.id)!.subcell})),remainingIds:group.map(e=>e.id)});sharedCells.add(cell);
    }
    state.ownership={...state.ownership,sharing:sharing.sort((a,b)=>a.cell-b.cell)};
  }
  return Object.freeze({ nextTick, instructionId: invocation.instructionId, sourceHouse: invocation.sourceHouse,
    destinationHouse: plan.destinationHouse, entityIds: plan.entityIds, changedEntityIds: plan.changedEntityIds, work });
}
/** Current ownership for already validated world records. Definitions always preserve initial source ownership. */
export function currentWorldOwner(model: WorldModel, entity: Pick<WorldEntity, 'id' | 'owner'>): number | null {
  return model.ownership ? entity.owner ?? null : model.entities.find(d => d.id === entity.id)?.owner ?? null;
}
