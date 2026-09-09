// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { inspectBrowserCatalog } from '../../../packages/vfs/src/browser-catalog.ts';
import { prepareTerrainPreview } from '../../../packages/content/src/terrain-preview.ts';
import { createTerrainScene } from '../../../packages/render/src/terrain-scene.ts';
import { attachTerrainWorker, type TerrainScope } from './terrain-worker-runtime.ts';
attachTerrainWorker(globalThis as unknown as TerrainScope, async(files,profile,progress)=>{
  let verifiedBytes=0;
  const catalog=await inspectBrowserCatalog(files,{profile,policy:'tolerant',onProgress(p){progress({phase:'scan',completed:p.filesProcessed,total:p.totalFiles,bytes:p.bytesRead});},onVerifiedProgress(p){verifiedBytes=p.sessionBytesRead;progress({phase:'verify',completed:p.bytesRead,total:p.totalBytes,bytes:verifiedBytes});}});
  try{
    const mission=profile==='ra2'?'all01t.map':'all01umd.map';
    const preview=await prepareTerrainPreview(catalog,{profile,engineVersion:'webra2-m1-content-1',missionPath:mission,theaterIniPath:profile==='ra2'?'urban.ini':'urbannmd.ini',palettePath:profile==='ra2'?'isourb.pal':'isoubn.pal',variantPolicy:'base-only'}, {onProgress(p){progress({phase:p.phase,completed:p.completed,total:p.total,bytes:verifiedBytes});}});
    progress({phase:'compose',completed:0,total:1,bytes:verifiedBytes});
    const scene=createTerrainScene({terrain:preview.terrain,assets:preview.assets.map(({id,sha256,bytes})=>({id,sha256,bytes})),choices:preview.choices,palette:preview.paletteRgba,projection:{tileWidth:60,tileHeight:30,elevationStep:15}}, {viewportDimension:960,viewportPixels:960*640});
    const summary={profile,mission,mapHash:scene.source.sha256,paletteHash:preview.paletteSource.sha256,cells:scene.allocations.cells,objects:preview.objects.placements.length,assets:scene.assets.length,verifiedBytes,sourceBytes:scene.allocations.sourceSnapshotBytes,decodedBytes:scene.allocations.decodedPlaneBytes,decodedSlots:scene.allocations.decodedSlots,bounds:{...scene.bounds},diagnostics:scene.diagnostics.map(d=>({...d}))};
    return {scene,summary};
  }finally{await catalog.dispose();}
});
