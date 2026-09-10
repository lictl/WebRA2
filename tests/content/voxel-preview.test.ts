// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBrowserCatalog, type BrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { prepareVoxelPreview, isVoxelPreview } from '../../packages/content/src/voxel-preview.ts';
import { renderVoxelFrame } from '../../packages/render/src/voxel-render.ts';
import { voxelPlan, vxl, hva, affine, palette, file, mix, sha } from './voxel.fixture.ts';
const sources=(profile:'ra2'|'yr'='ra2',color=1):Record<string,Uint8Array>=>({'rover.vxl':vxl([[0,0,0,color,7]]).bytes,'rover.hva':hva([affine()]),[profile==='ra2'?'uniturb.pal':'unitubn.pal']:palette()});
async function catalog(rows:Record<string,Uint8Array>,profile:'ra2'|'yr'='ra2'){return inspectBrowserCatalog(Object.entries(rows).map(([n,b])=>file(n,b)),{profile,policy:'tolerant'});}

test('verified owned models and optional absent attachments produce reusable atlas/stable still bindings',async()=>{
  for(const profile of ['ra2','yr']as const){const c=await catalog(sources(profile),profile);try{
    const r=await prepareVoxelPreview(c,voxelPlan({profile,rules:'Turret=yes\n'}));assert.ok(isVoxelPreview(r));assert.equal(isVoxelPreview(structuredClone({...r,atlas:null})),false);
    assert.equal(r.types[0]!.status,'ready');assert.equal(r.types[0]!.bindings.filter(b=>b.status==='absent-optional').length,2);
    assert.equal(r.atlas.parts.length,1);assert.equal(r.assets.length,2);assert.equal(r.types[0]!.stillPartIds.length,1);
    const request={atlas:r.atlas,instances:[{id:'actor',partId:r.types[0]!.stillPartIds[0]!,paletteId:r.palettes[0]!.id,modelToView:[2,0,0,0,0,-2,0,0,0,0,1,0]}],
      palettes:r.palettes.map(({id,rgba,remap,transparentIndex})=>({id,rgba,remap,transparentIndex})),viewport:{width:2,height:2,backgroundRgba:[0,0,0,0]},lighting:'unlit' as const};
    const frame=renderVoxelFrame(request);assert.equal(frame.pick(0,0)!.colorIndex,1);
    r.assets.forEach(a=>a.bytes.fill(0));frame.rgba.fill(0);assert.equal(renderVoxelFrame(request).pick(0,0)!.colorIndex,1);
    assert.ok(Object.isFrozen(r.types[0]!.bindings));assert.equal(r.nativeBehaviorVerified,false);
  }finally{await c.dispose();}}
});
test('native cachemd-before-cache, direct expansions and loose assets select by source evidence',async()=>{
  const base=sources('yr',1),newer=sources('yr',2),patch=vxl([[0,0,0,3,7]]).bytes;
  for(const layer of ['nested','expansion','loose']){
    const rows:Record<string,Uint8Array>={'ra2.mix':mix({'cache.mix':mix(base)}),'ra2md.mix':mix({'cachemd.mix':mix(newer)})};
    if(layer!=='nested')rows['expandmd07.mix']=mix({'rover.vxl':patch});if(layer==='loose')rows['rover.vxl']=vxl([[0,0,0,4,7]]).bytes;
    const c=await catalog(rows,'yr');try{const r=await prepareVoxelPreview(c,voxelPlan({profile:'yr'}));
      assert.equal(r.types[0]!.status,'ready');assert.equal(r.assets.find(a=>a.path==='rover.vxl')!.sha256,sha(layer==='nested'?newer['rover.vxl']!:layer==='expansion'?patch:rows['rover.vxl']!));
      const resource=r.resources.find(r=>r.path==='rover.vxl')!;assert.equal(resource.selected.length,1);assert.ok(resource.candidates.length>=2);
    }finally{await c.dispose();}
  }
});
test('a replacement container shadows all lower copies, including members it omits',async()=>{
  const rows={'ra2.mix':mix({'cache.mix':mix(sources())}),'cache.mix':mix({'rover.hva':hva([affine()]),'uniturb.pal':palette()})};
  const c=await catalog(rows);try{const r=await prepareVoxelPreview(c,voxelPlan());assert.equal(r.types[0]!.status,'unsupported');
    const resource=r.resources.find(r=>r.path==='rover.vxl')!;assert.equal(resource.status,'missing');assert.equal(resource.candidates[0]!.mounted,false);assert.equal(resource.candidates[0]!.source,null);
  }finally{await c.dispose();}
});
test('unknown mounts, incompatible pairs and conditional models remain explicit without partial still drawing',async()=>{
  const rows=sources();rows['rover.hva']=hva([affine(),affine()],1,2);
  let c=await catalog(rows);try{const r=await prepareVoxelPreview(c,voxelPlan());assert.equal(r.types[0]!.bindings[0]!.status,'incompatible-pair');assert.equal(r.atlas.parts.length,0);}finally{await c.dispose();}
  c=await catalog({'ecache01.mix':mix(sources())});try{const r=await prepareVoxelPreview(c,voxelPlan());assert.equal(r.resources.find(r=>r.path==='rover.vxl')!.status,'unsupported-mount');}finally{await c.dispose();}
  const all={...sources(),'roverwo.vxl':vxl().bytes,'roverwo.hva':hva([affine()])};c=await catalog(all);try{
    const r=await prepareVoxelPreview(c,voxelPlan({rules:'NoSpawnAlt=yes\n'}));assert.equal(r.types[0]!.status,'unsupported');assert.ok(r.types[0]!.bindings.every(b=>b.status==='ready'));assert.deepEqual(r.types[0]!.stillPartIds,[]);
  }finally{await c.dispose();}
});
test('budgets, cancellation, reentrancy, callback errors and root continuity retain recoverable ownership',async()=>{
  const c=await catalog(sources()),p=voxelPlan();let reads=0;
  const counted:BrowserCatalog={...c,async discover(id){reads++;return c.discover(id);}};
  try{
    for(const limits of [{sourceBytes:1},{rootBytes:1},{candidates:0},{references:0},{assets:0}]){reads=0;await assert.rejects(prepareVoxelPreview(counted,p,{limits}),/limit/);assert.equal(reads,0);}
    for(const limits of [{assets:0},{parts:0},{voxels:0},{matrices:0}])await assert.rejects(prepareVoxelPreview(c,p,{limits}),/limit|budget/);
    let nested:Promise<void>|undefined;const abort=new AbortController();
    await assert.rejects(prepareVoxelPreview(c,p,{signal:abort.signal,onProgress(){nested??=assert.rejects(prepareVoxelPreview(c,p),/busy/);abort.abort();}}),{name:'AbortError'});await nested;
    await assert.rejects(prepareVoxelPreview(c,p,{onProgress(){throw Error('callback');}}),/callback/);
    const valid=await prepareVoxelPreview(c,p),source=valid.assets[0]!.source;
    await assert.rejects(prepareVoxelPreview(c,p,{anchors:[{...source,root:{...source.root,sha256:'f'.repeat(64)}}]}),/root-identity/);
    assert.equal((await prepareVoxelPreview(c,p)).types[0]!.status,'ready');
  }finally{await c.dispose();}
});
test('candidate/root/identity snapshots reject mutable sizes, boxed hashes, duplicate IDs and accessor metadata',async()=>{
  const c=await catalog(sources()),p=voxelPlan();try{
    const roots=c.report.files.map(f=>({...f})),held:{size:number}[]=[];
    const mutable:BrowserCatalog={...c,report:{...c.report,files:roots},lookup(path){const found=c.lookup(path);return{...found,candidates:found.candidates.map(v=>{const copy={...v};held.push(copy);return copy;})};},
      async discover(id){roots.forEach(r=>r.size=0);held.forEach(c=>c.size=0);return c.discover(id);}};
    assert.equal((await prepareVoxelPreview(mutable,p)).types[0]!.status,'ready');
    const corrupt:BrowserCatalog={...c,async discover(id){const r=await c.discover(id);return {...r,identity:{...r.identity,sha256:new String(r.identity.sha256) as string}};}};
    await assert.rejects(prepareVoxelPreview(corrupt,p),/metadata/);
    let invoked=false,reads=0;
    for(const mode of ['getter','duplicate']){const bad:BrowserCatalog={...c,lookup(path){const r=c.lookup(path);return{...r,candidates:r.candidates.flatMap(v=>mode==='getter'?[Object.defineProperty({...v},'size',{get(){invoked=true;return v.size;},enumerable:true})]:[v,{...v,size:1}])};},async discover(id){reads++;return c.discover(id);}};
      await assert.rejects(prepareVoxelPreview(bad,p),/metadata|candidate-identity/);assert.equal(invoked,false);assert.equal(reads,0);}
  }finally{await c.dispose();}
});

test('stale member payloads, moved identities, section IDs and actual missing paired HVA are not accepted',async()=>{
  const c=await catalog(sources()),p=voxelPlan();try{
    for(const corruption of ['hash','offset']){
      const bad:BrowserCatalog={...c,async discover(id){const r=await c.discover(id);return {...r,identity:corruption==='hash'?{...r.identity,sha256:'f'.repeat(64)}:{...r.identity,absoluteOffset:r.identity.absoluteOffset+1}};}};
      await assert.rejects(prepareVoxelPreview(bad,p),/source-hash|source-identity/);
    }
    const abort=new AbortController();await assert.rejects(prepareVoxelPreview(c,p,{signal:abort.signal,onProgress(progress){if(progress.phase==='decode')abort.abort();}}),{name:'AbortError'});
    assert.equal((await prepareVoxelPreview(c,p)).types[0]!.status,'ready');
  }finally{await c.dispose();}
  for(const mode of ['section','missing']){
    const rows=sources();if(mode==='section')new DataView(rows['rover.vxl']!.buffer).setUint32(818,2,true);else delete rows['rover.hva'];
    const c=await catalog(rows);try{const r=await prepareVoxelPreview(c,p);assert.equal(r.types[0]!.bindings[0]!.status,mode==='section'?'incompatible-pair':'missing');assert.deepEqual(r.types[0]!.stillPartIds,[]);}finally{await c.dispose();}
  }
});
test('whole-container selection includes numbered expansion replacements and rejects ambiguous metadata before I/O',async()=>{
  const rows={'ra2.mix':mix({'cache.mix':mix(sources())}),'expand05.mix':mix({'cache.mix':mix({'rover.hva':hva([affine()]),'uniturb.pal':palette()})})};
  const c=await catalog(rows),p=voxelPlan();try{
    assert.equal((await prepareVoxelPreview(c,p)).resources.find(r=>r.path==='rover.vxl')!.status,'missing');
    let reads=0;const invalid:BrowserCatalog={...c,report:{...c.report,archives:c.report.archives.map((a,i)=>i===1?{...a,parentId:a.id}:a)},async discover(id){reads++;return c.discover(id);}};
    await assert.rejects(prepareVoxelPreview(invalid,p),/ancestry/);assert.equal(reads,0);
  }finally{await c.dispose();}
});
