// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Complete still groups; presentation data only.
import {validObjectPick,type ObjectInfo} from './object-protocol.ts';
import {WORLD_VOXEL_LIMITS,WORLD_VOXEL_POLICY} from './voxel-protocol.ts';
import {isRetiredWorldActor,type WorldSnapshot,type WorldSummary} from './world-protocol.ts';
import {sha256} from '@noble/hashes/sha2.js';

export interface GpuVoxelGround {readonly x:number;readonly y:number;readonly column:number;readonly row:number;readonly elevation:number}
export interface GpuVoxelGroup {
  readonly id:string;readonly actorId:number|null;readonly initial:GpuVoxelGround;
  readonly parts:readonly Readonly<{instanceId:string;partId:string;paletteId:string;info:ObjectInfo}>[];
}
export interface GpuVoxelResources {
  readonly version:1;readonly policy:typeof WORLD_VOXEL_POLICY;readonly modelHash:string|null;
  readonly parts:readonly Readonly<{id:string;voxels:Uint8Array;modelMatrix:readonly number[]}>[];
  readonly palettes:readonly Readonly<{id:string;rgba:Uint8Array;remap:null;transparentIndex:0}>[];
  readonly grounds:readonly GpuVoxelGround[];
  readonly groups:readonly GpuVoxelGroup[];
}
export interface GpuVoxelPlacement extends GpuVoxelGround {readonly objectId:string}
export interface GpuVoxelUpdate {readonly version:1;readonly resources:GpuVoxelResources|null;readonly placements:readonly GpuVoxelPlacement[]}
export type GpuVoxelResident=Pick<GpuVoxelResources,'modelHash'|'grounds'|'groups'>;
const groundIndexes=new WeakMap<GpuVoxelResident,ReadonlyMap<number,GpuVoxelGround>>();
const fail=():never=>{throw new Error('gpu-voxel-message');};
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length)return fail();
  const out:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))return fail();out[key]=d.value;}return out;
}
function array(value:unknown,max:number):unknown[]{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return fail();const n=Object.getOwnPropertyDescriptor(value,'length')?.value;
  if(!Number.isSafeInteger(n)||n<0||n>max||Reflect.ownKeys(value).length!==n+1)return fail();
  const out:unknown[]=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value'in d))return fail();out.push(d.value);}return out;
}
const name=(v:unknown):string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(v)?v:fail();
const integer=(v:unknown,min:number,max:number):number=>typeof v==='number'&&Number.isSafeInteger(v)&&!Object.is(v,-0)&&v>=min&&v<=max?v:fail();
const typed=Object.getPrototypeOf(Uint8Array.prototype) as object;
const typeName=Object.getOwnPropertyDescriptor(typed,Symbol.toStringTag)!.get!,byteLength=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,buffer=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,byteOffset=Object.getOwnPropertyDescriptor(typed,'byteOffset')!.get!;
const resizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
/** Borrow only actual fixed Uint8 storage until the GPU scene constructor owns it. */
function bytes(value:unknown,max:number):Uint8Array{
  try{if(!value||Object.getPrototypeOf(value)!==Uint8Array.prototype||typeName.call(value)!=='Uint8Array')return fail();
    const n=byteLength.call(value) as number,b=buffer.call(value) as ArrayBuffer,at=byteOffset.call(value) as number;
    if(n>max||Object.getPrototypeOf(b)!==ArrayBuffer.prototype||resizable?.call(b))return fail();return new Uint8Array(b,at,n);
  }catch{return fail();}
}
function ground(input:unknown):GpuVoxelGround{
  const p=record(input,['x','y','column','row','elevation']);return Object.freeze({x:integer(p.x,0,511),y:integer(p.y,0,511),
    column:integer(p.column,-1048576,1048576),row:integer(p.row,-1048576,1048576),elevation:integer(p.elevation,-1048576,1048576)});
}
function infoCopy(value:unknown,budget:{nodes:number;characters:number},depth=0):unknown{
  if(++budget.nodes>131072||depth>3)return fail();
  if(value===null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string'){budget.characters+=value.length;if(value.length>4096||budget.characters>WORLD_VOXEL_LIMITS.descriptorCharacters)return fail();return value;}
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return fail();
  const keys=Reflect.ownKeys(value);if(keys.length>32)return fail();const out:Record<string,unknown>={};
  for(const key of keys){if(typeof key!=='string'||key.length>64||key==='__proto__')return fail();const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))return fail();out[key]=infoCopy(d.value,budget,depth+1);}return Object.freeze(out);
}
/** Own metadata, validate complete joins and bound borrowed resident planes before import. */
export function captureGpuVoxelResources(input:unknown):GpuVoxelResources{
  const r=record(input,['version','policy','modelHash','parts','palettes','grounds','groups']);
  if(r.version!==1||r.policy!==WORLD_VOXEL_POLICY||(r.modelHash!==null&&(typeof r.modelHash!=='string'||!/^[a-f0-9]{64}$/.test(r.modelHash))))return fail();
  let geometryBytes=0;const partIds=new Set<string>(),paletteIds=new Set<string>();
  const parts=array(r.parts,WORLD_VOXEL_LIMITS.parts).map(value=>{
    const p=record(value,['id','voxels','modelMatrix']),id=name(p.id);if(partIds.has(id))return fail();partIds.add(id);
    const voxels=bytes(p.voxels,5*1048576-geometryBytes);geometryBytes+=voxels.byteLength;if(voxels.byteLength%5)return fail();
    const modelMatrix=array(p.modelMatrix,12);if(modelMatrix.length!==12||modelMatrix.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1048576))return fail();
    return Object.freeze({id,voxels,modelMatrix:Object.freeze(modelMatrix as number[])});
  });
  const palettes=array(r.palettes,256).map(value=>{
    const p=record(value,['id','rgba','remap','transparentIndex']),id=name(p.id),rgba=bytes(p.rgba,1024);
    if(paletteIds.has(id)||rgba.byteLength!==1024||p.remap!==null||p.transparentIndex!==0)return fail();paletteIds.add(id);
    return Object.freeze({id,rgba,remap:null,transparentIndex:0 as const});
  });
  const groundIndex=new Map<number,GpuVoxelGround>();const grounds=array(r.grounds,130816).map(value=>{
    const p=ground(value),key=p.x+p.y*512;if(groundIndex.has(key))return fail();groundIndex.set(key,p);return p;
  });
  const ids=new Set<string>(),actors=new Set<number>(),instances=new Set<string>(),budget={nodes:0,characters:0};
  const groups=array(r.groups,WORLD_VOXEL_LIMITS.placements).map(value=>{
    const g=record(value,['id','actorId','initial','parts']),id=name(g.id),initial=ground(g.initial),actorId=g.actorId===null?null:integer(g.actorId,1,Number.MAX_SAFE_INTEGER);
    const cell=groundIndex.get(initial.x+initial.y*512);if(!cell||cell.column!==initial.column||cell.row!==initial.row||cell.elevation!==initial.elevation)return fail();
    if(ids.has(id)||(actorId!==null&&actors.has(actorId))||(r.modelHash===null)!==(actorId===null))return fail();ids.add(id);if(actorId!==null)actors.add(actorId);
    const selected=new Set<string>();const parts=array(g.parts,WORLD_VOXEL_LIMITS.instances-instances.size).map(value=>{
      const p=record(value,['instanceId','partId','paletteId','info']),instanceId=name(p.instanceId),partId=name(p.partId),paletteId=name(p.paletteId);
      if(instances.has(instanceId)||selected.has(partId)||!partIds.has(partId)||!paletteIds.has(paletteId))return fail();instances.add(instanceId);selected.add(partId);
      const info=infoCopy(p.info,budget) as ObjectInfo;
      if(!validObjectPick({kind:'object',object:info,canvasX:0,canvasY:0,worldX:0,worldY:0,depth:0})||info.format!=='voxel'||info.voxel?.partId!==partId||info.id!==id||info.x!==initial.x||info.y!==initial.y)return fail();
      return Object.freeze({instanceId,partId,paletteId,info});
    });if(!parts.length)return fail();return Object.freeze({id,actorId,initial,parts:Object.freeze(parts)});
  });
  const resources=Object.freeze({version:1,policy:WORLD_VOXEL_POLICY,modelHash:r.modelHash,parts:Object.freeze(parts),palettes:Object.freeze(palettes),grounds:Object.freeze(grounds),groups:Object.freeze(groups)}) as GpuVoxelResources;
  groundIndexes.set(resources,groundIndex);return resources;
}
/** Retain only immutable descriptors after geometry/palette planes transfer to a renderer. */
export function retainGpuVoxelMetadata(resources:GpuVoxelResources):GpuVoxelResident{
  const index=groundIndexes.get(resources);if(!index)return fail();const resident=Object.freeze({modelHash:resources.modelHash,grounds:resources.grounds,groups:resources.groups});groundIndexes.set(resident,index);return resident;
}
export function captureGpuVoxelUpdate(input:unknown):GpuVoxelUpdate{
  const v=record(input,['version','resources','placements']);if(v.version!==1)return fail();
  const resources=v.resources===null?null:captureGpuVoxelResources(v.resources),ids=new Set<string>();
  const placements=array(v.placements,WORLD_VOXEL_LIMITS.placements).map(value=>{
    const p=record(value,['objectId','x','y','column','row','elevation']),objectId=name(p.objectId);if(ids.has(objectId))return fail();ids.add(objectId);
    const {objectId:_id,...at}=p;return Object.freeze({objectId,...ground(at)});
  });return Object.freeze({version:1,resources,placements:Object.freeze(placements)});
}
/** Join a complete resident grouping to each admitted snapshot. Ground is rendering metadata,
 * never navigation authority; x/y and retirement must follow the matching world actor. */
export function validateGpuVoxelWorld(resources:GpuVoxelResident,placements:readonly GpuVoxelPlacement[],summary:WorldSummary|null,world:WorldSnapshot|null):void{
  const groundIndex=groundIndexes.get(resources);if(!groundIndex)return fail();
  if(resources.modelHash!==(summary?.modelHash??null)||(summary===null)!==(world===null)||world&&world.modelHash!==resources.modelHash)return fail();
  const declared=new Map(summary?.actors.map(a=>[a.id,a])??[]),live=new Map(world?.actors.map(a=>[a.id,a])??[]),current=new Map(placements.map(p=>[p.objectId,p]));
  if(current.size!==placements.length)return fail();
  for(const group of resources.groups){
    const actor=group.actorId===null?null:live.get(group.actorId),p=current.get(group.id);
    if(group.actorId!==null&&(!actor||declared.get(group.actorId)?.objectId!==group.id))return fail();
    if(actor&&isRetiredWorldActor(actor)){if(p)return fail();continue;}
    const expected=actor??group.initial;if(!p||p.x!==expected.x||p.y!==expected.y)return fail();
    const cell=groundIndex.get(p.x+p.y*512);if(!cell||p.column!==cell.column||p.row!==cell.row||p.elevation!==cell.elevation)return fail();
    if(!actor&&(p.column!==group.initial.column||p.row!==group.initial.row||p.elevation!==group.initial.elevation))return fail();current.delete(group.id);
  }
  if(current.size)return fail();
}
/** Source continuity within this worker session, not a game-asset authenticity claim.
 * Accepts already captured metadata/planes and runs synchronously before ownership transfer. */
export function gpuVoxelResourceIdentity(value:GpuVoxelResources):string{
  if(!groundIndexes.has(value))return fail();
  const hash=sha256.create(),encode=new TextEncoder();
  hash.update(encode.encode(JSON.stringify({version:value.version,policy:value.policy,modelHash:value.modelHash,grounds:value.grounds,groups:value.groups,
    parts:value.parts.map(p=>({id:p.id,bytes:p.voxels.byteLength,matrix:p.modelMatrix.map(n=>Object.is(n,-0)?'-0':n)})),palettes:value.palettes.map(p=>p.id)})));
  for(const p of value.parts)hash.update(p.voxels);for(const p of value.palettes)hash.update(p.rgba);
  return Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');
}
