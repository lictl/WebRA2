// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. App-private metadata, never source assets.
export const WORLD_UI = Object.freeze({ policy: 'webra2-world-ui-1', entities: 2048, group: 64, players: 256, trace: 64, characters: 512 * 1024, documentBytes: 2 * 1024 ** 2, catchup: 4, hz: 15 });
export type WorldPlayer = { id: number; houseId: string; name: string };
export type WorldCombatRole = 'attacker' | 'target-only' | 'movement-only';
export type WorldCombatState = { targetId: number|null; readyTick: number; windupUntil: number|null; deathSequence: 11|12|null; deathUntil: number|null; corpseIndex: number|null };
export type WorldActorInfo = { combatRole?: WorldCombatRole; id: number; rowId: string; objectId: string; typeId: string; owner: number | null; kind: string; movable: boolean; maximumHealth: number | null; reasons: string[]; omittedReasons: number };
export type WorldSummary = { combatPolicy?: 'webra2-source-standing-infantry-combat-1'; policy: 'webra2-world-ui-1'; modelHash: string; motionPolicy: string; defaultPlayerId: number | null; players: WorldPlayer[]; actors: WorldActorInfo[]; limitations: string[]; omittedLimitations: number; truncatedFields: number };
export type WorldActor = { combat?: WorldCombatState; id: number; x: number; y: number; health: number | null; goalX: number | null; goalY: number | null; nextX: number | null; nextY: number | null; routeLength: number; progress: number; edgeCost: number | null; waitTicks: number };
export type WorldEvent = { tick: number; phase: 'command' | 'navigation' | 'movement' | 'combat'; kind: string; entityId: number; cell: number | null; value: number | null };
export type WorldSnapshot = { modelHash: string; revision: number; nextTick: number; stateHash: string; queuedCommands: number; actors: WorldActor[]; events: WorldEvent[]; omittedEvents: number };
export type WorldAttackOrder = { type: 'world-orders'; playerId: number; entityIds: number[]; expectedRevision: number; order: 'attack'; targetId: number };
export type WorldGroupOrder = WorldAttackOrder | { type: 'world-orders'; playerId: number; entityIds: number[]; expectedRevision: number; order: 'move'; x: number; y: number } | { type: 'world-orders'; playerId: number; entityIds: number[]; expectedRevision: number; order: 'stop' };
export type WorldAction = WorldGroupOrder | { type: 'world-step'; ticks: number } | { type: 'world-order'; playerId: number; entityId: number; order: 'move'; x: number; y: number } | { type: 'world-order'; playerId: number; entityId: number; order: 'stop' } | { type: 'world-save' | 'world-replay-export' } | { type: 'world-restore' | 'world-replay-validate'; text: string };
export type WorldDocument = { type: 'world-document'; kind: 'save' | 'replay' | 'validated'; modelHash: string; revision: number; stateHash: string; text: string | null };
export type WorldRejection = { type: 'world-rejection'; code: string; modelHash: string; revision: number };
export function worldRecord(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype || Reflect.ownKeys(v).length !== keys.length) return false;
  return keys.every(k => { const d = Object.getOwnPropertyDescriptor(v, k); return d && 'value' in d; });
}
export function worldRows(v: unknown, cap: number): v is unknown[] {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype || v.length > cap || Reflect.ownKeys(v).length !== v.length + 1) return false;
  for (let i = 0; i < v.length; i++) { const d = Object.getOwnPropertyDescriptor(v, String(i)); if (!d || !('value' in d)) return false; } return true;
}
export const worldInt = (v: unknown, min = 0, max = 0x7fffffff): v is number => typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= min && v <= max;
export const worldHashText = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const label = (v: unknown, max = 255): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const nullableInt = (v: unknown, max: number) => v === null || worldInt(v, 0, max);
const pair = (x: unknown, y: unknown) => x === null ? y === null : worldInt(x, 0, 511) && worldInt(y, 0, 511);
export function worldDocumentText(v: unknown): v is string { return typeof v === 'string' && v.length > 0 && v.length <= WORLD_UI.documentBytes && new TextEncoder().encode(v).byteLength <= WORLD_UI.documentBytes; }
export function validWorldAction(v: unknown): v is WorldAction {
  const groupStop = worldRecord(v, ['type', 'playerId', 'entityIds', 'expectedRevision', 'order']) && v.order === 'stop';
  const groupMove = worldRecord(v, ['type', 'playerId', 'entityIds', 'expectedRevision', 'order', 'x', 'y']) && v.order === 'move' && worldInt(v.x, 0, 511) && worldInt(v.y, 0, 511);
  const groupAttack = worldRecord(v, ['type','playerId','entityIds','expectedRevision','order','targetId']) && v.order==='attack' && worldInt(v.targetId,1);
  if ((groupStop || groupMove || groupAttack) && v.type === 'world-orders') {
    if (!worldInt(v.playerId, 0, 65535) || !worldInt(v.expectedRevision) || !worldRows(v.entityIds, WORLD_UI.group) || v.entityIds.length === 0) return false;
    let prior = 0; for (const id of v.entityIds) { if (!worldInt(id, prior + 1)) return false; prior = id; } return true;
  }
  if (worldRecord(v, ['type', 'ticks']) && v.type === 'world-step') return worldInt(v.ticks, 1, WORLD_UI.catchup);
  if (worldRecord(v, ['type']) && (v.type === 'world-save' || v.type === 'world-replay-export')) return true;
  if (worldRecord(v, ['type', 'text']) && (v.type === 'world-restore' || v.type === 'world-replay-validate')) return worldDocumentText(v.text);
  const stop = worldRecord(v, ['type', 'playerId', 'entityId', 'order']) && v.order === 'stop';
  const move = worldRecord(v, ['type', 'playerId', 'entityId', 'order', 'x', 'y']) && v.order === 'move' && worldInt(v.x, 0, 511) && worldInt(v.y, 0, 511);
  return (stop || move) && v.type === 'world-order' && worldInt(v.playerId, 0, 65535) && worldInt(v.entityId, 1);
}
export function validWorldSummary(v: unknown): v is WorldSummary {
  const source = !!v && typeof v==='object' && Object.hasOwn(v,'combatPolicy');
  if (!worldRecord(v, ['policy', 'modelHash', 'motionPolicy', 'defaultPlayerId', 'players', 'actors', 'limitations', 'omittedLimitations', 'truncatedFields', ...(source?['combatPolicy']:[])]) || v.policy !== WORLD_UI.policy || !worldHashText(v.modelHash) || v.motionPolicy !== 'webra2-cell-motion-1' || !nullableInt(v.defaultPlayerId, 65535) || !worldRows(v.players, WORLD_UI.players) || !worldRows(v.actors, WORLD_UI.entities) || !worldRows(v.limitations, 32) || !v.limitations.every(s => label(s, 128)) || !worldInt(v.omittedLimitations, 0, 65535) || !worldInt(v.truncatedFields, 0, 65535)) return false;
  if(source && v.combatPolicy!=='webra2-source-standing-infantry-combat-1')return false;
  const players = new Set<number>(), rows = new Set<string>(), objects = new Set<string>(); let lastId = 0, characters = (v.limitations as string[]).reduce((n, s) => n + s.length, 0);
  for (const p of v.players) { if (!worldRecord(p, ['id', 'houseId', 'name']) || !worldInt(p.id, 0, 65535) || players.has(p.id) || !label(p.houseId) || !label(p.name, 128)) return false; players.add(p.id); characters += p.houseId.length + p.name.length; }
  if (v.defaultPlayerId !== null && !players.has(v.defaultPlayerId)) return false;
  for (const a of v.actors) {
    if (!worldRecord(a, ['id', 'rowId', 'objectId', 'typeId', 'owner', 'kind', 'movable', 'maximumHealth', 'reasons', 'omittedReasons', ...(source?['combatRole']:[])]) || !worldInt(a.id, lastId + 1) || !label(a.rowId) || rows.has(a.rowId) || !label(a.objectId) || objects.has(a.objectId) || !label(a.typeId) || !(a.owner === null || worldInt(a.owner, 0, 65535) && players.has(a.owner)) || !['infantry', 'unit', 'aircraft', 'structure', 'terrain', 'smudge'].some(k => k === a.kind) || typeof a.movable !== 'boolean' || !nullableInt(a.maximumHealth, 1_000_000) || !worldRows(a.reasons, 8) || !a.reasons.every(r => label(r, 128)) || !worldInt(a.omittedReasons, 0, 65535)) return false;
    if(source && !['attacker','target-only','movement-only'].includes(a.combatRole as string))return false;
    if(source && a.combatRole!=='movement-only' && (a.kind!=='infantry'||a.maximumHealth===null||a.maximumHealth===0||a.owner===null))return false;
    if (a.movable && (a.owner === null || a.maximumHealth === null || a.maximumHealth === 0)) return false;
    lastId = a.id; rows.add(a.rowId); objects.add(a.objectId); characters += a.rowId.length + a.objectId.length + a.typeId.length + (a.reasons as string[]).reduce((n, s) => n + s.length, 0);
  }
  return characters <= WORLD_UI.characters;
}
export function validWorldSnapshot(v: unknown, summary?: WorldSummary): v is WorldSnapshot {
  if (!worldRecord(v, ['modelHash', 'revision', 'nextTick', 'stateHash', 'queuedCommands', 'actors', 'events', 'omittedEvents']) || !worldHashText(v.modelHash) || !worldHashText(v.stateHash) || !worldInt(v.revision) || !worldInt(v.nextTick, 0, 1_000_000_000) || !worldInt(v.queuedCommands, 0, 256) || !worldRows(v.actors, WORLD_UI.entities) || !worldRows(v.events, WORLD_UI.trace) || !worldInt(v.omittedEvents, 0, 32768)) return false;
  if (summary && (summary.modelHash !== v.modelHash || summary.actors.length !== v.actors.length)) return false;
  let lastId = 0, routes = 0;
  for (let i = 0; i < v.actors.length; i++) {
    const a = v.actors[i], info = summary?.actors[i], combat = !!a && typeof a==='object' && Object.hasOwn(a,'combat');
    if (!worldRecord(a, ['id', 'x', 'y', 'health', 'goalX', 'goalY', 'nextX', 'nextY', 'routeLength', 'progress', 'edgeCost', 'waitTicks',...(combat?['combat']:[])]) || !worldInt(a.id, lastId + 1) || !worldInt(a.x, 0, 511) || !worldInt(a.y, 0, 511) || !nullableInt(a.health, 1_000_000) || !pair(a.goalX, a.goalY) || !pair(a.nextX, a.nextY) || !worldInt(a.routeLength, 0, 16384) || !worldInt(a.progress, 0, 362 * 65535) || !(a.edgeCost === null || worldInt(a.edgeCost, 1, 362 * 65535)) || !worldInt(a.waitTicks, 0, 15)) return false;
    if ((info && (info.id !== a.id || (a.health === null ? info.maximumHealth !== null : info.maximumHealth === null || a.health > info.maximumHealth))) || (a.routeLength >= 2 ? a.nextX === null || a.edgeCost === null : a.nextX !== null || a.edgeCost !== null) || (a.progress > 0 && (a.edgeCost === null || a.progress >= a.edgeCost))) return false;
    if(info && combat !== (info.combatRole==='attacker'||info.combatRole==='target-only'))return false;
    if(combat){
      const c=a.combat;
      if(!worldRecord(c,['targetId','readyTick','windupUntil','deathSequence','deathUntil','corpseIndex'])||!(c.targetId===null||worldInt(c.targetId,1)&&c.targetId!==a.id)||!worldInt(c.readyTick,0,1_000_010_000)||!nullableInt(c.windupUntil,1_000_010_000)||![null,11,12].includes(c.deathSequence as number|null)||!nullableInt(c.deathUntil,1_000_000_000)||!nullableInt(c.corpseIndex,63))return false;
      if(c.windupUntil!==null&&(c.targetId===null||c.windupUntil<(v.nextTick as number)||a.health===0||a.goalX!==null))return false;
      if(c.deathSequence===null ? c.deathUntil!==null||c.corpseIndex!==null : c.deathUntil===null||a.health!==0||c.targetId!==null||c.windupUntil!==null)return false;
      if(c.deathUntil!==null && (c.corpseIndex===null ? c.deathUntil<(v.nextTick as number) : c.deathUntil>=(v.nextTick as number)))return false;
      if(c.targetId!==null&&summary&&!summary.actors.some(x=>x.id===c.targetId&&(x.combatRole==='attacker'||x.combatRole==='target-only')))return false;
    }
    routes += a.routeLength; lastId = a.id;
  }
  if (routes > 16384) return false;
  return v.events.every(e => worldRecord(e, ['tick', 'phase', 'kind', 'entityId', 'cell', 'value']) && worldInt(e.tick, 0, Math.max(0, v.nextTick as number - 1)) && ['command', 'navigation', 'movement', 'combat'].some(p => p === e.phase) && label(e.kind, 96) && worldInt(e.entityId, 1) && nullableInt(e.cell, 262143) && nullableInt(e.value, Number.MAX_SAFE_INTEGER));
}
export function validWorldDocument(v: unknown): v is WorldDocument {
  return worldRecord(v, ['type', 'kind', 'modelHash', 'revision', 'stateHash', 'text']) && v.type === 'world-document' && worldHashText(v.modelHash) && worldHashText(v.stateHash) && worldInt(v.revision) && (v.kind === 'validated' ? v.text === null : (v.kind === 'save' || v.kind === 'replay') && worldDocumentText(v.text));
}
export function validWorldRejection(v: unknown): v is WorldRejection { return worldRecord(v, ['type', 'code', 'modelHash', 'revision']) && v.type === 'world-rejection' && label(v.code, 96) && worldHashText(v.modelHash) && worldInt(v.revision); }
