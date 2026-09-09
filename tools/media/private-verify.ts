// SPDX-License-Identifier: MIT
// Metadata-only result; output PCM is explicitly private and never a public fixture.
import { readFileSync, openSync, readSync, closeSync, writeSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { RetainedDecoder, type Codec } from '../../packages/media/src/decoder.ts';
const [sample, codec, output] = process.argv.slice(2);
if (!sample || !codec || !output) throw new Error('Usage: node --import tsx tools/media/private-verify.ts PRIVATE_SAMPLE PRIVATE_CODEC PRIVATE_OUTPUT');
mkdirSync(output,{recursive:true}); const fd=openSync(sample,'r'),size=statSync(sample).size;
const {default:create}=await import(pathToFileURL(resolve(codec,'decoder.js')).href);
const core:Codec=await create({wasmBinary:readFileSync(resolve(codec,'decoder.wasm'))});
const read=(o:number,n:number)=>{const b=new Uint8Array(n);if(readSync(fd,b,0,n,o)!==n)throw new Error('short read');return b;};
const tracks=new DataView(read(0,44).buffer).getUint32(40,true), session=new RetainedDecoder(core,size,read,tracks?0:-1,null);
let frames=0,samples=0,events=0,lastAudioEnd=0,audioGaps=0;const video=createHash('sha256'),audio=createHash('sha256'),out=openSync(resolve(output,'wasm.f32'),'w'),start=performance.now();
for(;;){const event=session.next();if(!event)break;const b=new Uint8Array(event.buffer);if(event.kind==='video'){video.update(b);frames++;}else{audio.update(b);writeSync(out,b);samples+=event.samples;if(event.ticks!==lastAudioEnd)audioGaps++;lastAudioEnd=event.ticks+event.samples;}events++;}
closeSync(out);
const facts:Record<string,unknown>={identity:session.identity,header:session.header,frames,samples,events,audioGaps,io:{...session.source.stats},heap:core.HEAPU8.length,decodeMs:performance.now()-start,videoSHA256:video.digest('hex'),audioSHA256:audio.digest('hex')};
// Seek decodes forward from an explicit reset; sample positions and first displayed frame must repeat.
if(session.header.duration>10){session.seek(10);let discarded=0;for(;;){const e=session.next();if(!e)throw new Error('seek EOF');if(e.kind==='video'&&e.pts>=10){facts.seek={target:10,pts:e.pts,frameSHA256:createHash('sha256').update(new Uint8Array(e.buffer)).digest('hex'),discarded,io:{...session.source.stats}};break;}discarded++;}}
session.close();closeSync(fd);
const oracleVideo=spawnSync('ffmpeg',['-v','error','-cpuflags','0','-i',sample,'-map','0:v:0','-an','-sws_flags','bilinear+bitexact','-pix_fmt','rgba','-f','hash','-hash','sha256','-'],{encoding:'utf8'});if(oracleVideo.status!==0)throw new Error('oracle video failed');facts.oracleVideoSHA256=oracleVideo.stdout.trim().replace('SHA256=','');facts.videoExact=facts.oracleVideoSHA256===facts.videoSHA256;
if(tracks){const oracle=resolve(output,'oracle.f32');const result=spawnSync('ffmpeg',['-v','error','-cpuflags','0','-i',sample,'-map','0:a:0','-vn','-c:a','pcm_f32le','-f','f32le','-y',oracle]);if(result.status!==0)throw new Error('oracle audio failed');const a=openSync(resolve(output,'wasm.f32'),'r'),b=openSync(oracle,'r'),sizeA=statSync(resolve(output,'wasm.f32')).size,sizeB=statSync(oracle).size;let max=0,sum=0,count=0,unequal=0;const hash=createHash('sha256');for(let o=0;o<Math.min(sizeA,sizeB);o+=65536){const aa=Buffer.alloc(Math.min(65536,sizeA-o)),bb=Buffer.alloc(Math.min(65536,sizeB-o));readSync(a,aa,0,aa.length,o);readSync(b,bb,0,bb.length,o);hash.update(bb);for(let i=0;i<Math.min(aa.length,bb.length);i+=4){const d=Math.abs(aa.readFloatLE(i)-bb.readFloatLE(i));if(d!==0)unequal++;max=Math.max(max,d);sum+=d*d;count++;}}closeSync(a);closeSync(b);facts.oracleAudio={sha256:hash.digest('hex'),wasmBytes:sizeA,oracleBytes:sizeB,count,unequal,maxAbsError:max,rmsError:Math.sqrt(sum/count)};}
writeFileSync(resolve(output,'facts.json'),JSON.stringify(facts,null,2));console.log(JSON.stringify(facts,null,2));
if (!facts.videoExact) throw new Error('RGBA oracle mismatch');
const check=facts.oracleAudio as {wasmBytes:number;oracleBytes:number;maxAbsError:number}|undefined;
if (check && (check.wasmBytes!==check.oracleBytes || check.maxAbsError>1e-6)) throw new Error('PCM oracle tolerance/count mismatch');
