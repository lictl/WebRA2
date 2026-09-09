// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors; Olaf van der Spek.
// Source-hashed sparse cubes, explicit unlit projection policy. See ../VOXEL_PROVENANCE.md.
import {sha256} from '@noble/hashes/sha2.js';
import {createRuntimeVxl, RUNTIME_VXL_LIMITS, type RuntimeVxl, type RuntimeVxlSection} from '../../formats/src/runtime-vxl.ts';
import {createRuntimeHva, RUNTIME_HVA_LIMITS, type RuntimeHva, type HvaLayout} from '../../formats/src/runtime-hva.ts';
import {fields,array,integer,finite,id,compare,byteSize,copy,matrix,multiply,inverse,identity,point,fail} from './voxel-math.ts';
export {VoxelRenderError} from './voxel-math.ts';
export const VOXEL_RENDER_POLICY = 'webra2-voxel-unlit-1' as const;
export const VOXEL_TRANSFORM_POLICY = 'openra-hva-bounds-scale' as const;
export const VOXEL_RENDER_LIMITS = Object.freeze({ assets:256,parts:256,sourceBytes:128*1024*1024,
  sections:2048,columns:1048576,runs:4194304,sourceVoxels:1048576,selectedVoxels:1048576,matrices:65536,
  palettes:256,instances:4096,instanceVoxels:1048576,dimension:1024,pixels:1048576,samples:64*1024*1024 });
type Limits = { -readonly [K in keyof typeof VOXEL_RENDER_LIMITS]: number };
export interface VoxelAssetInput { readonly id:string; readonly kind:'vxl'|'hva'; readonly sha256:string; readonly bytes:Uint8Array }
export interface VoxelPartInput { readonly id:string; readonly vxlAssetId:string; readonly vxlSection:number;
  readonly hva:null|Readonly<{assetId:string;layout:HvaLayout;frame:number;section:number}>;
  readonly transformPolicy:typeof VOXEL_TRANSFORM_POLICY }
export interface VoxelAtlasInput { readonly assets:readonly VoxelAssetInput[]; readonly parts:readonly VoxelPartInput[] }
export interface VoxelPartMetadata extends VoxelPartInput {
  readonly sourceSection:RuntimeVxlSection; readonly modelMatrix:readonly number[];
  readonly selectedHva:null|Readonly<{record:number;offset:number;values:readonly number[];bits:readonly number[]}>;
}
export interface VoxelAtlas {
  readonly policy:typeof VOXEL_RENDER_POLICY; readonly nativeBehaviorVerified:false;
  readonly assets:readonly Readonly<{id:string;kind:'vxl'|'hva';sha256:string;size:number}>[];
  readonly parts:readonly VoxelPartMetadata[];
  readonly allocations:Readonly<{sourceBytes:number;sourceVoxels:number;selectedVoxels:number;geometryBytes:number;columns:number;runs:number;matrices:number;sections:number}>;
  readonly diagnostics:readonly Readonly<{code:string;count:number}>[];
}
export interface VoxelPalette { readonly id:string; readonly rgba:Uint8Array; readonly remap:Uint8Array|null; readonly transparentIndex:number|null }
export interface VoxelInstance { readonly id:string; readonly partId:string; readonly paletteId:string;
  /** Three row-major affine rows: pixel X, pixel Y, and depth (greater is nearer). Includes explicit facing/position. */
  readonly modelToView:readonly number[] }
export interface VoxelFrameInput { readonly atlas:VoxelAtlas; readonly instances:readonly VoxelInstance[]; readonly palettes:readonly VoxelPalette[];
  readonly viewport:Readonly<{width:number;height:number;backgroundRgba:readonly number[]}>; readonly lighting:'unlit' }
export interface VoxelPick { readonly instanceId:string;readonly partId:string;readonly vxlAssetId:string;readonly vxlSection:number;
  readonly voxelOrdinal:number;readonly x:number;readonly y:number;readonly z:number;readonly colorIndex:number;readonly normalIndex:number;readonly depth:number }
export interface VoxelFrame { readonly policy:typeof VOXEL_RENDER_POLICY;readonly nativeBehaviorVerified:false;readonly width:number;readonly height:number;readonly rgba:Uint8Array;
  readonly allocations:Readonly<{rgbaBytes:number;privateDepthBytes:number;privateOwnerBytes:number;projectionWorkBytes:number;paletteBytes:number;instanceVoxels:number;samples:number}>;
  copyDepth():Float64Array;pick(x:number,y:number):VoxelPick|null }
function limits(value:Partial<Limits>):Limits {
  if (!value || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('voxel-limits');
  const result:Limits={...VOXEL_RENDER_LIMITS};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key!=='string'||!Object.hasOwn(result,key)) fail('voxel-limits');
    const d=Object.getOwnPropertyDescriptor(value,key)!;if(!('value'in d))fail('voxel-limits');
    integer(d.value,0,result[key as keyof Limits],'voxel-limits');result[key as keyof Limits]=d.value;
  }
  return result;
}
const digest=(bytes:Uint8Array):string=>Array.from(sha256(bytes),b=>b.toString(16).padStart(2,'0')).join('');
interface OwnedPart {metadata:VoxelPartMetadata;voxels:Uint8Array}
const atlases=new WeakMap<VoxelAtlas,{parts:Map<string,OwnedPart>;cap:Limits}>();
/** Owns selected geometry/poses. No asset name matching, normal table, animation or world-facing inference. */
export function createVoxelAtlas(input:VoxelAtlasInput,options:Partial<Limits>={}):VoxelAtlas {
  const cap=limits(options);fields(input,['assets','parts']);array(input.assets,cap.assets);array(input.parts,cap.parts);
  const sources=new Map<string,VoxelAssetInput & {size:number}>();let sourceBytes=0;
  for(const a of input.assets){
    fields(a,['id','kind','sha256','bytes']);id(a.id);
    if((a.kind!=='vxl'&&a.kind!=='hva')||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256))fail('voxel-asset');
    if(sources.has(a.id))fail('voxel-duplicate-asset');
    const size=byteSize(a.bytes,a.kind==='vxl'?802:24,16*1024*1024);sourceBytes+=size;if(sourceBytes>cap.sourceBytes)fail('voxel-source-budget');
    sources.set(a.id,{id:a.id,kind:a.kind,sha256:a.sha256,bytes:a.bytes,size});
  }
  const choices:VoxelPartInput[]=[],used=new Set<string>(),ids=new Set<string>(),aliases=new Set<string>(),layouts=new Map<string,HvaLayout>();
  for(const p of input.parts){
    fields(p,['id','vxlAssetId','vxlSection','hva','transformPolicy']);id(p.id);id(p.vxlAssetId);integer(p.vxlSection,0,255);
    if(ids.has(p.id))fail('voxel-duplicate-part');ids.add(p.id);
    if(sources.get(p.vxlAssetId)?.kind!=='vxl'||p.transformPolicy!==VOXEL_TRANSFORM_POLICY)fail('voxel-part-source');used.add(p.vxlAssetId);
    let hva:VoxelPartInput['hva']=null;
    if(p.hva!==null){
      fields(p.hva,['assetId','layout','frame','section']);id(p.hva.assetId);integer(p.hva.frame,0,4095);integer(p.hva.section,0,255);
      if(sources.get(p.hva.assetId)?.kind!=='hva'||!['frame-major','section-major'].includes(p.hva.layout))fail('voxel-hva-source');
      if(layouts.has(p.hva.assetId)&&layouts.get(p.hva.assetId)!==p.hva.layout)fail('voxel-hva-layout-conflict');
      layouts.set(p.hva.assetId,p.hva.layout);used.add(p.hva.assetId);hva=Object.freeze({assetId:p.hva.assetId,layout:p.hva.layout,frame:p.hva.frame,section:p.hva.section});
    }
    const key=JSON.stringify([p.vxlAssetId,p.vxlSection,hva]);if(aliases.has(key))fail('voxel-duplicate-selection');aliases.add(key);
    choices.push(Object.freeze({id:p.id,vxlAssetId:p.vxlAssetId,vxlSection:p.vxlSection,hva,transformPolicy:p.transformPolicy}));
  }
  if(used.size!==sources.size)fail('voxel-unused-asset');
  const vxls=new Map<string,RuntimeVxl>(),hvas=new Map<string,RuntimeHva>(),assets:VoxelAtlas['assets'][number][]=[];
  let sections=0,columns=0,runs=0,sourceVoxels=0,matrices=0;
  for(const a of sources.values()){
    const bytes=copy(a.bytes,a.size);if(digest(bytes)!==a.sha256)fail('voxel-source-identity');
    if(a.kind==='vxl'){
      const vxl=createRuntimeVxl(bytes,{sections:Math.min(RUNTIME_VXL_LIMITS.sections,cap.sections-sections),columns:cap.columns-columns,runs:cap.runs-runs,voxels:cap.sourceVoxels-sourceVoxels});
      sections+=vxl.sections.length;columns+=vxl.columnCount;runs+=vxl.runCount;sourceVoxels+=vxl.voxelCount;vxls.set(a.id,vxl);
    }else{
      const hva=createRuntimeHva(bytes,{layout:layouts.get(a.id)!},{matrices:Math.min(RUNTIME_HVA_LIMITS.matrices,cap.matrices-matrices)});matrices+=hva.matrixCount;hvas.set(a.id,hva);
    }
    assets.push(Object.freeze({id:a.id,kind:a.kind,sha256:a.sha256,size:a.size}));
  }
  let selectedVoxels=0;const metadata:VoxelPartMetadata[]=[];
  for(const p of choices){
    const s=vxls.get(p.vxlAssetId)!.sections[p.vxlSection];if(!s)fail('voxel-section');
    if(s.normalTable==='unsupported')fail('voxel-normal-table');
    selectedVoxels+=s.voxelCount;if(selectedVoxels>cap.selectedVoxels)fail('voxel-selected-budget');
    const scale=s.scale.values[0]!;if(scale<=0||scale>4096)fail('voxel-scale');
    const bounds=s.bounds.values,dimensions=[s.sizeX,s.sizeY,s.sizeZ];
    for(let k=0;k<3;k++){finite(bounds[k]);finite(bounds[k+3]);if(bounds[k+3]!<=bounds[k]!)fail('voxel-bounds');}
    const selected=p.hva===null?null:hvas.get(p.hva.assetId)!.transform(p.hva.frame,p.hva.section);
    const selectedHva=selected===null?null:Object.freeze({record:selected.record,offset:selected.offset,values:Object.freeze(Array.from(selected.values)),bits:Object.freeze(Array.from(selected.bits))});
    const pose=selectedHva===null?identity():matrix(selectedHva.values);
    // Pinned OpenRA policy: adjust HVA translation, compose bounds translation, then scale and flip Y.
    for(let k=0;k<3;k++)pose[k*4+3]=pose[k*4+3]!*scale*(bounds[k+3]!-bounds[k]!)/dimensions[k]!;
    const shift=identity();for(let k=0;k<3;k++)shift[k*4+3]=bounds[k]!;
    const scaled=identity();scaled[0]=scale;scaled[5]=-scale;scaled[10]=scale;
    const modelMatrix=multiply(scaled,multiply(pose,shift));inverse(modelMatrix);
    for(const x of [0,s.sizeX])for(const y of [0,s.sizeY])for(const z of [0,s.sizeZ])for(const value of point(modelMatrix,x,y,z))finite(value);
    metadata.push(Object.freeze({...p,sourceSection:s,modelMatrix:Object.freeze(modelMatrix),selectedHva}));
  }
  const geometry=new Map<string,Uint8Array>(),parts=new Map<string,OwnedPart>();let geometryBytes=0;
  for(const m of metadata){
    const key=m.vxlAssetId+'\0'+m.vxlSection;let voxels=geometry.get(key);
    if(!voxels){voxels=vxls.get(m.vxlAssetId)!.decodeSection(m.vxlSection).voxels;geometry.set(key,voxels);geometryBytes+=voxels.byteLength;}
    parts.set(m.id,{metadata:m,voxels});
  }
  const diagnostics=[{code:'native-voxel-rendering-unverified',count:1},{code:'normal-indices-unused-unlit',count:metadata.length},
    {code:'vxl-footer-transform-not-applied',count:metadata.length},{code:'caller-selected-hva-layout-unverified',count:metadata.filter(m=>m.hva!==null).length}].filter(d=>d.count).map(d=>Object.freeze(d));
  const atlas:VoxelAtlas=Object.freeze({policy:VOXEL_RENDER_POLICY,nativeBehaviorVerified:false,assets:Object.freeze(assets.sort((a,b)=>compare(a.id,b.id))),
    parts:Object.freeze(metadata.sort((a,b)=>compare(a.id,b.id))),allocations:Object.freeze({sourceBytes,sourceVoxels,selectedVoxels,geometryBytes,columns,runs,matrices,sections}),diagnostics:Object.freeze(diagnostics)});
  atlases.set(atlas,{parts,cap});return atlas;
}

interface OwnedPalette {rgba:Uint8Array;remap:Uint8Array|null;transparentIndex:number|null}
interface Placement {id:string;part:OwnedPart;paletteId:string;forward:number[];backward:number[];start:number;end:number}
/** Orthographic, pixel-center intersection of transformed unit cubes. Worker-intended CPU baseline. */
export function renderVoxelFrame(input:VoxelFrameInput,options:Partial<Limits>={}):VoxelFrame {
  fields(input,['atlas','instances','palettes','viewport','lighting']);const atlas=atlases.get(input.atlas);if(!atlas)fail('voxel-atlas');
  const requested=limits(options),cap={...atlas.cap};for(const key of Object.keys(cap) as (keyof Limits)[])cap[key]=Math.min(cap[key],requested[key]);
  if(input.lighting!=='unlit')fail('voxel-lighting');
  fields(input.viewport,['width','height','backgroundRgba']);const {width,height}=input.viewport;
  integer(width,1,cap.dimension);integer(height,1,cap.dimension);if(width*height>cap.pixels)fail('voxel-pixel-budget');
  array(input.viewport.backgroundRgba,4);if(input.viewport.backgroundRgba.length!==4)fail('voxel-background');
  for(const n of input.viewport.backgroundRgba)integer(n,0,255);
  const background=Array.from(input.viewport.backgroundRgba);if(background[3]!==0&&background[3]!==255)fail('voxel-alpha');
  array(input.instances,cap.instances);array(input.palettes,cap.palettes);
  const palettes=new Map<string,OwnedPalette>();let paletteBytes=0;
  for(const p of input.palettes){
    fields(p,['id','rgba','remap','transparentIndex']);id(p.id);if(palettes.has(p.id))fail('voxel-duplicate-palette');
    byteSize(p.rgba,1024,1024);if(p.remap!==null)byteSize(p.remap,256,256);if(p.transparentIndex!==null)integer(p.transparentIndex,0,255);
    paletteBytes+=1024+(p.remap===null?0:256);palettes.set(p.id,{rgba:p.rgba,remap:p.remap,transparentIndex:p.transparentIndex});
  }
  const ids=new Set<string>(),usedPalettes=new Set<string>(),placements:Placement[]=[];let instanceVoxels=0;
  for(const inst of input.instances){
    fields(inst,['id','partId','paletteId','modelToView']);id(inst.id);id(inst.partId);id(inst.paletteId);
    if(ids.has(inst.id))fail('voxel-duplicate-instance');ids.add(inst.id);
    const part=atlas.parts.get(inst.partId);if(!part||!palettes.has(inst.paletteId))fail('voxel-instance-reference');usedPalettes.add(inst.paletteId);
    const forward=multiply(matrix(inst.modelToView),part.metadata.modelMatrix),backward=inverse(forward),s=part.metadata.sourceSection;
    for(const x of [0,s.sizeX])for(const y of [0,s.sizeY])for(const z of [0,s.sizeZ])for(const value of point(forward,x,y,z))finite(value);
    instanceVoxels+=s.voxelCount;if(instanceVoxels>cap.instanceVoxels)fail('voxel-instance-budget');
    placements.push({id:inst.id,part,paletteId:inst.paletteId,forward,backward,start:0,end:0});
  }
  if(usedPalettes.size!==palettes.size)fail('voxel-unused-palette');
  placements.sort((a,b)=>compare(a.id,b.id));let ordinal=0;
  for(const p of placements){p.start=ordinal;ordinal+=p.part.metadata.sourceSection.voxelCount;p.end=ordinal;}
  for(const p of palettes.values()){
    p.rgba=copy(p.rgba,1024);p.remap=p.remap===null?null:copy(p.remap,256);
    for(let i=3;i<1024;i+=4)if(p.rgba[i]!==0&&p.rgba[i]!==255)fail('voxel-alpha');
  }
  // Four clipped integer extents per selected instance voxel. This work buffer is capped before allocation.
  const boxes=new Int32Array(instanceVoxels*4);let samples=0;
  for(const p of placements){
    const m=p.forward,v=p.part.voxels;
    const rx=(Math.abs(m[0]!)+Math.abs(m[1]!)+Math.abs(m[2]!))/2,ry=(Math.abs(m[4]!)+Math.abs(m[5]!)+Math.abs(m[6]!))/2;
    for(let i=0;i<v.length;i+=5){
      const x=v[i]!+.5,y=v[i+1]!+.5,z=v[i+2]!+.5;
      const cx=m[0]!*x+m[1]!*y+m[2]!*z+m[3]!,cy=m[4]!*x+m[5]!*y+m[6]!*z+m[7]!;
      // Closed projected extents are conservative; slab tests decide edge/transparent ownership.
      const x0=Math.max(0,Math.ceil(cx-rx-.5)),y0=Math.max(0,Math.ceil(cy-ry-.5));
      const x1=Math.min(width,Math.floor(cx+rx-.5)+1),y1=Math.min(height,Math.floor(cy+ry-.5)+1);
      const at=(p.start+i/5)*4;boxes[at]=x0;boxes[at+1]=y0;boxes[at+2]=x1;boxes[at+3]=y1;
      samples+=Math.max(0,x1-x0)*Math.max(0,y1-y0);if(samples>cap.samples)fail('voxel-sample-budget');
    }
  }
  // No image/depth/owner allocation or painting occurs before the full projected-work preflight.
  const rgba=new Uint8Array(width*height*4),depth=new Float64Array(width*height),owners=new Uint32Array(width*height);depth.fill(-Infinity);
  for(let i=0;i<rgba.length;i+=4)rgba.set(background,i);
  for(const p of placements){
    const inv=p.backward,v=p.part.voxels,palette=palettes.get(p.paletteId)!;
    const direction=[inv[2]!,inv[6]!,inv[10]!];
    for(let i=0;i<v.length;i+=5){
      const original=v[i+3]!;if(original===palette.transparentIndex)continue;
      const mapped=palette.remap===null?original:palette.remap[original]!,color=mapped*4;if(palette.rgba[color+3]===0)continue;
      const box=(p.start+i/5)*4,lo=[v[i]!,v[i+1]!,v[i+2]!];
      for(let y=boxes[box+1]!;y<boxes[box+3]!;y++)for(let x=boxes[box]!;x<boxes[box+2]!;x++){
        let far=-Infinity,near=Infinity;
        for(let axis=0;axis<3;axis++){
          const row=axis*4,origin=inv[row]!*(x+.5)+inv[row+1]!*(y+.5)+inv[row+3]!,d=direction[axis]!;
          if(d===0){if(origin<lo[axis]!||origin>=lo[axis]!+1){near=-Infinity;break;}continue;}
          const a=(lo[axis]!-origin)/d,b=(lo[axis]!+1-origin)/d;far=Math.max(far,Math.min(a,b));near=Math.min(near,Math.max(a,b));
          if(near<=far)break;
        }
        const at=y*width+x;
        if(near<=far||near<=depth[at]!)continue;
        depth[at]=near;owners[at]=p.start+i/5+1;
        const out=at*4;rgba[out]=palette.rgba[color]!;rgba[out+1]=palette.rgba[color+1]!;rgba[out+2]=palette.rgba[color+2]!;rgba[out+3]=255;
      }
    }
  }
  return Object.freeze({policy:VOXEL_RENDER_POLICY,nativeBehaviorVerified:false,width,height,rgba,
    allocations:Object.freeze({rgbaBytes:rgba.byteLength,privateDepthBytes:depth.byteLength,privateOwnerBytes:owners.byteLength,projectionWorkBytes:boxes.byteLength,paletteBytes,instanceVoxels,samples}),
    copyDepth:()=>depth.slice(),
    pick(x:number,y:number):VoxelPick|null{
      integer(x,0,width-1);integer(y,0,height-1);const at=y*width+x,owner=owners[at]!;if(!owner)return null;
      const n=owner-1;let low=0,high=placements.length;
      while(low<high){const mid=(low+high)>>>1;if(placements[mid]!.end<=n)low=mid+1;else high=mid;}
      const p=placements[low]!,ordinal=n-p.start,i=ordinal*5,v=p.part.voxels,m=p.part.metadata;
      return Object.freeze({instanceId:p.id,partId:m.id,vxlAssetId:m.vxlAssetId,vxlSection:m.vxlSection,voxelOrdinal:ordinal,
        x:v[i]!,y:v[i+1]!,z:v[i+2]!,colorIndex:v[i+3]!,normalIndex:v[i+4]!,depth:depth[at]!});
    }});
}
