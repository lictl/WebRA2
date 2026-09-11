// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Explicit preview geometry, not native object placement.
import { assertObjectArtPlan } from '../../../packages/content/src/object-art.ts';
import type { ObjectPreview } from '../../../packages/content/src/object-preview.ts';
import type { ScenarioTerrain } from '../../../packages/content/src/scenario-terrain.ts';
import type { ScenarioObjects } from '../../../packages/content/src/scenario-objects.ts';
import type { TerrainScene } from '../../../packages/render/src/terrain-scene.ts';
import type { ViewportScene } from './terrain-worker-runtime.ts';
import { compileGpuScene } from '../../../packages/render/src/gpu-scene.ts';
import { createSpriteAtlas, type SpriteBatch, type SpriteObject } from '../../../packages/render/src/sprite-layer.ts';
import { ART_REPORT_LIMIT, PLACED_STILL_POLICY, type ArtworkSummary, type ArtworkType, type ObjectInfo } from './object-protocol.ts';
export type PlacedStill = { batch: SpriteBatch; artwork: ArtworkSummary; objects: ReadonlyMap<string, ObjectInfo> };
/** Source snapshots are consumed synchronously; returned descriptors have no mutable input aliases. */
export function createPlacedStill(terrain: ScenarioTerrain, objects: ScenarioObjects, preview: ObjectPreview): PlacedStill {
  assertObjectArtPlan(preview.plan);
  if (terrain.profile !== objects.profile || preview.plan.profile !== objects.profile || terrain.source.sha256 !== objects.source.sha256 || preview.plan.source.sha256 !== objects.source.sha256 || preview.plan.placements.length !== objects.placements.length) throw new Error('object-presentation-source');
  const ground = new Map(terrain.cells.map(c=>[c.x+512*c.y,c]));
  const planTypes = new Map(preview.plan.types.map((t,i)=>[t.id,{plan:t,id:`type-${i}`} ]));
  const resources = new Map(preview.types.map(t=>[t.id,t]));
  const sourceAssets = new Map(preview.assets.map(a=>[a.id,a]));
  const sourcePalettes = new Map(preview.palettes.map(p=>[p.id,p]));
  const joins = new Map(preview.plan.placements.map(p=>[p.rowId,p.typeId]));
  if (joins.size !== objects.placements.length || planTypes.size !== preview.plan.types.length || resources.size !== planTypes.size) throw new Error('object-presentation-join');
  let truncatedFields=0,unplaced=0,descriptorCharacters=0;
  const label=(s:string,max:number)=>{const result=s.replace(/[\u0000-\u001f\u007f]/g,'�').slice(0,max);if(result!==s)truncatedFields++;if(!result)throw new Error('object-presentation-label');return result;};
  const rows = new Map<string,ArtworkType>();
  for (const [typeId,{plan,id}] of planTypes) {
    const resource=resources.get(typeId);if(!resource)throw new Error('object-presentation-join');
    const asset=resource.assetId===null?undefined:sourceAssets.get(resource.assetId),palette=resource.paletteId===null?undefined:sourcePalettes.get(resource.paletteId);
    const reasons=plan.reasons.slice(0,ART_REPORT_LIMIT.reasons).map(r=>label(r,128));
    rows.set(typeId,{id,name:label(plan.name,ART_REPORT_LIMIT.label),family:plan.kind,format:plan.status==='voxel'?'voxel':'shp',status:resource.status,placements:0,rendered:0,reasons,omittedReasons:plan.reasons.length-reasons.length,sourcePath:asset?.path??null,sourceHash:asset?.sha256??null,palettePath:palette?.path??null,paletteHash:palette?.source.sha256??null});
  }
  const placed:SpriteObject[]=[],info=new Map<string,ObjectInfo>(),usedAssets=new Set<string>(),usedPalettes=new Set<string>();
  const seenRows=new Set<string>();
  for (let i=0;i<objects.placements.length;i++) {
    const p=objects.placements[i]!,typeId=joins.get(p.row.id),type=typeId===undefined?undefined:planTypes.get(typeId),resource=typeId===undefined?undefined:resources.get(typeId),row=typeId===undefined?undefined:rows.get(typeId);
    if (!type || !resource || !row || seenRows.has(p.row.id) || type.plan.kind!==p.kind) throw new Error('object-presentation-join');
    seenRows.add(p.row.id);row.placements++;
    if (resource.status!=='ready')continue;
    const cell=ground.get(p.x+512*p.y),foundation=p.kind==='structure'?type.plan.foundation:{width:1,height:1};
    if (!cell || !p.insideDiamond || !foundation) {unplaced++;continue;}
    const asset=resource.assetId===null?undefined:sourceAssets.get(resource.assetId),palette=resource.paletteId===null?undefined:sourcePalettes.get(resource.paletteId);
    if (!asset || !palette || !resource.canvas || !row.sourcePath || !row.sourceHash || !row.palettePath || !row.paletteHash)throw new Error('object-presentation-resource');
    for(const path of [asset.path,palette.path])if(path.length>ART_REPORT_LIMIT.path || /[\u0000-\u001f\u007f]/.test(path))throw new Error('object-presentation-path');
    const {width,height}=foundation,baseX=cell.projectedColumn*30+30,baseY=cell.projectedRow*15+15;
    // Rectangular foundation center; floor is deliberate for half-pixel Y positions.
    const x=baseX+(width-height)*15,y=baseY+Math.floor((width+height-2)*15/2)-cell.elevation*15;
    const id=`object-${i}`,frameId=`frame-${asset.id}`;
    placed.push(Object.freeze({id,frameId,paletteId:palette.id,x,y,anchorX:Math.floor(resource.canvas.width/2),anchorY:Math.floor(resource.canvas.height/2),depth:Object.freeze({base:baseY+15+(width+height-2)*15,rowStep:0 as const,terrainTie:'front' as const})}));
    const description=Object.freeze({id,format:'shp' as const,voxel:null,typeId:row.id,name:row.name,family:p.kind,owner:p.owner===null?null:label(p.owner,ART_REPORT_LIMIT.label),x:p.x,y:p.y,frame:0 as const,sourcePath:asset.path,sourceHash:asset.sha256,palettePath:palette.path,paletteHash:palette.source.sha256});
    descriptorCharacters+=Object.values(description).reduce<number>((n,v)=>n+(typeof v==='string'?v.length:0),0);
    if(descriptorCharacters>8*1024**2)throw new Error('object-presentation-metadata-budget');
    info.set(id,description);row.rendered++;usedAssets.add(asset.id);usedPalettes.add(palette.id);
  }
  const assets=preview.assets.filter(a=>usedAssets.has(a.id));
  const atlas=createSpriteAtlas({assets:assets.map(a=>({id:a.id,sha256:a.sha256,bytes:a.bytes})),frames:assets.map(a=>({id:`frame-${a.id}`,assetId:a.id,frame:0}))});
  const palettes=preview.palettes.filter(p=>usedPalettes.has(p.id)).map(p=>Object.freeze({id:p.id,rgba:p.rgba.slice(),remap:null,transparentIndex:0}));
  const reported:ArtworkType[]=[];let omittedTypes=0,omittedPlacements=0,omittedRendered=0,characters=0;
  for (const row of rows.values()) {
    const size=[row.id,row.name,row.family,row.status,row.sourcePath,row.sourceHash,row.palettePath,row.paletteHash,...row.reasons].reduce<number>((n,v)=>n+(typeof v==='string'?v.length:0),0);
    if (reported.length===ART_REPORT_LIMIT.types || size>ART_REPORT_LIMIT.characters-characters) {omittedTypes++;omittedPlacements+=row.placements;omittedRendered+=row.rendered;continue;}
    characters+=size;Object.freeze(row.reasons);reported.push(Object.freeze(row));
  }
  const artwork:ArtworkSummary=Object.freeze({policy:preview.plan.policy,presentation:PLACED_STILL_POLICY,voxel:null,types:rows.size,rendered:placed.length,unavailable:objects.placements.length-placed.length,assets:atlas.assets.length,palettes:palettes.length,sourceBytes:atlas.allocations.sourceSnapshotBytes,decodedBytes:atlas.allocations.decodedPixelBytes,indexedFrames:atlas.allocations.indexedFrames,rows:Object.freeze(reported) as unknown as ArtworkType[],omittedTypes,omittedPlacements,omittedRendered,truncatedFields,unplaced});
  return {batch:Object.freeze({atlas,palettes:Object.freeze(palettes),objects:Object.freeze(placed)}),artwork,objects:info};
}

/** This closure captures only owned rendering planes/palettes and bounded descriptions. */
export function createPlacedViewport(terrainScene:TerrainScene,still:PlacedStill):ViewportScene {
  return {gpu(){return {scene:compileGpuScene(terrainScene,still.batch),objectInfo:[...still.objects.values()],project:()=>({objects:still.batch.objects,retiredObjectIds:[]})};},render(viewport){
    const frame=terrainScene.renderSprites(viewport,still.batch);
    return {...frame,pick(x:number,y:number){
      const picked=frame.pick(x,y);if(!picked)return null;
      if(picked.kind==='terrain'){const {kind:_,...cell}=picked;return {kind:'terrain' as const,cell};}
      const object=still.objects.get(picked.id);if(!object)throw new Error('object-presentation-pick');
      return {kind:'object' as const,object,canvasX:picked.canvasX,canvasY:picked.canvasY,worldX:picked.worldX,worldY:picked.worldY,depth:picked.depth};
    }};
  }};
}
