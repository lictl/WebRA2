// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Whole-cell snapshot placement; no native interpolation claim.
import type { TerrainScene } from '../../../packages/render/src/terrain-scene.ts';
import type { ScenarioTerrain } from '../../../packages/content/src/scenario-terrain.ts';
import type { SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import type { PlacedStill } from './placed-still.ts';
import type { ObjectInfo } from './object-protocol.ts';
import type { ViewportScene } from './terrain-worker-runtime.ts';
type WorldArtJoin = { modelHash:string; actors:readonly {objectId:string;id:number;rowId:string}[] };
/** Source cells and initial art descriptors are captured before an asynchronous request can mutate inputs. */
export function createWorldViewport(scene: TerrainScene, terrain: ScenarioTerrain, still: PlacedStill, summary: WorldArtJoin): ViewportScene {
  const ground = new Map(terrain.cells.map(c => [c.x + c.y * 512, { column: c.projectedColumn, row: c.projectedRow, elevation: c.elevation }]));
  const actors = new Map(summary.actors.map(a => [a.objectId, { id: a.id, rowId: a.rowId }]));
  const initial = still.batch.objects.map(o => {
    const info = still.objects.get(o.id); if (!info) throw new Error('world-art-object-join');
    const cell = ground.get(info.x + info.y * 512); if (!cell) throw new Error('world-art-ground');
    return { object: o, info, cell, actor: actors.get(o.id) };
  });
  return { locate(x,y){const c=ground.get(x+y*512);return c?{x:c.column*30+30,y:c.row*15+15-c.elevation*15}:null;}, render(viewport, snapshot) {
    if (!snapshot || snapshot.modelHash !== summary.modelHash) throw new Error('world-art-snapshot');
    const positions = new Map(snapshot.actors.map(a => [a.id, a])), descriptions = new Map<string, ObjectInfo>();
    const visible=initial.filter(({actor})=>{const p=actor?positions.get(actor.id):undefined;return p?.health!==0||(p.combat?.deathSequence!=null&&p.combat.corpseIndex===null);});
    const objects: SpriteObject[] = visible.map(({ object, info, cell, actor }) => {
      const position = actor ? positions.get(actor.id) : undefined;
      if (actor && !position) throw new Error('world-art-entity-join');
      if (!position || (position.x === info.x && position.y === info.y)) { descriptions.set(object.id, info); return object; }
      const current = ground.get(position.x + position.y * 512); if (!current) throw new Error('world-art-ground');
      const dx = (current.column - cell.column) * 30, dy = (current.row - cell.row) * 15;
      descriptions.set(object.id, Object.freeze({ ...info, x: position.x, y: position.y }));
      return Object.freeze({ ...object, x: object.x + dx, y: object.y + dy - (current.elevation - cell.elevation) * 15, depth: Object.freeze({ ...object.depth, base: object.depth.base + dy }) });
    });
    const frame = scene.renderSprites(viewport, { ...still.batch, objects });
    // Every pick closure retains the descriptions for its own frame, never a later snapshot.
    return { ...frame, pick(x, y) {
      const picked = frame.pick(x, y); if (!picked) return null;
      if (picked.kind === 'terrain') { const { kind: _, ...cell } = picked; return { kind: 'terrain', cell }; }
      const object = descriptions.get(picked.id); if (!object) throw new Error('world-art-pick');
      return { kind: 'object', object, canvasX: picked.canvasX, canvasY: picked.canvasY, worldX: picked.worldX, worldY: picked.worldY, depth: picked.depth };
    } };
  } };
}
