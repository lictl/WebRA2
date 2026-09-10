// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {TEAM_FLASH_POLICY,teamFlashInstruction,assignTeamFlashes,advanceTeamFlashes,snapshotTeamFlashes} from '../../packages/sim/src/team-recruitment-flash.ts';
test('source Flash50 preserves exact bounded counters and rejects unknown or negative native wrapping',()=>{
 assert.equal(TEAM_FLASH_POLICY,'webra2-team-flash-counter-1');assert.deepEqual(teamFlashInstruction(50,70,2),{opcode:50,sourceSlot:2,duration:70});
 for(const n of [-1,-0,1.1,NaN,Infinity,1_000_000_001])assert.equal(teamFlashInstruction(50,n,0),null);
 assert.equal(teamFlashInstruction(11,0,0),null);assert.throws(()=>teamFlashInstruction(50,1,50));
});
test('flash assignment and decay preserve overwrite/zero bits beyond source instruction completion',()=>{
 const initial=assignTeamFlashes([], [1,4],4),before=structuredClone(initial);let s=initial;
 const bits=[];for(let i=0;i<6;i++){s=advanceTeamFlashes(s);bits.push([s[0]!.remaining,s[0]!.flashingNow]);assert.deepEqual(snapshotTeamFlashes(JSON.parse(JSON.stringify(s))),s);}
 assert.deepEqual(bits,[[3,true],[2,false],[1,true],[0,false],[0,false],[0,false]]);assert.deepEqual(initial,before);
 const odd=advanceTeamFlashes(initial),zero=assignTeamFlashes(odd,[1],0);assert.deepEqual(advanceTeamFlashes(zero)[0],{entityId:1,remaining:0,flashingNow:true});
 assert.deepEqual(assignTeamFlashes(zero,[1],2)[0],{entityId:1,remaining:2,flashingNow:true});assert.ok(Object.isFrozen(s)&&Object.isFrozen(s[0]));
});
test('flash state and membership are bounded strict snapshots with no getter execution or partial input mutation',()=>{
 let called=0;const bad={entityId:1,remaining:1,get flashingNow(){called++;return false;}};
 assert.throws(()=>advanceTeamFlashes([bad]));assert.equal(called,0);
 for(const input of [[{entityId:1,remaining:1,flashingNow:0}],[{entityId:1,remaining:-1,flashingNow:false}],Array(2049)])assert.throws(()=>snapshotTeamFlashes(input));
 const original=assignTeamFlashes([],[1],3),text=JSON.stringify(original);
 for(const ids of [[1,1],[2,1],[0],[1,-1],Array(2049)])assert.throws(()=>assignTeamFlashes(original,ids,1));
 assert.equal(JSON.stringify(original),text);
});
