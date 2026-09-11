// SPDX-License-Identifier: GPL-3.0-or-later
// Original protocol-only geometry. Genuine retail group selection is tested separately.
import type {GpuVoxelResources} from '../../apps/web/src/gpu-voxel-protocol.ts';
export function originalVoxelResources(modelHash:string):GpuVoxelResources{
  const parts=['body','turret','barrel'].map((id,i)=>({id,voxels:new Uint8Array([0,0,0,i+1,7]),modelMatrix:[1,0,0,0,0,1,0,0,0,0,1,i]}));
  const rgba=new Uint8Array(1024);for(let i=1;i<4;i++)rgba.set([30*i,40,50,255],i*4);
  const grounds=Array.from({length:35},(_,i)=>({x:i%7+1,y:Math.floor(i/7)+1,column:i%7,row:Math.floor(i/7),elevation:0}));
  return {version:1,policy:'webra2-world-voxel-still-1',modelHash,parts,palettes:[{id:'colors',rgba,remap:null,transparentIndex:0}],grounds,
    groups:[{id:'object-1',actorId:2,initial:grounds[34]!,parts:parts.map(p=>({instanceId:'voxel-'+p.id,partId:p.id,paletteId:'colors',info:{id:'object-1',typeId:'type-1',name:'Original multipart',family:'unit',owner:'Original opponent',x:7,y:5,frame:0,format:'voxel',sourcePath:'original.vxl',sourceHash:'a'.repeat(64),palettePath:'original.pal',paletteHash:'b'.repeat(64),
      voxel:{partId:p.id,role:p.id as 'body'|'turret'|'barrel',section:0,hvaPath:'original.hva',hvaHash:'c'.repeat(64),hvaSection:0,hvaFrame:0,voxelOrdinal:0}}}))}]};
}
