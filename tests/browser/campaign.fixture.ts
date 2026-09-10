// SPDX-License-Identifier: GPL-3.0-or-later
// Original metadata fixtures; not a substitute for source preparation.
import {combatActorFingerprint} from '../../packages/content/src/combat-actor-values.ts';
import type {CampaignLaunchPlan} from '../../apps/web/src/campaign-protocol.ts';
import type {FrameResult,SceneSummary,Camera} from '../../apps/web/src/terrain-protocol.ts';
export function campaignPlan(profile:'ra2'|'yr'='ra2'):CampaignLaunchPlan{
 const entries=(['allied','soviet'] as const).map((id,i)=>({id,status:'ready' as const,reasons:[],title:i?'Original B':'原創 A',descriptionLabel:null,briefing:null,briefingLabel:null,missionPath:i?'beta.map':'alpha.map',missionSha256:(i?'b':'a').repeat(64),theater:'SNOW',theaterIniPath:profile==='ra2'?'snow.ini':'snowmd.ini',palettePath:'isosno.pal',cinematics:[]}));
 const body={policy:'webra2-native-campaign-starts-1' as const,profile,entries,omittedBattleEntries:3,languageId:9,pins:[],canCompleteCampaign:false as const,cinematicPlayback:false as const};return {...body,fingerprint:combatActorFingerprint(body,32768)};
}
export function campaignFrame(id:number,profile:'ra2'|'yr'='ra2',entry:'allied'|'soviet'='allied',width=120,height=45):FrameResult{
 const camera:Camera={cameraX:0,cameraY:0,zoom:1,width,height},bytes=width*height*4;
 const artwork={policy:'webra2-object-still-2' as const,presentation:'webra2-placed-still-1' as const,voxel:null,types:0,rendered:0,unavailable:0,assets:0,palettes:0,sourceBytes:0,decodedBytes:0,indexedFrames:0,rows:[],omittedTypes:0,omittedPlacements:0,omittedRendered:0,truncatedFields:0,unplaced:0};
 const summary:SceneSummary={world:null,contentHash:'c'.repeat(64),artwork,profile,mission:entry==='allied'?'alpha.map':'beta.map',mapHash:(entry==='allied'?'a':'b').repeat(64),paletteHash:'d'.repeat(64),cells:3,objects:0,assets:1,verifiedBytes:100,sourceBytes:100,decodedBytes:50,decodedSlots:1,bounds:{x:0,y:0,width:120,height:45},diagnostics:[]};
 return {type:'frame',controlPoints:[],world:null,frameId:id,camera,summary,allocations:{voxel:null,rgbaBytes:bytes,depthBytes:bytes,ownerBytes:bytes,totalPixelBytes:bytes*4,samples:1,objectOwnerBytes:bytes,spriteSamples:0,paletteBytes:0,objects:0},rgba:new ArrayBuffer(bytes)};
}
