// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../MISSION_AUDIO_PROVENANCE.md.
import { cueBytes, cueFingerprint, cueFreeze, cueHash, cueInteger, cueList, cueRecord } from './mission-cue-types.ts';
import { MISSION_AUDIO_LIMITS, audioFail, type MissionAudioCandidate, type MissionAudioField,
  type MissionAudioLimits, type MissionAudioLocator, type MissionAudioSelection } from './mission-audio-types.ts';
export { cueBytes as audioBytes, cueFingerprint as audioFingerprint, cueFreeze as audioFreeze,
  cueHash as audioHash, cueInteger as audioInteger, cueList as audioList, cueRecord as audioRecord };
export const audioFold = (v: string): string => v.replace(/[A-Z]/g, c => c.toLowerCase());
export const audioTrim = (v: string): string => v.replace(/^[ \t]+|[ \t]+$/g, '');
export function audioSha(v: unknown): string { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) audioFail('sha256'); return v; }
export function audioPath(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-z0-9_][a-z0-9_.-]{0,127}$/.test(v) || v.includes('..')) audioFail('path'); return v;
}
export function audioCaps(raw: Partial<MissionAudioLimits>): MissionAudioLimits {
  if (!raw || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) audioFail('limits');
  const caps: { -readonly [K in keyof MissionAudioLimits]: number } = { ...MISSION_AUDIO_LIMITS };
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== 'string' || !Object.hasOwn(caps, key)) audioFail('limit');
    const d = Object.getOwnPropertyDescriptor(raw, key)!; if (!('value' in d)) audioFail('limit');
    const k = key as keyof MissionAudioLimits; caps[k] = cueInteger(d.value, caps[k]);
  }
  return caps;
}
export const LOCATOR_KEYS = ['path','rootPath','archivePath','root','absoluteOffset','size'] as const;
export function audioLocator(r: Record<string, unknown>): MissionAudioLocator {
  const root = cueRecord(r.root, ['sourceId','size','sha256']);
  if (typeof root.sourceId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(root.sourceId)) audioFail('source-id');
  const size = cueInteger(r.size, 1024 ** 3, 1), absoluteOffset = cueInteger(r.absoluteOffset, Number.MAX_SAFE_INTEGER);
  const rootSize = cueInteger(root.size, 8 * 1024 ** 3, 1);
  if (absoluteOffset > rootSize || size > rootSize - absoluteOffset) audioFail('range');
  const path = audioPath(r.path), rootPath = audioPath(r.rootPath);
  const archivePath = cueList(r.archivePath, 8).map(audioPath);
  if (archivePath.some(p => !p.endsWith('.mix'))) audioFail('archive-path');
  if (!rootPath.endsWith('.mix') && (rootPath !== path || archivePath.length || absoluteOffset || size !== rootSize)) audioFail('loose-range');
  return { path, rootPath, archivePath, root: { sourceId:root.sourceId, size:rootSize, sha256:audioSha(root.sha256) }, absoluteOffset, size };
}
/** Session handles are audit locators, never durable content identity. */
export function audioDurable<T>(value: T): unknown {
  if (Array.isArray(value)) return value.map(audioDurable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'sourceId').map(([k,v]) => [k,audioDurable(v)]));
  return value;
}
export function audioCandidateId(v: MissionAudioLocator): string {
  return cueFingerprint(audioDurable(v), 4096);
}
function family(c: MissionAudioCandidate, profile: 'ra2'|'yr'): { group:string; order:number } | null {
  if (c.rootPath === c.path && !c.archivePath.length) return {group:'loose',order:0};
  if (c.archivePath.some(n => !/^(?:local|localmd|cache|cachemd|speech|speechmd|language|langmd|audio|audiomd)\.mix$/.test(n))) return null;
  const n = c.rootPath;
  if (n === 'language.mix') return {group:'language',order:0};
  if (n === 'langmd.mix' && profile === 'yr') return {group:'language',order:1};
  const exp = (profile === 'ra2' ? /^expand(\d{2})\.mix$/ : /^expandmd(\d{2})\.mix$/).exec(n);
  if (exp) return {group:'game',order:100+Number(exp[1])};
  if (n === 'ra2.mix') return {group:'game',order:0};
  if (n === 'ra2md.mix' && profile === 'yr') return {group:'game',order:1};
  return null;
}
export function audioSelect(path:string, all: readonly MissionAudioCandidate[], profile:'ra2'|'yr', mounts:readonly MissionAudioLocator[]): MissionAudioSelection {
  const list = all.filter(c=>c.path===path), candidates=list.map(c=>c.id), reasons:string[]=[];
  if (!list.length) return {path,status:'missing',candidates,selected:[],reasons:['missing-resource']};
  const loose = list.filter(c=>family(c,profile)?.group==='loose');
  let unlistedMount=false;
  const active = list.filter(c=>{
    const at=c.archivePath.findIndex(n=>n==='audio.mix'||n==='audiomd.mix');if(at<0)return true;
    const matches=(mount:MissionAudioLocator)=>c.archivePath[at]===mount.path && c.rootPath===mount.rootPath && c.root.sha256===mount.root.sha256 &&
      c.root.size===mount.root.size && JSON.stringify(c.archivePath.slice(0,at))===JSON.stringify(mount.archivePath) &&
      c.absoluteOffset>=mount.absoluteOffset && c.size<=mount.size-(c.absoluteOffset-mount.absoluteOffset);
    if(!all.some(m=>['audio.mix','audiomd.mix'].includes(m.path)&&matches(m)))unlistedMount=true;
    return mounts.some(matches);
  });
  if(unlistedMount&&!loose.length)return {path,status:'unsupported',candidates,selected:[],reasons:['unlisted-audio-mount']};
  const options = loose.length ? loose : active;
  if(!options.length)return {path,status:'unsupported',candidates,selected:[],reasons:['inactive-or-unproven-audio-mount']};
  const ranks=options.map(c=>family(c,profile));
  if (ranks.some(r=>r===null) || new Set(ranks.map(r=>r?.group)).size!==1) reasons.push('unsupported-mount-precedence');
  if (reasons.length) return {path,status:'unsupported',candidates,selected:[],reasons};
  const best=Math.max(...ranks.map(r=>r!.order));
  const winners=options.filter((_,i)=>ranks[i]!.order===best);
  // Equal-tier roots with equal payload hashes are equivalent. A bank has no full member hash.
  const identities = new Set(winners.map(c=>c.sha256 ? `${c.size}:${c.sha256}` : `${c.root.sha256}:${c.absoluteOffset}:${c.size}`));
  if (identities.size!==1) reasons.push('ambiguous-resource');
  return {path,status:reasons.length?'unsupported':'selected',candidates,selected:reasons.length?[]:winners.map(c=>c.id),reasons};
}
export interface AudioIniSection { readonly name:string; readonly fields:readonly MissionAudioField[]; readonly duplicate:boolean }
// Native INI name CRC, with case preserved. The final partial four-byte block has
// a remainder byte followed by its first byte. No retail lookup table is copied.
function iniNameCrc(name:string):number {
  const bytes=new Uint8Array(Math.ceil(name.length/4)*4);
  for(let i=0;i<name.length;i++)bytes[i]=name.charCodeAt(i);
  const rem=name.length%4;if(rem){bytes[name.length]=rem;bytes.fill(bytes[name.length-rem]!,name.length+1);}
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export function audioIni(bytes:Uint8Array,caps:MissionAudioLimits): Map<string, AudioIniSection> {
  // Deliberately bounded ASCII-compatible subset; BOM and native duplicate-key CRC behavior are not guessed.
  if (bytes[0]===0xff || bytes[0]===0xfe || bytes[0]===0xef || bytes.includes(0)) audioFail('ini-encoding');
  const chunks:string[]=[];for(let at=0;at<bytes.length;at+=4096)chunks.push(String.fromCharCode(...bytes.subarray(at,at+4096)));
  const lines=chunks.join('').split(/\r\n|\n|\r/);
  if (lines.length>caps.sourceLines) audioFail('line-limit');
  const sections=new Map<string,{name:string;fields:MissionAudioField[];duplicate:boolean}>(),keys=new Map<string,Set<number>>(),sectionCrcs=new Map<number,string>(); let current: ReturnType<typeof sections.get>;
  for (let i=0;i<lines.length;i++) {
    if (lines[i]!.length>4096) audioFail('line-limit');
    const line=audioTrim(lines[i]!.split(';',1)[0]!); if (!line) continue;
    if (line.startsWith('[')) {
      const m=/^\[([^\]\x00-\x1f]{1,255})\]$/.exec(line); if (!m) { current=undefined; continue; }
      const name=m[1]!; current=sections.get(name);
      if (current) current.duplicate=true; else {
        const crc=iniNameCrc(name),prior=sectionCrcs.get(crc);current={name,fields:[],duplicate:prior!==undefined};
        if(prior!==undefined)sections.get(prior)!.duplicate=true;
        sections.set(name,current);keys.set(name,new Set());sectionCrcs.set(crc,name);
      }
    } else if(current) {
      const at=line.indexOf('='); if(at<1) continue;
      const key=audioTrim(line.slice(0,at)),value=audioTrim(line.slice(at+1));
      if (key.length>255) audioFail('ini-key');
      const seen=keys.get(current.name)!,crc=iniNameCrc(key);if(seen.has(crc))current.duplicate=true;seen.add(crc);
      current.fields.push({key,value,line:i+1});
    }
  }
  return sections;
}
