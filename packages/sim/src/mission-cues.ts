// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original caller-driven cue cursor; see ../../content/MISSION_CUES_PROVENANCE.md.
import { isMissionCueCatalog, missionCueInstruction } from '../../content/src/mission-cues.ts';
import { cueFail, cueFreeze, cueInteger, cueList, cueRecord, cueText, type MissionCueCatalog, type MissionCuePayload } from '../../content/src/mission-cue-types.ts';
export const MISSION_CUE_CURSOR_POLICY = 'webra2-caller-cue-order-1' as const;
export const MISSION_CUE_CURSOR_LIMITS = Object.freeze({ invocations:1024, total:1_000_000, tick:1_000_000_000, payloadUnits:1_048_576 });
export interface MissionCueState { readonly policy:typeof MISSION_CUE_CURSOR_POLICY; readonly catalogSha256:string; readonly tick:number; readonly nextSequence:number }
export interface MissionCueEvent { readonly sequence:number; readonly tick:number; readonly catalogSha256:string; readonly missionSha256:string;
  readonly instructionId:string; readonly instanceId:string; readonly payload:MissionCuePayload; readonly playbackAuthorized:false }
export interface MissionCueAppendResult { readonly state:MissionCueState; readonly events:readonly MissionCueEvent[]; readonly sourceDispatchVerified:false }
const states = new WeakMap<object,MissionCueCatalog>();
function owned(catalog:MissionCueCatalog,tick:number,nextSequence:number):MissionCueState {
  const state=Object.freeze({policy:MISSION_CUE_CURSOR_POLICY,catalogSha256:catalog.sha256,tick,nextSequence});states.set(state,catalog);return state;
}
function check(catalog:MissionCueCatalog):void {if(!isMissionCueCatalog(catalog))cueFail('catalog-brand');}
export function createMissionCueState(catalog:MissionCueCatalog):MissionCueState {check(catalog);return owned(catalog,0,0);}
/** Restores only an explicit cursor. A structurally valid cursor does not establish historical trigger execution. */
export function restoreMissionCueState(catalog:MissionCueCatalog,input:unknown):MissionCueState {
  check(catalog);const r=cueRecord(input,['policy','catalogSha256','tick','nextSequence']);
  if(r.policy!==MISSION_CUE_CURSOR_POLICY||r.catalogSha256!==catalog.sha256)cueFail('cursor-identity');
  return owned(catalog,cueInteger(r.tick,MISSION_CUE_CURSOR_LIMITS.tick),cueInteger(r.nextSequence,MISSION_CUE_CURSOR_LIMITS.total));
}
/** Caller-driven atomic reference ordering only. This is neither source trigger dispatch nor a media-playback API. */
export function appendMissionCues(catalog:MissionCueCatalog,state:MissionCueState,input:{readonly tick:number;readonly invocations:readonly {readonly instructionId:string;readonly instanceId:string}[]}):MissionCueAppendResult {
  check(catalog);if(states.get(state)!==catalog)cueFail('cursor-brand');
  const r=cueRecord(input,['tick','invocations']),tick=cueInteger(r.tick,MISSION_CUE_CURSOR_LIMITS.tick,state.tick);
  const rows=cueList(r.invocations,MISSION_CUE_CURSOR_LIMITS.invocations).map(v=>{
    const s=cueRecord(v,['instructionId','instanceId']);return {instructionId:cueText(s.instructionId),instanceId:cueText(s.instanceId,255)};
  });
  if(rows.length>MISSION_CUE_CURSOR_LIMITS.total-state.nextSequence)cueFail('cursor-total');
  let units=0;
  // Preflight the whole batch before allocating events or publishing a new cursor.
  const selected=rows.map(r=>{
    const instruction=missionCueInstruction(catalog,r.instructionId);
    if(!instruction||instruction.status!=='resolved-reference'||!instruction.payload)cueFail('unsupported-invocation');
    if(instruction.payload.kind==='text')units+=instruction.payload.text.length;
    if(units>MISSION_CUE_CURSOR_LIMITS.payloadUnits)cueFail('cursor-payload-limit');
    return {...r,payload:instruction.payload};
  });
  const events=selected.map((r,ordinal)=>({sequence:state.nextSequence+ordinal,tick,catalogSha256:catalog.sha256,missionSha256:catalog.source.sha256,
    instructionId:r.instructionId,instanceId:r.instanceId,payload:r.payload,playbackAuthorized:false as const}));
  return cueFreeze({state:owned(catalog,tick,state.nextSequence+rows.length),events,sourceDispatchVerified:false as const});
}
