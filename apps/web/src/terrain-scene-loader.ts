// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. On-device preparation remains inside the worker.
import { inspectBrowserCatalog, type BrowserCatalog } from '../../../packages/vfs/src/browser-catalog.ts';
import { prepareTerrainPreview } from '../../../packages/content/src/terrain-preview.ts';
import { compileObjectArt, OBJECT_ART_POLICY } from '../../../packages/content/src/object-art.ts';
import { prepareObjectPreview } from '../../../packages/content/src/object-preview.ts';
import { createTerrainScene } from '../../../packages/render/src/terrain-scene.ts';
import type { BrowserMemberIdentity } from '../../../packages/vfs/src/browser-verified.ts';
import type { TerrainProgress, TerrainProfile } from './terrain-protocol.ts';
import type { CampaignMissionRequest } from '../../../packages/content/src/campaign-launch.ts';
import type { SceneLoader } from './terrain-worker-runtime.ts';
import { createPlacedStill, createPlacedViewport } from './placed-still.ts';
import { prepareMissionWorld } from './world-content-loader.ts';
import { compileEntityDefinitions } from '../../../packages/content/src/entity-definitions.ts';
import { compileVoxelPlan, VOXEL_PLAN_POLICY } from '../../../packages/content/src/voxel-plan.ts';
import { prepareVoxelPreview } from '../../../packages/content/src/voxel-preview.ts';
import { createVoxelWorldViewport } from './world-voxel-viewport.ts';
import { createWorldViewport } from './world-viewport.ts';
export const loadMissionScene:SceneLoader=async(files,profile,progress)=>{
  let verifiedBytes=0;
  const catalog=await inspectBrowserCatalog(files,{profile,policy:'tolerant',onProgress(p){progress({phase:'scan',completed:p.filesProcessed,total:p.totalFiles,bytes:p.bytesRead});},onVerifiedProgress(p){verifiedBytes=p.sessionBytesRead;progress({phase:'verify',completed:p.bytesRead,total:p.totalBytes,bytes:verifiedBytes});}});
  try{return await loadCatalogMission(catalog,{profile,missionPath:profile==='ra2'?'all01t.map':'all01umd.map',theaterIniPath:profile==='ra2'?'urban.ini':'urbannmd.ini',palettePath:profile==='ra2'?'isourb.pal':'isoubn.pal'},progress,()=>verifiedBytes);}
  finally{await catalog.dispose();}
};
/** Same preparation path for legacy opening and genuine cached campaign entry. */
export async function loadCatalogMission(catalog:BrowserCatalog,request:Omit<CampaignMissionRequest,'missionSha256'> & {readonly missionSha256?:string},progress:(p:TerrainProgress)=>void,readBytes:()=>number):ReturnType<SceneLoader>{
    const {profile,missionPath:mission,theaterIniPath,palettePath,missionSha256}=request;
    const preview=await prepareTerrainPreview(catalog,{profile,engineVersion:'webra2-m1-content-1',missionPath:mission,theaterIniPath,palettePath,variantPolicy:'base-only'},{onProgress(p){progress({phase:p.phase,completed:p.completed,total:p.total,bytes:readBytes()});}});
    if(missionSha256 && preview.terrain.source.sha256!==missionSha256)throw new Error('campaign-mission-identity');
    const content=preview.definitions.content;if(!content)throw new Error('preview-definitions-unresolved');
    const plan=compileObjectArt({objects:preview.objects,rules:content.rules,art:content.tables.art,theater:preview.theater.theater,policy:OBJECT_ART_POLICY});
    const roots=new Map<string,BrowserMemberIdentity>();
    for(const source of [...content.files.map(f=>f.source),preview.theaterSource,preview.paletteSource,...preview.assets.map(a=>a.source)]){
      const prior=roots.get(source.root.sourceId);if(prior && (prior.root.sha256!==source.root.sha256 || prior.root.size!==source.root.size))throw new Error('object-presentation-source');
      roots.set(source.root.sourceId,Object.freeze({...source,root:Object.freeze({...source.root})}));
    }
    const artwork=await prepareObjectPreview(catalog,plan,{anchors:Object.freeze([...roots.values()]),onProgress(p){progress({phase:p.phase==='verify'?'artwork':'sprites',completed:p.completed,total:p.total,bytes:readBytes()});}});
    for(const source of [...artwork.assets.map(a=>a.source),...artwork.palettes.map(p=>p.source)]){
      const prior=roots.get(source.root.sourceId);if(prior&&(prior.root.sha256!==source.root.sha256||prior.root.size!==source.root.size))throw new Error('voxel-world-source');
      roots.set(source.root.sourceId,Object.freeze({...source,root:Object.freeze({...source.root})}));
    }
    const definitions=compileEntityDefinitions({objects:preview.objects,rules:content.rules,art:content.tables.art});
    const voxelPlan=compileVoxelPlan({policy:VOXEL_PLAN_POLICY,objects:preview.objects,artPlan:plan,definitions,rules:content.rules,art:content.tables.art});
    const voxels=await prepareVoxelPreview(catalog,voxelPlan,{anchors:Object.freeze([...roots.values()]),onProgress(p){progress({phase:p.phase==='verify'?'voxel-sources':'voxels',completed:p.completed,total:p.total,bytes:readBytes()});}});
    progress({phase:'compose',completed:0,total:1,bytes:readBytes()});
    const world=await prepareMissionWorld(catalog,preview);
    const terrainScene=createTerrainScene({terrain:preview.terrain,assets:preview.assets.map(({id,sha256,bytes})=>({id,sha256,bytes})),choices:preview.choices,palette:preview.paletteRgba,projection:{tileWidth:60,tileHeight:30,elevationStep:15}},{viewportDimension:960,viewportPixels:960*640});
    const still=createPlacedStill(preview.terrain,preview.objects,artwork);
    const summary={profile,mission,contentHash:content.contentIdentity.manifestSha256,artwork:still.artwork,mapHash:terrainScene.source.sha256,paletteHash:preview.paletteSource.sha256,cells:terrainScene.allocations.cells,objects:preview.objects.placements.length,assets:terrainScene.assets.length,verifiedBytes:readBytes(),sourceBytes:terrainScene.allocations.sourceSnapshotBytes,decodedBytes:terrainScene.allocations.decodedPlaneBytes,decodedSlots:terrainScene.allocations.decodedSlots,bounds:{...terrainScene.bounds},diagnostics:[...terrainScene.diagnostics,...still.batch.atlas.diagnostics].map(d=>({...d}))};
    if(!world)summary.diagnostics.push({code:'world-unsupported-required-footprint',count:1});
    const joins=world?{modelHash:world.model.sha256,actors:world.placements.map((p,index)=>({objectId:`object-${index}`,id:p.entityId,rowId:p.rowId}))}:null;
    const base=joins?createWorldViewport(terrainScene,preview.terrain,still,joins):createPlacedViewport(terrainScene,still);
    const composed=createVoxelWorldViewport(base,preview.terrain,preview.objects,still.artwork,plan,voxels,joins);
    return {scene:composed.scene,summary:{...summary,artwork:composed.artwork},...(world?{world}:{})};
}
