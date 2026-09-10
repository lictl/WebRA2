// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Metadata-only private application protocol.
import type { CampaignFaction, CampaignLaunchPlan } from '../../../packages/content/src/campaign-launch.ts';
import { combatActorFingerprint } from '../../../packages/content/src/combat-actor-values.ts';
import { shape,rows,int,hash,profileId,dimensions,VIEW_LIMIT,type SelectedTerrainFile,type TerrainProfile } from './terrain-protocol.ts';
export type { CampaignFaction,CampaignLaunchPlan };
export type CampaignAction={type:'campaign-scan';profile:TerrainProfile;files:SelectedTerrainFile[]}|{type:'campaign-launch';fingerprint:string;entryId:CampaignFaction;width:number;height:number}|{type:'campaign-back';fingerprint:string};
export type CampaignResult={type:'campaign-plan';plan:CampaignLaunchPlan};
export const faction=(v:unknown):v is CampaignFaction=>v==='allied'||v==='soviet';
export const campaignPath=(v:unknown):v is string=>typeof v==='string'&&/^[a-z0-9][a-z0-9_.-]{0,127}\.(?:map|mpr)$/.test(v);
const assetPath=(v:unknown,extension:'ini'|'pal')=>typeof v==='string'&&new RegExp(`^[a-z0-9][a-z0-9_.-]{0,127}\\.${extension}$`).test(v);
export function validCampaignAction(v:unknown):v is CampaignAction{
  if(shape(v,['type','profile','files'])&&v.type==='campaign-scan')return profileId(v.profile)&&rows(v.files,VIEW_LIMIT.files)&&v.files.length>0&&v.files.every(f=>shape(f,['file','relativePath'])&&f.file instanceof File&&typeof f.relativePath==='string'&&f.relativePath.length<=VIEW_LIMIT.path&&f.file.name.length<=VIEW_LIMIT.path);
  if(shape(v,['type','fingerprint','entryId','width','height'])&&v.type==='campaign-launch')return hash(v.fingerprint)&&faction(v.entryId)&&dimensions(v.width,v.height);
  return shape(v,['type','fingerprint'])&&v.type==='campaign-back'&&hash(v.fingerprint);
}
const boundedText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const nullableText=(v:unknown,max:number)=>v===null||boundedText(v,max);
/** Reject extra properties, sparse arrays, boxed strings and oversized nested rows before UI rendering. */
export function validCampaignResult(v:unknown):v is CampaignResult{
  if(!shape(v,['type','plan'])||v.type!=='campaign-plan')return false;const p=v.plan;
  if(!shape(p,['policy','profile','fingerprint','entries','omittedBattleEntries','languageId','pins','canCompleteCampaign','cinematicPlayback'])||p.policy!=='webra2-native-campaign-starts-1'||!profileId(p.profile)||!hash(p.fingerprint)||p.canCompleteCampaign!==false||p.cinematicPlayback!==false||!int(p.omittedBattleEntries,0,200000)||!(p.languageId===null||int(p.languageId,0,0xffffffff))||!rows(p.entries,2)||p.entries.length!==2||!rows(p.pins,16))return false;
  for(let i=0;i<2;i++){
    const e=p.entries[i];if(!shape(e,['id','status','reasons','title','descriptionLabel','briefing','briefingLabel','missionPath','missionSha256','theater','theaterIniPath','palettePath','cinematics'])||e.id!==(i?'soviet':'allied')||!['ready','unavailable'].some(x=>x===e.status)||!rows(e.reasons,16)||!e.reasons.every(r=>typeof r==='string'&&/^[A-Za-z][A-Za-z0-9:._-]{0,255}$/.test(r))||!nullableText(e.title,8192)||!nullableText(e.briefing,8192)||!nullableText(e.descriptionLabel,512)||!nullableText(e.briefingLabel,512)||!(e.missionPath===null||campaignPath(e.missionPath))||!(e.missionSha256===null||hash(e.missionSha256))||!nullableText(e.theater,16)||!(e.theaterIniPath===null||assetPath(e.theaterIniPath,'ini'))||!(e.palettePath===null||assetPath(e.palettePath,'pal'))||!rows(e.cinematics,8)||!e.cinematics.every(m=>shape(m,['field','reference'])&&['Intro','Brief','Win','Lose','Action','PostScore','PreMapSelect','FinalMovie'].some(k=>m.field===k)&&boundedText(m.reference,128)))return false;
    if(e.status==='ready'?(e.reasons.length!==0||!campaignPath(e.missionPath)||!hash(e.missionSha256)||!assetPath(e.theaterIniPath,'ini')||!assetPath(e.palettePath,'pal')||!e.theater):!e.reasons.length)return false;
  }
  let prior='';for(const pin of p.pins){if(!shape(pin,['path','sha256','size'])||typeof pin.path!=='string'||! /^[a-z0-9][a-z0-9_.-]{0,131}$/.test(pin.path)||pin.path<=prior||!hash(pin.sha256)||!int(pin.size,0,16*1024**2))return false;prior=pin.path;}
  try{const {fingerprint,...body}=p;if(JSON.stringify(body).length>32768)return false;return combatActorFingerprint(body,32768)===fingerprint;}catch{return false;}
}
