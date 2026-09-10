// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Bounded catalog composition, based on installation-profile.ts.
import type { ProfileId } from '../../contracts/src/index.ts';
import { BROWSER_CATALOG_POLICY, type BrowserCatalog, type BrowserAssetCandidate } from '../../vfs/src/browser-catalog.ts';
import type { BrowserImportArchive } from '../../vfs/src/browser-types.ts';
import type { BrowserMemberIdentity } from '../../vfs/src/browser-verified.ts';
import { hashByteSource } from '../../vfs/src/hash-source.ts';
import { normalizeAssetPath } from '../../vfs/src/profile.ts';
import { throwIfImportAborted } from '../../vfs/src/browser-source.ts';

export const CAMPAIGN_SOURCE_LIMITS = Object.freeze({ paths: 32, candidates: 256, memberBytes: 16 * 1024 ** 2,
  candidateBytes: 64 * 1024 ** 2, rootBytes: 1024 ** 3 });
export type CampaignSourceStatus = 'resolved'|'missing'|'blocked'|'name-collision'|'unsupported-mount'|'content-conflict';
export interface CampaignSourceFile { readonly path:string; readonly identity:BrowserMemberIdentity; readonly bytes:Uint8Array }
export interface CampaignSourceResult { readonly path:string; readonly status:CampaignSourceStatus; readonly file:CampaignSourceFile|null }
export class CampaignLaunchError extends Error { constructor(readonly code:string){super(code);this.name='CampaignLaunchError';} }
function fail(code:string):never {throw new CampaignLaunchError(code);}
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
// Same explicit standard-definition mount policy as installation-profile.ts. This
// is WebRA2 policy, not a newly inferred native archive precedence claim.
function rank(c:BrowserAssetCandidate,profile:ProfileId,archives:ReadonlyMap<string,BrowserImportArchive>):number|null{
  if(c.kind==='literal')return 200;
  let a=archives.get(c.archiveId!);const seen=new Set<string>();
  while(a?.parentId!==null){if(!a||seen.has(a.id))return fail('campaign-archive');seen.add(a.id);
    if(a.nameCandidates.length!==1||!/^(?:local|localmd|cache|cachemd|language|langmd)\.mix$/.test(a.nameCandidates[0]!))return null;
    a=archives.get(a.parentId);
  }
  if(!a)return fail('campaign-archive');
  const expansion=(profile==='ra2'?/^expand(\d{2})\.mix$/:/^expandmd(\d{2})\.mix$/).exec(c.rootPath);
  if(expansion)return 1+Number(expansion[1]);
  return (profile==='ra2'?/^(?:ra2|language|local|cache|maps\d{2})\.mix$/:/^(?:ra2|ra2md|language|langmd|local|localmd|cache|cachemd|maps\d{2}|mapsmd\d{2})\.mix$/).test(c.rootPath)?0:null;
}
/** Per-scan bounded reader. Caller owns the catalog, which stays private in its worker. */
export function createCampaignSourceReader(catalog:BrowserCatalog,profile:ProfileId,signal?:AbortSignal){
  if(catalog.policy!==BROWSER_CATALOG_POLICY||catalog.report.profile!==profile||catalog.report.status!=='inspected')fail('campaign-catalog');
  const roots=new Map(catalog.report.files.map(f=>[f.id,f]));const archives=new Map(catalog.report.archives.map(a=>[a.id,a]));
  const cache=new Map<string,CampaignSourceResult>(),seenCandidates=new Map<string,string>(),seenRoots=new Set<string>();
  let candidateCount=0,candidateBytes=0,rootBytes=0,busy=false;
  return Object.freeze({async read(rawPath:string):Promise<CampaignSourceResult>{
    if(busy)fail('campaign-source-busy');busy=true;
    try{
      throwIfImportAborted(signal);const path=normalizeAssetPath(rawPath);const old=cache.get(path);if(old)return old;
      if(cache.size>=CAMPAIGN_SOURCE_LIMITS.paths)fail('campaign-path-limit');
      const lookup=catalog.lookup(path);if(lookup.candidates.length>CAMPAIGN_SOURCE_LIMITS.candidates-candidateCount)fail('campaign-candidate-limit');
      candidateCount+=lookup.candidates.length;
      const candidates=lookup.candidates.map(c=>Object.freeze({...c,knownNames:Object.freeze([...c.knownNames])}));
      const priorities=candidates.map(c=>rank(c,profile,archives));
      const finish=(status:CampaignSourceStatus,file:CampaignSourceFile|null=null)=>{const r=Object.freeze({path,status,file});cache.set(path,r);return r;};
      if(!candidates.length)return finish('missing');
      if(candidates.some(c=>!c.allowed))return finish('blocked');
      if(candidates.some(c=>c.ambiguousName||(c.knownNames.length&&!c.knownNames.includes(path))||(seenCandidates.has(c.id)&&seenCandidates.get(c.id)!==path)))return finish('name-collision');
      if(priorities.includes(null))return finish('unsupported-mount');
      for(const c of candidates){
        if(!Number.isSafeInteger(c.size)||c.size<0||c.size>CAMPAIGN_SOURCE_LIMITS.memberBytes||c.size>CAMPAIGN_SOURCE_LIMITS.candidateBytes-candidateBytes)fail('campaign-byte-limit');
        candidateBytes+=c.size;seenCandidates.set(c.id,path);
        if(!seenRoots.has(c.sourceId)){const root=roots.get(c.sourceId);if(!root||root.size>CAMPAIGN_SOURCE_LIMITS.rootBytes-rootBytes)fail('campaign-root-limit');rootBytes+=root.size;seenRoots.add(c.sourceId);}
      }
      const contenders: {candidate:BrowserAssetCandidate;file:CampaignSourceFile;priority:number}[]=[];
      for(let i=0;i<candidates.length;i++){
        const c=candidates[i]!;throwIfImportAborted(signal);const result=await catalog.discover(c.id);throwIfImportAborted(signal);
        const r=result.identity,identity=Object.freeze({root:Object.freeze({sourceId:r.root.sourceId,size:r.root.size,sha256:r.root.sha256}),absoluteOffset:r.absoluteOffset,size:r.size,sha256:r.sha256});
        if(identity.root.sourceId!==c.sourceId||identity.root.size!==roots.get(c.sourceId)!.size||identity.absoluteOffset!==c.absoluteOffset||identity.size!==c.size||!/^[a-f0-9]{64}$/.test(identity.root.sha256)||!/^[a-f0-9]{64}$/.test(identity.sha256))fail('campaign-source-identity');
        if(!(result.bytes instanceof Uint8Array)||result.bytes.byteLength!==c.size||(typeof SharedArrayBuffer!=='undefined'&&result.bytes.buffer instanceof SharedArrayBuffer))fail('campaign-source-bytes');
        const bytes=new Uint8Array(result.bytes),digest=await hashByteSource({size:bytes.length,async read(o,n){return bytes.subarray(o,o+n);}},{...(signal?{signal}:{})});throwIfImportAborted(signal);
        if(digest.hex!==identity.sha256)fail('campaign-source-hash');
        contenders.push({candidate:c,file:Object.freeze({path,identity,bytes}),priority:priorities[i]!});
      }
      const highest=Math.max(...priorities as number[]),top=contenders.filter(c=>c.priority===highest);
      if(new Set(top.map(c=>c.file.identity.size+':'+c.file.identity.sha256)).size!==1)return finish('content-conflict');
      top.sort((a,b)=>compare(a.candidate.rootPath,b.candidate.rootPath)||a.candidate.absoluteOffset-b.candidate.absoluteOffset||compare(a.candidate.id,b.candidate.id));
      return finish('resolved',top[0]!.file);
    }finally{busy=false;}
  },clear(){if(busy)fail('campaign-source-busy');cache.clear();}});
}
