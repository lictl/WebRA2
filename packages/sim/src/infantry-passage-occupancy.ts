// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded D03 dual-anchor/reservation policy; this is not a WorldSave loader.
import { infantryPassageBase, infantryPassageFail as fail, infantryPassageFreeze as freeze,
  type InfantryPassageCatalog, type InfantryPassageActor, type InfantrySubcell } from './infantry-passage-catalog.ts';
import { worldAddress, worldInteger, worldList, worldRecord, WORLD_LIMITS } from './world-values.ts';
import type { WorldEntity } from './world.ts';
import {worldOwnershipInfantryData,type WorldOwnershipState} from './world-ownership.ts';

export interface InfantrySlotState { readonly entityId: number; readonly subcell: InfantrySubcell; readonly reservedSubcell: InfantrySubcell | null }
/** Core-owned projection: retired IDs must come from its validated lifecycle, never an imported permission flag. */
export interface InfantryOccupancyInput {
  readonly entities: readonly WorldEntity[]; readonly infantrySlots: readonly InfantrySlotState[]; readonly retiredEntityIds: readonly number[];
}
export interface InfantryCellChoice {
  readonly status: 'available' | 'blocked'; readonly subcell: InfantrySubcell | null;
  readonly reason: 'available' | 'unsupported-actor' | 'retired-actor' | 'dying-actor' | 'whole-cell-blocker' | 'non-allied-occupant' | 'unknown-alliance' | 'full-subcells' | 'captured-settled-group';
  readonly work: number;
}
export interface InfantryOccupancy {
  readonly catalogSha256: string; readonly occupiedCells: number; readonly indexedClaims: number;
  /** Pure bounded query. Queued future goals are not reservations; admitted active edges are. */
  choose(entityId: number, destination: number): InfantryCellChoice;
}
type Claim = { entityId: number | null; slot: InfantrySubcell | null; initial: boolean; anchor: boolean };
type Live = { id: number; at: number; health: number | null; progress: number; head: number | null; owner: number|null; row: InfantryPassageActor };
const slot = (v: unknown): InfantrySubcell => { const n = worldInteger(v, 2, 4); return n as InfantrySubcell; };

export function initialInfantrySlots(catalog: InfantryPassageCatalog): readonly InfantrySlotState[] {
  infantryPassageBase(catalog);
  return freeze(catalog.actors.filter(a => a.status === 'ordinary-slots').map(a => ({ entityId: a.entityId, subcell: a.sourceSubcell as InfantrySubcell, reservedSubcell: null })));
}

/** Validates slot structure/collisions against a genuine catalog and already core-validated motion/lifecycle.
 * Core save validation still owns routes, commands, health transitions, combat, clocks and retirement authenticity.
 * The returned detached index cannot update the world or authorize a different model. */
export function createInfantryOccupancy(catalog: InfantryPassageCatalog, input: InfantryOccupancyInput, ownership?: WorldOwnershipState): InfantryOccupancy {
  const model = infantryPassageBase(catalog), r = worldRecord(input, ['entities', 'infantrySlots', 'retiredEntityIds']);
  const current=ownership?worldOwnershipInfantryData(ownership,catalog):null, owners=new Map(current?.owners.map(a=>[a.entityId,a.owner]));
  const rows = worldList(r.entities, catalog.limits.actors), slotRows = worldList(r.infantrySlots, catalog.limits.actors);
  if (rows.length !== model.entities.length) fail('state-entity-count');
  const byId = new Map<number, Live>(), source = new Map(catalog.actors.map(a => [a.entityId, a]));
  let totalRoute = 0;
  for (let i = 0; i < rows.length; i++) {
    const e = worldRecord(rows[i], ['id', 'x', 'y', 'health', 'goal', 'route', 'progress', 'waitTicks',...(current?['owner']:[])]), d = model.entities[i]!;
    if (e.id !== d.id) fail('state-entity-order');
    const at = worldAddress(e.x, e.y), health = e.health === null ? null : worldInteger(e.health, 0, d.maximumHealth ?? 0);
    if ((health === null) !== (d.maximumHealth === null)) fail('state-health');
    const route = worldList(e.route, Math.min(WORLD_LIMITS.paths - totalRoute, WORLD_LIMITS.paths)).map(v => worldInteger(v, 0, 262143));
    totalRoute += route.length;
    const progress = worldInteger(e.progress, 0, 362 * 65535 - 1);
    if (progress && (route.length < 2 || route[0] !== at || route[1] === at || health === 0 || health === null || !d.movementPerTick)) fail('state-edge');
    if (!d.movementPerTick && at !== worldAddress(d.x, d.y)) fail('static-position');
    const owner=current?owners.get(d.id)!:source.get(d.id)!.playerId;
    if(current&&e.owner!==owner)fail('current-owner-join');
    byId.set(d.id, { id: d.id, at, health, progress, head: progress ? route[1]! : null, owner, row: source.get(d.id)! });
  }
  const retired = new Set<number>(); let previous = 0;
  for (const value of worldList(r.retiredEntityIds, catalog.limits.actors)) {
    const id = worldInteger(value, 1, 2147483647), e = byId.get(id);
    if (id <= previous || !e || e.health !== 0 || e.progress) fail('retired-projection'); previous = id; retired.add(id);
  }
  const slots = new Map<number, InfantrySlotState>(); previous = 0;
  for (const value of slotRows) {
    const s = worldRecord(value, ['entityId', 'subcell', 'reservedSubcell']), id = worldInteger(s.entityId, 1, 2147483647), e = byId.get(id);
    if (id <= previous || !e || e.row.status !== 'ordinary-slots') fail('slot-entity-order'); previous = id;
    const current = slot(s.subcell), reserved = s.reservedSubcell === null ? null : slot(s.reservedSubcell);
    if (!!e.progress !== (reserved !== null) || retired.has(id) && reserved !== null) fail('slot-reservation');
    slots.set(id, { entityId: id, subcell: current, reservedSubcell: reserved });
  }
  if (catalog.actors.some(a => (a.status === 'ordinary-slots') !== slots.has(a.entityId))) fail('slot-coverage');
  const claims = new Map<number, Claim[]>(); let indexedClaims = 0;
  const add = (at: number, c: Claim) => { const list = claims.get(at) ?? []; list.push(c); claims.set(at, list); indexedClaims++; };
  for (const at of model.blocked) add(at, { entityId: null, slot: null, initial: true, anchor: true });
  for (const d of model.entities) {
    const e = byId.get(d.id)!; if (!d.blocksCell || retired.has(d.id)) continue;
    // A dying actor retains its already-occupied slot so legal settled sharing survives death.
    // It separately blocks every incoming query/reservation until authoritative retirement.
    const s = slots.get(d.id);
    add(e.at, { entityId: d.id, slot: s?.subcell ?? null, initial: e.at === worldAddress(d.x, d.y) &&
      (!s || s.subcell === e.row.sourceSubcell), anchor: true });
    if (e.head !== null) add(e.head, { entityId: d.id, slot: s?.reservedSubcell ?? null, initial: false, anchor: false });
  }
  // Footprints are independent blockers. A mobile retirement cannot free a building's extra cells.
  for (const footprint of model.footprints) if (!retired.has(footprint.entityId)) for (const at of footprint.cells)
    add(at, { entityId: null, slot: null, initial: true, anchor: true });
  const alliances = new Set(catalog.alliances.map(p => `${p.from}:${p.to}`));
  const allied = (from: number, to: number): boolean => {
    const a = byId.get(from)!.owner, b = byId.get(to)!.owner;
    return a !== null && b !== null && (a === b || catalog.alliancesComplete && alliances.has(`${a}:${b}`));
  };
  // <=3 items; removing a possible last entrant proves one directed arrival order.
  const arrivalOrder = (items: Claim[], retained?: (item:Claim)=>boolean): boolean => items.length <= 1 ||
    !!retained && items.every(retained) || items.some((last, index) =>
    items.every(other => other === last || allied(last.entityId!, other.entityId!)) && arrivalOrder(items.filter((_, i) => i !== index),retained));
  const retained=new Map(current?.sharing.map(g=>[g.cell,g])),transferred=new Set(current?.transferredIds);
  for (const [at,list] of claims) if (list.length > 1) {
    // Preserve only exact original source positions/slots, never a moved actor newly joining a hard blocker.
    const original=list.every(c=>c.initial&&c.anchor),priorGroup=retained.get(at);
    if(original&&!priorGroup){
      // A capture of an original shared cohort needs the same closed marker as
      // a moved cohort. Otherwise a third-house query could admit an invalid edge.
      if(current&&list.length<=3&&list.every(c=>c.entityId!==null&&c.slot!==null)&&
        list.some(c=>transferred.has(c.entityId!))&&!arrivalOrder(list))fail('captured-group-missing');
      continue;
    }
    const prior=priorGroup, captured=prior ? (c:Claim)=>c.anchor && prior.remainingIds.includes(c.entityId!) &&
      prior.members.some(m=>m.entityId===c.entityId&&m.subcell===c.slot) : undefined;
    if(prior&&list.some(c=>!captured!(c)))fail('captured-group-closed');
    if (list.length > 3 || list.some(c => c.entityId === null || c.slot === null) ||
        new Set(list.map(c => c.slot)).size !== list.length || !arrivalOrder(list,captured)) fail('slot-overlap');
    // Active reservations have a known incoming actor, so a possible inverse arrival order is insufficient.
    if (list.some(c => !c.anchor && list.some(other => other !== c && byId.get(other.entityId!)!.health === 0))) fail('reservation-dying-blocker');
    if (list.some(c => !c.anchor && list.some(other => other !== c && !allied(c.entityId!, other.entityId!)))) fail('reservation-alliance');
  }
  // A saved surviving member must still occupy its precise recorded slot. Omitting
  // one cannot hide an unknown occupant; the complete claim list above is validated.
  for(const group of retained.values())for(const id of group.remainingIds){const e=byId.get(id)!, s=slots.get(id);
    if(retired.has(id)||e.at!==group.cell||!s||s.subcell!==group.members.find(m=>m.entityId===id)!.subcell)fail('captured-slot-join');}
  const result: InfantryOccupancy = {
    catalogSha256: catalog.sha256, occupiedCells: claims.size, indexedClaims,
    choose(entityId, destination) {
      const id = worldInteger(entityId, 1, 2147483647), at = worldInteger(destination, 0, 262143), e = byId.get(id);
      if (!e) fail('query-entity');
      const answer = (reason: InfantryCellChoice['reason'], value: InfantrySubcell | null = null, work = 0): InfantryCellChoice =>
        Object.freeze({ status: value === null ? 'blocked' : 'available', subcell: value, reason, work });
      if (e.row.status !== 'ordinary-slots') return answer('unsupported-actor');
      if (retired.has(id)) return answer('retired-actor'); if (e.health === 0) return answer('dying-actor');
      // Holding an already validated anchor adds no claim. No entrant may extend
      // a hostile capture cohort, even a third house allied to every member.
      if(at===e.at&&retained.has(at))return answer('available',slots.get(id)!.subcell);
      if(retained.has(at))return answer('captured-settled-group');
      const list = claims.get(at) ?? [], used = new Set<number>(); let work = 0;
      for (const claim of list) {
        work++; if (claim.entityId === id) continue;
        if (claim.entityId === null || claim.slot === null || byId.get(claim.entityId)!.health === 0) return answer('whole-cell-blocker', null, work);
        if (!allied(id, claim.entityId)) return answer(catalog.alliancesComplete ? 'non-allied-occupant' : 'unknown-alliance', null, work);
        used.add(claim.slot);
      }
      const preferred = slots.get(id)!.subcell;
      for (const candidate of [preferred, 2, 3, 4] as InfantrySubcell[]) if (!used.has(candidate)) return answer('available', candidate, work);
      return answer('full-subcells', null, work);
    },
  };
  return Object.freeze(result);
}
