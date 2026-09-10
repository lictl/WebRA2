import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeMissionAudio, copyMissionAudioPcm, isMissionAudioPcm, MissionAudioDecodeError, MISSION_AUDIO_DECODE_LIMITS } from '../../packages/formats/src/mission-audio-decode.ts';
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const input = (bytes: Uint8Array, flags = 12, chunkSize = 8) => ({ kind: 'indexed' as const, bytes, expectedSha256: hash(bytes), flags, chunkSize, sampleRate: 22050 });
function ima(sample = 0, index = 0, data = [0x10,0x32,0x54,0x76]): Uint8Array {
  const out = new Uint8Array(4 + data.length); new DataView(out.buffer).setInt16(0, sample, true); out[2] = index; out.set(data,4); return out;
}
function concat(...rows: Uint8Array[]): Uint8Array { const result = new Uint8Array(rows.reduce((n,r) => n+r.length,0)); let at=0; for(const r of rows){ result.set(r,at);at+=r.length; } return result; }
function u32(value: number): Uint8Array { const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,value,true);return b; }
function chunk(tag: string, data: Uint8Array): Uint8Array { return concat(new TextEncoder().encode(tag),u32(data.length),data,...(data.length%2 ? [new Uint8Array(1)] : [])); }
function wav(data: Uint8Array, opt: {channels?:number;bits?:number;align?:number;tag?:number;fact?:number;extra?:Uint8Array; spb?:number}={}): Uint8Array {
  const {channels=1,bits=4,align=8,tag=17}=opt, fmt=new Uint8Array(tag===17?20:16), v=new DataView(fmt.buffer);
  v.setUint16(0,tag,true);v.setUint16(2,channels,true);v.setUint32(4,22050,true);v.setUint32(8,tag===1?22050*align:10000,true);v.setUint16(12,align,true);v.setUint16(14,bits,true);
  if(tag===17){v.setUint16(16,2,true);v.setUint16(18,opt.spb??1+(align-4*channels)*2/channels,true);}
  const body=concat(new TextEncoder().encode('WAVE'),chunk('fmt ',fmt),...(opt.extra?[opt.extra]:[]),...(opt.fact!==undefined?[chunk('fact',u32(opt.fact))]:[]),chunk('data',data));
  return concat(new TextEncoder().encode('RIFF'),u32(body.length),body);
}
const waveInput = (bytes:Uint8Array) => ({kind:'riff-wave' as const,bytes,expectedSha256:hash(bytes)});
const error = (code:string) => (e:unknown) => e instanceof MissionAudioDecodeError && e.code===code;

test('unsigned8 and little-endian signed16 normalize exactly and retain stereo order',()=>{
  const a=decodeMissionAudio(input(Uint8Array.of(0,128,255,64),3,0));
  assert.deepEqual([...copyMissionAudioPcm(a)],[-32768,0,32512,-16384]);assert.equal(a.channels,2);assert.equal(a.frames,2);
  const raw=Uint8Array.of(0,128,255,127,255,255,0,0), b=decodeMissionAudio(input(raw,7,0));
  assert.deepEqual([...copyMissionAudioPcm(b)],[-32768,32767,-1,0]);assert.equal(b.pcmSha256,hash(raw));
  for(const [bits,bytes,align] of [[8,Uint8Array.of(0,128,255),1],[16,raw,2]] as const){
    const c=decodeMissionAudio(waveInput(wav(bytes,{tag:1,bits,align})));
    assert.equal(c.frames,bytes.length/(bits/8));assert.equal(c.blocks,0);
  }
});
test('IMA uses additive bit rounding, low nibble first and header predictor first',()=>{
  const r=decodeMissionAudio(input(ima()));
  assert.deepEqual([...copyMissionAudioPcm(r)],[0,0,1,4,8,15,27,47,88]);
  assert.equal(r.frames,9);assert.equal(r.pcmBytes,18);assert.equal(r.blocks,1);
  // step7 nibble3 gives4; a single multiply then shift would incorrectly give6.
  assert.deepEqual([...copyMissionAudioPcm(decodeMissionAudio(input(ima(0,0,[0x33,0,0,0]))))].slice(0,3),[0,4,8]);
});
test('stereo groups are four bytes per channel and predictors reset at every block',()=>{
  const stereo=concat(ima(100,0,[]),ima(-100,0,[]),Uint8Array.of(0x11,0x11,0x11,0x11),Uint8Array.of(0x99,0x99,0x99,0x99));
  const bytes=concat(stereo,stereo), r=decodeMissionAudio(input(bytes,13,16)), pcm=copyMissionAudioPcm(r);
  assert.equal(r.frames,18);assert.equal(r.channels,2);assert.deepEqual([...pcm.slice(0,6)],[100,-100,101,-101,102,-102]);
  assert.deepEqual(pcm.slice(0,18),pcm.slice(18));
  assert.equal(decodeMissionAudio(waveInput(wav(bytes,{channels:2,align:16}))).pcmSha256,r.pcmSha256);
});
test('IMA clamps predictor and index at both ends, with all16 codes and all89 starting indices',()=>{
  const steps=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
  for(let index=0;index<89;index++)for(let code=0;code<16;code++){
    const step=steps[index]!, deltas=[Math.floor(step/8),Math.floor(step/4),Math.floor(step/2),step];
    const delta=deltas[0]!+[1,2,4].reduce((n,bit,i)=>n+((code&bit)?deltas[i+1]!:0),0), start=code&8?-32760:32760;
    const actual=copyMissionAudioPcm(decodeMissionAudio(input(ima(start,index,[code,0,0,0]))))[1];
    assert.equal(actual,Math.max(-32768,Math.min(32767,start+(code&8?-delta:delta))));
  }
  assert.deepEqual([...copyMissionAudioPcm(decodeMissionAudio(input(ima(32760,88,[0x77,0xff,0x77,0xff]))))].slice(0,5),[32760,32767,32767,-28669,-32768]);
});
test('aligned short last blocks and predictor-only blocks are exact; incomplete groups fail closed',()=>{
  const full=ima(5,10,[0,0,0,0,0,0,0,0]), last=ima(-5,10), r=decodeMissionAudio(input(concat(full,last),12,12));
  assert.equal(r.frames,26);assert.equal(r.partialFinalBlockBytes,8);assert.equal(copyMissionAudioPcm(r)[17],-5);
  assert.equal(decodeMissionAudio(input(ima(1,0,[]),12,8)).frames,1);
  for(const tail of [1,2,3,5,6,7])assert.throws(()=>decodeMissionAudio(input(new Uint8Array(tail))),error('audio-ima-partial-group'));
  assert.throws(()=>decodeMissionAudio(input(concat(ima(),new Uint8Array(1)))),error('audio-ima-partial-group'));
  assert.throws(()=>decodeMissionAudio(input(concat(ima(0,0,[]),ima(0,0,[]),new Uint8Array(4)),13,16)),error('audio-ima-partial-group'));
});
test('RIFF fact is retained without trimming decoded padding; conflicting counts and formats reject',()=>{
  const r=decodeMissionAudio(waveInput(wav(ima(),{fact:5,extra:chunk('JUNK',Uint8Array.of(1))})));
  assert.equal(r.frames,9);assert.equal(r.riff?.factFrames,5);assert.equal(r.riff?.ignoredFactPaddingFrames,4);assert.equal(r.riff?.unknownChunks,1);
  for(const fact of [0,10])assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{fact}))),error('audio-riff-fact-count'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(concat(ima(),ima()),{fact:9}))),error('audio-riff-fact-count'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{spb:10}))),error('audio-ima-samples-per-block'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{bits:3}))),error('audio-ima-format'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{tag:2}))),error('audio-unsupported-format'));
  const extra=wav(ima());new DataView(extra.buffer).setUint16(36,4,true);assert.throws(()=>decodeMissionAudio(waveInput(extra)),error('audio-riff-format-extension'));
});
test('RIFF duplicate/truncated/range and PCM framing errors cannot yield partial output',()=>{
  const good=wav(ima());
  for(const length of [1,11,13,19,good.length-1])assert.throws(()=>decodeMissionAudio(waveInput(good.slice(0,length))));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{extra:chunk('data',ima())}))),error('audio-riff-data'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima(),{fact:9,extra:chunk('fact',u32(9))}))),error('audio-riff-fact'));
  const range=good.slice();new DataView(range.buffer).setUint32(16,0xffffffff,true);assert.throws(()=>decodeMissionAudio(waveInput(range)),error('audio-riff-chunk-range'));
  assert.throws(()=>decodeMissionAudio(input(Uint8Array.of(1,2,3),7,0)),error('audio-pcm-partial-frame'));
});
test('bounded preflight rejects source mismatch, malformed final headers and every lower-only resource cap',()=>{
  assert.throws(()=>decodeMissionAudio({...input(ima()),expectedSha256:'0'.repeat(64)}),error('audio-source-mismatch'));
  const bad=ima();bad[3]=1;assert.throws(()=>decodeMissionAudio(input(concat(ima(),bad))),error('audio-ima-header'));
  bad[3]=0;bad[2]=89;assert.throws(()=>decodeMissionAudio(input(bad)),error('audio-ima-header'));
  assert.throws(()=>decodeMissionAudio(input(ima()),{inputBytes:7}),error('audio-input-limit'));
  assert.throws(()=>decodeMissionAudio(input(ima()),{pcmBytes:17}),error('audio-pcm-limit'));
  assert.throws(()=>decodeMissionAudio(input(ima()),{blocks:0}),error('audio-block-limit'));
  assert.throws(()=>decodeMissionAudio(input(ima()),{workUnits:16}),error('audio-work-limit'));
  assert.throws(()=>decodeMissionAudio(waveInput(wav(ima())),{riffChunks:1}),error('audio-riff-chunk-limit'));
  for(const key of Object.keys(MISSION_AUDIO_DECODE_LIMITS))assert.throws(()=>decodeMissionAudio(input(ima()),{[key]:Infinity}),error('audio-limits'));
  for(const flags of [0,1,4,5,8,9,10,11,14,15,16,-1])assert.throws(()=>decodeMissionAudio(input(ima(),flags)),error('audio-index-flags'));
  assert.throws(()=>decodeMissionAudio(input(ima(),12,6)),error('audio-ima-block-align'));
  assert.throws(()=>decodeMissionAudio(input(Uint8Array.of(1),2,8)),error('audio-index-pcm-chunk-size'));
  assert.throws(()=>decodeMissionAudio(input(new Uint8Array(0))),error('audio-input-limit'));
});
test('input metadata and bytes are owned through descriptors; typed proxies/shared/resizable buffers are refused',()=>{
  const bytes=ima(), original=input(bytes), row=new Proxy(original,{get(){throw Error('no getters');}});
  const r=decodeMissionAudio(row,new Proxy({pcmBytes:18},{get(){throw Error('no getters');}}));
  bytes.fill(255);assert.equal(copyMissionAudioPcm(r)[0],0);assert.ok(Object.isFrozen(r));assert.ok(isMissionAudioPcm(r));
  const copied=copyMissionAudioPcm(r);copied.fill(123);assert.equal(copyMissionAudioPcm(r)[0],0);
  assert.equal(isMissionAudioPcm({...r}),false);assert.equal(isMissionAudioPcm(new Proxy(r,{})),false);
  assert.throws(()=>copyMissionAudioPcm({...r}),error('audio-pcm-brand'));
  for(const field of ['kind','bytes','expectedSha256','flags','sampleRate','chunkSize']){
    const x=input(ima());Object.defineProperty(x,field,{get(){throw Error('must not call');}});assert.throws(()=>decodeMissionAudio(x),error('audio-input'));
  }
  assert.throws(()=>decodeMissionAudio({...input(ima()),bytes:new Proxy(ima(),{})}),error('audio-input-type'));
  assert.throws(()=>decodeMissionAudio(input(new Uint8Array(new SharedArrayBuffer(8)))),error('audio-input-buffer'));
  assert.throws(()=>decodeMissionAudio(input(new Uint8Array(Reflect.construct(ArrayBuffer,[8,{maxByteLength:16}])))),error('audio-input-buffer'));
  const hostile=new Proxy(input(ima()),{ownKeys(){throw Error('trap');}});assert.throws(()=>decodeMissionAudio(hostile),error('audio-input'));
});
