// SPDX-License-Identifier: GPL-3.0-or-later
// Original222 geometry, with no retail/source authority or gameplay changes.
import {createNavigationGrid} from '../../packages/sim/src/navigation.ts';
import {createWorldModel} from '../../packages/sim/src/world-model.ts';
export function originalWorld(profile,count){
 if(!['ra2','yr'].includes(profile)||![64,256,1024].includes(count))throw Error('Invalid original world scale');
 const identity={profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
 const grid=createNavigationGrid({contentIdentity:identity,movementClass:'foot',cells:Array.from({length:128*256},(_,i)=>({x:i%128,y:Math.floor(i/128),cost:1,exits:255}))});
 const entities=Array.from({length:count},(_,i)=>({id:i+1,rowId:`units:${i}`,typeId:'unit:original',owner:0,kind:'unit',x:2+(i%8)*2,y:2+Math.floor(i/8)*2,initialHealth:100,maximumHealth:100,movementPerTick:128,navigationClass:'foot',blocksCell:true}));
 const model=createWorldModel({contentIdentity:identity,sourceSha256:'c'.repeat(64),definitionsSha256:'d'.repeat(64),entities,navigation:[{grid,costScale:1}],blocked:[]});
 return {model,movers:entities.filter((_,i)=>i%8===0).slice(0,64).map(e=>({id:e.id,y:e.y}))};
}
