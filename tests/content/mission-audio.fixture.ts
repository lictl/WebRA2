// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic audio and source fixtures; no retail bytes.
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { cueInput, hashCueFixture } from './mission-cue.fixture.ts';
import type { MissionAudioLocator, MissionAudioPlanInput, MissionAudioSource, MissionAudioWave } from '../../packages/content/src/mission-audio-types.ts';
export const audioFixtureHash=hashCueFixture;
export function waveFixture():Uint8Array {
 const b=new Uint8Array(48),d=new DataView(b.buffer);b.set(new TextEncoder().encode('RIFF'));d.setUint32(4,40,true);b.set(new TextEncoder().encode('WAVEfmt '),8);
 d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,22050,true);d.setUint32(28,44100,true);d.setUint16(32,2,true);d.setUint16(34,16,true);
 b.set(new TextEncoder().encode('data'),36);d.setUint32(40,4,true);b.set([1,2,3,4],44);return b;
}
export function indexFixture(entries=[{name:'click',offset:0,size:4,flags:6,chunkSize:0}]):Uint8Array {
 const b=new Uint8Array(12+36*entries.length),d=new DataView(b.buffer);d.setUint32(0,0x41424147,true);d.setUint32(4,2,true);d.setUint32(8,entries.length,true);
 entries.forEach((e,i)=>{const at=12+i*36;b.set(new TextEncoder().encode(e.name),at);d.setUint32(at+16,e.offset,true);d.setUint32(at+20,e.size,true);d.setUint32(at+24,22050,true);d.setUint32(at+28,e.flags,true);d.setUint32(at+32,e.chunkSize,true);});return b;
}
export function audioFixture(profile:'ra2'|'yr'='ra2', actions=['19,7,Alert,0,0,0,0,A','20,8,March,0,0,0,0,A','21,6,Notice,0,0,0,0,A']) {
 const roots:{sourceId:string;blob:Blob}[]=[],allBytes=new Map<string,Uint8Array>();
 const locator=(path:string,bytes:Uint8Array):MissionAudioLocator=>{const sourceId='audio-'+roots.length;roots.push({sourceId,blob:new Blob([new Uint8Array(bytes)])});allBytes.set(sourceId,bytes);return {path,rootPath:path,archivePath:[],root:{sourceId,size:bytes.length,sha256:hashCueFixture(bytes)},absoluteOffset:0,size:bytes.length};};
 const source=(path:string,text:string|Uint8Array):MissionAudioSource=>{const bytes=typeof text==='string'?new TextEncoder().encode(text):text;return {...locator(path,bytes),sha256:hashCueFixture(bytes),bytes};};
 const sound=profile==='ra2'?'sound.ini':'soundmd.ini',eva=profile==='ra2'?'eva.ini':'evamd.ini',theme=profile==='ra2'?'theme.ini':'thememd.ini';
 const sources=[source(sound,'[Defaults]\nVolume=80\n[SoundList]\n9=Alert\n[Alert]\nSounds=$#click click\nControl=random loop\n'),source(eva,'[DialogList]\n2=Notice\n[Notice]\nAllied=allied\nRussian=russian\nYuri=yuri\n'),source(theme,'[Themes]\n4=March\n[March]\nSound=$#march\nNormal=no\n'),source('audio.idx',indexFixture())];
 const bagBytes=new Uint8Array([1,2,3,4]),bags=[locator('audio.bag',bagBytes)],waveCandidates:MissionAudioWave[]=[];
 for(const name of ['allied','russian','yuri','march']){const b=waveFixture();waveCandidates.push({...locator(name+'.wav',b),sha256:hashCueFixture(b)});}
 const input:MissionAudioPlanInput={cues:compileMissionCues(cueInput(profile,actions)),side:0,audioMountCandidates:[],sources,bags,waveCandidates};
 const requiredRoots=(ids:readonly string[])=>roots.filter(r=>ids.includes(r.sourceId));
 return {input,roots,source,locator,allBytes,requiredRoots};
}
export function planRoots(plan:{candidates:readonly {id:string;root:{sourceId:string}}[];selections:readonly {status:string;path:string;selected:readonly string[]}[];samples:readonly {selected:readonly string[]}[]},roots:readonly {sourceId:string;blob:Blob}[]) {
 const ids=new Set([...plan.selections.filter(s=>s.status==='selected'&&(s.path.endsWith('.ini')||s.path==='audio.idx')).flatMap(s=>s.selected),...plan.samples.flatMap(s=>s.selected)]);
 const used=new Set(plan.candidates.filter(c=>ids.has(c.id)).map(c=>c.root.sourceId));return roots.filter(r=>used.has(r.sourceId));
}
