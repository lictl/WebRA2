// SPDX-License-Identifier: GPL-3.0-or-later
// Original source fixtures; no retail mission data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {missionBindingsFixture} from './mission-bindings-fixture.ts';
import {compileMissionBindings, prepareMissionBindings, isMissionBindingAuthority, isMissionBindingCatalog,
  type MissionBindingsInput} from '../../packages/sim/src/mission-bindings.ts';
import {missionEventAttachmentFlags,missionActionAttachmentFlags} from '../../packages/sim/src/mission-binding-flags.ts';
import {MissionLogic} from '../../packages/sim/src/mission-logic.ts';
const rows=(tag='Shared')=>`0=Commander,Walker,256,2,2,0,Guard,0,${tag}\n1=Commander,Walker,256,2,3,0,Guard,0,${tag}`;
function corpus({profile='yr' as 'ra2'|'yr',triggers='Start=Blue,<none>,Start,0,1,1,1,0', tags='Shared=0,Sharing,Start',events='Start=1,8,0,0',actions='Start=1,28,0,1,0,0,0,0,A',cells='',infantry=rows(),extra='',extraRules=''}={}){
  const f=missionBindingsFixture({profile,infantryRows:infantry,extraRules,extraMap:`[Triggers]\n${triggers}\n[Tags]\n${tags}\n[Events]\n${events}\n[Actions]\n${actions}\n[CellTags]\n${cells}\n${extra}`});
  return {world:f.world,definitions:f.definitions,rules:f.rules,mission:f.mission,difficulty:1 as const};
}
const create=(authority:NonNullable<Awaited<ReturnType<typeof prepareMissionBindings>>['authority']>)=>MissionLogic.create(authority.program,{bindings:authority.bindings,globals:Array(50).fill(false),locals:Array(100).fill(false)});

test('one shared tag owns object/cell references and separate list memberships in both profiles',async()=>{
  for(const profile of ['ra2','yr'] as const){
    const input=corpus({profile,cells:'3003=Shared\n2004=Shared'}),catalog=compileMissionBindings(input),prepared=await prepareMissionBindings(catalog);
    assert.deepEqual(catalog.diagnostics,[]);assert.ok(prepared.authority);assert.ok(isMissionBindingCatalog(catalog));assert.ok(isMissionBindingAuthority(prepared.authority));
    const tag=catalog.tags[0]!;assert.equal(tag.flags,31);assert.equal(tag.initialReferenceCount,4);assert.equal(tag.dispatchAttachmentIds.length,7);
    assert.deepEqual(tag.memberships,{map:true,scenario:true,houseId:'houses:0'});assert.deepEqual(tag.defaultCell,{x:4,y:2});
    assert.deepEqual(tag.objectEntityIds,[1,2]);assert.deepEqual(tag.cellIds,['cell:3003','cell:2004']);assert.equal(prepared.authority.bindings.length,1);
    const sim=create(prepared.authority);assert.equal(sim.step().effects.length,1);assert.equal(sim.save().globals[1],true);assert.equal(sim.step(3).effects.length,0);
    assert.equal(catalog.canStartCampaign,false);assert.equal(prepared.authority.initialFlagState,'external-authenticated-state-required');
    assert.equal(compileMissionBindings(input).fingerprint,catalog.fingerprint);assert.ok(Object.isFrozen(tag.objectEntityIds));
  }
});

test('chains reverse within each tag while sharing never merges different tag types',async()=>{
  const input=corpus({triggers:'Tail=Blue,<none>,Tail,0,1,1,1,0\nStart=Blue,Tail,Start,0,1,1,1,0',
    tags:'Shared=0,Sharing,Start\nOther=0,Other,Tail',events:'Start=1,8,0,0\nTail=1,8,0,0',actions:'Start=1,28,0,1,0,0,0,0,A\nTail=1,28,0,2,0,0,0,0,A'});
  const c=compileMissionBindings(input),p=await prepareMissionBindings(c);assert.deepEqual(c.diagnostics,[]);assert.ok(p.authority);
  assert.deepEqual(c.tags[0]!.declaredChain,['trigger:start','trigger:tail']);assert.deepEqual(c.tags[0]!.runtimeChain,['trigger:tail','trigger:start']);
  const sim=create(p.authority),effects=sim.step().effects;
  assert.deepEqual(effects.map(e=>[e.bindingId,e.triggerId]),[['binding:tag:other','trigger:tail'],['binding:tag:shared','trigger:tail'],['binding:tag:shared','trigger:start']]);
});

test('difficulty and disabled flags suppress execution but preserve native allocation candidates',async()=>{
  for(const variant of ['Start=Blue,<none>,Start,1,1,1,1,0','Start=Blue,<none>,Start,0,1,0,1,0']){
    const c=compileMissionBindings(corpus({triggers:variant})),p=await prepareMissionBindings(c);assert.ok(p.authority);
    assert.equal(c.triggers[0]!.initiallyEnabled,false);assert.equal(c.tags[0]!.allocated,true);assert.equal(create(p.authority).step(3).effects.length,0);
  }
});

test('repeat source retains a single shared latch/timer across every-tick save restoration',async()=>{
  const c=compileMissionBindings(corpus({tags:'Shared=2,Sharing,Start',events:'Start=1,13,0,1'})),p=await prepareMissionBindings(c);assert.ok(p.authority);
  const sim=create(p.authority);let effects=0;
  for(let tick=0;tick<47;tick++){const restored=MissionLogic.restore(p.authority.program,sim.save());assert.deepEqual(restored.step(),sim.step());assert.deepEqual(restored.save(),sim.save());effects+=sim.save().bindings[0]!.triggers[0]!.fired===Math.floor(tick/15)?0:1;}
  assert.equal(sim.save().bindings[0]!.triggers[0]!.fired,3);assert.equal(sim.save().nextTick,47);assert.equal(effects,0);
});

test('first declaration ID-or-name lookup differs from cell ID-only lookup',async()=>{
  const c=compileMissionBindings(corpus({tags:'First=0,Shared,Start\nShared=0,Second,Start',cells:'3003=Shared'}));
  assert.deepEqual(c.objects.map(o=>[o.tagId,o.resolution]),[['tag:first','name'],['tag:first','name']]);assert.equal(c.cells[0]!.tagId,'tag:shared');
  const alias=compileMissionBindings(corpus({cells:'3003=Sharing'}));assert.equal(alias.cells[0]!.resolution,'unsupported');assert.equal((await prepareMissionBindings(alias)).authority,null);
});

test('country selectors are source countries and first matching houses, not literal actor owners',async()=>{
  for(const [owner,country,resolution] of [['<none>','country:blue','none-first-country'],['Blue','country:blue','named'],['Red','country:red','named']] as const){
    const c=compileMissionBindings(corpus({triggers:`Start=${owner},<none>,Start,0,1,1,1,0`}));assert.equal(c.triggers[0]!.countryId,country);assert.equal(c.triggers[0]!.countryResolution,resolution);
    assert.equal(c.triggers[0]!.initialHouseListId,owner==='Red'?'houses:1':'houses:0');
  }
  const c=compileMissionBindings(corpus({triggers:'Start=Commander,<none>,Start,0,1,1,1,0'}));assert.equal(c.triggers[0]!.countryId,null);assert.equal((await prepareMissionBindings(c)).authority,null);
});

test('unattached triggers do not acquire invented global bindings, flags-only tags may allocate',async()=>{
  const c=compileMissionBindings(corpus({tags:'',infantry:rows('None')})),p=await prepareMissionBindings(c);assert.ok(p.authority);assert.deepEqual(p.authority.bindings,[]);assert.equal(create(p.authority).step().effects.length,0);
  const dormant=compileMissionBindings(corpus({events:'Start=1,0,0,0',infantry:rows('None')}));assert.equal(dormant.tags[0]!.allocated,false);
  const scenario=compileMissionBindings(corpus({events:'Start=1,13,0,1',infantry:rows('None')}));assert.equal(scenario.tags[0]!.allocated,true);assert.equal(scenario.tags[0]!.initialReferenceCount,0);assert.deepEqual(scenario.tags[0]!.dispatchAttachmentIds,['scenario-list:tag:shared']);
});

test('whole-program unknown closure stays closed for disabled, dormant, malformed and foreign references',async()=>{
  const variants=[{events:'Start=1,999,0,0',triggers:'Start=Blue,<none>,Start,1,1,1,1,0'},
    {tags:'Shared=1,Sharing,Start'},{triggers:'Start=Blue,Absent,Start,0,1,1,1,0'},
    {tags:'Shared=0,Sharing,Absent'},{triggers:'Start=Blue,Start,Start,0,1,1,1,0'},
    {triggers:'Start=Blue,<none>,Start,2,1,1,1,0'},{triggers:'Start= Blue,<none>,Start,0,1,1,1,0'},
    {tags:'Shared=0, Sharing,Start'},{triggers:'Start=Blue,,Start,0,1,1,1,0'},{triggers:'Start=Blue,<none>,Start,0,1,1,1,1'},
    {infantry:rows('Absent')},{infantry:rows(' Shared')},{cells:'3003=Absent'},{cells:'3003=Shared\n03003=Shared'},
    {extra:'[Tags]\nOther=0,Other,Start'},{extra:'[tags]\nOther=0,Other,Start'},
    {triggers:'Start=Blue,<none>,Start,0,1,1,1,0\nHidden=Blue,<none>,Hidden,1,1,1,1,0',events:'Start=1,8,0,0\nHidden=1,999,0,0',actions:'Start=0\nHidden=0'}];
  for(const variant of variants){const c=compileMissionBindings(corpus(variant)),p=await prepareMissionBindings(c);assert.equal(p.authority,null,JSON.stringify(variant));assert.ok(p.diagnostics.length);}
});

test('genuine source/world/definition joins and descriptor boundaries reject forged or mutated inputs',async()=>{
  const input=corpus(),c=compileMissionBindings(input);assert.equal(isMissionBindingCatalog({...c}),false);assert.equal(isMissionBindingAuthority({}),false);
  await assert.rejects(prepareMissionBindings({...c}),/catalog/);
  const foreign=corpus({profile:'ra2'});assert.throws(()=>compileMissionBindings({...input,world:foreign.world}),/source-join/);
  assert.throws(()=>compileMissionBindings({...input,definitions:{...input.definitions}}),/factory/);
  const bytes=input.mission.bytes.slice();bytes[0]=bytes[0]!^1;assert.throws(()=>compileMissionBindings({...input,mission:{...input.mission,bytes}}),/map-hash/);
  let invoked=false;const accessor=Object.defineProperty({...input},'difficulty',{get(){invoked=true;return 1;}});assert.throws(()=>compileMissionBindings(accessor),/record/);assert.equal(invoked,false);
  assert.throws(()=>compileMissionBindings({...input,difficulty:-0 as 0}),/difficulty/);
  const source=input.mission.source;assert.equal(compileMissionBindings({...input,mission:{bytes:input.mission.bytes,source:{sha256:source.sha256,profile:source.profile,id:source.id}}}).fingerprint,c.fingerprint);
});

test('limits fail before binding expansion and do not mutate source factories',()=>{
  const input=corpus({cells:'3003=Shared'}),c=compileMissionBindings(input);
  for(const cap of [{bytes:1},{work:0},{actors:1},{tags:0},{triggers:0},{cells:0},{chainLinks:0},{references:0},{serializedBytes:1}])assert.throws(()=>compileMissionBindings(input,cap));
  assert.throws(()=>compileMissionBindings(input,{work:Infinity}));assert.throws(()=>compileMissionBindings(input,{constructor:3} as never));
  assert.equal(compileMissionBindings(input).fingerprint,c.fingerprint);assert.equal(input.world.model.entities.length,2);
});

test('native classification tables are profile-specific flags, never opcode execution admission',()=>{
  assert.equal(missionEventAttachmentFlags('ra2',8),31);assert.equal(missionEventAttachmentFlags('yr',8),31);
  assert.equal(missionEventAttachmentFlags('ra2',59),0);assert.equal(missionEventAttachmentFlags('yr',59),1);
  assert.equal(missionEventAttachmentFlags('ra2',58),0);assert.equal(missionEventAttachmentFlags('yr',58),8);
  assert.equal(missionEventAttachmentFlags('yr',60),16);assert.equal(missionEventAttachmentFlags('ra2',60),0);
  assert.equal(missionActionAttachmentFlags(91),2);assert.equal(missionActionAttachmentFlags(999),0);
  assert.throws(()=>missionEventAttachmentFlags('ra2',-1));assert.throws(()=>missionActionAttachmentFlags(-0));
});

test('RA2 source authority cannot use the generic VM upper local slots',async()=>{
  for(const profile of ['ra2','yr'] as const)for(const opcode of [36,37,56,57]){
    const input=corpus({profile,...(opcode<50?{events:`Start=1,${opcode},0,50`}:{actions:`Start=1,${opcode},0,50,0,0,0,0,A`})});
    const c=compileMissionBindings(input),p=await prepareMissionBindings(c);
    assert.equal(c.diagnostics.some(d=>d.code==='ra2-native-local-index'),profile==='ra2');
    assert.equal(p.authority!==null,profile==='yr');
  }
  const p=await prepareMissionBindings(compileMissionBindings(corpus({profile:'ra2',events:'Start=1,36,0,49',actions:'Start=1,56,0,49,0,0,0,0,A'})));assert.ok(p.authority);
});

test('country Name alias competes with ID in native allocation order',()=>{
  const c=compileMissionBindings(corpus({extraRules:'[Blue]\nName=Alias\n[Red]\nName=Blue',triggers:'Start=Alias,<none>,Start,0,1,1,1,0'}));
  assert.deepEqual(c.diagnostics,[]);assert.equal(c.triggers[0]!.countryId,'country:blue');assert.equal(c.triggers[0]!.initialHouseListId,'houses:0');
});

test('preparation reports shared-instance and dispatch capacity without dropping source tags',async()=>{
  const input=corpus({infantry:rows('None'),events:'Start=1,13,0,1',tags:Array.from({length:257},(_,i)=>`Tag${i}=0,Name${i},Start`).join('\n')});
  const c=compileMissionBindings(input),p=await prepareMissionBindings(c);assert.equal(c.tags.length,257);assert.equal(c.identityComplete,true);assert.equal(c.coverage.allocatedTags,257);
  assert.ok(p.compilation?.program);assert.equal(p.authority,null);assert.ok(p.diagnostics.includes('vm:binding-capacity'));
});
