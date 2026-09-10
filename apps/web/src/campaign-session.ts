// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Worker-private catalog and genuine plan ownership.
import { inspectBrowserCatalog } from '../../../packages/vfs/src/browser-catalog.ts';
import { prepareCampaignLaunches, campaignMissionRequest, type CampaignFaction, type CampaignLaunchPlan } from '../../../packages/content/src/campaign-launch.ts';
import { loadCatalogMission } from './terrain-scene-loader.ts';
import type { SceneLoader } from './terrain-worker-runtime.ts';
import type { TerrainProfile, TerrainProgress } from './terrain-protocol.ts';
export interface CampaignSession { readonly plan:CampaignLaunchPlan;load(fingerprint:string,id:CampaignFaction,progress:(p:TerrainProgress)=>void):ReturnType<SceneLoader>;dispose():void }
export type CampaignSessionFactory=(files:File[],profile:TerrainProfile,progress:(p:TerrainProgress)=>void)=>Promise<CampaignSession>;
export const createCampaignSession:CampaignSessionFactory=async(files,profile,onProgress)=>{
  let bytes=0,live=true,busy=false,progress=onProgress;
  const catalog=await inspectBrowserCatalog(files,{profile,policy:'tolerant',onProgress(p){progress({phase:'scan',completed:p.filesProcessed,total:p.totalFiles,bytes:p.bytesRead});},onVerifiedProgress(p){bytes=p.sessionBytesRead;progress({phase:'verify',completed:p.bytesRead,total:p.totalBytes,bytes});}});
  try{
    const plan=await prepareCampaignLaunches(catalog,{profile},{onProgress(_path,completed){progress({phase:'definitions',completed,total:32,bytes});}});
    return Object.freeze({plan,async load(fingerprint:string,id:CampaignFaction,onLoadProgress:(p:TerrainProgress)=>void){
      if(!live||busy)throw new Error('campaign-unavailable');const request=campaignMissionRequest(plan,fingerprint,id);busy=true;progress=onLoadProgress;
      try{return await loadCatalogMission(catalog,request,progress,()=>bytes);}finally{busy=false;progress=()=>{};}
    },dispose(){if(!live)return;live=false;progress=()=>{};catalog.dispose();}});
  }catch(error){catalog.dispose();throw error;}
};
