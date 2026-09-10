// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic models adapted from tests/render/voxel-render.test.ts; no retail content.
import { input } from './object-art.fixture.ts';
import { compileObjectArt } from '../../packages/content/src/object-art.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileVoxelPlan, VOXEL_PLAN_POLICY } from '../../packages/content/src/voxel-plan.ts';
export { file, mix, palette, sha } from './object-art.fixture.ts';
export function voxelInput(options: { profile?: 'ra2'|'yr'; rules?: string; art?: string; ruleMods?: string[]; artMods?: string[] } = {}) {
  const i = input({ ...options, mission: '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Home\n[Home]\nCountry=Home\n[Units]\n0=Home,ROVER,256,2,2,0,Guard,None\n',
    rules: '[Countries]\n0=Home\n[VehicleTypes]\n0=ROVER\n[ROVER]\nStrength=20\n' + (options.rules ?? ''),
    art: '[ROVER]\nVoxel=yes\n' + (options.art ?? '') });
  const { objects, rules, art } = i;
  return { objects, rules, art, artPlan: compileObjectArt(i), definitions: compileEntityDefinitions({ objects, rules, art }), policy: VOXEL_PLAN_POLICY };
}
export const voxelPlan = (options: Parameters<typeof voxelInput>[0] = {}) => compileVoxelPlan(voxelInput(options));
type Cell=readonly [number,number,number,number,number];
export function vxl(cells:readonly Cell[]=[[0,0,0,1,7]],size:readonly number[]=[1,1,1],scale=1,bounds:readonly number[]=[0,0,0,...size]){
  const [sx,sy,sz]=size as [number,number,number],columns=sx*sy,rows:number[][]=[];
  for(let y=0;y<sy;y++)for(let x=0;x<sx;x++){
    const values=cells.filter(c=>c[0]===x&&c[1]===y).sort((a,b)=>a[2]-b[2]),row:number[]=[];let z=0;
    for(const c of values){row.push(c[2]-z,1,c[3],c[4],1);z=c[2]+1;}
    if(values.length&&z<sz)row.push(sz-z,0,0);rows.push(row);
  }
  const body=830,bodySize=columns*8+rows.reduce((n,r)=>n+r.length,0),footer=body+bodySize,b=new Uint8Array(footer+92),v=new DataView(b.buffer);
  b.set(new TextEncoder().encode('Voxel Animation\0'));v.setUint32(16,1,true);v.setUint32(20,1,true);v.setUint32(24,1,true);v.setUint32(28,bodySize,true);v.setUint16(32,0x1f10,true);
  b.set(new TextEncoder().encode('original'),802);v.setUint32(822,1,true);let at=columns*8;
  rows.forEach((r,i)=>{v.setInt32(body+i*4,r.length?at-columns*8:-1,true);b.set(r,body+at);at+=r.length;v.setInt32(body+columns*4+i*4,r.length?at-columns*8-1:-1,true);});
  v.setUint32(footer,0,true);v.setUint32(footer+4,columns*4,true);v.setUint32(footer+8,columns*8,true);v.setFloat32(footer+12,scale,true);
  for(const i of [0,5,10])v.setFloat32(footer+16+i*4,1,true);bounds.forEach((n,i)=>v.setFloat32(footer+64+i*4,n,true));b.set([...size,4],footer+88);
  return {bytes:b,view:v,footer,body};
}
export const affine=(x=0):number[]=>[1,0,0,x,0,1,0,0,0,0,1,0];
export function hva(matrices:readonly (readonly number[])[],frames=matrices.length,sections=1){
  const data=24+16*sections,b=new Uint8Array(data+48*matrices.length),v=new DataView(b.buffer);v.setUint32(16,frames,true);v.setUint32(20,sections,true);
  for(let i=0;i<sections;i++)b.set(new TextEncoder().encode('original'+i),24+i*16);
  matrices.forEach((m,i)=>m.forEach((n,k)=>v.setFloat32(data+48*i+4*k,n,true)));return b;
}
