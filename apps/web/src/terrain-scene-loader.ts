// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. On-device preparation remains inside the worker.
import { inspectBrowserCatalog } from '../../../packages/vfs/src/browser-catalog.ts';
import { prepareTerrainPreview } from '../../../packages/content/src/terrain-preview.ts';
import { compileObjectArt, OBJECT_ART_POLICY } from '../../../packages/content/src/object-art.ts';
import { prepareObjectPreview } from '../../../packages/content/src/object-preview.ts';
import { createTerrainScene } from '../../../packages/render/src/terrain-scene.ts';
import type { BrowserMemberIdentity } from '../../../packages/vfs/src/browser-verified.ts';
import type { SceneLoader } from './terrain-worker-runtime.ts';
import { createPlacedStill, createPlacedViewport } from './placed-still.ts';
import { prepareMissionWorld } from './world-content-loader.ts';
import { createWorldViewport } from './world-viewport.ts';
export const loadMissionScene:SceneLoader=async(files,profile,progress)=>{
  let verifiedBytes=0;
  const catalog=await inspectBrowserCatalog(files,{profile,policy:'tolerant',onProgress(p){progress({phase:'scan',completed:p.filesProcessed,total:p.totalFiles,bytes:p.bytesRead});},onVerifiedProgress(p){verifiedBytes=p.sessionBytesRead;progress({phase:'verify',completed:p.bytesRead,total:p.totalBytes,bytes:verifiedBytes});}});
  try{
    const mission=profile==='ra2'?'all01t.map':'all01umd.map';
    const preview=await prepareTerrainPreview(catalog,{profile,engineVersion:'webra2-m1-content-1',missionPath:mission,theaterIniPath:profile==='ra2'?'urban.ini':'urbannmd.ini',palettePath:profile==='ra2'?'isourb.pal':'isoubn.pal',variantPolicy:'base-only'},{onProgress(p){progress({phase:p.phase,completed:p.completed,total:p.total,bytes:verifiedBytes});}});
    const content=preview.definitions.content;if(!content)throw new Error('preview-definitions-unresolved');
    const plan=compileObjectArt({objects:preview.objects,rules:content.rules,art:content.tables.art,theater:preview.theater.theater,policy:OBJECT_ART_POLICY});
    const roots=new Map<string,BrowserMemberIdentity>();
    for(const source of [...content.files.map(f=>f.source),preview.theaterSource,preview.paletteSource,...preview.assets.map(a=>a.source)]){
      const prior=roots.get(source.root.sourceId);if(prior && (prior.root.sha256!==source.root.sha256 || prior.root.size!==source.root.size))throw new Error('object-presentation-source');
      roots.set(source.root.sourceId,Object.freeze({...source,root:Object.freeze({...source.root})}));
    }
    const artwork=await prepareObjectPreview(catalog,plan,{anchors:Object.freeze([...roots.values()]),onProgress(p){progress({phase:p.phase==='verify'?'artwork':'sprites',completed:p.completed,total:p.total,bytes:verifiedBytes});}});
    progress({phase:'compose',completed:0,total:1,bytes:verifiedBytes});
    const world=await prepareMissionWorld(catalog,preview);
    const terrainScene=createTerrainScene({terrain:preview.terrain,assets:preview.assets.map(({id,sha256,bytes})=>({id,sha256,bytes})),choices:preview.choices,palette:preview.paletteRgba,projection:{tileWidth:60,tileHeight:30,elevationStep:15}},{viewportDimension:960,viewportPixels:960*640});
    const still=createPlacedStill(preview.terrain,preview.objects,artwork);
    const summary={profile,mission,contentHash:content.contentIdentity.manifestSha256,artwork:still.artwork,mapHash:terrainScene.source.sha256,paletteHash:preview.paletteSource.sha256,cells:terrainScene.allocations.cells,objects:preview.objects.placements.length,assets:terrainScene.assets.length,verifiedBytes,sourceBytes:terrainScene.allocations.sourceSnapshotBytes,decodedBytes:terrainScene.allocations.decodedPlaneBytes,decodedSlots:terrainScene.allocations.decodedSlots,bounds:{...terrainScene.bounds},diagnostics:[...terrainScene.diagnostics,...still.batch.atlas.diagnostics].map(d=>({...d}))};
    if(!world){summary.diagnostics.push({code:'world-unsupported-required-footprint',count:1});return {scene:createPlacedViewport(terrainScene,still),summary};}
    const joins={modelHash:world.model.sha256,actors:world.placements.map((p,index)=>({objectId:`object-${index}`,id:p.entityId,rowId:p.rowId}))};
    return {scene:createWorldViewport(terrainScene,preview.terrain,still,joins),summary,world};
  }finally{await catalog.dispose();}
};
