// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, audioWindow, binkHeader, BoundedSource, MEDIA_LIMITS, MediaQueue, validateEvent, type MediaEvent } from '../../packages/media/src/session.ts';
import { blobRange, RetainedDecoder, type Codec } from '../../packages/media/src/decoder.ts';
import { MediaClient, type Port } from '../../packages/media/src/client.ts';
function fixture(): Uint8Array { const b = new Uint8Array(100), d = new DataView(b.buffer); b.set([66,73,75,105]); for (const [o,v] of [[4,92],[8,1],[12,56],[20,2],[24,2],[28,15],[32,1]]) d.setUint32(o!, v!, true); return b; }
const header = binkHeader(fixture(),100);
function video(): MediaEvent { return { kind:'video', ticks:0,num:1,den:15,pts:0,duration:1/15,samples:0,width:2,height:2,rate:0,channels:0,buffer:new ArrayBuffer(16) }; }
test('original header fixture accepts silent Bink and rejects size/dimension/rate/track bombs', () => {
  assert.equal(header.duration,1/15);
  for(const [offset,value] of [[4,91],[8,0],[20,1025],[24,769],[28,0],[32,0],[40,9]]) { const b=fixture(); new DataView(b.buffer).setUint32(offset!,value!,true); assert.throws(()=>binkHeader(b,100)); }
  assert.throws(()=>binkHeader(fixture(),Infinity)); const b=fixture();b[3]=50;assert.throws(()=>binkHeader(b,100));
});
test('source caps ranges, prevents escape and charges failed/reentrant reads before callbacks', () => {
  const source=new BoundedSource(100,(o,n)=>new Uint8Array(n),100); assert.equal(source.read(0,44).length,44);
  assert.throws(()=>source.read(99,2)); assert.throws(()=>source.read(-1,1)); assert.throws(()=>source.read(0,32769)); assert.throws(()=>source.read(0,57));
  assert.equal(source.stats.bytes,44);
  const reentrant=new BoundedSource(100,()=>{assert.throws(()=>reentrant.read(0,100));return new Uint8Array(100);},100); reentrant.read(0,100);
  assert.throws(()=>new BoundedSource(100,()=>new Uint8Array(0)).read(0,1));
});
test('hash identity is checked with bounded reads and mismatch rejection',()=>{
  const b=fixture(); let max=0; const read=(o:number,n:number)=>{max=Math.max(max,n);return b.slice(o,o+n);};
  const hash=authenticate(b.length,read,null); assert.match(hash,/^[a-f0-9]{64}$/); assert.equal(authenticate(b.length,read,hash),hash); assert.equal(max,100);
  assert.throws(()=>authenticate(100,read,'0'.repeat(64)),/identity-mismatch/); assert.throws(()=>authenticate(100,()=>new Uint8Array(1),null),/short-read/);
});
test('authorized Blob subrange rejects escaping, oversized and fractional reads',()=>{
  const blob=new Blob([new Uint8Array(300)]), read=blobRange(blob,100,100,b=>new ArrayBuffer(b.size));
  assert.equal(read(99,1).length,1); for(const [o,n] of [[-1,1],[99,2],[0,1.5],[0,1048577]]) assert.throws(()=>read(o!,n!)); assert.throws(()=>blobRange(blob,250,100,()=>new ArrayBuffer(0)));
});
test('queue counts owned buffers and refuses unbounded growth, clearing all retained entries',()=>{
  const q=new MediaQueue(); for(let i=0;i<64;i++) q.push(video());assert.throws(()=>q.push(video()),/queue-limit/);assert.equal(q.bytes,1024);q.shift();assert.equal(q.bytes,1008);q.clear();assert.equal(q.bytes,0);assert.equal(q.length,0);
  const large={...video(),buffer:new ArrayBuffer(MEDIA_LIMITS.output)};for(let i=0;i<4;i++)q.push(large);assert.equal(q.available,false);assert.throws(()=>q.push(large));
});
test('late PCM is trimmed to content clock and never replayed from sample zero',()=>{
  assert.deepEqual(audioWindow(2,480,48000,2.005),{trim:240,count:240,start:2.005});
  assert.deepEqual(audioWindow(2,480,48000,3),{trim:480,count:0,start:2.01});assert.deepEqual(audioWindow(2,480,48000,1),{trim:0,count:480,start:2});assert.throws(()=>audioWindow(0,1,0,0));
});
test('event validator binds rational timestamps, frame shape and PCM byte lengths',()=>{
  validateEvent(video(),header);
  for(const patch of [{buffer:new ArrayBuffer(12)},{width:3},{ticks:0.5},{den:0},{pts:NaN},{kind:'other'},{duration:2}])assert.throws(()=>validateEvent({...video(),...patch} as MediaEvent,header));
  const a:MediaEvent={...video(),kind:'audio',rate:48000,channels:2,samples:480,den:48000,duration:.01,buffer:new ArrayBuffer(3840)};validateEvent(a,header);assert.throws(()=>validateEvent({...a,samples:481},header));
});
function fakeCodec():Codec & { closes:number } { const c={HEAPU8:new Uint8Array(100),closes:0,_wm_close(){c.closes++;},_wm_open(){return 0;},_wm_next(){return 0;},_wm_seek(){return 0;},_wm_data(){return 0;},_wm_bytes(){return 16;},_wm_samples(){return 0;},_wm_width(){return 2;},_wm_height(){return 2;},_wm_rate(){return 0;},_wm_channels(){return 0;},_wm_ticks(){return 0;},_wm_num(){return 1;},_wm_den(){return 15;}};return c; }
test('session rejects track/source failure with codec cleanup, and close is idempotent',()=>{
  const b=fixture(),core=fakeCodec();assert.throws(()=>new RetainedDecoder(core,100,(o,n)=>b.slice(o,o+n),0,null));assert.equal(core.closes,1);
  const c=fakeCodec(),s=new RetainedDecoder(c,100,(o,n)=>b.slice(o,o+n),-1,null);c._wm_next=()=>1;assert.equal(s.next()?.kind,'video');c._wm_next=()=>0;assert.equal(s.next(),null);s.close();s.close();assert.equal(c.closes,1);assert.throws(()=>s.next());
});
test('native failure/output bounds close session and four explicit seeks are bounded',()=>{
  const b=fixture(),c=fakeCodec(),s=new RetainedDecoder(c,100,(o,n)=>b.slice(o,o+n),-1,null);for(let i=0;i<4;i++)s.seek(0);assert.throws(()=>s.seek(0));c._wm_next=()=>-1;assert.throws(()=>s.next());assert.equal(c.closes,1);
});
class FakePort implements Port { onmessage:((e:MessageEvent)=>void)|null=null;onerror:((e:ErrorEvent)=>void)|null=null;sent:unknown[]=[];stopped=0;postMessage(r:unknown){this.sent.push(r);}terminate(){this.stopped++;} }
test('one response demand rejects concurrent commands and stop suppresses stale replies',async()=>{
  const p=new FakePort(),c=new MediaClient(p),first=c.request('open');await assert.rejects(c.request('next'),/busy/);const old=p.onmessage;c.stop();await assert.rejects(first,/cancelled/);old?.({data:{version:1,id:1,type:'ready'}} as MessageEvent);assert.equal(p.stopped,1);c.stop();assert.equal(p.stopped,1);
});
test('malformed or wrong-id worker metadata fails closed and terminates',async()=>{
  for(const value of [{version:1,id:2,type:'ready'},{version:1,id:1,type:'ready',header:{}}]){const p=new FakePort(),c=new MediaClient(p),r=c.request('open');p.onmessage?.({data:value} as MessageEvent);await assert.rejects(r);assert.equal(p.stopped,1);}
});
test('command timeout terminates worker and rejects pending call',async()=>{const p=new FakePort(),c=new MediaClient(p,5),r=c.request('next');await assert.rejects(r,/timeout/);assert.equal(p.stopped,1);});
test('queue can remove due audio/video while preserving future event order and bytes',()=>{const q=new MediaQueue();q.push(video());q.push({...video(),ticks:1,pts:1/15});q.push({...video(),ticks:2,pts:2/15});assert.equal(q.takeWhere(e=>e.ticks%2===0).length,2);assert.equal(q.bytes,16);assert.equal(q.first?.ticks,1);});
test('truncated native video, timestamp gaps and nonfinite PCM fail closed',()=>{
 const b=fixture();for(const mode of ['eof','gap']){const c=fakeCodec(),s=new RetainedDecoder(c,100,(o,n)=>b.slice(o,o+n),-1,null);if(mode==='gap'){c._wm_next=()=>1;c._wm_ticks=()=>1;}assert.throws(()=>s.next());assert.equal(c.closes,1);}
 const pcm=new Float32Array([NaN,0]);assert.throws(()=>validateEvent({...video(),kind:'audio',rate:48000,channels:2,samples:1,den:48000,duration:1/48000,buffer:pcm.buffer},header),/finite/);
});
test('boxed/extra metadata fields and invalid output payloads fail the explicit schema',async()=>{
 const p=new FakePort(),c=new MediaClient(p);const ready=c.request('open');p.onmessage?.({data:{version:1,id:1,type:'ready',header,identity:'a'.repeat(64),loadMs:1,heap:33554432,io:{bytes:1,reads:1,maximumRequest:1,seeks:0}}} as MessageEvent);await ready;
 const next=c.request('next');p.onmessage?.({data:{version:1,id:2,type:'event',event:{...video(),payload:new Blob()},decodeMs:1,heap:33554432,io:{bytes:1,reads:1,maximumRequest:1,seeks:0}}} as MessageEvent);await assert.rejects(next);assert.equal(p.stopped,1);
});
test('unreduced header frame rate normalizes to FFmpeg rational timestamps',()=>{const b=fixture(),d=new DataView(b.buffer);d.setUint32(28,225,true);d.setUint32(32,15,true);assert.deepEqual(binkHeader(b,100),header);});
