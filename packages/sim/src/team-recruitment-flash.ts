// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded source Flash50 policy; native update phase remains an explicit WebRA2 choice.
import {worldInteger,worldList,worldRecord} from './world-values.ts';
export const TEAM_FLASH_POLICY='webra2-team-flash-counter-1' as const;
export const TEAM_FLASH_LIMITS=Object.freeze({actors:2048,duration:1_000_000_000});
export interface TeamFlashInstruction {readonly opcode:50;readonly sourceSlot:number;readonly duration:number}
export interface TeamFlashState {readonly entityId:number;readonly remaining:number;readonly flashingNow:boolean}
/** Exact signed numeric framing comes from the genuine source compiler; negative native wrap is unsupported. */
export function teamFlashInstruction(opcode:number|null,argument:number|null,sourceSlot:number):TeamFlashInstruction|null{
 if(opcode!==50||argument===null||!Number.isSafeInteger(argument)||Object.is(argument,-0)||argument<0||argument>TEAM_FLASH_LIMITS.duration)return null;
 return Object.freeze({opcode:50,sourceSlot:worldInteger(sourceSlot,0,49),duration:argument});
}
function states(input:unknown):TeamFlashState[]{
 let prior=0;return worldList(input,TEAM_FLASH_LIMITS.actors).map(value=>{
  const r=worldRecord(value,['entityId','remaining','flashingNow']),entityId=worldInteger(r.entityId,1,2147483647);
  if(entityId<=prior||typeof r.flashingNow!=='boolean')throw new Error('team-flash-state');prior=entityId;
  return {entityId,remaining:worldInteger(r.remaining,0,TEAM_FLASH_LIMITS.duration),flashingNow:r.flashingNow};
 });
}
const freeze=(s:TeamFlashState[])=>Object.freeze(s.map(value=>Object.freeze(value)));
/** One authoritative update: an already-zero counter preserves its bit, matching the observed native path. */
export function advanceTeamFlashes(input:unknown):readonly TeamFlashState[]{
 return freeze(states(input).map(s=>s.remaining===0?s:{...s,remaining:s.remaining-1,flashingNow:(s.remaining-1)%2===1}));
}
/** First-entry script assignment overwrites the counter only, including zero; it does not toggle the bit. */
export function assignTeamFlashes(input:unknown,actorIds:readonly number[],duration:number):readonly TeamFlashState[]{
 const count=worldInteger(duration,0,TEAM_FLASH_LIMITS.duration),out=states(input),byId=new Map(out.map(s=>[s.entityId,s]));
 const ids=worldList(actorIds,TEAM_FLASH_LIMITS.actors);let prior=0;
 for(const value of ids){const entityId=worldInteger(value,1,2147483647);if(entityId<=prior)throw new Error('team-flash-order');prior=entityId;
  const old=byId.get(entityId);if(!old&&byId.size>=TEAM_FLASH_LIMITS.actors)throw new Error('team-flash-limit');
  byId.set(entityId,{entityId,remaining:count,flashingNow:old?.flashingNow??false});}
 return freeze([...byId.values()].sort((a,b)=>a.entityId-b.entityId));
}
/** A detached validated snapshot; consumers must retain both values rather than infer the bit from remaining. */
export function snapshotTeamFlashes(input:unknown):readonly TeamFlashState[]{return freeze(states(input));}
