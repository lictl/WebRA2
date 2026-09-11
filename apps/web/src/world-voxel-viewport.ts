// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Complete verified still groups; no gameplay identity changes.
import { isVoxelPreview, type VoxelPreview } from '../../../packages/content/src/voxel-preview.ts';
import type { ScenarioTerrain } from '../../../packages/content/src/scenario-terrain.ts';
import { assertObjectArtPlan, type ObjectArtPlan } from '../../../packages/content/src/object-art.ts';
import { fingerprint } from '../../../packages/content/src/voxel-content-utils.ts';
import type { ScenarioObjects } from '../../../packages/content/src/scenario-objects.ts';
import { copyVoxelAtlasData,renderVoxelFrame, type VoxelInstance } from '../../../packages/render/src/voxel-render.ts';
import { ART_REPORT_LIMIT, validArtworkSummary, type ArtworkSummary, type ArtworkType, type ObjectInfo } from './object-protocol.ts';
import { WORLD_VOXEL_LIMITS, WORLD_VOXEL_POLICY } from './voxel-protocol.ts';
import { composeVoxelWorld, voxelWorldProjection } from './world-voxel-compositor.ts';
import type { ViewportScene } from './terrain-worker-runtime.ts';
import { isRetiredWorldActor } from './world-protocol.ts';
import type { WorldSnapshot } from './world-protocol.ts';
import {captureGpuVoxelResources,type GpuVoxelResources,type GpuVoxelPlacement,type GpuVoxelGroup} from './gpu-voxel-protocol.ts';

type WorldJoin = { modelHash: string; actors: readonly { objectId: string; id: number; rowId: string }[] };
/** Capture source metadata synchronously. Only the genuine owned atlas and copied palettes survive preparation. */
export function createVoxelWorldViewport(base: ViewportScene, terrain: ScenarioTerrain, objects: ScenarioObjects,
  artwork: ArtworkSummary, artPlan: ObjectArtPlan, preview: VoxelPreview, join: WorldJoin | null): { scene: ViewportScene; artwork: ArtworkSummary } {
  assertObjectArtPlan(artPlan);
  if (artPlan.source.sha256!==objects.source.sha256 || artPlan.profile!==objects.profile)throw new Error('voxel-world-source');
  if (!isVoxelPreview(preview) || fingerprint(artPlan)!==preview.plan.artPlanSha256 || terrain.profile !== objects.profile || preview.plan.profile !== objects.profile ||
    terrain.source.sha256 !== objects.source.sha256 || preview.plan.source.sha256 !== objects.source.sha256 || !validArtworkSummary(artwork,objects.placements.length)) throw new Error('voxel-world-source');
  const ground=new Map(terrain.cells.map(c=>[c.x+c.y*512,Object.freeze({column:c.projectedColumn,row:c.projectedRow,elevation:c.elevation})]));
  const actorIds=new Set<number>(),actors=new Map<string,{id:number;rowId:string}>();
  const modelHash=join?.modelHash??null;
  if(join){
    if(!/^[a-f0-9]{64}$/.test(join.modelHash)||join.actors.length!==objects.placements.length)throw new Error('voxel-world-join');
    for(let i=0;i<join.actors.length;i++){const a=join.actors[i]!;
      if(a.objectId!==`object-${i}`||a.rowId!==objects.placements[i]!.row.id||!Number.isSafeInteger(a.id)||a.id<1||actorIds.has(a.id))throw new Error('voxel-world-join');
      actorIds.add(a.id);actors.set(a.objectId,{id:a.id,rowId:a.rowId});
    }
  }
  const types=new Map(preview.types.map(t=>[t.id,t])),plans=new Map(preview.plan.types.map(t=>[t.id,t]));
  const parts=new Map(preview.atlas.parts.map(p=>[p.id,p])),assets=new Map(preview.assets.map(a=>[a.id,a])),palettes=new Map(preview.palettes.map(p=>[p.id,p]));
  const sourceRows=new Map(objects.placements.map((p,i)=>[p.row.id,{p,i}])),reportRows=new Map(artwork.rows.map(r=>[r.id,{...r,reasons:[...r.reasons]}]));
  // Exact complete object-plan ordinals also identify omitted report rows.
  const planTypeIds=new Map(artPlan.types.map((t,i)=>[t.id,`type-${i}`]));
  const initial:{instanceId:string;partId:string;paletteId:string;info:ObjectInfo;actorId:number|null}[]=[];
  const renderedByType=new Map<string,number>();let rendered=0,unplaced=0,characters=0,truncatedFields=0;
  const text=(value:string,max:number)=>{const s=value.replace(/[\u0000-\u001f\u007f]/g,'�').slice(0,max);if(s!==value)truncatedFields++;if(!s)throw new Error('voxel-world-label');return s;};
  const path=(value:string)=>{if(value.length>ART_REPORT_LIMIT.path||/[\u0000-\u001f\u007f]/.test(value))throw new Error('voxel-world-path');return value;};
  const descriptions=new Map<string,{sourcePath:string;sourceHash:string;palettePath:string;paletteHash:string}>();
  const seen=new Set<string>();
  for(const placement of preview.plan.placements){
    const source=sourceRows.get(placement.rowId),type=types.get(placement.typeId),plan=plans.get(placement.typeId);
    if(!source||!type||!plan||seen.has(placement.rowId))throw new Error('voxel-world-join');seen.add(placement.rowId);
    if(type.status!=='ready')continue; // Never draw a body when the complete type is conditional or unresolved.
    const {p,i}=source;if(!p.insideDiamond||!ground.has(p.x+p.y*512)){unplaced++;continue;}
    if(!type.stillPartIds.length||new Set(type.stillPartIds).size!==type.stillPartIds.length||!type.paletteId)throw new Error('voxel-world-parts');
    const palette=palettes.get(type.paletteId);if(!palette)throw new Error('voxel-world-palette');
    const typeId=planTypeIds.get(type.id);if(!typeId)throw new Error('voxel-world-type-join');
    const objectId=`object-${i}`,actorId=join?actors.get(objectId)!.id:null;
    for(let partIndex=0;partIndex<type.stillPartIds.length;partIndex++){
      const partId=type.stillPartIds[partIndex]!,part=parts.get(partId),binding=type.bindings.find(b=>b.partIds.includes(partId)),request=plan.requests.find(r=>r.id===binding?.requestId);
      if(!part||!part.hva||part.hva.frame!==0||part.hva.layout!=='frame-major'||!binding||binding.status!=='ready'||!request?.still||!['body','turret','barrel'].includes(request.role))throw new Error('voxel-world-parts');
      const vxl=assets.get(part.vxlAssetId),hva=assets.get(part.hva.assetId);if(!vxl||!hva)throw new Error('voxel-world-source');
      const info:ObjectInfo=Object.freeze({id:objectId,typeId,name:text(plan.name,128),family:p.kind,owner:p.owner===null?null:text(p.owner,128),x:p.x,y:p.y,frame:0,format:'voxel',
        sourcePath:path(vxl.path),sourceHash:vxl.sha256,palettePath:path(palette.path),paletteHash:palette.source.sha256,
        voxel:Object.freeze({partId,role:request.role as 'body'|'turret'|'barrel',section:part.vxlSection,hvaPath:path(hva.path),hvaHash:hva.sha256,hvaSection:part.hva.section,hvaFrame:0,voxelOrdinal:0})});
      characters+=JSON.stringify(info).length;if(characters>WORLD_VOXEL_LIMITS.descriptorCharacters)throw new Error('voxel-world-metadata-budget');
      initial.push(Object.freeze({instanceId:`voxel-${String(i).padStart(5,'0')}-${String(partIndex).padStart(3,'0')}`,partId,paletteId:type.paletteId,info,actorId}));
      if(initial.length>WORLD_VOXEL_LIMITS.instances)throw new Error('voxel-world-instance-budget');
      if(!descriptions.has(type.id))descriptions.set(type.id,{sourcePath:info.sourcePath,sourceHash:info.sourceHash,palettePath:info.palettePath,paletteHash:info.paletteHash});
    }
    rendered++;renderedByType.set(type.id,(renderedByType.get(type.id)??0)+1);
  }
  let omittedRendered=artwork.omittedRendered;
  for(const type of preview.types){
    const id=planTypeIds.get(type.id),row=id?reportRows.get(id):undefined,count=renderedByType.get(type.id)??0;
    if(!row){omittedRendered+=count;continue;}
    const description=descriptions.get(type.id);
    row.format='voxel';row.status=type.status==='ready'&&description?'ready':'unsupported-plan';row.rendered=count;
    row.reasons=type.reasons.slice(0,ART_REPORT_LIMIT.reasons).map(r=>text(r,128));row.omittedReasons=Math.max(0,type.reasons.length-row.reasons.length);
    if(description)Object.assign(row,description);
  }
  // Enforce the report budget again after replacing pending rows with source identities.
  const rows:ArtworkType[]=[];let omittedTypes=artwork.omittedTypes,omittedPlacements=artwork.omittedPlacements,reportCharacters=0;
  for(const row of reportRows.values()){
    const size=[row.id,row.name,row.family,row.status,row.sourcePath,row.sourceHash,row.palettePath,row.paletteHash,...row.reasons].reduce<number>((n,v)=>n+(typeof v==='string'?v.length:0),0);
    if(rows.length===ART_REPORT_LIMIT.types||size>ART_REPORT_LIMIT.characters-reportCharacters){omittedTypes++;omittedPlacements+=row.placements;omittedRendered+=row.rendered;continue;}
    reportCharacters+=size;rows.push(Object.freeze({...row,reasons:Object.freeze(row.reasons) as unknown as string[]}));
  }
  const allocations=preview.atlas.allocations;
  const combined:ArtworkSummary=Object.freeze({...artwork,rows:Object.freeze(rows) as unknown as ArtworkType[],rendered:artwork.rendered+rendered,unavailable:artwork.unavailable-rendered,
    omittedTypes,omittedPlacements,omittedRendered,truncatedFields:artwork.truncatedFields+truncatedFields,unplaced:artwork.unplaced+unplaced,
    voxel:Object.freeze({policy:preview.policy,presentation:WORLD_VOXEL_POLICY,types:preview.types.length,readyTypes:preview.types.filter(t=>t.status==='ready').length,
      placements:preview.plan.placements.length,rendered,unavailable:preview.plan.placements.length-rendered,assets:preview.assets.length,parts:preview.atlas.parts.length,
      sourceBytes:allocations.sourceBytes,geometryBytes:allocations.geometryBytes,selectedVoxels:allocations.selectedVoxels,matrices:allocations.matrices})});
  if(!validArtworkSummary(combined,objects.placements.length))throw new Error('voxel-world-report');
  const atlas=preview.atlas,used=new Set(initial.map(p=>p.paletteId));
  const paletteCopies=Object.freeze(preview.palettes.filter(p=>used.has(p.id)).map(p=>Object.freeze({id:p.id,rgba:p.rgba.slice(),remap:null,transparentIndex:0})));
  const grouped=new Map<string,typeof initial>();for(const part of initial){const group=grouped.get(part.info.id)??[];group.push(part);grouped.set(part.info.id,group);}
  const groups:readonly GpuVoxelGroup[]=Object.freeze([...grouped].map(([id,parts])=>{
    const first=parts[0]!,at=ground.get(first.info.x+first.info.y*512)!;
    return Object.freeze({id,actorId:first.actorId,initial:Object.freeze({x:first.info.x,y:first.info.y,...at}),
      parts:Object.freeze(parts.map(p=>Object.freeze({instanceId:p.instanceId,partId:p.partId,paletteId:p.paletteId,info:p.info})))});
  }));
  // One selection program owns full group membership and retirement for both renderers.
  const captureGroups=(snapshot?:WorldSnapshot)=>{
    if(modelHash!==null&&(!snapshot||snapshot.modelHash!==modelHash))throw new Error('voxel-world-snapshot');
    const positions=new Map(snapshot?.actors.map(a=>[a.id,a])??[]),placements:GpuVoxelPlacement[]=[],retired:string[]=[];
    for(const group of groups){
      const position=group.actorId===null?group.initial:positions.get(group.actorId);if(!position)throw new Error('voxel-world-actor');
      if(group.actorId!==null&&isRetiredWorldActor(positions.get(group.actorId)!)){retired.push(group.id);continue;}
      const cell=ground.get(position.x+position.y*512);if(!cell)throw new Error('voxel-world-ground');
      placements.push(Object.freeze({objectId:group.id,x:position.x,y:position.y,...cell}));
    }
    return {placements:Object.freeze(placements),retired};
  };
  const gpu=base.gpu?{gpu(){
    const lower=base.gpu!();if(!initial.length)return lower;
    const copied=copyVoxelAtlasData(atlas),voxel:GpuVoxelResources=captureGpuVoxelResources({version:1,policy:WORLD_VOXEL_POLICY,modelHash,
      parts:copied.parts.map(p=>({id:p.metadata.id,voxels:p.voxels,modelMatrix:p.modelMatrix})),
      palettes:paletteCopies.map(p=>({...p,rgba:p.rgba.slice()})),grounds:[...ground].map(([xy,p])=>({x:xy%512,y:Math.floor(xy/512),...p})),groups});
    return {...lower,voxel,project(snapshot?:WorldSnapshot){const baseState=lower.project(snapshot),state=captureGroups(snapshot);
      return {...baseState,voxelPlacements:state.placements,retiredObjectIds:[...new Set([...baseState.retiredObjectIds,...state.retired])].sort()};}};
  }}:{gpuRefusal:base.gpuRefusal??'scene-unavailable' as const};
  return {artwork:combined,scene:{...gpu,...(base.locate?{locate:base.locate}:{}),render(viewport,snapshot){
    const {placements,retired}=captureGroups(snapshot),current=new Map(placements.map(p=>[p.objectId,p])),instances:VoxelInstance[]=[],sources=new Map<string,ObjectInfo>();
    for(const part of initial){const p=current.get(part.info.id);if(!p)continue;
      instances.push({id:part.instanceId,partId:part.partId,paletteId:part.paletteId,modelToView:voxelWorldProjection(p,viewport)});
      sources.set(part.instanceId,Object.freeze({...part.info,x:p.x,y:p.y}));
    }
    const lower=base.render(viewport,snapshot),frame=retired.length?{...lower,allocations:{...lower.allocations,retiredObjectIds:[...new Set([...(lower.allocations.retiredObjectIds??[]),...retired])].sort()}}:lower;
    if(!instances.length)return frame;
    const livePalettes=new Set(instances.map(p=>p.paletteId));
    const voxel=renderVoxelFrame({atlas,instances,palettes:paletteCopies.filter(p=>livePalettes.has(p.id)),viewport:{width:viewport.width,height:viewport.height,backgroundRgba:[0,0,0,0]},lighting:'unlit'},
      {dimension:960,pixels:WORLD_VOXEL_LIMITS.pixels,instances:WORLD_VOXEL_LIMITS.instances,instanceVoxels:WORLD_VOXEL_LIMITS.instanceVoxels,samples:WORLD_VOXEL_LIMITS.samples});
    return composeVoxelWorld(frame,voxel,sources);
  }}};
}
