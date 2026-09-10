// SPDX-License-Identifier: GPL-3.0-or-later
// Original metadata/pixel fixtures test application plumbing; real codec pixels have separate component/private gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainController, canPick } from '../../apps/web/src/terrain-controller.ts';
import { TerrainBridge,type TerrainPort } from '../../apps/web/src/terrain-bridge.ts';
import { attachTerrainWorker,type TerrainScope } from '../../apps/web/src/terrain-worker-runtime.ts';
import { centered,validResult,validAction,validProgress,type SceneSummary,type TerrainAction,type TerrainResult,type FrameResult,type TerrainReply,type Camera } from '../../apps/web/src/terrain-protocol.ts';
import { terrainText } from '../../apps/web/src/terrain-i18n.ts';
import type { ViewportScene } from '../../apps/web/src/terrain-worker-runtime.ts';
const artwork={policy:'webra2-object-still-2' as const,presentation:'webra2-placed-still-1' as const,voxel:null,types:0,rendered:0,unavailable:0,assets:0,palettes:0,sourceBytes:0,decodedBytes:0,indexedFrames:0,rows:[],omittedTypes:0,omittedPlacements:0,omittedRendered:0,truncatedFields:0,unplaced:0};
const summary:SceneSummary={world:null,contentHash:'c'.repeat(64),artwork,profile:'ra2',mission:'all01t.map',mapHash:'a'.repeat(64),paletteHash:'b'.repeat(64),cells:3,objects:0,assets:1,verifiedBytes:100,sourceBytes:100,decodedBytes:50,decodedSlots:1,bounds:{x:0,y:0,width:120,height:45},diagnostics:[{code:'native-composition-unverified',count:1}]};
const view:Camera={cameraX:0,cameraY:0,zoom:1,width:120,height:45};
function frame(frameId=1,camera=view):FrameResult{const bytes=camera.width*camera.height*4;return {type:'frame',world:null,frameId,camera,summary:structuredClone(summary),allocations:{voxel:null,rgbaBytes:bytes,depthBytes:bytes,ownerBytes:bytes,totalPixelBytes:bytes*4,samples:1,objectOwnerBytes:bytes,spriteSamples:0,paletteBytes:0,objects:0},rgba:new ArrayBuffer(bytes)};}
const selected=()=>[new File(['original asset bytes'],'sample.mix')];
const load:TerrainAction={type:'load',profile:'ra2',files:[{file:selected()[0]!,relativePath:'game/sample.mix'}],width:120,height:45};
const tick=async()=>{await new Promise<void>(resolve=>setImmediate(resolve));};
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
class FakeWorker extends EventTarget{sent:unknown[]=[];terminated=0;postMessage(v:unknown){this.sent.push(v);}terminate(){this.terminated++;}emit(v:unknown){this.dispatchEvent(new MessageEvent('message',{data:structuredClone(v)}));}}
function port(){const calls:{action:TerrainAction;response:ReturnType<typeof deferred<TerrainResult>>;signal:AbortSignal}[]=[];let disposed=0;const value:TerrainPort={request(action,signal){const response=deferred<TerrainResult>();calls.push({action,response,signal});return response.promise;},dispose(){disposed++;}};return {value,calls,get disposed(){return disposed;}};}

test('metadata validation rejects sparse/extra/boxed data, oversized buffers and mismatched pixel allocations',()=>{
  assert.ok(validResult(frame()));assert.ok(validAction(load));assert.equal(validAction({...load,width:961}),false);
  assert.equal(validResult({...frame(),rgba:new ArrayBuffer(4)}),false);assert.equal(validResult({...frame(),allocations:{...frame().allocations,totalPixelBytes:4}}),false);
  const sparse=frame();sparse.summary.diagnostics=Array(1);assert.equal(validResult(sparse),false);
  const extra=frame();Object.assign(extra.summary.diagnostics,{payload:new Blob(['extra'])});assert.equal(validResult(extra),false);
  assert.equal(validResult({...frame(),summary:{...summary,cells:new Number(3)}}),false);
  assert.equal(validProgress({phase:new String('scan'),completed:0,total:1,bytes:0}),false);
  assert.equal(validProgress({phase:'scan',completed:2,total:1,bytes:0}),false);
  const accessor=frame();Object.defineProperty(accessor.summary,'mapHash',{get(){throw Error('must not call');}});assert.equal(validResult(accessor),false);
  const buffer=frame();Object.assign(buffer.rgba,{payload:new Blob(['extra'])});assert.equal(validResult(buffer),false);
});
test('bridge admits one request, validates progress and binds result/pick to exact request and displayed frame',async()=>{
  const worker=new FakeWorker(),bridge=new TerrainBridge(worker),signal=new AbortController().signal,progress:number[]=[];
  const first=bridge.request(load,signal,p=>progress.push(p.completed));await assert.rejects(bridge.request(load,signal),/unavailable/);
  worker.emit({version:4,id:99,type:'result',result:frame(99)});worker.emit({version:4,id:1,type:'progress',sequence:1,progress:{phase:'scan',completed:1,total:2,bytes:10}});
  assert.equal(worker.sent.length,2);assert.deepEqual(progress,[1]);worker.emit({version:4,id:1,type:'result',result:frame(1)});assert.equal((await first).type,'frame');
  const picking=bridge.request({type:'pick',frameId:1,x:2,y:2},signal);worker.emit({version:4,id:2,type:'result',result:{type:'pick',frameId:1,selection:null}});assert.deepEqual(await picking,{type:'pick',frameId:1,selection:null});
  const rendering=bridge.request({type:'render',camera:{...view,cameraX:32}},signal);worker.emit({version:4,id:3,type:'result',result:frame(3)});await assert.rejects(rendering,/invalid/);assert.equal(worker.terminated,1);
});
test('bridge rejects cross-profile metadata, stale pick identity and malformed terminal shape; abort terminates promptly',async()=>{
  for(const invalid of [{...frame(),frameId:2},{...frame(),summary:{...summary,profile:'yr',mission:'all01umd.map'}},{...frame(),summary:{...summary,diagnostics:[null]}}]){const worker=new FakeWorker(),bridge=new TerrainBridge(worker),promise=bridge.request(load,new AbortController().signal);worker.emit({version:4,id:1,type:'result',result:invalid});await assert.rejects(promise,/invalid/);assert.equal(worker.terminated,1);}
  const worker=new FakeWorker(),bridge=new TerrainBridge(worker),abort=new AbortController();const promise=bridge.request(load,abort.signal);abort.abort();await assert.rejects(promise,{name:'AbortError'});worker.emit({version:4,id:1,type:'result',result:frame()});assert.equal(worker.terminated,1);
});
test('controller cancels long preparation, retains selection, ignores late completion and retries with a fresh worker',async()=>{
  const ports:ReturnType<typeof port>[]=[];const controller=new TerrainController('en',()=>{const p=port();ports.push(p);return p.value;});controller.select(selected());const loading=controller.load();controller.cancel();assert.equal(controller.state.phase,'cancelled');assert.equal(controller.state.files,1);assert.ok(ports[0]!.calls[0]!.signal.aborted);
  ports[0]!.calls[0]!.response.resolve(frame());await loading;assert.equal(controller.state.frame,null);
  const retry=controller.load();ports[1]!.calls[0]!.response.resolve(frame());await retry;assert.equal(controller.state.phase,'ready');controller.dispose();assert.ok(ports.every(p=>p.disposed>=1));
});
test('camera requests coalesce; outdated pixels and picks are never published for the displayed frame',async()=>{
  const p=port(),controller=new TerrainController('en',()=>p.value);controller.resize(120,45);controller.select(selected());const loading=controller.load();p.calls[0]!.response.resolve(frame());await loading;
  controller.pan(10,0);controller.pan(20,0);controller.pan(30,0);assert.equal(p.calls.length,2);assert.equal(controller.state.busy,true);
  p.calls[1]!.response.resolve(frame(2,{...view,cameraX:10}));await tick();assert.equal(controller.state.frame!.frameId,1);assert.equal(p.calls.length,3);assert.deepEqual(p.calls[2]!.action,{type:'render',camera:{...view,cameraX:60}});
  p.calls[2]!.response.resolve(frame(3,{...view,cameraX:60}));await tick();assert.equal(controller.state.frame!.frameId,3);assert.equal(controller.state.busy,false);
  const picking=controller.pick(1,1);controller.pan(4,0);p.calls[3]!.response.resolve({type:'pick',frameId:3,selection:{kind:'terrain',cell:{sourceRecord:0,x:1,y:2,assetId:'tile',subtile:0,worldX:61,worldY:1,depth:0}}});await picking;
  assert.equal(controller.state.selection,null);assert.equal(p.calls.length,5);assert.equal(p.calls[4]!.action.type,'render');controller.cancel();p.calls[4]!.response.resolve(frame(5));await tick();assert.equal(controller.state.frame,null);
});
test('resize during load is bounded/coalesced, source failure recovers, profile replacement releases scene',async()=>{
  const ports:ReturnType<typeof port>[]=[];const controller=new TerrainController('en',()=>{const p=port();ports.push(p);return p.value;});controller.select(selected());const bad=controller.load();ports[0]!.calls[0]!.response.reject(new Error('preview-missing-asset'));await bad;assert.equal(controller.state.phase,'failed');assert.equal(controller.state.files,1);
  const good=controller.load();controller.resize(20000,20000);controller.resize(320,240);ports[1]!.calls[0]!.response.resolve(frame(1,centered(summary,960,640)));await good;assert.deepEqual(ports[1]!.calls[1]!.action,{type:'render',camera:centered(summary,320,240)});
  ports[1]!.calls[1]!.response.resolve(frame(2,centered(summary,320,240)));await tick();assert.equal(controller.state.frame!.camera.width,320);controller.setProfile('yr');assert.equal(controller.state.frame,null);assert.equal(controller.state.phase,'selected');assert.equal(ports[1]!.disposed,1);
  controller.select({length:4097,get 0(){throw Error('must not copy');}} as unknown as ArrayLike<File>);assert.equal(controller.state.notice,'tooMany');assert.equal(controller.state.files,0);
});
function fakeScene():ViewportScene{return {render(viewport){const bytes=viewport.width*viewport.height*4,rgba=new Uint8Array(bytes).fill(17);return {rgba,viewport,allocations:{voxel:null,rgbaBytes:bytes,depthBytes:bytes,ownerBytes:bytes,totalPixelBytes:bytes*4,samples:1,objectOwnerBytes:bytes,spriteSamples:0,paletteBytes:0,objects:0},pick(x,y){return {kind:'terrain',cell:{sourceRecord:0,x:1,y:2,assetId:'tile',subtile:0,worldX:viewport.cameraX+x/viewport.zoom,worldY:viewport.cameraY+y/viewport.zoom,depth:0}};}};}} as ViewportScene;}
test('worker retains scene/picking, transfers only bounded RGBA, preserves explicit folder paths and progress backpressure',async()=>{
  const messages:TerrainReply[]=[],ready=deferred<{scene:ViewportScene;summary:SceneSummary}>();let inheritedPath='';
  const scope:TerrainScope={onmessage:null,postMessage(message,transfer){messages.push(structuredClone(message,{transfer:transfer??[]}));}};
  attachTerrainWorker(scope,async(files,_profile,progress)=>{inheritedPath=files[0]!.webkitRelativePath;progress({phase:'scan',completed:1,total:3,bytes:10});progress({phase:'scan',completed:2,total:3,bytes:20});progress({phase:'scan',completed:3,total:3,bytes:30});return ready.promise;});
  scope.onmessage!({data:structuredClone({version:4,id:1,action:load})});assert.equal(inheritedPath,'game/sample.mix');assert.equal(messages.length,1);
  scope.onmessage!({data:{version:4,id:1,type:'ack',sequence:1}});assert.equal(messages.length,2);assert.equal((messages[1] as {progress:{completed:number}}).progress.completed,3);
  ready.resolve({scene:fakeScene(),summary});await tick();const result=messages.at(-1)!;assert.equal(result.type,'result');if(result.type!=='result'||result.result.type!=='frame')assert.fail();assert.ok(validResult(result.result));assert.equal(result.result.rgba.byteLength,120*45*4);
  scope.onmessage!({data:{version:4,id:2,action:{type:'pick',frameId:1,x:30,y:10}}});await tick();assert.equal(messages.at(-1)!.type,'result');
  scope.onmessage!({data:{version:4,id:3,action:{type:'render',camera:view}}});await tick();scope.onmessage!({data:{version:4,id:4,action:{type:'pick',frameId:1,x:30,y:10}}});await tick();assert.deepEqual(messages.at(-1),{version:4,id:4,type:'error',code:'stale-frame'});
});
test('worker rejects malformed actions and failed preparation without exposing exception text or partial scene',async()=>{
  const messages:TerrainReply[]=[],scope:TerrainScope={onmessage:null,postMessage(m){messages.push(m);}};let attempts=0;
  attachTerrainWorker(scope,async()=>{attempts++;throw new Error('/private/path with data');});
  scope.onmessage!({data:{version:4,id:1,action:{...load,width:961}}});await tick();assert.equal(attempts,0);assert.equal(messages.at(-1)!.type,'error');
  scope.onmessage!({data:{version:4,id:2,action:load}});await tick();assert.deepEqual(messages.at(-1),{version:4,id:2,type:'error',code:'unavailable'});
  scope.onmessage!({data:{version:4,id:3,action:{type:'render',camera:view}}});await tick();assert.equal(messages.at(-1)!.type,'error');
});
test('every original terrain UI state has English and Traditional Chinese copy, including prototype-name fallback',()=>{
  for(const locale of ['en','zh-Hant'] as const)for(const key of ['choose','selected','loading','ready','rendering','picking','picked','background','cancelled','failure','tooMany','scan','verify','definitions','mission','theater','tiles','compose','constructor','__proto__'])assert.equal(typeof terrainText(locale,key),'string');
  assert.match(terrainText('zh-Hant','cancelled'),/取消/);assert.match(terrainText('en','scope'),/mission behavior/);
});

test('a fast second click cannot move the marker while the first pick owns the request',async()=>{
  const p=port(),controller=new TerrainController('en',()=>p.value);controller.resize(120,45);controller.select(selected());const loading=controller.load();p.calls[0]!.response.resolve(frame());await loading;
  let marker:[number,number]|null=null;const click=(x:number,y:number)=>{if(!canPick(controller.state,x,y))return;marker=[x,y];void controller.pick(x,y);};
  click(10,10);click(60,20);assert.deepEqual(marker,[10,10]);assert.equal(p.calls.length,2);assert.equal(canPick(controller.state,60,20),false);
  p.calls[1]!.response.resolve({type:'pick',frameId:1,selection:{kind:'terrain',cell:{sourceRecord:0,x:1,y:2,assetId:'tile',subtile:0,worldX:10,worldY:10,depth:0}}});await tick();assert.deepEqual(marker,[10,10]);assert.equal(controller.state.selection?.kind,'terrain');assert.equal(controller.state.selection?.kind==='terrain' && controller.state.selection.cell.worldX,10);
  click(-1,10);assert.deepEqual(marker,[10,10]);controller.dispose();
});
