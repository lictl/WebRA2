// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Display-frame anchors and UI-only selection.
import { locateWorldActor } from './infantry-slot-projection.ts';
import { WORLD_UI, worldInt, worldRecord, worldRows, type WorldSummary, type WorldSnapshot } from './world-protocol.ts';

export type WorldControlPoint = { entityId: number; x: number; y: number };
export type SelectionMode = 'replace' | 'add' | 'toggle';
export type SelectionResult = { ids: number[]; limited: boolean };
export type SelectionBox = { left: number; top: number; right: number; bottom: number };

export function controllable(summary: WorldSummary | null | undefined, snapshot: WorldSnapshot | null | undefined, playerId: number | null, id: number): boolean {
  if (!summary || !snapshot || summary.modelHash !== snapshot.modelHash || playerId === null) return false;
  const info = summary.actors.find(a => a.id === id), actor = snapshot.actors.find(a => a.id === id);
  return !!info && !!actor && info.movable && info.owner === playerId && actor.health !== null && actor.health > 0;
}

export function selectWorldActors(current: readonly number[], candidates: readonly number[], mode: SelectionMode, summary: WorldSummary, snapshot: WorldSnapshot, playerId: number | null): SelectionResult {
  const eligible = new Set(summary.actors.filter(a => controllable(summary, snapshot, playerId, a.id)).map(a => a.id));
  const next = new Set(mode === 'replace' ? [] : current.filter(id => eligible.has(id)));
  for (const id of candidates) {
    if (!eligible.has(id)) continue;
    if (mode === 'toggle' && next.has(id)) next.delete(id); else next.add(id);
  }
  if (next.size > WORLD_UI.group) return { ids: current.filter(id => eligible.has(id)).slice(0, WORLD_UI.group), limited: true };
  return { ids: [...next].sort((a, b) => a - b), limited: false };
}

export function actorsInBox(points: readonly WorldControlPoint[], box: SelectionBox): number[] {
  return points.filter(p => p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom).map(p => p.entityId);
}

/** Project authoritative saved cell/slot positions using the retained verified terrain locator. */
export function projectControlPoints(summary: WorldSummary | null, snapshot: WorldSnapshot | null, camera: { cameraX: number; cameraY: number; zoom: number; width: number; height: number }, locate?: (x: number, y: number) => { x: number; y: number } | null): WorldControlPoint[] {
  return projectWorldControlPoints(summary,snapshot,locate).flatMap(point=>{
    const x=Math.floor((point.x-camera.cameraX)*camera.zoom),y=Math.floor((point.y-camera.cameraY)*camera.zoom);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))throw new Error('world-ui-control-point');
    return x>=0&&y>=0&&x<camera.width&&y<camera.height?[{entityId:point.entityId,x,y}]:[];
  });
}
/** Unclipped anchors permit camera-only presentation without another simulation request. */
export function projectWorldControlPoints(summary: WorldSummary | null, snapshot: WorldSnapshot | null, locate?: (x: number, y: number) => { x: number; y: number } | null): WorldControlPoint[] {
  if (!summary || !snapshot || !locate) return [];
  const points: WorldControlPoint[] = [];
  for (let i = 0; i < snapshot.actors.length; i++) {
    const actor = snapshot.actors[i]!, info = summary.actors[i];
    if (!info || info.id !== actor.id) throw new Error('world-ui-control-join');
    if (!info.movable || actor.health === null || actor.health <= 0) continue;
    const point = locateWorldActor(summary,actor,locate); if (!point) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('world-ui-control-point');
    points.push({ entityId: actor.id, x:point.x, y:point.y });
  }
  return points;
}

export function validControlPoints(value: unknown, width: number, height: number, summary: WorldSummary | null, snapshot: WorldSnapshot | null): value is WorldControlPoint[] {
  if (!worldRows(value, WORLD_UI.entities)) return false;
  if (!summary || !snapshot) return value.length === 0;
  let prior = 0;
  for (const p of value) {
    if (!worldRecord(p, ['entityId', 'x', 'y']) || !worldInt(p.entityId, prior + 1) || !worldInt(p.x, 0, width - 1) || !worldInt(p.y, 0, height - 1)) return false;
    const info = summary.actors.find(a => a.id === p.entityId), actor = snapshot.actors.find(a => a.id === p.entityId);
    if (!info?.movable || actor?.health === null || actor?.health === undefined || actor.health <= 0) return false;
    prior = p.entityId;
  }
  return true;
}
