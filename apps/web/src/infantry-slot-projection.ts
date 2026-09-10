// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. App presentation; no simulation authority.
import type { WorldActor, WorldSummary } from './world-protocol.ts';
export const INFANTRY_SLOT_PRESENTATION = 'webra2-settled-infantry-slot-pixels-1' as const;
/** Native slot coordinates in a 256-lepton cell; final raster rounding is WebRA2 policy.
 * The existing still starts at cell center. No fictional initial offset is subtracted.
 * Math.round(7.5)=8; the settled slot remains displayed for the entire logical edge.
 */
export function infantrySlotOffset(motionPolicy: string | undefined, actor: Pick<WorldActor,'subcell'>): { x: number; y: number } {
  if (motionPolicy !== 'webra2-cell-motion-2' || actor.subcell == null) return { x: 0, y: 0 };
  const point = actor.subcell === 2 ? [192,64] : actor.subcell === 3 ? [64,192] : actor.subcell === 4 ? [192,192] : null;
  if (!point) throw new Error('world-ui-slot-projection');
  const x=point[0]!-128,y=point[1]!-128;
  return { x: Math.round((x-y)*30/256), y: Math.round((x+y)*15/256) };
}
/** Focus, box-selection anchors and SHP placement consume the same saved settled slot. */
export function locateWorldActor(summary: Pick<WorldSummary,'motionPolicy'>, actor: WorldActor, locate: (x:number,y:number)=>{x:number;y:number}|null): {x:number;y:number}|null {
  const point=locate(actor.x,actor.y);if(!point)return null;
  const offset=infantrySlotOffset(summary.motionPolicy,actor);return {x:point.x+offset.x,y:point.y+offset.y};
}
